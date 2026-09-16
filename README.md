# ZapTaria - Autonomous WhatsApp Task Assistant

ZapTaria is a production-oriented web application that acts as an autonomous personal assistant for WhatsApp conversations. It allows users to define concrete real-world tasks, assign them to WhatsApp contacts, and autonomously execute and monitor the conversation until completion, escalation, or explicit user intervention.

---

## Architecture Overview

```text
Frontend (React + Vite + Tailwind CSS)
    │
REST / Socket.IO WebSockets API
    │
Application Services (Auth, GeminiKeyPoolManager, TaskScheduler)
    │
Task Engine & State Machine
    │
ContextBuilder & Safety Guardrails
    │
AI Provider Interface ────► GeminiProvider (Google Gemini API) / MockAIProvider
    │
WhatsApp Provider Interface ────► WPPConnectProvider (WPPConnect) / MockWhatsAppProvider
    │
PostgreSQL Database (Prisma ORM)
```

---

## Features

- **Objective-Driven Tasks**: Tasks are defined with explicit success/failure criteria, instructions, priority, and autonomy levels (`FULL_AUTO`, `LIMITED_AUTO`, `HUMAN_APPROVAL`).
- **Deterministic Task State Machine**: Tasks transition safely between states (`DRAFT`, `SCHEDULED`, `ACTIVE`, `WAITING_FOR_CONTACT`, `WAITING_FOR_USER`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`, `HUMAN_REQUIRED`).
- **Strict Safety Guardrails**: Restricted keywords filter, maximum message counts per task, task deadline monitoring, and a global Emergency Stop switch that instantly halts all autonomous output.
- **Secure Gemini Key Pool**: AES-256-GCM server-side encryption at rest, deterministic HMAC-SHA256 fingerprinting for duplicate detection, masked keys (`••••••••••••A91K`), bulk text/upload import, and fair rotation strategies (`ROUND_ROBIN`, `LEAST_RECENTLY_USED`). Keys are never exposed to the frontend or logs.
- **WPPConnect WhatsApp Integration**: Complete session management, real-time message event listeners, historical message synchronization, message deduplication, and media handling.
- **Human Takeover**: Allows users to pause AI control on any conversation, reply manually, and resume AI control seamlessly.
- **Real-Time Dashboard**: Socket.IO updates for active tasks, waiting states, human attention alerts, Gemini key pool status, and live AI audit logs.

---

## Environment Configuration

Create a `.env` file based on `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zaptaria?schema=public"
APP_URL="http://localhost:3000"
API_URL="http://localhost:5000"
PORT=5000
SESSION_SECRET="your-32-character-random-session-secret"
ENCRYPTION_KEY="64-character-hex-string-for-aes-256-gcm-key"
KEY_FINGERPRINT_SECRET="32-character-hex-string-for-hmac-sha256"
GEMINI_DEFAULT_MODEL="gemini-2.5-flash"
GEMINI_FALLBACK_MODEL="gemini-1.5-flash"
KEY_ROTATION_STRATEGY="ROUND_ROBIN"
```

---

## Local Setup Instructions

### 1. Requirements
- Node.js >= v20
- PostgreSQL >= 15 (or Docker / Docker Compose)

### 2. Installation
```bash
npm install
```

### 3. Database Setup
Ensure PostgreSQL is running and `DATABASE_URL` is configured, then run:
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 4. Running the Development Server
```bash
npm run dev
```

### 5. Running via Docker Compose
To run PostgreSQL and the application together:
```bash
docker-compose up --build
```

---

## WhatsApp Connection & Session Guide

1. Navigate to the dashboard and open the WhatsApp Session section.
2. The system initiates a WPPConnect session and displays a QR code when pairing is required.
3. Scan the QR code with WhatsApp on your phone (`Linked Devices`).
4. Once connected, session status changes to `CONNECTED`, and contact/conversation synchronization begins automatically.

---

## Gemini Key Pool Management Guide

1. Open **Gemini Key Pool** from the sidebar.
2. You can add keys individually, paste multiple keys into the bulk textarea, or upload a `.txt` file containing one key per line.
3. Added keys are normalized, checked for duplicate fingerprints using HMAC-SHA256, encrypted with AES-256-GCM, and stored safely.
4. The frontend and API responses only display masked metadata (`••••••••••••A91K`). Plaintext keys are decrypted only in backend memory when calling the Gemini API.

---

## Creating Your First Autonomous Task

1. Click **Create Task** from the top header or Tasks section.
2. Select a contact, enter a concise title (e.g. *Request Bravus ANVISA Documents*), and write a natural-language objective:
   > "Ask the supplier whether they have the ANVISA documents for the Bravus product. If they have them, ask them to send the documents. If not, determine whether another person can provide them."
3. Set the priority, autonomy level (`FULL_AUTO`), and maximum allowed messages (e.g. `10`).
4. Click **Activate Task**. The Task Engine will handle conversation initiation, response interpretation, wait state transitions, and audit logging.

---

## Running Tests

Execute the automated Vitest test suite covering Task Engine state machine, Gemini Key Pool encryption/rotation, WhatsApp provider sync, and API endpoints:

```bash
npm test
```

---

## Known Limitations & Future Roadmap

- **Group Conversations**: Primary MVP architecture focuses on 1-to-1 WhatsApp chats; full group conversation context separation is scheduled for Milestone 2.
- **Multimodal Documents**: Advanced multi-page PDF vision parsing can be integrated using Gemini Multimodal when document attachments arrive.
