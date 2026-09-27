# AI-Powered Meeting Minutes of Meeting (MoM) Web Application

A complete web application that records meetings directly from the **speaker's laptop microphone**, generates a real-time speaker-aware live transcript via WebSockets, applies Data Mining and NLP techniques, and automatically synthesizes traceable Minutes of Meeting (MoM) with English and Hindi translations, analytics charts, and action matrices.

---

## 🌟 Key Capabilities & Features

### 1. User Roles
* **Speaker / Host**:
  - Create a meeting and generate unique 6-digit meeting codes (e.g. `MOM-4829`).
  - Register speaker voice profiles via laptop microphone.
  - Start, pause, and end meetings.
  - Stream live microphone audio without requiring physical external hardware.
  - Live speaker-labelled transcript feed with inline speaker renaming.
  - Access comprehensive analytics and generated MoM.
* **Listener**:
  - Enter meeting code to join the live room.
  - Stream synchronized live transcript in real-time via WebSockets.
  - Microphone is strictly disabled (read-only mode).
  - Automatically transitions to view final MoM and analytics upon meeting completion.

### 2. Speaker Recognition & Diarization
* **Voice Profile Enrollment**: Enrolls speaker voice samples via laptop mic into 192-dimensional acoustic filterbank/ECAPA-TDNN feature embeddings.
* **Cosine Similarity Matching**: Matches live speech against enrolled database profiles with confidence metrics.
* **Unregistered Speakers**: Labelled as `Unknown Speaker 1`, `Unknown Speaker 2`, etc., with live renaming support across the entire meeting transcript.

### 3. Bilingual / Multilingual Verbatim STT
* **Verbatim Preservation**: Preserves original spoken language verbatim (e.g., `"Project Friday tak complete karna hai."`). Never alters original speech.
* **Multi-Format Output**:
  1. *Original Verbatim Transcript*
  2. *Proper English Version*
  3. *Proper Hindi Version (हिंदी संस्करण)*

### 4. Data Mining & NLP Pipeline
* **Filtering**: Cleans analytical copy by removing filler words (`um`, `uh`, `you know`, `basically`, `matlab`, `arre`) and acoustic noise while preserving the pristine original transcript.
* **Classification**: Categorizes segments into *Discussion, Question, Decision, Action Item, Suggestion, Problem, Important Information*.
* **Information Extraction (NER)**: Extracts People/Assignees, Dates/Deadlines, Organizations, and Technology keywords.
* **Topic Modeling**: Agglomerative clustering and TF-IDF feature extraction to group discussion topics with summaries and keywords.
* **Outlier Detection**: IsolationForest & confidence thresholding to flag noisy or anomalous audio segments.

### 5. MoM Generation & Traceability
* **Traceable Matrix**: Every action item and decision is traceable back to its source transcript segment ID.
* **Structured Sections**:
  1. Meeting Overview
  2. Agenda / Topics
  3. Discussion Summary
  4. Speaker-wise Contributions
  5. Decisions
  6. Action Items Matrix (`Task | Assigned To | Deadline | Status | Segment ID`)
  7. Open Questions
  8. Important Points & Technologies
  9. Meeting Analytics

### 6. SQLite Database (`meeting_mom.db`)
All 13 tables implemented via SQLAlchemy:
* `users`
* `meetings`
* `participants`
* `speaker_profiles`
* `voice_embeddings`
* `transcript_segments`
* `speaker_clusters`
* `topics`
* `action_items`
* `decisions`
* `questions`
* `meeting_summaries`
* `meeting_analytics`
* `mom_documents`

---

## 🚀 Quick Start & How to Run

### Prerequisites
* Python 3.10+
* Node.js 18+ and npm

### 1. Launch Backend and Frontend together
```bash
python run_app.py
```
Or run individually:

**Backend:**
```bash
.\venv\Scripts\activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

* **Frontend UI:** `http://localhost:5173`
* **Backend API Docs:** `http://localhost:8000/docs`

---

## 🧪 Running Automated Test Suite

Run the full end-to-end test suite:
```bash
.\venv\Scripts\python tests\test_pipeline.py
```
