import { TTSService, TTSOptions } from './TTSService'

export interface AITTSConfig {
  endpoint: string;
  apiKey?: string;
  model?: string;
  voice?: string;
  headers?: Record<string, string>;
  requestBody?: (text: string, options: TTSOptions) => any;
  responseHandler?: (response: Response) => Promise<Blob>;
}

export class AITTSService implements TTSService {
  private config: AITTSConfig;
  private audio?: HTMLAudioElement;

  constructor(config: AITTSConfig) {
    this.config = {
      ...config,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      }
    };
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    this.stop();

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          ...this.config.headers,
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: this.config.requestBody ? 
          JSON.stringify(this.config.requestBody(text, options)) :
          JSON.stringify({
            text,
            model: this.config.model,
            voice: this.config.voice,
            language: options.lang || 'zh-CN',
            speed: options.rate || 1,
            volume: options.volume || 1,
            pitch: options.pitch || 1
          })
      });

      if (!response.ok) {
        throw new Error('AI TTS request failed');
      }

      const blob = this.config.responseHandler ? 
        await this.config.responseHandler(response) :
        await response.blob();
        
      const url = URL.createObjectURL(blob);
      
      this.audio = new Audio(url);
      this.audio.onended = () => {
        URL.revokeObjectURL(url);
        this.onEnd?.();
      };
      this.audio.onplay = () => this.onStart?.();
      this.audio.onerror = (error) => this.onError?.(error);
      
      await this.audio.play();
    } catch (error) {
      this.onError?.(error);
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  resume(): void {
    this.audio?.play();
  }

  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  onBoundary?: (event: { charIndex: number, name: string }) => void;
}

// 预定义的 AI TTS 服务配置
export const AITTSConfigs = {
  // CoquiTTS / CosyVoice2 本地服务
  cosyvoice2: (endpoint = 'http://localhost:5000/tts'): AITTSConfig => ({
    endpoint,
    requestBody: (text, options) => ({
      text,
      speaker_id: options.voice || 'default',
      language: options.lang || 'zh',
    })
  }),

  // ChatTTS API
  chatTTS: (apiKey: string): AITTSConfig => ({
    endpoint: 'https://api.chattts.com/v1/tts',
    apiKey,
    requestBody: (text, options) => ({
      text,
      voice: options.voice || 'zh-CN-natural',
      speed: options.rate || 1,
    })
  }),

  // Google Cloud TTS
  googleCloud: (apiKey: string): AITTSConfig => ({
    endpoint: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey
    },
    requestBody: (text, options) => ({
      input: { text },
      voice: {
        languageCode: options.lang || 'zh-CN',
        name: options.voice || 'zh-CN-Neural2-A'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: options.pitch || 0,
        speakingRate: options.rate || 1,
        volumeGainDb: options.volume ? Math.log10(options.volume) * 20 : 0
      }
    }),
    responseHandler: async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Google Cloud TTS failed: ${JSON.stringify(data.error || 'Unknown error')}`);
      }
      return new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
    }
  }),

  // 自定义本地服务
  custom: (config: AITTSConfig): AITTSConfig => config
}; 