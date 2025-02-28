import { AITTSService, AITTSConfigs } from './AITTSService';

export interface TTSOptions {
  lang?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
  voice?: string;
}

export interface TTSService {
  speak: (text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: string;
  }) => Promise<void>;
  stop: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  onBoundary?: (event: { name: string; charIndex: number }) => void;
}

// 浏览器原生 TTS 服务实现
export class BrowserTTSService implements TTSService {
  private synthesis: SpeechSynthesis;
  private utterance?: SpeechSynthesisUtterance;

  constructor() {
    this.synthesis = window.speechSynthesis;
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    this.stop();
    
    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang = options.lang || 'zh-CN';
    this.utterance.pitch = options.pitch || 1;
    this.utterance.rate = options.rate || 1;
    this.utterance.volume = options.volume || 1;

    if (options.voice) {
      const voices = this.synthesis.getVoices();
      const selectedVoice = voices.find(v => v.name === options.voice);
      if (selectedVoice) {
        this.utterance.voice = selectedVoice;
      }
    }

    return new Promise((resolve, reject) => {
      if (this.onStart) this.utterance!.onstart = this.onStart;
      if (this.onEnd) this.utterance!.onend = () => {
        this.onEnd?.();
        resolve();
      };
      if (this.onError) this.utterance!.onerror = (error) => {
        this.onError?.(error);
        reject(error);
      };
      if (this.onBoundary) {
        this.utterance!.onboundary = (event) => {
          if (event instanceof SpeechSynthesisEvent) {
            this.onBoundary?.({
              charIndex: event.charIndex,
              name: event.name
            });
          }
        };
      }

      this.synthesis.speak(this.utterance!);
    });
  }

  stop(): void {
    this.synthesis.cancel();
  }

  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  onBoundary?: (event: { charIndex: number, name: string }) => void;
}

// Azure TTS 服务实现示例
export class AzureTTSService implements TTSService {
  private apiKey: string;
  private region: string;
  private audio?: HTMLAudioElement;

  constructor(apiKey: string, region: string) {
    this.apiKey = apiKey;
    this.region = region;
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    this.stop();

    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
          },
          body: `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${options.lang || 'zh-CN'}">
              <voice name="${options.voice || 'zh-CN-XiaoxiaoNeural'}">
                <prosody rate="${options.rate || 1}" pitch="${options.pitch || 1}" volume="${options.volume || 1}">
                  ${text}
                </prosody>
              </voice>
            </speak>
          `
        }
      );

      if (!response.ok) {
        throw new Error('TTS request failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      return new Promise((resolve, reject) => {
        this.audio = new Audio(url);
        this.audio.onended = () => {
          URL.revokeObjectURL(url);
          this.onEnd?.();
          resolve();
        };
        this.audio.onplay = () => this.onStart?.();
        this.audio.onerror = (error) => {
          this.onError?.(error);
          reject(error);
        };
        
        this.audio.play().catch(reject);
      });
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  onBoundary?: (event: { charIndex: number, name: string }) => void;
}

// TTS 服务工厂
export class TTSServiceFactory {
  static createService(
    type: 'browser' | 'azure' | 'cosyvoice2' | 'chatTTS' | 'googleCloud' | 'custom',
    config?: { 
      apiKey?: string, 
      region?: string,
      endpoint?: string,
      customConfig?: any 
    }
  ): TTSService {
    switch (type) {
      case 'browser':
        return new BrowserTTSService();
      case 'azure':
        if (!config?.apiKey || !config?.region) {
          throw new Error('Azure TTS requires apiKey and region');
        }
        return new AzureTTSService(config.apiKey, config.region);
      case 'cosyvoice2':
        return new AITTSService(AITTSConfigs.cosyvoice2(config?.endpoint));
      case 'chatTTS':
        if (!config?.apiKey) {
          throw new Error('ChatTTS requires apiKey');
        }
        return new AITTSService(AITTSConfigs.chatTTS(config.apiKey));
      case 'googleCloud':
        if (!config?.apiKey) {
          throw new Error('Google Cloud TTS requires apiKey');
        }
        return new AITTSService(AITTSConfigs.googleCloud(config.apiKey));
      case 'custom':
        if (!config?.customConfig) {
          throw new Error('Custom TTS requires configuration');
        }
        return new AITTSService(AITTSConfigs.custom(config.customConfig));
      default:
        return new BrowserTTSService();
    }
  }
} 