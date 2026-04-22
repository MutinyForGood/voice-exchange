export interface TranscriptionResult {
  text: string
  source: 'browser' | 'manual' | 'api'
}

export interface TranscriptionProvider {
  /**
   * Attempt to transcribe audio. Returns null if the provider
   * cannot handle this audio (e.g. browser API unavailable).
   */
  transcribe(audio: Blob): Promise<TranscriptionResult | null>
}

// TODO: implement OpenAITranscriptionProvider here when ready
// import OpenAI from 'openai'
// export class OpenAITranscriptionProvider implements TranscriptionProvider { ... }
