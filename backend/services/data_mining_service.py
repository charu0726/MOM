import re
import json
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import AgglomerativeClustering, DBSCAN
from sklearn.ensemble import IsolationForest

class DataMiningService:
    def __init__(self):
        # Comprehensive list of English and Hindi/Hinglish filler words
        self.filler_patterns = [
            r'\b(um+|uh+|er+|ah+|h+m+)\b',
            r'\b(you know|i mean|like|basically|actually|literally|sort of|kind of)\b',
            r'\b(right\?|okay\?|got it\?)\b',
            r'\b(matlab|arre|toh|yaani|achha|theek hai|suno|dekho)\b'
        ]
        
        # Classification keywords & patterns
        self.action_item_patterns = [
            r'\b(will|shall|need to|have to|must|assigned to|responsible for|take care of|complete|finish|deploy|implement|create|fix|build)\b',
            r'\b(karna hai|karega|karenge|dekh lena|bana do|bhejo|complete karo)\b',
            r'\b(task|action item|todo|ticket|jira|pr)\b'
        ]
        self.decision_patterns = [
            r'\b(we decided|agreed upon|we will go with|finalized|conclusion is|approved|rejected|chosen|settled)\b',
            r'\b(final hua|decide kiya|yehi karenge|pakka|theek kiya)\b'
        ]
        self.question_patterns = [
            r'\?',
            r'\b(what|why|how|when|where|who|which|can we|should we|is it|do we|could you)\b',
            r'\b(kya|kaise|kyun|kab|kahan|kaun|hoga kya|kar sakte hai kya)\b'
        ]
        self.suggestion_patterns = [
            r'\b(i suggest|my recommendation|we could|what if|how about|maybe we should|propose)\b',
            r'\b(mera sujhav|aisa kar sakte hai|better hoga|recommendation)\b'
        ]
        self.problem_patterns = [
            r'\b(issue|bug|error|problem|failure|delay|blocker|risk|challenge|failing|broken)\b',
            r'\b(dikkat|problem|error aa raha|fas gaya|ruk gaya)\b'
        ]
        self.important_patterns = [
            r'\b(note that|important|critical|key point|remember|vital|highlight|milestone)\b',
            r'\b(dhyan rakhna|zaroori|important hai|yaad rakhna)\b'
        ]

        # Tech keywords vocabulary for Entity extraction
        self.tech_keywords = [
            "React", "TypeScript", "JavaScript", "Python", "FastAPI", "SQLite", "PostgreSQL",
            "Docker", "Kubernetes", "AWS", "GCP", "Azure", "WebSockets", "Whisper", "SpeechBrain",
            "PyTorch", "TensorFlow", "API", "GraphQL", "Redis", "Kafka", "Git", "GitHub", "Jira",
            "Tailwind", "CSS", "HTML", "Node.js", "Express", "Vite", "Next.js", "CI/CD", "Linux"
        ]

    # 1. FILTERING
    def filter_text(self, text: str) -> str:
        """
        Cleans analytical copy of the text by removing filler words and acoustic artifacts.
        NOTE: Never modifies the original transcript.
        """
        cleaned = text
        for pat in self.filler_patterns:
            cleaned = re.sub(pat, '', cleaned, flags=re.IGNORECASE)
        # Clean extra spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def is_noisy_or_duplicate(self, text: str, previous_texts: List[str], confidence: float) -> Tuple[bool, Optional[str]]:
        """Checks if a segment is noise, duplicate, or low confidence."""
        if confidence < 0.35:
            return True, "Low STT confidence score"
        
        cleaned = text.strip()
        if len(cleaned) < 2 or (len(cleaned.split()) == 1 and len(cleaned) < 3):
            return True, "Short acoustic artifact / noise"

        # Check exact or near duplicate
        for prev in previous_texts[-5:]:
            if cleaned.lower() == prev.lower():
                return True, "Duplicate consecutive utterance"

        return False, None

    # 2. CLASSIFICATION
    def classify_segment(self, text: str) -> str:
        """
        Classifies segment into:
        Discussion, Question, Decision, Action Item, Suggestion, Problem, Important Information.
        """
        lower = text.lower()

        # Decision
        for p in self.decision_patterns:
            if re.search(p, lower):
                return "Decision"

        # Action Item
        for p in self.action_item_patterns:
            if re.search(p, lower) and any(kw in lower for kw in ["friday", "monday", "tomorrow", "today", "deadline", "assigned", "tak", "karna", "will", "need"]):
                return "Action Item"

        # Question
        if "?" in text:
            return "Question"
        for p in self.question_patterns:
            if re.search(p, lower):
                return "Question"

        # Problem
        for p in self.problem_patterns:
            if re.search(p, lower):
                return "Problem"

        # Suggestion
        for p in self.suggestion_patterns:
            if re.search(p, lower):
                return "Suggestion"

        # Important Information
        for p in self.important_patterns:
            if re.search(p, lower):
                return "Important Information"

        # Default fallback
        return "Discussion"

    # 3. INFORMATION EXTRACTION (NER, Dates, Deadlines, Entities)
    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extracts structured entities: People, Deadlines/Dates, Tasks, Decisions, Organizations, Technologies.
        """
        entities = {
            "people": [],
            "dates_deadlines": [],
            "technologies": [],
            "organizations": []
        }

        # Date & Deadline extraction
        date_patterns = [
            r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
            r'\b(today|tomorrow|yesterday|eod|end of day|end of week|next week|this week)\b',
            r'\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))\b',
            r'\b(kal tak|aaj shaam|agla hafta|friday tak|monday tak)\b'
        ]
        for p in date_patterns:
            matches = re.findall(p, text, flags=re.IGNORECASE)
            for m in matches:
                entities["dates_deadlines"].append(m.title() if isinstance(m, str) else str(m))

        # Technology extraction
        for tech in self.tech_keywords:
            if re.search(rf'\b{re.escape(tech)}\b', text, flags=re.IGNORECASE):
                entities["technologies"].append(tech)

        # Organization / Team extraction
        org_patterns = [
            r'\b([A-Z][a-zA-Z0-9]+(?:\s+Team|\s+Dept|\s+Group|\s+Corporation|\s+Inc|\s+LLC|\s+Technologies))\b',
            r'\b(Frontend|Backend|DevOps|QA|Design|Product|Engineering|Sales|Marketing)\s+team\b'
        ]
        for p in org_patterns:
            matches = re.findall(p, text, flags=re.IGNORECASE)
            for m in matches:
                entities["organizations"].append(m)

        # Person name candidates (Capitalized names or speaker mentions)
        name_patterns = [
            r'\b([A-Z][a-z]+)\s+(?:will|should|to|can|has|reported|suggested)\b',
            r'\b(?:assign(?:ed)? to|handover to|ask)\s+([A-Z][a-z]+)\b'
        ]
        for p in name_patterns:
            matches = re.findall(p, text)
            for m in matches:
                if m not in self.tech_keywords and m not in ["Friday", "Monday", "Today", "Tomorrow"]:
                    entities["people"].append(m)

        # Remove duplicates
        for k in entities:
            entities[k] = list(dict.fromkeys(entities[k]))

        return entities

    # 4. TOPIC EXTRACTION & CLUSTERING
    def extract_topics(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Uses TF-IDF + Agglomerative Clustering / K-Means to identify major meeting topics and keywords.
        """
        if not segments:
            return []

        texts = [s.get("filtered_text") or s.get("original_text", "") for s in segments]
        non_empty = [t for t in texts if len(t.strip()) > 3]

        if len(non_empty) < 2:
            return [{
                "topic_name": "General Discussion",
                "keywords": "meeting, discussion, updates",
                "summary": non_empty[0] if non_empty else "Meeting proceedings.",
                "segment_ids": [s.get("id") for s in segments if s.get("id")]
            }]

        try:
            # TF-IDF Vectorizer
            vectorizer = TfidfVectorizer(max_features=100, stop_words="english", ngram_range=(1, 2))
            X = vectorizer.fit_transform(non_empty)
            terms = np.array(vectorizer.get_feature_names_out())

            num_clusters = min(4, max(2, len(non_empty) // 3))
            clustering = AgglomerativeClustering(n_clusters=num_clusters)
            labels = clustering.fit_predict(X.toarray())

            topics = []
            for cluster_id in range(num_clusters):
                cluster_indices = np.where(labels == cluster_id)[0]
                if len(cluster_indices) == 0:
                    continue

                # Get cluster centroid / top TF-IDF words
                cluster_matrix = X[cluster_indices].toarray()
                mean_tfidf = cluster_matrix.mean(axis=0)
                top_word_indices = mean_tfidf.argsort()[::-1][:5]
                keywords = [terms[idx] for idx in top_word_indices if mean_tfidf[idx] > 0]
                
                # Determine title
                topic_title = " & ".join([w.capitalize() for w in keywords[:2]]) if keywords else f"Topic {cluster_id + 1}"
                
                # Associated segment IDs and sample summary
                seg_ids = [segments[idx].get("id") for idx in cluster_indices if idx < len(segments)]
                sample_texts = [non_empty[idx] for idx in cluster_indices[:3]]
                summary = " ".join(sample_texts)

                topics.append({
                    "topic_name": topic_title,
                    "keywords": ", ".join(keywords),
                    "summary": summary[:250] + "..." if len(summary) > 250 else summary,
                    "segment_ids": seg_ids
                })

            return topics
        except Exception as e:
            print(f"[DataMiningService] Topic extraction fallback: {e}")
            return [{
                "topic_name": "Core Discussion",
                "keywords": "overview, updates, planning",
                "summary": "Key discussion items and project updates.",
                "segment_ids": [s.get("id") for s in segments if s.get("id")]
            }]

    # 5. OUTLIER DETECTION
    def detect_outliers(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Uses IsolationForest & heuristic thresholds on confidence, word rate, and energy
        to tag outlier/noisy segments.
        """
        if len(segments) < 4:
            for s in segments:
                conf = s.get("confidence", 0.9)
                if conf < 0.4:
                    s["is_outlier"] = True
                    s["outlier_reason"] = "Low confidence STT segment"
                else:
                    s["is_outlier"] = False
                    s["outlier_reason"] = None
            return segments

        try:
            # Build feature vectors: [confidence, duration, word_count]
            features = []
            for s in segments:
                duration = max(0.1, s.get("end_time", 0) - s.get("start_time", 0))
                words = len((s.get("original_text") or "").split())
                conf = s.get("confidence", 0.85)
                features.append([conf, duration, words])

            X = np.array(features)
            iso = IsolationForest(contamination=0.15, random_state=42)
            preds = iso.fit_predict(X)  # -1 for outlier, 1 for inlier

            for idx, s in enumerate(segments):
                if preds[idx] == -1 or s.get("confidence", 1.0) < 0.4:
                    s["is_outlier"] = True
                    s["outlier_reason"] = "Acoustic or length anomaly / low confidence"
                else:
                    s["is_outlier"] = False
                    s["outlier_reason"] = None

            return segments
        except Exception as e:
            print(f"[DataMiningService] Outlier detection fallback: {e}")
            return segments

data_mining_service = DataMiningService()
