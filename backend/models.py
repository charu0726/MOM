import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, LargeBinary
)
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    full_name = Column(String(100), nullable=True)
    password_hash = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    meetings = relationship("Meeting", back_populates="host")
    speaker_profile = relationship("SpeakerProfile", back_populates="user", uselist=False)

class SpeakerProfile(Base):
    __tablename__ = "speaker_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    voice_sample_path = Column(String(255), nullable=True)
    registered_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="speaker_profile")
    embeddings = relationship("VoiceEmbedding", back_populates="speaker_profile", cascade="all, delete-orphan")
    transcript_segments = relationship("TranscriptSegment", back_populates="speaker_profile")

class VoiceEmbedding(Base):
    __tablename__ = "voice_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    speaker_profile_id = Column(Integer, ForeignKey("speaker_profiles.id"), nullable=False)
    embedding_data = Column(LargeBinary, nullable=False)  # Float32 NumPy array serialized as bytes
    embedding_dim = Column(Integer, default=192)
    sample_audio_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    speaker_profile = relationship("SpeakerProfile", back_populates="embeddings")

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False, default="Untitled Meeting")
    host_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="SCHEDULED")  # SCHEDULED, RECORDING, PROCESSING, COMPLETED
    audio_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    host = relationship("User", back_populates="meetings")
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    transcript_segments = relationship("TranscriptSegment", back_populates="meeting", cascade="all, delete-orphan")
    speaker_clusters = relationship("SpeakerCluster", back_populates="meeting", cascade="all, delete-orphan")
    topics = relationship("Topic", back_populates="meeting", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")
    decisions = relationship("Decision", back_populates="meeting", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="meeting", cascade="all, delete-orphan")
    summary = relationship("MeetingSummary", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    analytics = relationship("MeetingAnalytics", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    mom_document = relationship("MoMDocument", back_populates="meeting", uselist=False, cascade="all, delete-orphan")

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    display_name = Column(String(100), nullable=False)
    role = Column(String(20), default="LISTENER")  # HOST, SPEAKER, LISTENER
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

    meeting = relationship("Meeting", back_populates="participants")

class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    speaker_profile_id = Column(Integer, ForeignKey("speaker_profiles.id"), nullable=True)
    speaker_name = Column(String(100), nullable=False, default="Unknown Speaker 1")
    start_time = Column(Float, nullable=False, default=0.0)
    end_time = Column(Float, nullable=False, default=0.0)
    
    # Text in various formats
    original_text = Column(Text, nullable=False)  # Verbatim unchanged original speech
    filtered_text = Column(Text, nullable=True)   # Analytical filtered text (no filler words)
    english_text = Column(Text, nullable=True)    # Translated/Normalized English
    hindi_text = Column(Text, nullable=True)      # Translated/Normalized Hindi
    
    # Classification & ML attributes
    segment_type = Column(String(50), default="Discussion")  # Discussion, Question, Decision, Action Item, Suggestion, Problem, Important Information
    confidence = Column(Float, default=0.9)
    is_outlier = Column(Boolean, default=False)
    outlier_reason = Column(String(200), nullable=True)
    audio_chunk_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    meeting = relationship("Meeting", back_populates="transcript_segments")
    speaker_profile = relationship("SpeakerProfile", back_populates="transcript_segments")
    action_items = relationship("ActionItem", back_populates="segment")
    decisions = relationship("Decision", back_populates="segment")
    questions = relationship("Question", back_populates="segment")

class SpeakerCluster(Base):
    __tablename__ = "speaker_clusters"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    cluster_label = Column(String(50), nullable=False)
    assigned_speaker_name = Column(String(100), nullable=False)
    centroid_bytes = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    meeting = relationship("Meeting", back_populates="speaker_clusters")

class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    topic_name = Column(String(150), nullable=False)
    keywords = Column(Text, nullable=True)  # JSON or comma-separated
    summary = Column(Text, nullable=True)
    segment_ids_json = Column(Text, nullable=True)  # JSON list of segment ids

    meeting = relationship("Meeting", back_populates="topics")

class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    task = Column(Text, nullable=False)
    assigned_to = Column(String(100), default="Unassigned")
    deadline = Column(String(100), default="TBD")
    status = Column(String(50), default="Pending")
    segment_id = Column(Integer, ForeignKey("transcript_segments.id"), nullable=True)

    meeting = relationship("Meeting", back_populates="action_items")
    segment = relationship("TranscriptSegment", back_populates="action_items")

class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    decision_text = Column(Text, nullable=False)
    impact = Column(String(100), nullable=True)
    segment_id = Column(Integer, ForeignKey("transcript_segments.id"), nullable=True)

    meeting = relationship("Meeting", back_populates="decisions")
    segment = relationship("TranscriptSegment", back_populates="decisions")

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    asked_by = Column(String(100), nullable=True)
    is_answered = Column(Boolean, default=False)
    answer_text = Column(Text, nullable=True)
    segment_id = Column(Integer, ForeignKey("transcript_segments.id"), nullable=True)

    meeting = relationship("Meeting", back_populates="questions")
    segment = relationship("TranscriptSegment", back_populates="questions")

class MeetingSummary(Base):
    __tablename__ = "meeting_summaries"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, unique=True)
    overall_summary = Column(Text, nullable=False)
    english_summary = Column(Text, nullable=True)
    hindi_summary = Column(Text, nullable=True)
    speaker_summaries_json = Column(Text, nullable=True)  # JSON { "Charu": ["point 1", ...], ... }
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    meeting = relationship("Meeting", back_populates="summary")

class MeetingAnalytics(Base):
    __tablename__ = "meeting_analytics"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, unique=True)
    duration_seconds = Column(Float, default=0.0)
    num_speakers = Column(Integer, default=0)
    num_participants = Column(Integer, default=0)
    words_spoken = Column(Integer, default=0)
    speaker_stats_json = Column(Text, nullable=True)  # JSON list of speaker durations, words, percentages
    topic_count = Column(Integer, default=0)
    question_count = Column(Integer, default=0)
    decision_count = Column(Integer, default=0)
    action_item_count = Column(Integer, default=0)
    language_distribution_json = Column(Text, nullable=True)  # JSON {"English": 60, "Hindi": 40}
    segment_types_json = Column(Text, nullable=True)          # JSON counts of segment types
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    meeting = relationship("Meeting", back_populates="analytics")

class MoMDocument(Base):
    __tablename__ = "mom_documents"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, unique=True)
    markdown_content = Column(Text, nullable=False)
    html_content = Column(Text, nullable=True)
    pdf_path = Column(String(255), nullable=True)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)

    meeting = relationship("Meeting", back_populates="mom_document")
