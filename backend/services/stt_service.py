import os
import io
import tempfile
import numpy as np
import soundfile as sf
from typing import Tuple, List, Dict, Any, Optional

class STTService:
    def __init__(self):
        self.model = None
        self.model_name = "tiny"
        self._is_loading = False

    def _load_model(self):
        if self.model is not None or self._is_loading:
            return
        try:
            self._is_loading = True
            from faster_whisper import WhisperModel
            # Load tiny or base model on CPU with int8 quantization for ultra fast response
            print("[STTService] Loading faster-whisper model...")
            self.model = WhisperModel(self.model_name, device="cpu", compute_type="int8")
            print("[STTService] faster-whisper model loaded successfully!")
        except Exception as e:
            print(f"[STTService] Could not load faster-whisper ({e}). Fallback mode active.")
            self.model = None
        finally:
            self._is_loading = False

    def transcribe_audio_chunk(
        self,
        audio_data: np.ndarray,
        sample_rate: int = 16000
    ) -> Tuple[str, float, str]:
        """
        Transcribes an audio chunk (float32 numpy array).
        Returns: (transcribed_text, confidence_score, detected_language)
        
        CRITICAL: Preserves original language exactly as spoken (e.g. Hindi, Hinglish, English).
        Do NOT translate original speech.
        """
        if len(audio_data) < sample_rate * 0.5:  # Less than 0.5s
            return "", 0.0, "unknown"

        self._load_model()

        if self.model is not None:
            try:
                # Save chunk to temp WAV
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    tmp_path = tmp.name
                    sf.write(tmp_path, audio_data, sample_rate, subtype="PCM_16")

                # Transcribe preserving verbatim spoken language
                segments, info = self.model.transcribe(
                    tmp_path,
                    beam_size=3,
                    task="transcribe",  # 'transcribe' keeps original language, does not translate
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=400)
                )

                text_pieces = []
                avg_confidence = 0.0
                seg_count = 0
                for seg in segments:
                    text_pieces.append(seg.text.strip())
                    # seg.avg_logprob can be mapped to confidence ~ exp(avg_logprob)
                    conf = float(np.exp(seg.avg_logprob)) if seg.avg_logprob is not None else 0.85
                    avg_confidence += conf
                    seg_count += 1

                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

                full_text = " ".join(text_pieces).strip()
                final_conf = (avg_confidence / seg_count) if seg_count > 0 else 0.85
                detected_lang = info.language if hasattr(info, 'language') else "en"

                return full_text, min(1.0, max(0.0, final_conf)), detected_lang
            except Exception as e:
                print(f"[STTService] Transcription error: {e}")
                return "", 0.0, "en"
        else:
            # If faster-whisper is not ready or failed, return empty or fallback
            return "", 0.0, "en"

stt_service = STTService()
