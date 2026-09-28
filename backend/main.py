import os
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import Meeting, TranscriptSegment, Participant
from .routers import speakers, meetings, mom, auth
from .websocket_manager import manager
from .services.audio_service import AudioService
from .services.speaker_service import speaker_service
from .services.stt_service import stt_service
from .services.data_mining_service import data_mining_service
from .services.mom_service import mom_service

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI-Powered Meeting MoM API",
    description="Real-time speaker-aware transcription, data mining/NLP, and MoM generation engine.",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(speakers.router)
app.include_router(meetings.router)
app.include_router(mom.router)

@app.get("/")
def root():
    return {
        "app": "AI-Powered Meeting MoM System",
        "status": "online",
        "docs": "/docs"
    }

@app.websocket("/ws/meeting/{code}/live")
async def websocket_live_endpoint(
    websocket: WebSocket,
    code: str,
    name: str = Query("Guest"),
    role: str = Query("LISTENER")
):
    """
    Real-time bi-directional broadcast channel for both Host and Listeners.
    Receives live transcript segments, active speaker indicators, attendee events, and status updates.
    """
    clean_code = code.upper().strip()
    await manager.connect(websocket, clean_code, display_name=name, role=role)
    try:
        while True:
            # Keep-alive ping/pong and client commands
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, clean_code, display_name=name)
        await manager.broadcast(clean_code, {
            "type": "participant_left",
            "participant": {"name": name, "role": role},
            "total_attendees": len(manager.active_connections.get(clean_code, []))
        })

@app.websocket("/ws/meeting/{code}/audio")
async def websocket_audio_endpoint(
    websocket: WebSocket,
    code: str
):
    """
    Streaming audio channel from the Host's laptop microphone.
    Processes audio chunks -> STT -> Speaker Recognition -> Database -> Broadcasts to all live listeners.
    """
    clean_code = code.upper().strip()
    await websocket.accept()

    # Create local DB session for audio processing
    from .database import SessionLocal
    db = SessionLocal()

    meeting = db.query(Meeting).filter(Meeting.code == clean_code).first()
    if not meeting:
        await websocket.close(code=4004, reason="Meeting not found")
        db.close()
        return

    meeting_id = meeting.id
    accumulated_bytes = bytearray()
    start_time_offset = 0.0

    try:
        while True:
            # Receive binary audio chunk (e.g. 1-2 second chunks from MediaRecorder)
            data = await websocket.receive_bytes()
            if not data:
                continue

            accumulated_bytes.extend(data)

            # Once we have ~1.5 - 2.5 seconds of audio (~48KB - 80KB)
            if len(accumulated_bytes) >= 40000:
                chunk_bytes = bytes(accumulated_bytes)
                accumulated_bytes.clear()

                audio_data, _ = AudioService.process_audio_buffer(chunk_bytes, target_sr=16000)
                
                # Check for voice activity
                if len(audio_data) > 0 and AudioService.is_speech(audio_data):
                    # 1. Transcribe speech verbatim (Preserve original language)
                    transcribed_text, confidence, lang = stt_service.transcribe_audio_chunk(audio_data, sample_rate=16000)
                    
                    if transcribed_text.strip():
                        # 2. Speaker Diarization & Voice Recognition via ECAPA-TDNN / Cosine Similarity
                        emb = speaker_service.extract_embedding(audio_data, sample_rate=16000)
                        profile_id, speaker_name, sim_score = speaker_service.match_or_cluster_speaker(
                            emb,
                            meeting_id,
                            db,
                            threshold=0.72
                        )

                        # 3. Clean analytical copy & Classify
                        filtered = data_mining_service.filter_text(transcribed_text)
                        seg_type = data_mining_service.classify_segment(transcribed_text)
                        eng_text = mom_service.translate_to_english(transcribed_text)
                        hin_text = mom_service.translate_to_hindi(transcribed_text)

                        seg_duration = round(len(audio_data) / 16000.0, 2)
                        end_time = round(start_time_offset + seg_duration, 2)

                        # Save to database
                        segment = TranscriptSegment(
                            meeting_id=meeting_id,
                            speaker_profile_id=profile_id,
                            speaker_name=speaker_name,
                            start_time=start_time_offset,
                            end_time=end_time,
                            original_text=transcribed_text,
                            filtered_text=filtered,
                            english_text=eng_text,
                            hindi_text=hin_text,
                            segment_type=seg_type,
                            confidence=confidence
                        )
                        db.add(segment)
                        db.commit()
                        db.refresh(segment)

                        start_time_offset = end_time

                        # Broadcast live transcript to all attendees instantly!
                        segment_dict = {
                            "id": segment.id,
                            "speaker_name": segment.speaker_name,
                            "start_time": segment.start_time,
                            "end_time": segment.end_time,
                            "original_text": segment.original_text,
                            "filtered_text": segment.filtered_text,
                            "english_text": segment.english_text,
                            "hindi_text": segment.hindi_text,
                            "segment_type": segment.segment_type,
                            "confidence": segment.confidence,
                            "is_outlier": False
                        }
                        await manager.broadcast_transcript(clean_code, segment_dict)
                        await manager.broadcast_active_speaker(clean_code, segment.speaker_name)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket Audio] Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
