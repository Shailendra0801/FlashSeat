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

It uses a two-layer locking strategy — Redis distributed locks for fast soft reservation, and PostgreSQL row-level transactions for final hard confirmation — ensuring only one user can ever own a seat, even under heavy concurrent load.

---

## 🚀 Features

- JWT-based authentication with admin/user roles
- Admin can create events, sessions, and seat layouts
- Waiting room queue to limit concurrent users on the booking page
- Redis distributed locks for per-seat soft reservation (300s TTL)
- PostgreSQL `SELECT ... FOR UPDATE NOWAIT` for race-safe final booking
- Auto seat lock cleanup for abandoned reservations
- Real-time seat map with polling
- Full order history per user
- Vanilla JS frontend (no framework)

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (async) |
| Database | PostgreSQL + SQLAlchemy 2.0 (async) |
| Cache / Locks | Redis (redis.asyncio) |
| Auth | JWT (python-jose) |
| Frontend | HTML, CSS, Vanilla JS |
| Password Hashing | bcrypt (passlib) |
<!-- | Migrations | Alembic | -->

---

## 🗂 Project Structure

```
FlashSeat/
├── backend/
│   └── app/
│       ├── core/
│       │   ├── config.py              # Settings from .env
│       │   ├── dependencies.py        # JWT auth, get_current_user
│       │   ├── redis.py               # Redis connection
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
│       │   ├── auth.py                # Register, login, profile
│       │   ├── event.py               # Events, sessions, seats, locking
│       │   ├── queue.py               # Waiting room entry/leave
│       │   └── orders.py             # Checkout and order history
│       ├── scripts/                   # Admin utilities and load testing
│       └── main.py                    # App entrypoint, lifespan
├── frontend/
│   ├── index.html                     # Login / Register page
│   ├── pages/
│   │   ├── dashboard.html
│   │   └── event.html                 # Seat selection + booking
│   ├── js/
│   │   ├── auth.js
│   │   └── event.js
│   └── css/
├── .env
├── requirements.txt
└── README.md
```

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
        string category
        string venue_name
        string venue_city
    }
    event_sessions {
        UUID session_id PK
        UUID event_id FK
        string session_name
        datetime start_time
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
        enum status
    }
    order_items {
        UUID order_item_id PK
        UUID order_id FK
        UUID session_seat_id FK
        string seat_label
        decimal unit_price
    }

    users ||--o{ events : "creates"
    users ||--o{ orders : "places"
    users ||--o{ session_seats : "books"
    events ||--o{ event_sessions : "has"
    events ||--o{ seats : "defines"
    event_sessions ||--o{ session_seats : "tracks"
    seats ||--o{ session_seats : "mapped to"
    orders ||--o{ order_items : "contains"
    session_seats ||--o| order_items : "referenced by"
```

---

## 🔐 Authentication Flow

```mermaid
flowchart TD
    A[User opens index.html] --> B{Has JWT in localStorage?}
    B -- No --> C[Show Login / Register form]
    C --> D[POST /auth/register or /auth/login]
    D --> E[Server returns access_token]
    E --> F[Store token in localStorage]
    F --> G[Redirect to dashboard.html]
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
    A[User opens event.html?event_id=...] --> B[GET /events/eventId/queue]
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
    V -- No --> W[ROLLBACK → 409 Conflict]
    V -- Yes --> X[Update each seat to BOOKED\nCreate OrderItems\nSet Order status=CONFIRMED\nCOMMIT]
    X --> Y[Delete Redis lock keys\nvia pipeline]
    Y --> Z[Return order confirmation]
    N --> AA[Seat map polls every 5s]
    AA --> H
```

---

## 🔒 Concurrency Strategy

FlashSeat uses a **two-layer defense** to prevent double booking:

```mermaid
flowchart LR
    A[Concurrent booking requests] --> B[Layer 1: Redis NX Lock\nFast rejection\nTTL = 300s]
    B --> C{Lock acquired?}
    C -- No --> D[409 Instant rejection\nNo DB hit]
    C -- Yes --> E[Layer 2: PostgreSQL\nSELECT FOR UPDATE NOWAIT\nREPEATABLE READ]
    E --> F{Row locked\nby another txn?}
    F -- Yes --> G[OperationalError\n409 Try again]
    F -- No --> H[Final DB constraints:\nuq_session_seat\nuq_order_item_session_seat]
    H --> I[COMMIT]
```

| Layer | Mechanism | Purpose |
|---|---|---|
| Redis `SET NX` | Distributed lock | Fast rejection, prevents thundering herd on DB |
| `SELECT FOR UPDATE NOWAIT` | Row-level DB lock | Prevents race within same transaction |
| `uq_session_seat` constraint | `(session_id, seat_id)` unique | DB-level: one seat per session, ever |
| `uq_order_item_session_seat` | `(session_seat_id)` unique | DB-level: one order item per seat, ever |

> Even if Redis goes down, the PostgreSQL constraints guarantee correctness. Redis is a performance optimization, not a correctness requirement.

---

## 🌐 API Reference

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Register new user |
| POST | `/auth/login` | None | Login, returns JWT |
| GET | `/auth/me` | JWT | Get current user profile |
| GET | `/auth/users` | JWT + Admin | List all users |

### Events
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/events/` | JWT + Admin | Create event with sessions and seats |
| POST | `/events/{event_id}/generate-seats` | JWT + Admin | Add more seats to existing event |
| GET | `/events/` | None | List events (filter by category, city) |
| GET | `/events/{event_id}` | None | Get event with sessions |
| GET | `/events/{event_id}/seats` | None | Get seat map for a session |
| POST | `/events/seats/{seat_id}/lock` | JWT | Soft-lock a seat via Redis |

### Queue
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/events/{event_id}/queue` | JWT | Enter waiting room or get access |
| POST | `/events/{event_id}/leave` | JWT | Leave booking page, free slot |

### Orders
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/orders` | JWT | Finalize booking (Redis → PostgreSQL) |
| GET | `/orders/me` | JWT | Get current user's order history |

---

## ⚙️ Setup & Installation

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Git

---

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
# Windows (if using Redis via WSL or installer)
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

### 7. Run database migrations

```bash
cd backend
alembic upgrade head
```

### 8. Start the backend server

```bash
cd backend
uvicorn app.main:app --reload
```

Server runs at: `http://127.0.0.1:8000`

### 9. Open the frontend

Open `frontend/index.html` directly in your browser, or serve it with:

```bash
cd frontend
python -m http.server 5500
```

Then visit: `http://localhost:5500`

---

## 📖 API Docs

Once the server is running:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

---

## 🧪 Load Testing

Admin scripts for concurrency testing are available in `backend/app/scripts/`:

```bash
# Run seat race simulation
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

---

## 👤 Author

**Shailendra** — [@Shailendra0801](https://github.com/Shailendra0801)