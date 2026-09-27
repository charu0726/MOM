import random
import string
import re
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    Meeting, Participant, TranscriptSegment, SpeakerProfile,
    ActionItem, Decision, Question, Topic, MeetingSummary,
    MeetingAnalytics, MoMDocument
)
from ..schemas import (
    MeetingCreate, MeetingJoin, MeetingResponse, MeetingDetailResponse,
    RenameSpeakerRequest, TranscriptSegmentResponse
)
from ..websocket_manager import manager
from ..services.audio_service import AudioService
from ..services.speaker_service import speaker_service
from ..services.stt_service import stt_service
from ..services.mom_service import mom_service
from ..services.analytics_service import analytics_service
from ..services.data_mining_service import data_mining_service

router = APIRouter(prefix="/api/meetings", tags=["Meetings"])

def generate_meeting_code() -> str:
    """Generates a memorable 6-character code e.g. MOM-4829."""
    digits = ''.join(random.choices(string.digits, k=4))
    return f"MOM-{digits}"

@router.get("", response_model=List[MeetingResponse])
def list_meetings(db: Session = Depends(get_db)):
    """List all created meetings."""
    return db.query(Meeting).order_by(Meeting.created_at.desc()).all()

@router.post("", response_model=MeetingResponse)
def create_meeting(payload: MeetingCreate, db: Session = Depends(get_db)):
    """Create a new meeting and generate a unique meeting code."""
    for _ in range(10):
        code = generate_meeting_code()
        if not db.query(Meeting).filter(Meeting.code == code).first():
            break

    meeting = Meeting(
        code=code,
        title=payload.title or "AI-Powered Meeting",
        status="SCHEDULED"
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # Add Host Participant
    host = Participant(
        meeting_id=meeting.id,
        display_name=payload.host_name or "Host",
        role="HOST"
    )
    db.add(host)
    db.commit()
    db.refresh(meeting)

    return meeting

@router.post("/join", response_model=MeetingResponse)
async def join_meeting(payload: MeetingJoin, db: Session = Depends(get_db)):
    """Join an existing meeting using the unique code."""
    meeting = db.query(Meeting).filter(Meeting.code == payload.code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found. Please check the code.")

    existing = db.query(Participant).filter(
        Participant.meeting_id == meeting.id,
        Participant.display_name == payload.display_name
    ).first()

    if not existing:
        participant = Participant(
            meeting_id=meeting.id,
            display_name=payload.display_name,
            role=payload.role
        )
        db.add(participant)
        db.commit()
        db.refresh(meeting)

    return meeting

@router.get("/{code}", response_model=MeetingDetailResponse)
def get_meeting_detail(code: str, db: Session = Depends(get_db)):
    """Get full details, transcripts, topics, action items, analytics and MoM for a meeting."""
    meeting = db.query(Meeting).filter(Meeting.code == code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting

@router.post("/{code}/start", response_model=MeetingResponse)
async def start_meeting(code: str, db: Session = Depends(get_db)):
    """Start meeting recording."""
    meeting = db.query(Meeting).filter(Meeting.code == code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    meeting.status = "RECORDING"
    meeting.started_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(meeting)

    await manager.broadcast_status(meeting.code, "RECORDING")
    return meeting

@router.post("/{code}/end", response_model=MeetingDetailResponse)
async def end_meeting(code: str, db: Session = Depends(get_db)):
    """
    End meeting, trigger full Data Mining / NLP analysis, calculate analytics, and generate MoM.
    """
    meeting = db.query(Meeting).filter(Meeting.code == code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    meeting.status = "PROCESSING"
    meeting.ended_at = datetime.datetime.utcnow()
    db.commit()

    await manager.broadcast_status(meeting.code, "PROCESSING")

    # Run Data Mining & MoM Synthesis
    mom_service.generate_mom(meeting.id, db)
    analytics_service.calculate_meeting_analytics(meeting.id, db)

    meeting.status = "COMPLETED"
    db.commit()
    db.refresh(meeting)

    await manager.broadcast_status(meeting.code, "COMPLETED")
    await manager.broadcast(meeting.code, {"type": "mom_ready"})

    return meeting

@router.post("/{code}/rename-speaker")
async def rename_speaker(code: str, payload: RenameSpeakerRequest, db: Session = Depends(get_db)):
    """
    Rename an unknown speaker across all transcript segments in the meeting.
    """
    meeting = db.query(Meeting).filter(Meeting.code == code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Update segments
    segments = db.query(TranscriptSegment).filter(
        TranscriptSegment.meeting_id == meeting.id,
        TranscriptSegment.speaker_name == payload.old_speaker_name
    ).all()

    for seg in segments:
        seg.speaker_name = payload.new_speaker_name

    db.commit()

    # Re-run MoM & Analytics if meeting is completed
    if meeting.status == "COMPLETED":
        mom_service.generate_mom(meeting.id, db)
        analytics_service.calculate_meeting_analytics(meeting.id, db)

    await manager.broadcast(meeting.code, {
        "type": "speaker_renamed",
        "old_name": payload.old_speaker_name,
        "new_name": payload.new_speaker_name
    })

    return {"status": "success", "updated_segments": len(segments)}

@router.post("/{code}/segment", response_model=TranscriptSegmentResponse)
async def add_transcript_segment(
    code: str,
    original_text: Optional[str] = Form(None),
    speaker_name: Optional[str] = Form(None),
    start_time: Optional[float] = Form(0.0),
    end_time: Optional[float] = Form(0.0),
    audio_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Accepts live speech audio or manual transcript chunk, performs STT & Speaker recognition,
    persists in SQLite, and broadcasts via WebSocket.
    """
    meeting = db.query(Meeting).filter(Meeting.code == code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    detected_text = original_text or ""
    detected_speaker = speaker_name or "Speaker 1"
    detected_profile_id = None
    confidence_score = 0.92
    chunk_path = None

    # Check for speaker prefix in text e.g. "Charu: We should..." or "Rahul: I will do..."
    prefix_match = re.match(r'^([A-Z][a-zA-Z0-9_\s]{1,20}):\s*(.+)$', detected_text.strip())
    if prefix_match:
        detected_speaker = prefix_match.group(1).strip()
        detected_text = prefix_match.group(2).strip()

    # If audio is uploaded, run STT & Speaker Recognition
    if audio_file:
        audio_bytes = await audio_file.read()
        if len(audio_bytes) > 200:
            filename = f"meeting_{meeting.id}_seg_{start_time}.wav"
            chunk_path = AudioService.save_audio_file(audio_bytes, filename)
            audio_data, _ = AudioService.process_audio_buffer(audio_bytes, target_sr=16000)

            # 1. STT Transcription if text was empty
            if not detected_text.strip():
                stt_text, stt_conf, _ = stt_service.transcribe_audio_chunk(audio_data, sample_rate=16000)
                detected_text = stt_text
                confidence_score = stt_conf

            # 2. Speaker Diarization / Recognition via Cosine Similarity
            if not speaker_name or speaker_name.startswith("Unknown"):
                emb = speaker_service.extract_embedding(audio_data, sample_rate=16000)
                profile_id, match_name, match_score = speaker_service.match_speaker(emb, db, threshold=0.72)
                if profile_id:
                    detected_profile_id = profile_id
                    detected_speaker = match_name

    if not detected_text.strip():
        raise HTTPException(status_code=400, detail="No speech detected in audio chunk")

    # Determine timeline timestamps
    last_seg = db.query(TranscriptSegment).filter(
        TranscriptSegment.meeting_id == meeting.id
    ).order_by(TranscriptSegment.end_time.desc()).first()
    
    calc_start = (last_seg.end_time + 0.5) if last_seg else 0.0
    seg_dur = max(2.0, round(len(detected_text.split()) * 0.4, 1))
    calc_end = round(calc_start + seg_dur, 1)

    # Clean analytical copy & classify
    filtered = data_mining_service.filter_text(detected_text)
    seg_type = data_mining_service.classify_segment(detected_text)
    eng_text = mom_service.clean_and_professionalize_text(detected_text)
    hin_text = mom_service.translate_to_hindi(detected_text)

    # Save to DB
    segment = TranscriptSegment(
        meeting_id=meeting.id,
        speaker_profile_id=detected_profile_id,
        speaker_name=detected_speaker,
        start_time=calc_start,
        end_time=calc_end,
        original_text=detected_text,
        filtered_text=filtered,
        english_text=eng_text,
        hindi_text=hin_text,
        segment_type=seg_type,
        confidence=confidence_score,
        audio_chunk_path=chunk_path
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)

    # Broadcast to all live listeners & speaker
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
        "is_outlier": segment.is_outlier
    }
    await manager.broadcast_transcript(meeting.code, segment_dict)
    await manager.broadcast_active_speaker(meeting.code, segment.speaker_name)

    return segment
