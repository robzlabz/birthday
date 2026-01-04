## 🏗️ Architecture Overview

Sistem menggunakan pendekatan **Event-Driven** untuk memisahkan logic pencarian user dan pengiriman email.

* **API Layer:** Hono (CRUD User).
* **Storage:** Cloudflare D1 (SQLite) via Drizzle ORM.
* **Scheduler:** Cloudflare Cron Triggers (check hourly).
* **Executor:** Cloudflare Queues (send email & retry mechanism).

---

## 📅 Phase 1: Environment & Configuration

Setup project dan infrastruktur dasar di `wrangler.toml`.

* [ ] **Init Project:** `npm create hono@latest` (template `cloudflare-workers`).
* [ ] **Dependencies:** Install `drizzle-orm`, `drizzle-kit`, `better-sqlite3` (dev), `vitest`.
* [ ] **Wrangler Config (`wrangler.toml`):**
* Define `[[d1_databases]]` binding name: `DB`.
* Define `[triggers]` crons: `["0 * * * *"]` (Jalan tiap jam menit ke-0).
* Define `[[queues]]` producer & consumer bindings.



## 🗄️ Phase 2: Database Schema (Drizzle)

Desain skema untuk menyimpan data user dan log pengiriman demi mencegah duplikat (Idempotency).

* [ ] **Users Table:**
* `id` (PK, Auto Inc)
* `first_name`, `last_name`
* `birthday_date` (Format: `YYYY-MM-DD`)
* 
`location` (Format: IANA Timezone, e.g., "Asia/Jakarta") 




* [ ] **Sent Logs Table (Idempotency):**
* Composite PK: `user_id` + `year`.
* `status` ('sent', 'failed').
* `sent_at` (Timestamp).
* *Fungsi:* Mencegah user menerima email 2x di tahun yang sama.



## 🧠 Phase 3: Core Logic (Testable Service)

Membuat logic yang terisolasi dari *environment* Cloudflare agar mudah di-unit test.

* [ ] **Create `BirthdayService` Class:**
* Inject `db` instance via constructor.
* **Method `getUsersToNotify(referenceTime: Date)`:**
* Terima waktu sebagai parameter (jangan `new Date()` di dalam).
* Filter Timezone: Cari timezone mana di dunia yang saat ini jam 09:00.


* Query DB: `SELECT * WHERE location IN (...) AND birthday matches MM-DD`.




* [ ] **Timezone Helper:** Fungsi murni untuk konversi UTC ke Local Time.

## 🔌 Phase 4: API Implementation (Hono)

Endpoint untuk manajemen user sesuai requirements.

* [ ] **POST /user:** Validasi input & Insert ke D1.


* [ ] **DELETE /user:** Hapus user dari D1.


* [ ] **PUT /user (Bonus):** Update detail user.



## ⚡ Phase 5: Async Worker & Reliability

Inti dari skalabilitas dan *error recovery*.

* [ ] **Cron Handler (`scheduled` event):**
* Jalan setiap jam.
* Panggil `BirthdayService`.
* Dispatch setiap user yang ditemukan ke **Cloudflare Queue**.
* *Note:* Cron tidak mengirim email, hanya memproduksi *jobs*.


* [ ] **Queue Consumer (`queue` handler):**
* Terima batch message.
* **Check `sent_logs`:** Skip jika sudah ada record sukses tahun ini.
* 
**Call External API:** Hit endpoint email service.


* **Error Handling:**
* Jika `200 OK`: Insert ke `sent_logs`, lalu `msg.ack()`.
* Jika `Fail/Timeout`: `msg.retry()`. Cloudflare akan melakukan *exponential backoff* otomatis untuk mencoba lagi nanti.







## 🧪 Phase 6: Testing Strategy

Memastikan kode berfungsi benar dan anti-regresi.

* [ ] **Unit Test (Vitest):**
* Test `TimezoneHelper`: Pastikan konversi jam UTC ke jam 9 lokal akurat.
* Test `BirthdayService`: Mock DB, inject waktu palsu (misal: pura-pura jam 9 pagi di Jakarta), pastikan user yang tepat terpilih.


* [ ] **Integration Test:**
* Gunakan `better-sqlite3` in-memory database.
* Simulasikan flow insert user -> jalankan service -> check hasil.



## 🚀 Phase 7: Deployment

* [ ] Generate SQL Migration: `drizzle-kit generate:sqlite`.
* [ ] Apply Migration ke D1 (Remote & Local).
* [ ] Deploy: `npx wrangler deploy`.