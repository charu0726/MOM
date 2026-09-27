import os
import sys
import numpy as np

# Force UTF-8 on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine, Base
from backend.models import (
    User, Meeting, Participant, SpeakerProfile, VoiceEmbedding,
    TranscriptSegment, ActionItem, Decision, Question, Topic,
    MeetingSummary, MeetingAnalytics, MoMDocument
)
from backend.services.speaker_service import speaker_service
from backend.services.data_mining_service import data_mining_service
from backend.services.mom_service import mom_service
from backend.services.analytics_service import analytics_service

def test_full_pipeline():
    print("==================================================")
    print("Starting Comprehensive Meeting MoM Pipeline Test")
    print("==================================================")

    # 1. Initialize Database Tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clean up any existing test records
    existing_mtg = db.query(Meeting).filter(Meeting.code == "MOM-TEST").first()
    if existing_mtg:
        db.delete(existing_mtg)
    for spk_name in ["Charu", "Rahul"]:
        prof = db.query(SpeakerProfile).filter(SpeakerProfile.name == spk_name).first()
        if prof:
            db.delete(prof)
    db.commit()

    # 2. Test Voice Profile Registration & Cosine Similarity
    print("\n[1] Testing Voice Profile Registration & Embeddings...")
    sr = 16000
    t = np.linspace(0, 3, sr * 3)
    audio_charu = 0.5 * np.sin(2 * np.pi * 220 * t) + 0.3 * np.sin(2 * np.pi * 440 * t)
    audio_rahul = 0.5 * np.sin(2 * np.pi * 120 * t) + 0.3 * np.sin(2 * np.pi * 240 * t)

    emb_charu = speaker_service.extract_embedding(audio_charu, sample_rate=sr)
    emb_rahul = speaker_service.extract_embedding(audio_rahul, sample_rate=sr)

    assert len(emb_charu) == 192, "Speaker embedding dimension should be 192"
    assert len(emb_rahul) == 192, "Speaker embedding dimension should be 192"

    prof_charu = SpeakerProfile(name="Charu")
    db.add(prof_charu)
    db.commit()
    db.refresh(prof_charu)

    db.add(VoiceEmbedding(
        speaker_profile_id=prof_charu.id,
        embedding_data=emb_charu.tobytes(),
        embedding_dim=192
    ))

    prof_rahul = SpeakerProfile(name="Rahul")
    db.add(prof_rahul)
    db.commit()
    db.refresh(prof_rahul)

    db.add(VoiceEmbedding(
        speaker_profile_id=prof_rahul.id,
        embedding_data=emb_rahul.tobytes(),
        embedding_dim=192
    ))
    db.commit()

    # Test Cosine Similarity matching
    pid, name, score = speaker_service.match_speaker(emb_charu, db, threshold=0.70)
    print(f"Charu Voice Match Result: Identified as '{name}' (Confidence: {score:.3f})")
    assert name == "Charu", f"Expected Charu, got {name}"

    pid2, name2, score2 = speaker_service.match_speaker(emb_rahul, db, threshold=0.70)
    print(f"Rahul Voice Match Result: Identified as '{name2}' (Confidence: {score2:.3f})")
    assert name2 == "Rahul", f"Expected Rahul, got {name2}"

    # 3. Test Meeting Creation & Participants
    print("\n[2] Testing Meeting Creation...")
    meeting = Meeting(
        code="MOM-TEST",
        title="Q4 AI MoM Project Architecture Review",
        status="RECORDING"
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    db.add(Participant(meeting_id=meeting.id, display_name="Charu", role="HOST"))
    db.add(Participant(meeting_id=meeting.id, display_name="Rahul", role="LISTENER"))
    db.commit()

    # 4. Ingest Transcript Utterances (Preserving Original Mixed Hinglish / English Speech)
    print("\n[3] Ingesting Multilingual Utterances...")
    sample_dialogue = [
        ("Charu", 0.0, 4.5, "Welcome everyone. Aaj hum backend architecture aur API testing discuss karenge."),
        ("Rahul", 5.0, 9.2, "Sure Charu. Main FastAPI backend aur SQLite database setup kar chuka hoon."),
        ("Charu", 10.0, 15.0, "Great! Project Friday tak complete karna hai. Rahul will take care of API integration."),
        ("Rahul", 15.5, 19.8, "Theek hai, I will complete the integration by Friday EOD."),
        ("Charu", 20.0, 24.5, "We finalized the decision to use faster-whisper and SpeechBrain for the pipeline."),
        ("Rahul", 25.0, 29.0, "Should we also enable Docker deployment for the staging server?"),
        ("Charu", 29.5, 33.0, "Yes, Docker deployment is vital for continuous integration.")
    ]

    for spk, st, et, text in sample_dialogue:
        filtered = data_mining_service.filter_text(text)
        stype = data_mining_service.classify_segment(text)
        seg = TranscriptSegment(
            meeting_id=meeting.id,
            speaker_name=spk,
            start_time=st,
            end_time=et,
            original_text=text,
            filtered_text=filtered,
            segment_type=stype,
            confidence=0.92
        )
        db.add(seg)
    db.commit()

    # 5. Run MoM Generation & Data Mining Pipeline
    print("\n[4] Executing Data Mining, NER, Topic Clustering & MoM Generation...")
    mom_service.generate_mom(meeting.id, db)
    analytics_service.calculate_meeting_analytics(meeting.id, db)

    # 6. Verify Results & Invariants
    print("\n[5] Verifying MoM Invariants & Outputs...")
    
    # Verify Original Transcript is UNCHANGED
    segs = db.query(TranscriptSegment).filter(TranscriptSegment.meeting_id == meeting.id).all()
    assert segs[2].original_text == "Great! Project Friday tak complete karna hai. Rahul will take care of API integration.", \
        "Original transcript must NEVER be modified!"
    print("[OK] Verbatim Original Transcript integrity verified.")

    # Verify Translations
    assert segs[2].english_text is not None and len(segs[2].english_text) > 5
    assert segs[2].hindi_text is not None and len(segs[2].hindi_text) > 5
    print(f"  - Original: {segs[2].original_text}")
    print(f"  - English:  {segs[2].english_text}")
    print(f"  - Hindi:    {segs[2].hindi_text}")

    # Verify Action Items Extraction & Traceability
    actions = db.query(ActionItem).filter(ActionItem.meeting_id == meeting.id).all()
    assert len(actions) > 0, "Action items should be extracted"
    for a in actions:
        assert a.segment_id is not None, "Action item must have traceable segment_id"
        print(f"  [OK] Action Item: Task='{a.task}' | Assigned='{a.assigned_to}' | Deadline='{a.deadline}' | Segment=#{a.segment_id}")

    # Verify Decisions Extraction & Traceability
    decs = db.query(Decision).filter(Decision.meeting_id == meeting.id).all()
    assert len(decs) > 0, "Decisions should be extracted"
    for d in decs:
        assert d.segment_id is not None, "Decision must have traceable segment_id"
        print(f"  [OK] Decision: '{d.decision_text}' | Impact={d.impact} | Segment=#{d.segment_id}")

    # Verify Questions Extraction & Traceability
    questions = db.query(Question).filter(Question.meeting_id == meeting.id).all()
    assert len(questions) > 0, "Questions should be extracted"
    for q in questions:
        assert q.segment_id is not None, "Question must have traceable segment_id"
        print(f"  [OK] Question: '{q.question_text}' | Asked by={q.asked_by} | Segment=#{q.segment_id}")

    # Verify Topics Extracted
    topics = db.query(Topic).filter(Topic.meeting_id == meeting.id).all()
    assert len(topics) > 0, "Topics should be extracted"
    for t in topics:
        print(f"  [OK] Topic: '{t.topic_name}' (Keywords: {t.keywords})")

    # Verify MoM Document
    mom_doc = db.query(MoMDocument).filter(MoMDocument.meeting_id == meeting.id).first()
    assert mom_doc is not None
    assert "Minutes of Meeting" in mom_doc.markdown_content
    assert "1. Meeting Overview" in mom_doc.markdown_content
    assert "Action Items Matrix" in mom_doc.markdown_content
    print("[OK] Full MoM document generated according to specifications.")

    # Verify Analytics
    analytics = db.query(MeetingAnalytics).filter(MeetingAnalytics.meeting_id == meeting.id).first()
    assert analytics is not None
    assert analytics.words_spoken > 0
    assert analytics.num_speakers == 2
    print(f"[OK] Analytics verified: {analytics.words_spoken} words, {analytics.num_speakers} speakers, {analytics.duration_seconds:.1f}s duration.")

    db.close()
    print("\n==================================================")
    print("ALL PIPELINE & DATA MINING TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    test_full_pipeline()
