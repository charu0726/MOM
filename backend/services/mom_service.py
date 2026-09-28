import json
import re
import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from ..models import (
    Meeting, TranscriptSegment, ActionItem, Decision, Question,
    Topic, MeetingSummary, MoMDocument, Participant
)
from .data_mining_service import data_mining_service

class MoMService:
    def __init__(self):
        # Comprehensive phrase normalizer for professional business English
        self.phrase_enhancements = [
            (r'\b(project friday tak complete karna hai)\b', 'The project deliverable must be completed by Friday.'),
            (r'\b(friday tak complete karna hai)\b', 'The target milestone needs to be finalized by Friday.'),
            (r'\b(karna hai)\b', 'needs to be executed'),
            (r'\b(karega|karenge)\b', 'will be handling'),
            (r'\b(friday tak)\b', 'by Friday'),
            (r'\b(monday tak)\b', 'by Monday'),
            (r'\b(kal tak)\b', 'by tomorrow'),
            (r'\b(aaj shaam)\b', 'by this evening EOD'),
            (r'\b(theek hai)\b', 'Agreed and confirmed'),
            (r'\b(dekh lena)\b', 'review and investigate'),
            (r'\b(fas gaya|dikkat aa rahi)\b', 'encountering a technical blocker'),
            (r'\b(bana do)\b', 'please implement'),
            (r'\b(bhejo)\b', 'forward the documentation/files'),
            (r'\b(kya|kaise|kyun|kab)\b', ''),
            (r'\b(hai|hain|tha|thi|hoga|raha|rahe|karo)\b', ''),
        ]

        self.hinglish_to_hindi_map = {
            "complete": "पूरा",
            "friday": "शुक्रवार",
            "monday": "सोमवार",
            "tomorrow": "कल",
            "today": "आज",
            "project": "परियोजना (Project)",
            "architecture": "वास्तुकला (Architecture)",
            "backend": "बैकएंड",
            "frontend": "फ्रंटएंड",
            "testing": "परीक्षण (Testing)",
            "api": "एपीआई",
            "database": "डेटाबेस",
            "assigned": "सौंपा गया",
            "decision": "निर्णय",
            "task": "कार्य",
            "action item": "कार्य बिंदु",
            "meeting": "बैठक",
            "fastapi": "फास्टएपीआई (FastAPI)",
            "sqlite": "एसक्यूलाइट (SQLite)",
            "docker": "डॉकर (Docker)",
            "whisper": "व्हिस्पर (Whisper)",
            "integration": "एकीकरण (Integration)"
        }

    def clean_and_professionalize_text(self, text: str) -> str:
        """Transforms spoken utterances into polished, clear, professional business English."""
        cleaned = text.strip()
        for pat, repl in self.phrase_enhancements:
            cleaned = re.sub(pat, repl, cleaned, flags=re.IGNORECASE)

        # Clean redundant whitespaces and grammatical artifacts
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        cleaned = re.sub(r'\b(by by)\b', 'by', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(complete complete)\b', 'complete', cleaned, flags=re.IGNORECASE)

        if not cleaned:
            return text

        # Capitalize first letter
        cleaned = cleaned[0].upper() + cleaned[1:]
        if not cleaned.endswith(('.', '?', '!')):
            cleaned += '.'
        return cleaned

    def translate_to_hindi(self, text: str) -> str:
        """Converts transcript into understandable Hindi (Devanagari script)."""
        translated = text
        for eng, hin in self.hinglish_to_hindi_map.items():
            translated = re.sub(rf'\b{re.escape(eng)}\b', hin, translated, flags=re.IGNORECASE)
        # Format clean ending
        translated = re.sub(r'\s+', ' ', translated).strip()
        return translated

    def translate_to_english(self, text: str) -> str:
        """Normalizes spoken mixed-language text into clear business English."""
        if not text or not text.strip():
            return ""
        return self.clean_and_professionalize_text(text)

    def generate_mom(self, meeting_id: int, db: Session) -> Dict[str, Any]:
        """
        Executes an advanced, professional MoM synthesis pipeline:
        1. Contextual Segment Classification & Natural Normalization
        2. Automatic Speaker Extraction & Action Assignment
        3. Traceable Action Items Matrix, Decisions & Unresolved Questions
        4. Topic Grouping with Executive-Ready Summaries
        5. Formats structured Markdown, HTML, and Multi-lingual versions
        """
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            return {}

        segments = db.query(TranscriptSegment).filter(
            TranscriptSegment.meeting_id == meeting_id
        ).order_by(TranscriptSegment.start_time.asc()).all()

        if not segments:
            empty_mom = MoMDocument(
                meeting_id=meeting.id,
                markdown_content=f"# Minutes of Meeting: {meeting.title}\n\n*No transcript recorded during this session.*",
                html_content=f"<h1>Minutes of Meeting: {meeting.title}</h1><p><em>No transcript recorded.</em></p>"
            )
            db.merge(empty_mom)
            db.commit()
            return {}

        # 1. Process and Clean Segments
        seg_dicts = []
        speakers_set = set()
        for seg in segments:
            seg.filtered_text = data_mining_service.filter_text(seg.original_text)
            seg.segment_type = data_mining_service.classify_segment(seg.original_text)
            seg.english_text = self.clean_and_professionalize_text(seg.original_text)
            seg.hindi_text = self.translate_to_hindi(seg.original_text)
            if seg.speaker_name:
                speakers_set.add(seg.speaker_name)

            seg_dicts.append({
                "id": seg.id,
                "speaker_name": seg.speaker_name,
                "start_time": seg.start_time,
                "end_time": seg.end_time,
                "original_text": seg.original_text,
                "filtered_text": seg.filtered_text,
                "confidence": seg.confidence
            })

        # Run Outlier Detection
        analyzed_segs = data_mining_service.detect_outliers(seg_dicts)
        for idx, s in enumerate(segments):
            s.is_outlier = analyzed_segs[idx].get("is_outlier", False)
            s.outlier_reason = analyzed_segs[idx].get("outlier_reason")

        # 2. Extract Entities, Action Items, Decisions, and Questions
        db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).delete()
        db.query(Decision).filter(Decision.meeting_id == meeting_id).delete()
        db.query(Question).filter(Question.meeting_id == meeting_id).delete()
        db.query(Topic).filter(Topic.meeting_id == meeting_id).delete()

        action_items_list = []
        decisions_list = []
        questions_list = []
        speaker_contributions: Dict[str, List[str]] = {spk: [] for spk in speakers_set}

        for seg in segments:
            speaker = seg.speaker_name or "Speaker"
            entities = data_mining_service.extract_entities(seg.original_text)
            
            # Determine assignee: check if other people mentioned in utterance or current speaker
            assigned_person = entities["people"][0] if entities["people"] else speaker
            deadline = entities["dates_deadlines"][0] if entities["dates_deadlines"] else "Upcoming Sprint / TBD"

            cleaned_summary_point = seg.english_text or seg.original_text

            if seg.segment_type == "Action Item":
                ai = ActionItem(
                    meeting_id=meeting.id,
                    task=cleaned_summary_point,
                    assigned_to=assigned_person,
                    deadline=deadline,
                    status="Pending",
                    segment_id=seg.id
                )
                db.add(ai)
                action_items_list.append(ai)
                speaker_contributions[speaker].append(f"Task Assigned: {ai.task} (Owner: {ai.assigned_to}, Deadline: {ai.deadline})")

            elif seg.segment_type == "Decision":
                dec = Decision(
                    meeting_id=meeting.id,
                    decision_text=cleaned_summary_point,
                    impact="High" if any(kw in seg.original_text.lower() for kw in ["architecture", "final", "pipeline", "release"]) else "Medium",
                    segment_id=seg.id
                )
                db.add(dec)
                decisions_list.append(dec)
                speaker_contributions[speaker].append(f"Key Decision: {dec.decision_text}")

            elif seg.segment_type == "Question":
                q = Question(
                    meeting_id=meeting.id,
                    question_text=seg.original_text,
                    asked_by=speaker,
                    is_answered=False,
                    segment_id=seg.id
                )
                db.add(q)
                questions_list.append(q)
                speaker_contributions[speaker].append(f"Inquiry Raised: {q.question_text}")

            else:
                speaker_contributions[speaker].append(cleaned_summary_point)

        # 3. Topic Clustering & Modeling
        topics_extracted = data_mining_service.extract_topics(seg_dicts)
        for top in topics_extracted:
            t = Topic(
                meeting_id=meeting.id,
                topic_name=top["topic_name"],
                keywords=top["keywords"],
                summary=top["summary"],
                segment_ids_json=json.dumps(top["segment_ids"])
            )
            db.add(t)

        # 4. Construct High-Quality Executive Summary
        num_segs = len(segments)
        speakers_list_str = ", ".join(list(speakers_set)) if speakers_set else "Meeting Participants"
        main_topics_str = ", ".join([t["topic_name"] for t in topics_extracted[:3]]) if topics_extracted else "Project Planning and Deliverables"

        overall_summary = (
            f"The meeting focused on key discussions regarding {main_topics_str}. "
            f"A total of {num_segs} key dialogue turns were logged across {len(speakers_set)} active speaker(s) ({speakers_list_str}). "
            f"The team finalized {len(decisions_list)} strategic decision(s) and assigned {len(action_items_list)} prioritized action item(s) to ensure project alignment and timely execution."
        )

        english_summary = overall_summary
        hindi_summary = (
            f"बैठक में मुख्य रूप से {main_topics_str} से संबंधित विषयों पर चर्चा की गई। "
            f"सत्र के दौरान कुल {len(speakers_set)} वक्ताओं ({speakers_list_str}) के {num_segs} संवाद दर्ज किए गए। "
            f"बैठक में {len(decisions_list)} महत्वपूर्ण निर्णय लिए गए तथा {len(action_items_list)} कार्य बिंदु निर्धारित समय सीमा के साथ सौंपे गए।"
        )

        summary_obj = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting_id).first()
        if not summary_obj:
            summary_obj = MeetingSummary(
                meeting_id=meeting.id,
                overall_summary=overall_summary,
                english_summary=english_summary,
                hindi_summary=hindi_summary,
                speaker_summaries_json=json.dumps(speaker_contributions)
            )
            db.add(summary_obj)
        else:
            summary_obj.overall_summary = overall_summary
            summary_obj.english_summary = english_summary
            summary_obj.hindi_summary = hindi_summary
            summary_obj.speaker_summaries_json = json.dumps(speaker_contributions)

        # 5. Format Standardized, Beautiful MoM Document
        duration_min = round(max(1.0, (segments[-1].end_time - segments[0].start_time) / 60.0), 1)
        start_date = meeting.started_at.strftime("%B %d, %Y - %H:%M") if meeting.started_at else datetime.datetime.utcnow().strftime("%B %d, %Y - %H:%M")
        participants = db.query(Participant).filter(Participant.meeting_id == meeting_id).all()
        participant_names = ", ".join([p.display_name for p in participants]) if participants else speakers_list_str

        # Build simpler, easy-to-read markdown
        md = f"""# Minutes of Meeting

**Meeting Title:** {meeting.title}  
**Code:** {meeting.code}  
**Date:** {start_date} UTC  
**Duration:** ~{duration_min} minutes  
**Participants:** {participant_names}

---

## 1. Meeting Overview
{overall_summary}

---

## 2. Discussion Highlights
"""
        if topics_extracted:
            for t in topics_extracted[:5]:
                md += f"- **{t['topic_name']}**: {t['summary']}\n"
        else:
            md += "- The team reviewed project progress, priorities, and follow-up work.\n"

        md += "\n---\n\n## 3. Speaker Updates\n"
        for spk, pts in speaker_contributions.items():
            md += f"\n### {spk}\n"
            if pts:
                for pt in pts[:3]:
                    md += f"- {pt}\n"
            else:
                md += "- Shared updates and joined the conversation.\n"

        md += "\n---\n\n## 4. Decisions\n"
        if decisions_list:
            for idx, d in enumerate(decisions_list, 1):
                md += f"{idx}. {d.decision_text}\n"
        else:
            md += "- No formal decision was recorded in this meeting.\n"

        md += "\n---\n\n## 5. Action Items Matrix\n\n"
        md += "| # | Task | Owner | Due | Status |\n"
        md += "| --- | --- | --- | --- | --- |\n"
        if action_items_list:
            for idx, a in enumerate(action_items_list, 1):
                md += f"| {idx} | {a.task} | {a.assigned_to} | {a.deadline} | {a.status} |\n"
        else:
            md += "| 1 | Review next steps and plan follow-up | Team | Next sync | Pending |\n"

        md += "\n---\n\n## 6. Follow-up Questions\n"
        if questions_list:
            for q in questions_list:
                status_label = "Answered" if q.is_answered else "Pending"
                md += f"- {q.question_text} ({q.asked_by or 'Attendee'} - {status_label})\n"
        else:
            md += "- No open questions were left unresolved.\n"

        md += f"\n---\n\n## 7. Notes\n- Total dialogue segments: {len(segments)}\n- Speakers tracked: {len(speakers_set)}\n- Issues flagged: {sum(1 for s in segments if s.is_outlier)}\n"

        # Save to DB
        mom_doc = db.query(MoMDocument).filter(MoMDocument.meeting_id == meeting_id).first()
        if not mom_doc:
            mom_doc = MoMDocument(
                meeting_id=meeting.id,
                markdown_content=md,
                html_content=f"<div class='mom-container'>{md}</div>"
            )
            db.add(mom_doc)
        else:
            mom_doc.markdown_content = md
            mom_doc.html_content = f"<div class='mom-container'>{md}</div>"

        db.commit()
        return {"status": "success", "meeting_id": meeting_id}

mom_service = MoMService()
