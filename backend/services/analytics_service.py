import json
import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from ..models import (
    Meeting, TranscriptSegment, Participant, Topic,
    ActionItem, Decision, Question, MeetingAnalytics
)

class AnalyticsService:
    @staticmethod
    def calculate_meeting_analytics(meeting_id: int, db: Session) -> Dict[str, Any]:
        """
        Calculates timestamped analytics from actual transcript data.
        """
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            return {}

        segments = db.query(TranscriptSegment).filter(
            TranscriptSegment.meeting_id == meeting_id
        ).order_by(TranscriptSegment.start_time.asc()).all()

        participants = db.query(Participant).filter(Participant.meeting_id == meeting_id).all()
        num_participants = len(participants) if participants else 1

        if not segments:
            return {
                "duration_seconds": 0.0,
                "num_speakers": 0,
                "num_participants": num_participants,
                "words_spoken": 0,
                "speaker_stats": [],
                "topic_count": 0,
                "question_count": 0,
                "decision_count": 0,
                "action_item_count": 0,
                "language_distribution": {"English": 100, "Hindi": 0},
                "segment_types": {}
            }

        if meeting.started_at and meeting.ended_at:
            total_duration = max(1.0, (meeting.ended_at - meeting.started_at).total_seconds())
        elif segments:
            total_duration = max(1.0, segments[-1].end_time - segments[0].start_time)
        else:
            total_duration = 0.0
        total_words = sum(len((s.original_text or "").split()) for s in segments)

        # Speaker level stats
        speaker_stats_map: Dict[str, Dict[str, Any]] = {}
        for s in segments:
            spk = s.speaker_name or "Unknown Speaker"
            if spk not in speaker_stats_map:
                speaker_stats_map[spk] = {
                    "name": spk,
                    "duration": 0.0,
                    "words": 0,
                    "turn_count": 0
                }
            seg_dur = max(0.5, s.end_time - s.start_time)
            speaker_stats_map[spk]["duration"] += seg_dur
            speaker_stats_map[spk]["words"] += len((s.original_text or "").split())
            speaker_stats_map[spk]["turn_count"] += 1

        speaker_stats_list = []
        for spk, data in speaker_stats_map.items():
            pct = round((data["duration"] / total_duration) * 100.0, 1) if total_duration > 0 else 0.0
            speaker_stats_list.append({
                "name": spk,
                "duration_seconds": round(data["duration"], 1),
                "words": data["words"],
                "turn_count": data["turn_count"],
                "percentage": min(100.0, pct)
            })

        # Count topics, questions, decisions, action items
        topic_count = db.query(Topic).filter(Topic.meeting_id == meeting_id).count()
        question_count = db.query(Question).filter(Question.meeting_id == meeting_id).count()
        decision_count = db.query(Decision).filter(Decision.meeting_id == meeting_id).count()
        action_item_count = db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).count()

        # Segment types count
        segment_types_count: Dict[str, int] = {}
        hindi_count = 0
        english_count = 0

        for s in segments:
            stype = s.segment_type or "Discussion"
            segment_types_count[stype] = segment_types_count.get(stype, 0) + 1

            # Simple language detection heuristic
            # Check for Hindi/Devanagari or common Hinglish words
            if re.search(r'[\u0900-\u097F]', s.original_text) or any(w in s.original_text.lower().split() for w in ["karna", "hai", "karega", "tak", "bana", "theek", "kya", "kaise"]):
                hindi_count += 1
            else:
                english_count += 1

        tot_lang = max(1, hindi_count + english_count)
        hindi_pct = round((hindi_count / tot_lang) * 100.0)
        english_pct = 100 - hindi_pct
        lang_dist = {"English": english_pct, "Hindi / Hinglish": hindi_pct}

        # Save/Update in DB
        analytics_obj = db.query(MeetingAnalytics).filter(MeetingAnalytics.meeting_id == meeting_id).first()
        if not analytics_obj:
            analytics_obj = MeetingAnalytics(
                meeting_id=meeting.id,
                duration_seconds=total_duration,
                num_speakers=len(speaker_stats_map),
                num_participants=num_participants,
                words_spoken=total_words,
                speaker_stats_json=json.dumps(speaker_stats_list),
                topic_count=topic_count,
                question_count=question_count,
                decision_count=decision_count,
                action_item_count=action_item_count,
                language_distribution_json=json.dumps(lang_dist),
                segment_types_json=json.dumps(segment_types_count)
            )
            db.add(analytics_obj)
        else:
            analytics_obj.duration_seconds = total_duration
            analytics_obj.num_speakers = len(speaker_stats_map)
            analytics_obj.num_participants = num_participants
            analytics_obj.words_spoken = total_words
            analytics_obj.speaker_stats_json = json.dumps(speaker_stats_list)
            analytics_obj.topic_count = topic_count
            analytics_obj.question_count = question_count
            analytics_obj.decision_count = decision_count
            analytics_obj.action_item_count = action_item_count
            analytics_obj.language_distribution_json = json.dumps(lang_dist)
            analytics_obj.segment_types_json = json.dumps(segment_types_count)

        db.commit()

        return {
            "duration_seconds": total_duration,
            "num_speakers": len(speaker_stats_map),
            "num_participants": num_participants,
            "words_spoken": total_words,
            "speaker_stats": speaker_stats_list,
            "topic_count": topic_count,
            "question_count": question_count,
            "decision_count": decision_count,
            "action_item_count": action_item_count,
            "language_distribution": lang_dist,
            "segment_types": segment_types_count
        }

analytics_service = AnalyticsService()
