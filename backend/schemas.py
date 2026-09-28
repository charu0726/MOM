import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# User Schemas
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    user: UserResponse
    token: str
    message: str

# Speaker Profile Schemas
class SpeakerProfileBase(BaseModel):
    name: str

class SpeakerProfileCreate(SpeakerProfileBase):
    pass

class SpeakerProfileResponse(SpeakerProfileBase):
    id: int
    user_id: Optional[int] = None
    voice_sample_path: Optional[str] = None
    registered_at: datetime.datetime

    class Config:
        from_attributes = True

class VoiceMatchTestResponse(BaseModel):
    matched: bool
    speaker_name: Optional[str] = None
    confidence: float
    message: str

# Transcript Segment Schemas
class TranscriptSegmentBase(BaseModel):
    speaker_name: str
    start_time: float
    end_time: float
    original_text: str
    filtered_text: Optional[str] = None
    english_text: Optional[str] = None
    hindi_text: Optional[str] = None
    segment_type: str = "Discussion"
    confidence: float = 0.9
    is_outlier: bool = False
    outlier_reason: Optional[str] = None

class TranscriptSegmentCreate(TranscriptSegmentBase):
    meeting_id: int
    speaker_profile_id: Optional[int] = None
    audio_chunk_path: Optional[str] = None

class TranscriptSegmentResponse(TranscriptSegmentBase):
    id: int
    meeting_id: int
    speaker_profile_id: Optional[int] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Participant Schemas
class ParticipantBase(BaseModel):
    display_name: str
    role: str = "LISTENER"  # HOST, SPEAKER, LISTENER

class ParticipantCreate(ParticipantBase):
    meeting_id: int
    user_id: Optional[int] = None

class ParticipantResponse(ParticipantBase):
    id: int
    meeting_id: int
    is_active: bool
    joined_at: datetime.datetime

    class Config:
        from_attributes = True

# Action Items, Decisions, Questions
class ActionItemResponse(BaseModel):
    id: int
    task: str
    assigned_to: str
    deadline: str
    status: str
    segment_id: Optional[int] = None

    class Config:
        from_attributes = True

class DecisionResponse(BaseModel):
    id: int
    decision_text: str
    impact: Optional[str] = None
    segment_id: Optional[int] = None

    class Config:
        from_attributes = True

class QuestionResponse(BaseModel):
    id: int
    question_text: str
    asked_by: Optional[str] = None
    is_answered: bool
    answer_text: Optional[str] = None
    segment_id: Optional[int] = None

    class Config:
        from_attributes = True

class TopicResponse(BaseModel):
    id: int
    topic_name: str
    keywords: Optional[str] = None
    summary: Optional[str] = None
    segment_ids_json: Optional[str] = None

    class Config:
        from_attributes = True

class MeetingSummaryResponse(BaseModel):
    overall_summary: str
    english_summary: Optional[str] = None
    hindi_summary: Optional[str] = None
    speaker_summaries_json: Optional[str] = None

    class Config:
        from_attributes = True

class MeetingAnalyticsResponse(BaseModel):
    duration_seconds: float
    num_speakers: int
    num_participants: int
    words_spoken: int
    speaker_stats_json: Optional[str] = None
    topic_count: int
    question_count: int
    decision_count: int
    action_item_count: int
    language_distribution_json: Optional[str] = None
    segment_types_json: Optional[str] = None

    class Config:
        from_attributes = True

class MoMDocumentResponse(BaseModel):
    markdown_content: str
    html_content: Optional[str] = None
    pdf_path: Optional[str] = None
    generated_at: datetime.datetime

    class Config:
        from_attributes = True

# Meeting Schemas
class MeetingCreate(BaseModel):
    title: str = "Meeting"
    host_name: str = "Host"

class MeetingJoin(BaseModel):
    code: str
    display_name: str
    role: str = "LISTENER"

class MeetingResponse(BaseModel):
    id: int
    code: str
    title: str
    status: str
    created_at: datetime.datetime
    started_at: Optional[datetime.datetime] = None
    ended_at: Optional[datetime.datetime] = None
    participants: List[ParticipantResponse] = []

    class Config:
        from_attributes = True

class MeetingDetailResponse(MeetingResponse):
    transcript_segments: List[TranscriptSegmentResponse] = []
    topics: List[TopicResponse] = []
    action_items: List[ActionItemResponse] = []
    decisions: List[DecisionResponse] = []
    questions: List[QuestionResponse] = []
    summary: Optional[MeetingSummaryResponse] = None
    analytics: Optional[MeetingAnalyticsResponse] = None
    mom_document: Optional[MoMDocumentResponse] = None

class RenameSpeakerRequest(BaseModel):
    meeting_id: int
    old_speaker_name: str
    new_speaker_name: str
