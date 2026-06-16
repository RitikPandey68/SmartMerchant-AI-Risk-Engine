# SmartMerchant AI — AI-Native Merchant Onboarding & Risk Engine

SmartMerchant AI is a production-ready, automated merchant onboarding, KYB (Know Your Business) verification, and real-time transaction risk classification engine. It operates with a collaborative agent model that parses corporate files, audits landing pages, verifies registry records, and routes merchants to dynamic transaction gateways based on calculated risk.

## 🚀 Key Features

* **AI-Agent Multi-Threaded Crew**: Features four specialized verification agents:
  1. **Document Extractor**: Uses OCR and LLM rules to parse incorporation details and identify corporate metadata.
  2. **Website Risk Auditor**: Crawls merchant landing pages and terms of service, searching for restricted keywords and SSL compliance.
  3. **KYB Registry Validator**: Cross-references corporate records in state registries.
  4. **Risk Classifier**: Synthesizes agent evaluations, calculates an aggregate risk score (0-100), and issues risk classifications.
* **Real-time Streaming Over WebSockets**: Live progress tracking, step steppers, and raw thought logs stream straight to the onboarding UI from the background worker.
* **Smart Transaction Routing Simulator**: Maps merchant risk (Low, Medium, High) to specific payment processors (Stripe vs. Backup Pay vs. High-Risk Gateways) and dynamically routes fee structures (e.g., 1.9% vs. 4.5%), showing immediate business/revenue impact.
* **Auditor Compliance Panel**: Interactive management interface allowing compliance auditors to approve/reject onboarding requests, input override reasons, audit trails, and export printable compliance reports.
* **Webhook Subscription Dispatcher**: Platforms can register webhook callback URLs. A background task dispatches signing payloads upon completion.
* **Docker Orcherated**: Single-command production build deploying FastAPI, Celery, Redis, PostgreSQL, and Next.js.
* **SQLite Fallback**: Local developer execution uses SQLite out-of-the-box, eliminating database dependencies.

---

## 🛠️ Technology Stack

* **Frontend**: Next.js (App Router), React, Lucide Icons, Vanilla CSS Modules.
* **Backend**: FastAPI, SQLAlchemy, WebSockets, Pydantic, Python-Jose (JWT).
* **Broker & Queue**: Redis, Celery.
* **Database**: PostgreSQL (Production) / SQLite (Local dev).
* **AI/LLM Engine**: Google Gemini API / LangChain / Fallback mock heuristics.

---

## 🐳 Getting Started (Docker Compose)

Deploy the entire production-ready ecosystem locally:

```bash
docker-compose up --build
```

Once started:
* **Frontend Portal**: [http://localhost:3000](http://localhost:3000)
* **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **Auditor Username**: `auditor`
* **Auditor Password**: `password123`

---

## 💻 Manual Local Development Setup

If you prefer running the components individually outside Docker, follow these steps:

### 1. Prerequisite: Start Redis
Make sure Redis is running locally on default port `6379`.

### 2. Backend Setup
1. Move to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
5. Start the Celery Worker (in a separate terminal inside the backend virtual environment):
   ```bash
   celery -A app.worker.celery_app worker --loglevel=info
   ```

### 3. Frontend Setup
1. Move to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Configurations

The application runs in **Simulation Mode** by default. Set the following environment variables to activate live AI-native analysis:

* `GEMINI_API_KEY`: Google AI studio developer key for live LLM agents.
* `DATABASE_URL`: Connection URL (defaults to `sqlite:///./smartmerchant.db` locally, and PostgreSQL in docker).
* `REDIS_URL`: Redis connection URL (defaults to `redis://localhost:6379/0`).

---

## 🔒 Auditor Default Accounts
For development audit control access:
* **Username**: `auditor`
* **Password**: `password123`
* **Role**: `auditor`
