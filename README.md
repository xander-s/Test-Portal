# Enterprise-Grade Online Test Portal with AI Proctoring & SAP Integration

A scalable, multi-tenant Online Test Portal built for colleges, recruitment agencies, and enterprises. Featuring automated AI proctoring (webcam frame analysis, browser lockouts), isolated sandbox code execution, and OData synchronization with SAP SuccessFactors.

---

## Technical Stack

* **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query
* **API Gateway**: Python 3.12, FastAPI, SQLAlchemy (Async pg), Alembic
* **AI Proctoring**: FastAPI, OpenCV, NumPy, ONNX Runtime
* **Cache & Queues**: Redis, Celery (background report and certificate generation)
* **Storage**: MinIO / AWS S3
* **Databases**: PostgreSQL

---

## Directory Layout

```
Testportal/
├── docker-compose.yml       # Dev orchestration
├── backend/                 # FastAPI core endpoints
│   ├── app/
│   │   ├── main.py          # Entry router
│   │   ├── core/            # Security, database, s3, celery config
│   │   ├── models/          # Master SQLAlchemy schemas
│   │   ├── api/             # CRUD modules (Auth, Questions, SAP)
│   │   └── tasks/           # Celery workers
│   └── requirements.txt
├── proctor_service/         # OpenCV/ONNX frame detection service
└── frontend/                # React 19 SPA
```

---

## Quick Start (Docker Compose)

The easiest way to launch the entire platform (PostgreSQL, Redis, MinIO, Backend API, AI Proctoring, Celery, and Nginx serving Frontend) is using Docker Compose:

1. **Clone the workspace** and navigate to the project directory.
2. **Copy env file template**:
   ```bash
   cp .env.example .env
   ```
3. **Launch all containers**:
   ```bash
   docker-compose up --build -d
   ```
4. **Seed the database**:
   Run the seeding script on the running backend container:
   ```bash
   docker-compose exec backend python ../scripts/seed_db.py
   ```
5. **Access services**:
   * **Frontend Application**: [http://localhost](http://localhost) (port 80)
   * **FastAPI Backend (Swagger Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   * **AI Proctoring Microservice**: [http://localhost:8001/health](http://localhost:8001/health)
   * **MinIO Object Console**: [http://localhost:9001](http://localhost:9001) (Credentials: `minioadmin` / `minioadmin`)

---

## Seed Credentials (Default)

After seeding, the database contains default logins:

* **Super Admin**: `superadmin@portal.com` | Password: `SuperAdmin@123`
* **Acme Tenant Admin**: `admin@acme.com` | Password: `Admin@123` | Organization ID: `acme`
* **Acme Trainer**: `trainer@acme.com` | Password: `Trainer@123` | Organization ID: `acme`
* **Acme Student**: `student@acme.com` | Password: `Student@123` | Organization ID: `acme`

---

## Local Development (Without Docker)

### 1. Backend API
Ensure Python 3.12+ is installed and a local PostgreSQL instance is running.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend React Client
```bash
cd frontend
npm install
npm run dev
```

### 3. Celery Tasks
```bash
cd backend
celery -A app.core.celery_app worker --loglevel=info
```
