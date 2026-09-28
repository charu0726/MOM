/**
 * Real-time 16kHz Mono 16-bit PCM WAV Audio Recorder
 * Captures clean audio directly from Web Audio API without WebM chunk slicing corruption.
 */

export class WavAudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isRecording: boolean = false;
  private pcmBuffers: Float32Array[] = [];
  private totalSamples: number = 0;
  private maxDurationSec: number = 30;
  private targetSampleRate: number = 16000;

  constructor(maxDurationSec: number = 30) {
    this.maxDurationSec = maxDurationSec;
  }

  async start(stream?: MediaStream): Promise<MediaStream> {
    this.stop();
    this.pcmBuffers = [];
    this.totalSamples = 0;

    const ms = stream || await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    this.mediaStream = ms;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx();
    this.sourceNode = this.audioContext.createMediaStreamSource(ms);

    // Buffer size 4096, 1 input channel, 1 output channel
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    const inputSampleRate = this.audioContext.sampleRate;
    const maxSamples = this.maxDurationSec * this.targetSampleRate;

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputChannelData = e.inputBuffer.getChannelData(0);

      // Downsample input to 16000Hz
      const resampled = this.downsampleBuffer(inputChannelData, inputSampleRate, this.targetSampleRate);
      this.pcmBuffers.push(resampled);
      this.totalSamples += resampled.length;

      // Keep within max sliding window
      if (this.totalSamples > maxSamples) {
        while (this.pcmBuffers.length > 0 && this.totalSamples > maxSamples) {
          const removed = this.pcmBuffers.shift();
          if (removed) this.totalSamples -= removed.length;
        }
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
    this.isRecording = true;

    return ms;
  }

  stop(): void {
    this.isRecording = false;
    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch (e) {}
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      this.mediaStream = null;
    }
  }

  /**
   * Generates a standard RIFF/WAVE PCM 16-bit 16kHz Mono audio Blob
   */
  getWavBlob(recentSeconds?: number): Blob | null {
    if (this.pcmBuffers.length === 0 || this.totalSamples === 0) {
      return null;
    }

    let samplesToExport: Float32Array[];
    let sampleCount = 0;

    if (recentSeconds && recentSeconds > 0) {
      const neededSamples = Math.round(recentSeconds * this.targetSampleRate);
      samplesToExport = [];
      let accumulated = 0;
      for (let i = this.pcmBuffers.length - 1; i >= 0; i--) {
        const buf = this.pcmBuffers[i];
        samplesToExport.unshift(buf);
        accumulated += buf.length;
        if (accumulated >= neededSamples) break;
      }
      sampleCount = accumulated;
    } else {
      samplesToExport = this.pcmBuffers;
      sampleCount = this.totalSamples;
    }

    // Merge buffers into continuous Float32Array
    const merged = new Float32Array(sampleCount);
    let offset = 0;
    for (const buf of samplesToExport) {
      merged.set(buf, offset);
      offset += buf.length;
    }

    // Encode standard 44-byte WAV header + 16-bit PCM samples
    const wavBuffer = this.encodeWAV(merged, this.targetSampleRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  clearBuffer(): void {
    this.pcmBuffers = [];
    this.totalSamples = 0;
  }

  private downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
    if (inputRate === outputRate) {
      return new Float32Array(buffer);
    }
    const sampleRateRatio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, 36 + samples.length * 2, true);
    // RIFF type
    this.writeString(view, 8, 'WAVE');
    // Format chunk identifier
    this.writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (raw 16-bit PCM = 1)
    view.setUint16(20, 1, true);
    // Channel count (1 for mono)
    view.setUint16(22, 1, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (sampleRate * 1 channel * 2 bytes)
    view.setUint32(28, sampleRate * 2, true);
    // Block align (1 channel * 2 bytes)
    view.setUint16(32, 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // Data chunk identifier
    this.writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, samples.length * 2, true);

    // Write PCM 16-bit integers
    let index = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      index += 2;
    }

    return buffer;
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}
