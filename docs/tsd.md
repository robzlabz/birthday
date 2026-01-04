# Technical Design Document: Birthday Notification Service

**Date:** 2026-01-04
**Author:** Robbyn Rahmandaru
**Status:** Draft / Proposed
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
* **Producer (Cron):** Berjalan setiap jam/menit untuk mencari user yang jadwalnya sudah tiba.
* **Consumer (Queue Worker):** Memproses pengiriman email secara paralel untuk skalabilitas tinggi.



---

## 3. Database Design (Schema)

Menggunakan **Cloudflare D1 (SQLite)** dengan **Drizzle ORM**.

### 3.1 Table: `users`

Menyimpan data pengguna dan jadwal notifikasi berikutnya.

| Column | Type | Description |
| --- | --- | --- |
| `id` | TEXT (UUID) | Primary Key. |
| `first_name` | TEXT | Nama depan user.

 |
| `last_name` | TEXT | Nama belakang user.

 |
| `birth_date` | TEXT | Format YYYY-MM-DD. |
| `location` | TEXT | IANA Timezone (e.g., 'Asia/Jakarta'). |
| `next_notify_at` | INTEGER | Timestamp (UTC) kapan notifikasi harus dikirim. **Indexed.** |
| `version` | INTEGER | Optimistic Locking untuk mencegah Race Condition.

 |

### 3.2 Table: `notification_logs`

Menyimpan riwayat pengiriman untuk audit dan idempotency check.

| Column | Type | Description |
| --- | --- | --- |
| `id` | TEXT | Primary Key. |
| `user_id` | TEXT | Foreign Key ke users.id. |
| `type` | TEXT | Tipe notifikasi (e.g., 'BIRTHDAY', 'ANNIVERSARY' ).

 |
| `sent_at` | INTEGER | Waktu pengiriman. |
| `status` | TEXT | 'SUCCESS' atau 'FAILED'. |

---

## 4. Technical Strategy & Logic

### 4.1 Timezone & Scheduling Strategy

Alih-alih mengecek "Siapa yang ulang tahun hari ini?", sistem menghitung target waktu spesifik (Timestamp UTC).

* **Logic:** `SchedulerService.calculateNextRun(birthDate, location)`
* **Proses:**
1. Ambil waktu sekarang di Timezone user.
2. Set target ke jam 09:00 pagi tahun ini.
3. Jika target < sekarang, set ke tahun depan.
4. Konversi ke UTC dan simpan di `next_notify_at`.



4.2 Scalability Strategy (100M Scale) 

Untuk menangani volume tinggi, proses dipisah menjadi dua:

1. **The Producer (Cron Job):**
* Query ringan: `SELECT id FROM users WHERE next_notify_at <= NOW() LIMIT 1000`.
* Tugas: Hanya melempar `user_id` ke **Cloudflare Queue**.
* Sifat: Cepat, memori rendah.


2. **The Consumer (Queue Worker):**
* Triggered by Queue. Cloudflare otomatis men-scale jumlah worker sesuai panjang antrian.
* Tugas: Fetch data user -> Call API Email -> Update DB.
* Batching: Memproses 10-100 pesan per batch untuk mengurangi overhead koneksi database.



4.3 Reliability & Recovery Strategy 

* **Masalah:** Server mati selama 24 jam.
* **Solusi:** Query menggunakan *inequality*: `WHERE next_notify_at <= NOW()`.
* **Hasil:** Saat server menyala kembali, semua jadwal yang "tertunggak" (past due) akan otomatis terambil oleh Producer dan diproses.

4.4 Race Condition Prevention (Exactly-Once Delivery) 

Menggunakan 3 lapis pertahanan:

1. **Queue Visibility Timeout:** Mencegah dua consumer mengambil pesan yang sama dari antrian.
2. **Idempotency Log Check:** Sebelum kirim, cek tabel `notification_logs` apakah sudah ada kiriman sukses tahun ini.
3. **Optimistic Locking:** Saat update database setelah kirim email:
```sql
UPDATE users SET next_notify_at = ..., version = version + 1
WHERE id = ? AND version = ? -- Version harus sama dengan saat dibaca

```



---

## 5. API Specification

5.1 Create User 

* **Endpoint:** `POST /user`
* **Body:** `{ firstName, lastName, birthDate, location }`
* **Process:** Validasi input, hitung `next_notify_at`, simpan ke DB.

5.2 Update User 

* **Endpoint:** `PUT /user/:id`
* **Body:** `{ firstName, lastName, birthDate, location }`
* **Process:** Update data, **re-calculate** `next_notify_at` (karena timezone/tgl lahir mungkin berubah).

5.3 Delete User 

* **Endpoint:** `DELETE /user/:id`

---

6. Testing Strategy 

### 6.1 Unit Testing (Vitest)

Menggunakan **Dependency Injection** pada Service Layer.

* **Mocking:** `IUserRepository` dan `IEmailService` di-mock.
* **Test Cases:**
* Perhitungan Timezone (Pastikan konversi Jakarta/New York ke UTC benar).
* Logika Recovery (Pastikan tanggal lampau tetap diproses).
* Error Handling (Simulasi API Email timeout).



### 6.2 Integration Testing

Menggunakan `app.request` dari Hono untuk mengetes endpoint HTTP tanpa menjalankan server full.

---

## 7. Future Improvements

* 
**Anniversary Support:** Menambahkan kolom `anniversary_date` dan logika serupa di `SchedulerService`.


* **Database Scaling:** Migrasi dari D1 ke PostgreSQL (Hyperdrive) jika *write throughput* melebihi batas D1.