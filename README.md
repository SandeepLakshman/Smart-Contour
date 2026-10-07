# SmartContour

**SmartContour – Intelligent Pressure Analysis and Soft Insert Contouring System for 3D-Printed Prosthetic Sockets**

*A Prototype Clinical-Engineering Research Evaluation Platform*

---

## Overview

SmartContour provides real-time pressure monitoring, anatomical socket heatmap visualization, and automated soft-insert contouring guidance for transtibial prosthetic sockets.

```
PHYSICAL PRESSURE
       ↓
FSR SENSORS (FSR1 = GPIO 34, FSR2 = GPIO 35)
       ↓
ESP32 ADC (12-bit)
       ↓
Wi-Fi HTTP POST http://<SERVER_IP>:5000/api/sensor-data
       ↓
NODE.JS / EXPRESS BACKEND (Port 5000, 0.0.0.0 LAN)
       ↓
FIRESTORE (SensorReadings, Patients, Sessions, Recs, Reports)
       ↓
REAL-TIME WEBSOCKET STREAM + REST
       ↓
REACT DASHBOARD (Vite + Tailwind CSS)
       ↓
REAL-TIME PRESSURE HEATMAP (Centerpiece anatomical contour & interpolation)
       ↓
HOTSPOT BEACON & HIGHEST PRESSURE ZONE
       ↓
INTERACTIVE ZONE INSPECTOR (Current, Peak, Average, Severity, Soft Insert Rec)
       ↓
TRUE RAG AI ASSISTANT (Gemini 3.8 + Dense Embeddings + Grounded Sources)
       ↓
PDF FITTING REPORTS (pdfkit generation & download)
```

---

## Hardware Configuration (ESP32)

- **Microcontroller**: ESP32 DevKit
- **FSR1**: GPIO 34 (Zone 1: Anterior Patellar Tendon Bar)
- **FSR2**: GPIO 35 (Zone 2: Posterior Popliteal Fossa Counter-Wall)
- **FSR3**: GPIO 32 (Zone 3: Distal Lateral Tibia / Fibula - Reserved Expansion)
- **FSR4**: GPIO 33 (Zone 4: Distal Residual Limb Apex - Reserved Expansion)
- **ADC Resolution**: 12-bit (0–4095)
- **Firmware Location**: `firmware/smartcontour_esp32.ino`
- **Backend Target**: `http://<SERVER_IP>:5000/api/sensor-data`

---

## Prototype Pressure Bands

- **LOW**: `0 – 349` (Nominal contact, displayed in Green)
- **MEDIUM**: `350 – 699` (Caution counter-pressure, displayed in Amber/Yellow)
- **HIGH**: `700+` (Hotspot alert, displayed in Red)

> **Important Disclaimer**: Thresholds are prototype engineering test values, **not** clinical diagnostic limits. AI recommendations are fitting-support guidance, **not** medical advice.

---

## Running with Docker (Recommended)

To start both the frontend and backend in isolated production containers:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Fill in your FIREBASE and GEMINI keys in .env

# 3. Build and launch containers
docker compose up --build
```

- **Frontend**: http://localhost:5173 (or http://localhost:80)
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

---

## Running Locally

### 1. Backend

```bash
cd backend
npm install
node src/server.js
```
The server will bind to `0.0.0.0:5000` to allow ESP32 access over your Wi-Fi LAN.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

---

## Environment Variables

Copy `.env.example` to `.env` in the root or `backend/.env`.

| Variable | Description |
| :--- | :--- |
| `PORT` | Backend port (default: `5000`) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account client email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private RSA key |
| `GEMINI_API_KEY` | Google Gemini API key (RAG & embeddings) |
| `DEFAULT_DEVICE_ID` | Default hardware ID (`SMARTCONTOUR-001`) |
| `VITE_API_URL` | Frontend API target (`http://localhost:5000`) |
| `VITE_WS_URL` | Frontend WebSocket target (`ws://localhost:5000`) |

---

## True RAG System Architecture

The SmartContour AI Assistant is a genuine Retrieval-Augmented Generation system:
1. Ingests all Markdown papers in `knowledge/documents/`.
2. Chunks documents and generates dense vector embeddings with `gemini-embedding-001` (3072 dimensions).
3. Performs semantic cosine similarity retrieval for user queries.
4. Supplies retrieved context + live sensor telemetry strictly to `gemini-3.8-flash`.
5. Enforces zero fabricated sources: if no evidence exists, it states *"I could not find sufficient information in the provided knowledge base."*
