import os
import uuid
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SpeakerProfile, VoiceEmbedding
from ..schemas import SpeakerProfileResponse, VoiceMatchTestResponse
from ..services.audio_service import AudioService
from ..services.speaker_service import speaker_service

router = APIRouter(prefix="/api/speakers", tags=["Speakers"])

@router.get("", response_model=list[SpeakerProfileResponse])
def list_speakers(db: Session = Depends(get_db)):
    """List all registered speaker profiles."""
    return db.query(SpeakerProfile).all()

@router.post("/register", response_model=SpeakerProfileResponse)
async def register_speaker(
    name: str = Form(...),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Registers a new speaker voice profile using a laptop microphone recording.
    Extracts 192-dim speaker embedding and persists in SQLite.
    """
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Speaker name cannot be empty")

    # Read uploaded audio bytes
    audio_bytes = await audio_file.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Audio sample too short. Please record for 3-5 seconds.")

    # Save audio sample to file
    filename = f"voice_sample_{uuid.uuid4().hex[:8]}.wav"
    saved_path = AudioService.save_audio_file(audio_bytes, filename)

    # Process audio into 16kHz float32 numpy
    audio_data, _ = AudioService.process_audio_buffer(audio_bytes, target_sr=16000)
    
    # Extract speaker embedding
    embedding_vec = speaker_service.extract_embedding(audio_data, sample_rate=16000)

    # Check if speaker with same name already exists
    existing = db.query(SpeakerProfile).filter(SpeakerProfile.name == clean_name).first()
    if existing:
        existing.voice_sample_path = saved_path
        # Add new embedding or update
        emb_record = VoiceEmbedding(
            speaker_profile_id=existing.id,
            embedding_data=embedding_vec.tobytes(),
            embedding_dim=len(embedding_vec),
            sample_audio_path=saved_path
        )
        db.add(emb_record)
        db.commit()
        db.refresh(existing)
        return existing

    # Create new profile
    profile = SpeakerProfile(
        name=clean_name,
        voice_sample_path=saved_path
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    # Add embedding record
    emb_record = VoiceEmbedding(
        speaker_profile_id=profile.id,
        embedding_data=embedding_vec.tobytes(),
        embedding_dim=len(embedding_vec),
        sample_audio_path=saved_path
    )
    db.add(emb_record)
    db.commit()
    db.refresh(profile)

    return profile

@router.post("/test-match", response_model=VoiceMatchTestResponse)
async def test_voice_match(
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Tests an audio sample against all registered voice embeddings to verify recognition accuracy.
    """
    audio_bytes = await audio_file.read()
    audio_data, _ = AudioService.process_audio_buffer(audio_bytes, target_sr=16000)
    
    if len(audio_data) < 1600:
        return VoiceMatchTestResponse(
            matched=False,
            speaker_name=None,
            confidence=0.0,
            message="Audio too short to evaluate."
        )

    embedding_vec = speaker_service.extract_embedding(audio_data, sample_rate=16000)
    profile_id, name, score = speaker_service.match_speaker(embedding_vec, db, threshold=0.70)

    if profile_id is not None:
        return VoiceMatchTestResponse(
            matched=True,
            speaker_name=name,
            confidence=round(score, 3),
            message=f"Voice recognized as {name} with {round(score * 100, 1)}% match confidence."
        )
    else:
        return VoiceMatchTestResponse(
            matched=False,
            speaker_name="Unknown Speaker",
            confidence=round(score, 3),
            message=f"Voice not recognized (Best match score: {round(score * 100, 1)}%)."
        )

@router.delete("/{profile_id}")
def delete_speaker(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(SpeakerProfile).filter(SpeakerProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Speaker profile not found")
    db.delete(profile)
    db.commit()
    return {"status": "success", "message": f"Deleted profile {profile.name}"}
