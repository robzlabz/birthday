# Technical Design Document: Birthday Notification Service

**Date:** 2026-01-04
**Author:** Robbyn Rahmandaru
**Status:** Proposed
**Stack:** TypeScript, Hono, Cloudflare Workers, Drizzle ORM, D1 Database, Cloudflare Queues.

---

## 1. Introduction

### 1.1 Purpose

Tujuan dari dokumen ini adalah merancang arsitektur layanan backend untuk mengirimkan ucapan ulang tahun kepada pengguna tepat pada pukul 09:00 waktu lokal mereka. Sistem harus dapat menangani ribuan hingga jutaan pengguna, tahan terhadap kegagalan server (downtime recovery), dan mencegah pengiriman ganda (race conditions).

### 1.2 Scope

* REST API untuk manajemen user (Create, Update, Delete).
* Penjadwalan otomatis berbasis Timezone.
* Integrasi dengan Email Service pihak ketiga.
* Mekanisme Recovery dan Scalability.

---

## 2. System Architecture

Sistem menggunakan pendekatan **Clean Architecture** (Separation of Concerns) yang dijalankan di atas infrastruktur Serverless (Cloudflare Workers) dengan pola **Producer-Consumer**.

### 2.1 High-Level Design

1. **API Layer (Hono):** Menangani request HTTP dari client (CRUD User).
2. **Service Layer:** Berisi logika bisnis (perhitungan waktu, validasi).
3. **Data Layer (Repository):** Abstraksi ke database D1 menggunakan Drizzle ORM.
4. **Worker Layer (Async Processing):**
   * **Producer (Cron):** Berjalan **setiap jam** menggunakan Cloudflare Cron Triggers untuk mencari event yang jadwalnya sudah tiba.
   * **Consumer (Queue Worker):** Memproses pengiriman email secara paralel menggunakan **Cloudflare Queues**.

---

## 3. Database Design (Schema)

Menggunakan **Cloudflare D1 (SQLite)** dengan **Drizzle ORM**. Model data dirancang fleksibel (Generic Events) agar dapat menangani berbagai jenis perayaan (Birthday, Anniversary, dll) tanpa perlu mengubah schema database.

### 3.1 Table: `users`

Menyimpan data profil pengguna.

| Column | Type | Description |
| --- | --- | --- |
| `id` | TEXT (UUID) | Primary Key. |
| `email` | TEXT | Email user. |
| `first_name` | TEXT | Nama depan user. |
| `last_name` | TEXT | Nama belakang user. |
| `location` | TEXT | IANA Timezone (e.g., 'Asia/Jakarta'). |

### 3.2 Table: `events`

Menyimpan jadwal notifikasi untuk user tertentu. Tabel ini menjawab kebutuhan untuk tidak menambah kolom baru saat ada tipe event baru (e.g., Anniversary).

| Column | Type | Description |
| --- | --- | --- |
| `id` | TEXT (UUID) | Primary Key. |
| `user_id` | TEXT | Foreign Key ke users.id. |
| `type` | TEXT | Tipe event (e.g., 'BIRTHDAY', 'WORK_ANNIVERSARY'). |
| `date` | TEXT | Tanggal dasar event (format YYYY-MM-DD). |
| `next_notify_at` | INTEGER | Timestamp (UTC) kapan notifikasi harus dikirim. **Indexed.** |
| `version` | INTEGER | Optimistic Locking untuk penjadwalan. |

### 3.3 Table: `notification_logs`

Menyimpan riwayat pengiriman untuk audit dan idempotency check.

| Column | Type | Description |
| --- | --- | --- |
| `id` | TEXT | Primary Key. |
| `user_id` | TEXT | Foreign Key ke users.id. |
| `type` | TEXT | Tipe notifikasi. |
| `sent_at` | INTEGER | Waktu pengiriman. |
| `status` | TEXT | 'SUCCESS' atau 'FAILED'. |

---

## 4. Technical Strategy & Logic

### 4.1 Timezone & Scheduling Strategy

Sistem menghitung target waktu spesifik (Timestamp UTC) berdasarkan event date, bukan sekadar tanggal hari ini.

* **Logic:** `SchedulerService.calculateNextRun(eventDate, location)`
* **Proses:**
   1. Ambil waktu sekarang di Timezone user.
   2. Set target ke jam 09:00 pagi pada tanggal event di tahun ini.
   3. **Leap Year Handling:** Jika event date adalah **29 Februari**:
      * Jika tahun ini **Kabisat**, target tetap 29 Feb.
      * Jika tahun ini **Bukan Kabisat**, target diubah ke **1 Maret**.
   4. Jika target < sekarang, set ke tahun depan (ulangi logika leap year untuk tahun depan).
   5. Konversi ke UTC dan simpan di `events.next_notify_at`.

### 4.2 Scalability Strategy (100M Scale)

Untuk menangani volume tinggi, proses dipisah menjadi dua:

1. **The Producer (Cron Job):**
   * Berjalan setiap jam.
   * Query ringan: `SELECT id, user_id, type FROM events WHERE next_notify_at <= NOW() LIMIT 1000`.
   * Tugas: Melempar payload (event_id, user_id) ke **Cloudflare Queue**.
   * Sifat: Cepat, memori rendah.

2. **The Consumer (Queue Worker):**
   * Triggered by Queue. Cloudflare otomatis men-scale jumlah worker.
   * Tugas: Fetch user details -> Call API Email -> Update DB (`events.next_notify_at`).
   * Batching: Memproses 10-100 pesan per batch.

### 4.3 Reliability & Recovery Strategy

* **Masalah:** Server mati selama 24 jam.
* **Solusi:** Query menggunakan *inequality*: `WHERE next_notify_at <= NOW()`.
* **Hasil:** Saat server menyala kembali, semua jadwal yang "tertunggak" (past due) akan otomatis terambil oleh Producer dan diproses.

### 4.4 Race Condition Prevention (Exactly-Once Delivery)

Menggunakan 3 lapis pertahanan:

1. **Queue Visibility Timeout:** Mencegah dua consumer mengambil pesan yang sama.
2. **Idempotency Log Check:** Cek tabel `notification_logs`.
3. **Optimistic Locking pada Event:**
   ```sql
   UPDATE events SET next_notify_at = ..., version = version + 1
   WHERE id = ? AND version = ?
   ```

---

## 5. API Specification

### 5.1 Create User

* **Endpoint:** `POST /user`
* **Body:** `{ firstName, lastName, email, birthDate, location }`
* **Process:**
   1. Simpan data user.
   2. Otomatis buat event 'BIRTHDAY' di tabel `events`.
   3. Hitung dan simpan `next_notify_at`.

### 5.2 Update User

* **Endpoint:** `PUT /user/:id`
* **Body:** `{ firstName, lastName, location, birthDate }`
* **Process:**
   1. Update data user.
   2. Jika `birthDate` atau `location` berubah, update event 'BIRTHDAY' dan re-calculate `next_notify_at`.

### 5.3 Delete User

* **Endpoint:** `DELETE /user/:id`
* **Process:** Cascade delete user dan semua events-nya.

---

## 6. Testing Strategy

### 6.1 Unit Testing (Vitest)

Menggunakan **Dependency Injection** pada Service Layer.

* **Mocking:** Repositories dan EmailService.
* **Test Cases:**
   * Perhitungan Timezone (Jakarta/New York).
   * **Leap Year Case:** Pastikan user lahir 29 Feb dinotifikasi 1 Maret pada tahun regular.
   * Queue Consumer Logic.

### 6.2 Integration Testing

Menggunakan `app.request` dari Hono untuk mengetes endpoint HTTP.

---

## 7. Future Improvements

* **Custom Events:** API endpoint untuk menambah custom event (Anniversary, Custom Reminder) tanpa ubah database.
* **Database Scaling:** Migrasi ke PostgreSQL (Hyperdrive) untuk throughput write yang lebih tinggi.