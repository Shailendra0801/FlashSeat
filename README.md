# ⚡ FlashSeat

> **High-Concurrency Event Ticketing System** — Built to handle flash-sale traffic with zero seat overselling.

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7+-red?logo=redis)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 📌 What is FlashSeat?

FlashSeat is a production-style event ticketing backend built to solve the hardest problem in ticketing: **concurrent users trying to book the same seat at the same time**.

It uses a three-layer concurrency strategy — Redis distributed locks for fast soft reservation, PostgreSQL row-level transactions for final hard confirmation, and DB-level uniqueness constraints as the ultimate safety net — ensuring only one user can ever own a seat, even under heavy concurrent load.

---

## 🚀 Features

- JWT-based authentication with admin/user roles
- Admin can create events, sessions, and seat layouts dynamically
- Admin dashboard with stats, order management, session control, and seat blocking
- Waiting room queue to limit concurrent users on the booking page
- Redis distributed locks for per-seat soft reservation (300s TTL)
- PostgreSQL `SELECT ... FOR UPDATE NOWAIT` for race-safe final booking
- Auto seat lock cleanup for abandoned reservations
- Dirty-disconnect detection and active-slot reclamation via TTL expiry
- Real-time seat map with polling
- Full order history per user
- Order cancellation with automatic seat release
- React 18 + TypeScript frontend with Zustand state management

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (async) |
| Database | PostgreSQL + SQLAlchemy 2.0 (async) |
| Cache / Locks | Redis (redis.asyncio) |
| Auth | JWT (python-jose) |
| Frontend | React 18 + TypeScript + Vite |
| State Management | Zustand |
| Password Hashing | bcrypt (pwdlib) |

---

## 🗂 Project Structure

```
FlashSeat/
├── backend/
│   └── app/
│       ├── core/
│       │   ├── config.py              # Settings from .env
│       │   ├── dependencies.py        # JWT auth, get_current_user
│       │   ├── redis.py               # Redis connection + key builders
│       │   ├── security.py            # Password hashing + JWT token creation
│       │   ├── queue_manager.py       # Waiting room logic (Lua scripts)
│       │   └── seat_lock_cleanup.py   # Background seat lock cleanup loop
│       ├── models/                    # SQLAlchemy ORM models
│       │   ├── user.py
│       │   ├── event.py
│       │   ├── event_session.py
│       │   ├── seat.py
│       │   ├── session_seat.py
│       │   ├── order.py
│       │   └── order_item.py
│       ├── routers/
│       │   ├── admin.py               # Admin dashboard, event/session management
│       │   ├── auth.py                # Register, login, profile
│       │   ├── event.py               # Events, sessions, seats, locking
│       │   ├── queue.py               # Waiting room entry/leave
│       │   └── orders.py              # Checkout, order history, cancellation
│       ├── scripts/                   # Admin utilities and load testing
│       └── main.py                    # App entrypoint, lifespan
├── frontend-react/
│   ├── index.html                     # Vite entry point
│   ├── src/
│   │   ├── App.tsx                    # Router + layout
│   │   ├── main.tsx                   # React entry
│   │   ├── api/                       # API client (fetch wrapper)
│   │   ├── components/                # Cart, SeatMap, etc.
│   │   ├── hooks/                     # Custom React hooks
│   │   ├── pages/                     # Dashboard, Event, Auth
│   │   ├── stores/                    # Zustand state management
│   │   ├── types/                     # TypeScript interfaces
│   │   └── utils/                     # Constants, formatters
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .env
├── requirements.txt
└── README.md
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Node.js 18+ (for frontend)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Shailendra0801/FlashSeat.git
cd FlashSeat
```

### 2. Create and activate virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up PostgreSQL

Open pgAdmin or psql and create the database:

```sql
CREATE DATABASE flashseat;
```

### 5. Set up Redis

Make sure Redis is running locally on default port `6379`.

```bash
# Windows (WSL or Redis installer)
redis-server

# Mac
brew services start redis
```

### 6. Configure environment variables

Create a `.env` file inside the `backend/` folder:

```env
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/flashseat
SECRET_KEY=your_generated_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REDIS_URL=redis://localhost:6379
```

To generate a secret key:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 7. Database setup

Tables are created automatically on first startup via SQLAlchemy's `create_all`.  
No migration tool is required for development.

### 8. Start the backend server

```bash
uvicorn app.main:app --reload
```

Server runs at: `http://127.0.0.1:8000`

### 9. Start the frontend

```bash
cd frontend-react
npm install
npm run dev
```

Then visit the URL shown by Vite (typically `http://localhost:5173`)

### 10. API Docs

Once the server is running:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

---

## 🏗 Architecture Overview

FlashSeat uses a **three-layer concurrency strategy** to safely handle flash-sale bookings:

1. **Redis soft locks** — per-seat hold with 300s TTL before opening a DB transaction
2. **PostgreSQL row locks** — final booking using `SELECT ... FOR UPDATE NOWAIT`
3. **DB-level uniqueness constraints** — guarantee a session seat cannot be double-booked even if upstream logic fails

A **queue/waiting room** limits how many users can actively load the booking UI for an event. A background task detects dirty disconnects by scanning `user_session:*` TTL keys and reclaims slots for expired sessions.

### 🔒 Concurrency Strategy

```mermaid
flowchart LR
    A[Concurrent booking requests] --> B[Layer 1: Redis NX Lock\nFast rejection\nTTL = 300s]
    B --> C{Lock acquired?}
    C -- No --> D[409 Instant rejection\nNo DB hit]
    C -- Yes --> E[Layer 2: PostgreSQL\nSELECT FOR UPDATE NOWAIT]
    E --> F{Row locked\nby another txn?}
    F -- Yes --> G[OperationalError\n409 Try again]
    F -- No --> H[Final DB constraints:\nuq_session_seat_per_session\nuq_order_item_session_seat]
    H --> I[COMMIT]
```

| Layer | Mechanism | Purpose |
|---|---|---|
| Redis `SET NX` | Distributed lock | Fast rejection, prevents thundering herd on DB |
| `SELECT FOR UPDATE NOWAIT` | Row-level DB lock | Prevents race within same transaction |
| `uq_session_seat_per_session` | `(session_id, seat_id)` unique | DB-level: one seat per session, ever |
| `uq_order_item_session_seat` | `(session_seat_id)` unique | DB-level: one order item per seat, ever |

> Even if Redis goes down, PostgreSQL constraints guarantee correctness. Redis is a performance optimization, not a correctness requirement.

---

## 🌐 API Reference

### Health / Root

#### `GET /`
Returns `message`, `docs` and `redoc` paths.

#### `GET /health`
```json
{ "status": "healthy" }
```

---

### Auth
Prefix: `/auth`

#### `POST /auth/register`
- **Auth:** none
- **Body:** `full_name`, `email`, `password`
- **Status:** `201`
- Verifies email not already registered, hashes password, creates `User(is_admin=false, is_active=true)`

#### `POST /auth/login`
- **Auth:** none
- **Body:** `email`, `password`
- Returns `{ "access_token": "...", "token_type": "bearer" }`
- JWT payload: `{ "sub": user.email, "exp": ... }`

#### `GET /auth/me`
- **Auth:** Bearer JWT
- Returns current user profile (`user_id`, `full_name`, `email`, `is_admin`).

#### `GET /auth/users`
- **Auth:** Bearer JWT (admin only)
- Returns all users.

---

### Events
Prefix: `/events`

#### `POST /events/`
- **Auth:** admin only
- **Status:** `201`
- **Body:** `title`, `description?`, `category`, `venue_name?`, `venue_city?`, `seat_layout[]` (row_name, seat_number, section), `sessions[]` (session_name, start_time, doors_open_time?)
- Creates an `Event`, `Seat` rows from `seat_layout`, `EventSession` rows, and `SessionSeat` rows (all `AVAILABLE`) for every seat per session.

#### `POST /events/{event_id}/generate-seats`
- **Auth:** admin only
- **Status:** `201`
- **Body:** `seat_layout[]`
- Adds more seats to an existing event and creates corresponding `SessionSeat` rows for all existing sessions. Updates `total_seats` and `available_seats` on each session.

#### `GET /events/`
- **Auth:** none
- **Query params:** `category?`, `city?`, `search?` (title search), `skip` (default `0`), `limit` (default `20`, max `100`)
- Returns paginated events with `total_sessions` per event.

#### `GET /events/{event_id}`
- **Auth:** none
- Returns full event details including all sessions.

#### `GET /events/{event_id}/seats`
- **Auth:** none
- **Query param:** `session_id` (required)
- Returns seat map for session including `total_seats`, `available_seats`, `booked_seats`, `blocked_seats`, `unavailable_seats` and per-seat `status`, `booked_by`, `booked_at`.

#### `POST /events/seats/{seat_id}/lock`
- **Auth:** Bearer JWT
- **Query param:** `session_id` (required)
- Acquires Redis lock: `SET seat:{session_id}:{seat_id} {user_id} NX EX 300`
- On success schedules background DB update: `SessionSeat.status = RESERVED`, `SessionSeat.booked_by = user_id`
- Returns `409` if seat already locked.

---

### Orders
Prefix: `/orders`

#### `GET /orders/me`
- **Auth:** Bearer JWT
- Returns order history with `seat_label` snapshot per item.

#### `POST /orders`
- **Auth:** Bearer JWT
- **Status:** `201`
- **Body:** `session_id`, `seat_ids: uuid[]`
- Full booking finalization flow:
  1. Validates Redis lock ownership for every seat
  2. Opens PostgreSQL transaction:
     - Creates `Order(PENDING)`
     - `SELECT SessionSeat FOR UPDATE NOWAIT`
     - Verifies each seat is `RESERVED` and `booked_by == current_user`
     - Updates seats to `BOOKED`, binds `order_id`
     - Creates `OrderItem` per seat with `seat_label` snapshot
     - Sets `Order(CONFIRMED)`, commits
  3. Deletes Redis lock keys via pipeline
- **Errors:** `409` on lock failure, contention, or integrity violation; `500` on unexpected error.

#### `POST /orders/{order_id}/cancel`
- **Auth:** Bearer JWT
- Cancels a `CONFIRMED` or `PENDING` order.
- Releases all associated `SessionSeat` rows back to `AVAILABLE`.
- Increments `EventSession.available_seats` (clamped to `total_seats`).
- Sets order status to `CANCELLED`.

---

### Admin
Prefix: `/admin`

#### `GET /admin/stats`
- **Auth:** admin only
- Returns dashboard stats: `total_events`, `total_users`, `total_orders`, `confirmed_orders`, `total_revenue`, `total_seats`, `booked_seats`, `seat_utilization`.

#### `PUT /admin/events/{event_id}`
- **Auth:** admin only
- **Body:** `title?`, `description?`, `category?`, `venue_name?`, `venue_city?`
- Updates event details (not seats or sessions).

#### `DELETE /admin/events/{event_id}`
- **Auth:** admin only
- Deletes an event and all associated data (cascading).

#### `PATCH /admin/events/{event_id}/sessions/{session_id}/status`
- **Auth:** admin only
- **Body:** `status` (one of: `draft`, `published`, `sold_out`, `cancelled`, `completed`)
- Updates a session's status.

#### `POST /admin/events/{event_id}/sessions/{session_id}/seats/{seat_id}/block`
- **Auth:** admin only
- **Body:** `blocked: bool`, `reason?: str`
- Blocks or unblocks a seat for a session. Cannot block a `BOOKED` seat.

#### `GET /admin/orders`
- **Auth:** admin only
- **Query params:** `event_id?`, `session_id?`, `order_status?` (aliased from `status`), `skip` (default `0`), `limit` (default `50`, max `200`)
- Returns paginated order list with user email, event title, and order items.

---

### Queue (Waiting Room)
Prefix: `/events`

#### `GET /events/{event_id}/queue`
- **Auth:** Bearer JWT
- If active users < `MAX_ACTIVE_USERS` (500): returns `status: access_granted` with `active_users` count
- Else: returns `status: in_queue` with `queue_position` and `estimated_wait_seconds`
- Uses a Lua script for atomic check-and-add to prevent race conditions.

#### `POST /events/{event_id}/leave`
- **Auth:** Bearer JWT
- Removes user from `active_users:{event_id}`, deletes `user_session:{event_id}:{user_id}` key, promotes next user from `waiting_room:{event_id}`.
- Returns `{ status: "success", slot_freed: bool }`.

---

## 🗄 Database Schema

```mermaid
erDiagram
    users {
        UUID user_id PK
        string email
        string full_name
        string hashed_password
        bool is_admin
        bool is_active
        datetime created_at
    }
    events {
        UUID event_id PK
        UUID created_by FK
        string title
        string description
        string category
        string venue_name
        string venue_city
        datetime created_at
    }
    event_sessions {
        UUID session_id PK
        UUID event_id FK
        string session_name
        datetime start_time
        datetime doors_open_time
        int total_seats
        int available_seats
        enum status
    }
    seats {
        UUID seat_id PK
        UUID event_id FK
        string row_name
        int seat_number
        enum section
    }
    session_seats {
        UUID session_seat_id PK
        UUID session_id FK
        UUID seat_id FK
        enum status
        UUID booked_by FK
        datetime booked_at
        UUID order_id FK
    }
    orders {
        UUID order_id PK
        UUID user_id FK
        UUID session_id FK
        int total_tickets
        decimal total_amount
        string currency
        enum status
        string failure_reason
    }
    order_items {
        UUID order_item_id PK
        UUID order_id FK
        UUID session_seat_id FK
        string seat_label
        decimal unit_price
        string currency
    }

    users ||--o{ events : "creates"
    users ||--o{ orders : "places"
    users ||--o{ session_seats : "books"
    events ||--o{ event_sessions : "has"
    events ||--o{ seats : "defines"
    event_sessions ||--o{ session_seats : "tracks"
    event_sessions ||--o{ orders : "has"
    seats ||--o{ session_seats : "mapped to"
    orders ||--o{ order_items : "contains"
    session_seats ||--o| order_items : "referenced by"
```

### Key Constraints

| Table | Constraint | Purpose |
|---|---|---|
| `session_seats` | `uq_session_seat_per_session (session_id, seat_id)` | Prevents same seat inserted twice for same session |
| `order_items` | `uq_order_item_session_seat (session_seat_id)` | Ensures a seat can only belong to one order globally |
| `seats` | `uq_seat_event_row_number (event_id, row_name, seat_number)` | No duplicate physical seats per event |
| `event_sessions` | `ck_session_total_seats_positive (total_seats > 0)` | Prevents zero/negative seat counts |
| `event_sessions` | `ck_session_available_seats_non_negative (available_seats >= 0)` | Prevents negative availability |
| `event_sessions` | `ck_session_available_seats_le_total (available_seats <= total_seats)` | Prevents over-availability |
| `seats` | `ck_seat_number_positive (seat_number > 0)` | Prevents zero/negative seat numbers |

---

## 🔴 Redis Usage

Redis client created in `backend/app/core/redis.py` using `redis.asyncio`.

### Key Patterns

| Key | Type | Purpose |
|---|---|---|
| `active_users:{event_id}` | Set | Currently active booking-page users |
| `waiting_room:{event_id}` | List (FIFO) | Queue of waiting user ids |
| `user_session:{event_id}:{user_id}` | TTL string (1800s) | Dirty disconnect detection; expiry = user disconnected |
| `seat:{session_id}:{seat_id}` | TTL string (300s) | Distributed seat lock; value = `user_id` |

### Where It's Used

- `queue_manager.py` — Lua script `ATOMIC_ENTER_SCRIPT` for atomic grant vs enqueue; promotes users on leave; scans `user_session:*` keys to detect and clean up stale sessions
- `event.py` — `POST /events/seats/{seat_id}/lock` uses `SET NX EX 300`
- `orders.py` — validates lock ownership with `GET`; deletes locks after commit via pipeline
- `seat_lock_cleanup.py` — scans `seat:*` keys; releases `SessionSeat` rows back to `AVAILABLE` when TTL < 5s or key has expired

---

## 🔐 Authentication Flow

```mermaid
flowchart TD
    A[User opens React app] --> B{Has JWT in localStorage?}
    B -- No --> C[Show Login / Register form]
    C --> D[POST /auth/register or /auth/login]
    D --> E[Server returns access_token]
    E --> F[Store token in localStorage as flashseat-token]
    F --> G[Redirect to dashboard]
    B -- Yes --> G
    G --> H[All API calls include Authorization: Bearer token]
    H --> I{Token valid + user active?}
    I -- No --> C
    I -- Yes --> J[Request proceeds]
    J --> K{is_admin required?}
    K -- Yes, not admin --> L[403 Forbidden]
    K -- No or is admin --> M[Handler executes]
```

---

## 🎟 Full Booking Flow

```mermaid
flowchart TD
    A[User opens event page] --> B[GET /events/eventId/queue]
    B --> C{Active users < MAX?}
    C -- Yes --> D[access_granted\nLua atomic script adds user to Redis active set]
    C -- No --> E[in_queue\nUser pushed to waiting_room list]
    E --> F[Frontend polls every 3s until access_granted]
    F --> C
    D --> G[GET /events/eventId — load event details]
    G --> H[GET /events/eventId/seats?session_id=...\nRender seat map]
    H --> I[User clicks available seat]
    I --> J[POST /events/seats/seatId/lock?session_id=...]
    J --> K{Redis SET NX EX 300\nLock acquired?}
    K -- No --> L[409 Conflict\nSeat already locked]
    K -- Yes --> M[Background task:\nSessionSeat.status = RESERVED\nSessionSeat.booked_by = user]
    M --> N[Seat shown as locked-by-you in cart]
    N --> O[User clicks Checkout]
    O --> P[POST /orders\nseat_ids + session_id]
    P --> Q{Validate Redis lock ownership\nfor all seats}
    Q -- Fail --> R[409 Conflict\nLock expired or not yours]
    Q -- Pass --> S[BEGIN PostgreSQL transaction]
    S --> T[Create Order status=PENDING]
    T --> U[SELECT session_seats FOR UPDATE NOWAIT]
    U --> V{All seats RESERVED\nand booked_by == user?}
    V -- No --> W[ROLLBACK - 409 Conflict]
    V -- Yes --> X[Update each seat to BOOKED\nCreate OrderItems\nSet Order status=CONFIRMED\nCOMMIT]
    X --> Y[Delete Redis lock keys\nvia pipeline]
    Y --> Z[Return order confirmation]
    N --> AA[Seat map polls every 5s]
    AA --> H
```

---

## ⚙️ Background Tasks

Started in `backend/app/main.py` lifespan on startup:

**1. Queue / disconnect handling** (`interval_seconds=5`)
- `listen_for_expired_sessions()` — scans `user_session:*` keys every 5 seconds. For each known event, checks if active members' session keys still exist in Redis. If a key has expired (TTL elapsed), removes the user from `active_users` and promotes the next user from the waiting room.

**2. Abandoned seat lock cleanup** (`interval_seconds=60`)
- `cleanup_abandoned_seat_locks_loop()` — scans `seat:*` keys every 60 seconds. For each key, checks remaining TTL. If TTL < 5 seconds or key has already expired, releases the corresponding `SessionSeat` row back to `AVAILABLE` (only if currently `RESERVED`; never reverts `BOOKED` seats).

---

## 🧪 Load Testing

Admin scripts for concurrency simulation are available in `backend/app/scripts/`:

```bash
python backend/app/scripts/race_test.py
```

---

## 🔮 Future Improvements

- Payment gateway integration (Razorpay / Stripe)
- Email confirmation on successful booking
- Seat pricing per section
- Waitlist for sold-out sessions
- Docker + docker-compose setup
- CI/CD with GitHub Actions
- WebSocket-based real-time seat map updates (replace polling)
- Tighten CORS origins for production

---

## 👤 Author

**Shailendra** — [@Shailendra0801](https://github.com/Shailendra0801)
