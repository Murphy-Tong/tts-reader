import { TTSService, TTSOptions } from './TTSService'

interface Voice {
  name: string
  languageCodes: string[]
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL'
  naturalSampleRateHertz: number
}

export class GoogleCloudTTSService {
  private static endpoint = 'https://texttospeech.googleapis.com/v1'
  
  static async listVoices(apiKey: string, lang: string = ''): Promise<Voice[]> {
    try {
      const response = await fetch(`${this.endpoint}/voices?key=${apiKey}`)
      if (!response.ok) {
        throw new Error('Failed to fetch voices')
      }
      
      const data = await response.json()
      return lang?data.voices.filter((voice: Voice) => 
        voice.languageCodes.includes(lang)
      ):data.voices
    } catch (error) {
      console.error('Error fetching voices:', error)
      throw error
    }
  }
} 