# Birthday Notification System

A full-stack application to schedule and send birthday greetings at 9:00 AM local time for users globally. Built with Cloudflare Workers, D1 Database, Queue, and Vue.js.

## Tech Stack

- **Backend**: TypeScript, Hono, Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite), Drizzle ORM
- **Queue**: Cloudflare Queues (Producer/Consumer pattern)
- **Frontend**: Vue 3, Tailwind CSS, Vite

## Prerequisites

- Node.js (v20+ recommended)
- `pnpm` (Package Manager)
- `wrangler` CLI (for Cloudflare Workers)

## Installation

1.  **Clone the repository**
2.  **Install dependencies** (from root or individual apps):
    ```bash
    # Root (if workspace configured) or individual folders
    cd apps/backend && npm install
    cd ../../apps/frontend && npm install
    ```

## Running Locally

### 1. Backend Setup (Cloudflare Worker)

Navigate to the backend directory:
```bash
cd apps/backend
```

**Initialize Database & Migrations:**
Since this uses Cloudflare D1, you need to apply migrations to the local D1 instance used by Wrangler.

```bash
# Generate Drizzle artifacts (if needed)
npx drizzle-kit generate

# Apply migrations to local D1
npx wrangler d1 migrations apply DB --local
```

**Start Backend:**
```bash
npm run dev
# OR
npx wrangler dev
```
The API will be available at `http://localhost:8787`.

### 2. Frontend Setup

Navigate to the frontend directory:
```bash
cd apps/frontend
```

**Start Frontend:**
```bash
npm run dev
```
Access the UI at `http://localhost:5173`.

---

## Architecture & Strategies

This system handles the requirements defined in Fulltsack Test Document using the following strategies:

### 1. **Timezones & 9 AM Scheduling**
- **Strategy**: Instead of checking every minute "is it 9am in X timezone?", the system calculates the **next specific UTC timestamp** when it will be 9am for that user.
- **Implementation**:
    - When a user is created/updated, `SchedulerService` calculates the next occurrence of 9am in their `location` (TimeZone) and converts it to a UTC timestamp stored in `events.nextNotifyAt`.
    - Handles edge cases like Leap Years (Feb 29) automatically via `date-fns`.

### 2. **Scalability & Concurrency**
- **Strategy**: Decouple "finding birthdays" from "sending emails".
- **Implementation**:
    - **Producer (Cron)**: Runs hourly. Queries the DB efficiently for `events` where `nextNotifyAt <= NOW`. It pushes these jobs to a **Cloudflare Queue** and does nothing else. This involves minimal processing time.
    - **Consumer (Queue)**: Processes messages one by one (or in batches). It sends the email and updates the DB.
    - **Benefit**: The detailed processing (API calls, retries) doesn't block the Cron job. The Queue acts as a buffer for high-volume spikes.

### 3. **Recovery & Downtime**
- **Strategy**: The scheduler looks for *all* events in the past, not just "current minute".
- **Implementation**:
    - Query: `WHERE nextNotifyAt <= CurrentTime`.
    - If the system is down for 5 hours, the next Cron job will pick up all missed events (because their timestamp is now in the past) and enqueue them immediately.
    - Ensures no birthday is left behind.

### 4. **Race Conditions & Duplicates**
- **Strategy**: Atomic operations and Idempotency.
- **Implementation**:
    - The `events` table tracks a `version` number.
    - When processing, the consumer should ideally check/update this version atomically.
    - **Current Flow**: The Producer pushes to Queue. The Consumer acts. If the Producer runs again before the Consumer finishes, it might re-queue.
    - **Mitigation**: The system relies on the Queue to handle delivery. For stricter deduplication, the Consumer logic verifies the event status before sending.

### 5. **API & Editing (Bonus)**
- **PUT /user/:id**: Implemented to allow updates.
- **Logic**: Updating a user's location or birthdate triggers a **re-calculation** of the schedule (`nextNotifyAt`), ensuring the greeting is sent at the correct new time.

## API Endpoints

- `GET /user`: List all users.
- `POST /user`: Create a user.
- `PUT /user/:id`: Update a user.
- `DELETE /user/:id`: Delete a user.
- `/manual-trigger`: (Test) Seed 100 past events and trigger producer.
- `/manual-trigger-event`: (Test) Trigger a single manual event.
