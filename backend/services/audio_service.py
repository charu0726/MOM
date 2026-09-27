import os
import io
import wave
import struct
import numpy as np
import soundfile as sf
from typing import Tuple, Optional

# Try importing av for WebM / Opus / AAC decoding
try:
    import av
    AV_AVAILABLE = True
except ImportError:
    AV_AVAILABLE = False

AUDIO_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "audio")
os.makedirs(AUDIO_STORAGE_DIR, exist_ok=True)

class AudioService:
    @staticmethod
    def save_audio_file(audio_bytes: bytes, filename: str) -> str:
        """Saves raw audio bytes to file and returns absolute path."""
        file_path = os.path.join(AUDIO_STORAGE_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(audio_bytes)
        return file_path

    @staticmethod
    def decode_with_av(audio_bytes: bytes, target_sr: int = 16000) -> np.ndarray:
        """Decodes WebM, MP3, Opus, AAC, etc. bytes to 16kHz float32 mono array."""
        if not AV_AVAILABLE:
            return np.zeros(0, dtype=np.float32)
        try:
            container = av.open(io.BytesIO(audio_bytes))
            resampler = av.AudioResampler(format='fltp', layout='mono', rate=target_sr)
            all_frames = []
            for frame in container.decode(audio=0):
                for rframe in resampler.resample(frame):
                    all_frames.append(rframe.to_ndarray()[0])
            if all_frames:
                return np.concatenate(all_frames).astype(np.float32)
            return np.zeros(0, dtype=np.float32)
        except Exception as e:
            # print(f"[AudioService] PyAV decode error: {e}")
            return np.zeros(0, dtype=np.float32)

    @staticmethod
    def process_audio_buffer(audio_bytes: bytes, target_sr: int = 16000) -> Tuple[np.ndarray, str]:
        """
        Processes audio bytes (WAV, WebM, PCM) into a 16kHz float32 NumPy array.
        Returns: (audio_np, saved_path)
        """
        if len(audio_bytes) == 0:
            return np.zeros(0, dtype=np.float32), ""

        # 1. Try PyAV first (handles WebM, Opus, Ogg, MP3, WAV perfectly)
        if AV_AVAILABLE:
            data = AudioService.decode_with_av(audio_bytes, target_sr=target_sr)
            if len(data) > 0:
                max_val = np.max(np.abs(data))
                if max_val > 1e-6:
                    data = data / max_val
                return data, ""

        # 2. Try soundfile
        try:
            bio = io.BytesIO(audio_bytes)
            data, sr = sf.read(bio)
            
            if data.ndim > 1:
                data = np.mean(data, axis=1)
                
            if sr != target_sr:
                num_samples = int(len(data) * target_sr / sr)
                indices = np.linspace(0, len(data) - 1, num_samples)
                data = np.interp(indices, np.arange(len(data)), data)
                
            data = data.astype(np.float32)
            max_val = np.max(np.abs(data))
            if max_val > 1e-6:
                data = data / max_val
                
            return data, ""
        except Exception:
            pass

        # 3. Fallback: Assume raw 16-bit PCM 16kHz mono
        try:
            samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            return samples, ""
        except Exception:
            return np.zeros(0, dtype=np.float32), ""

    @staticmethod
    def is_speech(audio_data: np.ndarray, energy_threshold: float = 0.008) -> bool:
        """Energy-based voice activity detector."""
        if len(audio_data) == 0:
            return False
        rms = np.sqrt(np.mean(audio_data ** 2))
        return rms > energy_threshold

    @staticmethod
    def write_wav(audio_data: np.ndarray, file_path: str, sample_rate: int = 16000):
        """Writes float32 numpy array to 16kHz WAV file."""
        sf.write(file_path, audio_data, sample_rate, subtype="PCM_16")
