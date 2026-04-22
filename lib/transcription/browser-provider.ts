import { TranscriptionProvider, TranscriptionResult } from './provider'

export class BrowserTranscriptionProvider implements TranscriptionProvider {
  async transcribe(_audio: Blob): Promise<TranscriptionResult | null> {
    // Browser speech recognition works on the live audio stream, not a blob.
    // This provider signals "not available" so the UI falls back to manual entry.
    // Real-time recognition is handled directly in the RecordingStep component.
    if (typeof window === 'undefined') return null
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return null
    // Signal available — actual text comes from the recording component
    return null
  }
}
