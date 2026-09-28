export interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

export interface SpeakerProfile {
  id: number;
  name: string;
  user_id?: number;
  voice_sample_path?: string;
  registered_at: string;
}

export interface VoiceMatchResult {
  matched: boolean;
  speaker_name?: string;
  confidence: number;
  message: string;
}

export interface TranscriptSegment {
  id: number;
  meeting_id: number;
  speaker_profile_id?: number;
  speaker_name: string;
  start_time: number;
  end_time: number;
  original_text: string;
  filtered_text?: string;
  english_text?: string;
  hindi_text?: string;
  segment_type: string;
  confidence: number;
  is_outlier: boolean;
  outlier_reason?: string;
  created_at?: string;
}

export interface Participant {
  id: number;
  meeting_id: number;
  display_name: string;
  role: 'HOST' | 'SPEAKER' | 'LISTENER';
  is_active: boolean;
  joined_at: string;
}

export interface ActionItem {
  id: number;
  task: string;
  assigned_to: string;
  deadline: string;
  status: string;
  segment_id?: number;
}

export interface Decision {
  id: number;
  decision_text: string;
  impact?: string;
  segment_id?: number;
}

export interface Question {
  id: number;
  question_text: string;
  asked_by?: string;
  is_answered: boolean;
  answer_text?: string;
  segment_id?: number;
}

export interface Topic {
  id: number;
  topic_name: string;
  keywords?: string;
  summary?: string;
  segment_ids_json?: string;
}

export interface MeetingSummary {
  overall_summary: string;
  english_summary?: string;
  hindi_summary?: string;
  speaker_summaries_json?: string;
}

export interface SpeakerStat {
  name: string;
  duration_seconds: number;
  words: number;
  turn_count: number;
  percentage: number;
}

export interface MeetingAnalytics {
  duration_seconds: number;
  num_speakers: number;
  num_participants: number;
  words_spoken: number;
  speaker_stats_json?: string;
  topic_count: number;
  question_count: number;
  decision_count: number;
  action_item_count: number;
  language_distribution_json?: string;
  segment_types_json?: string;
}

export interface MoMDocument {
  markdown_content: string;
  html_content?: string;
  pdf_path?: string;
  generated_at: string;
}

export interface MeetingDetail {
  id: number;
  code: string;
  title: string;
  status: 'SCHEDULED' | 'RECORDING' | 'PROCESSING' | 'COMPLETED';
  created_at: string;
  started_at?: string;
  ended_at?: string;
  participants: Participant[];
  transcript_segments: TranscriptSegment[];
  topics: Topic[];
  action_items: ActionItem[];
  decisions: Decision[];
  questions: Question[];
  summary?: MeetingSummary;
  analytics?: MeetingAnalytics;
  mom_document?: MoMDocument;
}
