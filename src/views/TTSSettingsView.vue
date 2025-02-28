<template>
  <div class="tts-settings-page">
    <div class="md3-top-app-bar">
      <button @click="router.back()" class="md3-icon-button">
        <span class="material-icons">arrow_back</span>
      </button>
      <h2>语音设置</h2>
    </div>

    <div class="md3-surface">
      <div class="md3-card">
        <div class="md3-card-content">
          <h3 class="md3-headline-small">TTS 服务配置</h3>
          <div class="md3-form-field">
            <label class="md3-field-label">TTS 服务</label>
            <select v-model="settings.type" class="md3-select">
              <option value="browser">浏览器原生</option>
              <option value="azure">Azure</option>
              <option value="cosyvoice2">CosyVoice2</option>
              <option value="chatTTS">ChatTTS</option>
              <option value="googleCloud">Google Cloud</option>
              <option value="custom">自定义服务</option>
            </select>
          </div>

          <!-- Azure 设置 -->
          <div v-if="settings.type === 'azure'" class="md3-form-group">
            <div class="md3-form-field">
              <label class="md3-field-label">API Key</label>
              <input type="password" v-model="settings.apiKey" class="md3-text-field" placeholder="输入 Azure API Key" />
            </div>
            <div class="md3-form-field">
              <label class="md3-field-label">区域</label>
              <input type="text" v-model="settings.region" class="md3-text-field" placeholder="如：eastasia" />
            </div>
          </div>

          <!-- CosyVoice2 设置 -->
          <div v-if="settings.type === 'cosyvoice2'" class="md3-form-group">
            <div class="md3-form-field">
              <label class="md3-field-label">服务地址</label>
              <input type="text" v-model="settings.endpoint" class="md3-text-field" placeholder="http://localhost:5000/tts" />
            </div>
          </div>

          <!-- ChatTTS 设置 -->
          <div v-if="settings.type === 'chatTTS'" class="md3-form-group">
            <div class="md3-form-field">
              <label class="md3-field-label">API Key</label>
              <input type="password" v-model="settings.apiKey" class="md3-text-field" placeholder="输入 ChatTTS API Key" />
            </div>
          </div>

          <!-- Google Cloud 设置 -->
          <div v-if="settings.type === 'googleCloud'" class="md3-form-group">
            <div class="md3-form-field">
              <label class="md3-field-label">API Key</label>
              <input 
                type="password" 
                v-model="settings.apiKey" 
                class="md3-text-field"
                placeholder="输入 Google Cloud API Key"
                @input="handleApiKeyInput"
              />
            </div>
            <div class="md3-form-field" v-if="availableVoices.length > 0">
              <label class="md3-field-label">语音选择</label>
              <div class="voice-filter">
                <input 
                  type="text" 
                  v-model="voiceFilter" 
                  class="md3-text-field" 
                  placeholder="搜索语音..."
                />
              </div>
              <select v-model="settings.voice" class="md3-select">
                <optgroup v-for="gender in ['FEMALE', 'MALE']" :key="gender" :label="gender === 'FEMALE' ? '女声' : '男声'">
                  <option 
                    v-for="voice in getFilteredVoicesByGender(gender)" 
                    :key="voice.name" 
                    :value="voice.name"
                  >
                    {{ formatVoiceName(voice) }}
                  </option>
                </optgroup>
              </select>
            </div>
            <div v-if="isLoadingVoices" class="md3-loading">
              <div class="md3-circular-progress"></div>
              <span>正在加载语音列表...</span>
            </div>
          </div>

          <!-- 自定义服务设置 -->
          <div v-if="settings.type === 'custom'" class="md3-form-group">
            <div class="md3-form-field">
              <label class="md3-field-label">服务地址</label>
              <input type="text" v-model="settings.endpoint" class="md3-text-field" placeholder="输入服务地址" />
            </div>
            <div class="md3-form-field">
              <label class="md3-field-label">API Key</label>
              <input type="password" v-model="settings.apiKey" class="md3-text-field" placeholder="输入 API Key（可选）" />
            </div>
          </div>
        </div>
      </div>

      <div class="md3-card">
        <div class="md3-card-content">
          <h3 class="md3-headline-small">语音参数</h3>
          <div class="md3-form-group">
            <div class="md3-slider-field">
              <label class="md3-field-label">
                语速
                <span class="md3-slider-value">{{ settings.rate }}</span>
              </label>
              <input 
                type="range" 
                v-model.number="settings.rate" 
                min="0.5" 
                max="2" 
                step="0.1"
                class="md3-slider" 
              />
            </div>
            <div class="md3-slider-field">
              <label class="md3-field-label">
                音调
                <span class="md3-slider-value">{{ settings.pitch }}</span>
              </label>
              <input 
                type="range" 
                v-model.number="settings.pitch" 
                min="0.5" 
                max="2" 
                step="0.1"
                class="md3-slider" 
              />
            </div>
            <div class="md3-slider-field">
              <label class="md3-field-label">
                音量
                <span class="md3-slider-value">{{ settings.volume }}</span>
              </label>
              <input 
                type="range" 
                v-model.number="settings.volume" 
                min="0" 
                max="1" 
                step="0.1"
                class="md3-slider" 
              />
            </div>
          </div>
        </div>
      </div>

      <div class="md3-card">
        <div class="md3-card-content">
          <h3 class="md3-headline-small">测试区域</h3>
          <div class="md3-form-field">
            <textarea
              v-model="testText"
              placeholder="在此输入要测试的文本..."
              rows="4"
              class="md3-textarea"
            ></textarea>
          </div>
          <div class="md3-actions">
            <button 
              @click="testVoice" 
              :disabled="!testText.trim()"
              class="md3-button"
            >
              <span class="material-icons">{{ isPlaying ? 'stop' : 'play_arrow' }}</span>
              {{ isPlaying ? '停止' : '测试语音' }}
            </button>
          </div>
        </div>
      </div>

      <div class="md3-actions">
        <button @click="saveSettings" class="md3-button md3-button-filled">
          <span class="material-icons">save</span>
          保存设置
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { TTSServiceFactory } from '../services/tts/TTSService'
import { GoogleCloudTTSService } from '../services/tts/GoogleCloudTTSService'

const router = useRouter()
const isPlaying = ref(false)
const testText = ref('这是一段测试文本，您可以修改它来测试不同的语音效果。')
const isLoadingVoices = ref(false)
const availableVoices = ref<any[]>([])
const voiceFilter = ref('')

const settings = ref({
  type: 'browser' as 'browser' | 'azure' | 'cosyvoice2' | 'chatTTS' | 'googleCloud' | 'custom',
  apiKey: '',
  region: '',
  endpoint: 'http://localhost:5000/tts',
  rate: 1,
  pitch: 1,
  volume: 1,
  voice: ''
})

let currentTTS: any = null

// 从 localStorage 加载设置
onMounted(() => {
  const savedSettings = localStorage.getItem('ttsSettings')
  if (savedSettings) {
    const parsed = JSON.parse(savedSettings)
    settings.value = {
      ...settings.value,
      ...parsed
    }
  }
  if (settings.value.type === 'googleCloud' && settings.value.apiKey) {
    loadVoices()
  }
})

// 监听 API Key 变化
const handleApiKeyInput = async () => {
  if (settings.value.type === 'googleCloud' && settings.value.apiKey) {
    await loadVoices()
  }
}

// 加载语音列表
const loadVoices = async () => {
  isLoadingVoices.value = true
  try {
    availableVoices.value = await GoogleCloudTTSService.listVoices(settings.value.apiKey);
    console.log(availableVoices.value);
    if (!settings.value.voice && availableVoices.value.length > 0) {
      settings.value.voice = availableVoices.value[0].name
    }
  } catch (error) {
    console.error('Failed to load voices:', error)
  } finally {
    isLoadingVoices.value = false
  }
}

// 按性别过滤语音
const getFilteredVoicesByGender = (gender: string) => {
  return availableVoices.value
    .filter(voice => voice.ssmlGender === gender)
    .filter(voice => {
      if (!voiceFilter.value) return true
      return voice.name.toLowerCase().includes(voiceFilter.value.toLowerCase())
    })
}

// 监听过滤器变化
watch(voiceFilter, () => {
  // 获取当前性别的所有过滤后的语音
  const currentVoice = availableVoices.value.find(v => v.name === settings.value.voice)
  const currentGender = currentVoice?.ssmlGender || 'FEMALE'
  const filteredVoices = getFilteredVoicesByGender(currentGender)
  
  // 如果当前选中的语音不在过滤结果中，选择第一个可用的语音
  if (filteredVoices.length > 0 && !filteredVoices.some(v => v.name === settings.value.voice)) {
    settings.value.voice = filteredVoices[0].name
  }
})

// 格式化语音名称
const formatVoiceName = (voice: any) => {
  return voice.name
}

const saveSettings = () => {
  localStorage.setItem('ttsSettings', JSON.stringify(settings.value))
  router.back()
}

const testVoice = async () => {
  if (isPlaying.value) {
    currentTTS?.stop()
    isPlaying.value = false
    return
  }

  try {
    currentTTS = TTSServiceFactory.createService(settings.value.type, {
      apiKey: settings.value.apiKey,
      region: settings.value.region,
      endpoint: settings.value.endpoint
    })

    currentTTS.onEnd = () => {
      isPlaying.value = false
    }

    currentTTS.onError = (error: any) => {
      console.error('TTS test failed:', error)
      alert('语音测试失败，请检查设置')
      isPlaying.value = false
    }

    isPlaying.value = true
    await currentTTS.speak(testText.value, {
      rate: settings.value.rate,
      pitch: settings.value.pitch,
      volume: settings.value.volume,
      voice: settings.value.voice
    })
  } catch (error) {
    console.error('TTS test failed:', error)
    alert('语音测试失败，请检查设置')
    isPlaying.value = false
  }
}
</script>

<style>
/* 移除全局样式，使用主题变量 */
.tts-settings-page {
  min-height: 100vh;
  background-color: var(--md3-sys-color-surface);
  color: var(--md3-sys-color-on-surface);
}

.md3-surface {
  padding: var(--spacing-md);
}

.md3-top-app-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-md);
  height: 64px;
  background-color: var(--md3-sys-color-surface);
  color: var(--md3-sys-color-on-surface);
  box-shadow: var(--md3-elevation-2);
}

.md3-card {
  background-color: var(--md3-sys-color-surface);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--md3-elevation-1);
  margin-bottom: var(--spacing-md);
  overflow: hidden;
}

.md3-card-content {
  padding: var(--spacing-md);
}

.voice-filter {
  margin-bottom: var(--spacing-sm);
}

.md3-text-field,
.md3-select,
.md3-textarea {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--md3-sys-color-outline);
  border-radius: var(--border-radius-sm);
  background-color: var(--md3-sys-color-surface);
  color: var(--md3-sys-color-on-surface);
  font-size: var(--font-size-md);
  line-height: 1.5;
  transition: border-color var(--transition-speed);
}

.md3-text-field:focus,
.md3-select:focus,
.md3-textarea:focus {
  border-color: var(--md3-sys-color-primary);
  outline: none;
}

.md3-button {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-lg);
  height: 40px;
  border: none;
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  cursor: pointer;
  background: transparent;
  color: var(--md3-sys-color-primary);
  transition: all var(--transition-speed);
}

.md3-button:hover {
  background-color: var(--md3-sys-color-surface-variant);
}

.md3-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.md3-button .material-icons {
  font-size: 20px;
}

.md3-button-filled {
  background-color: var(--md3-sys-color-primary);
  color: var(--md3-sys-color-on-primary);
}

.md3-button-filled:hover {
  background-color: var(--md3-sys-color-primary);
  opacity: 0.9;
}

.md3-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
}

.md3-loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  color: var(--md3-sys-color-on-surface);
}

.md3-circular-progress {
  width: 24px;
  height: 24px;
  border: 3px solid var(--md3-sys-color-primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.material-icons {
  font-size: 24px;
  line-height: 1;
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  display: inline-block;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
  vertical-align: middle;
  
  /* Support for all WebKit browsers. */
  -webkit-font-smoothing: antialiased;
  /* Support for Safari and Chrome. */
  text-rendering: optimizeLegibility;
  /* Support for Firefox. */
  -moz-osx-font-smoothing: grayscale;
  /* Support for IE. */
  font-feature-settings: 'liga';
}

.md3-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--md3-sys-color-outline);
  border-radius: 4px;
  background-color: var(--md3-sys-color-surface);
  color: var(--md3-sys-color-on-surface);
  font-size: 16px;
  line-height: 24px;
  transition: border-color 0.2s;
  appearance: auto;
  -webkit-appearance: auto;
}

.md3-icon-button {
  width: 40px;
  height: 40px;
  padding: 8px;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md3-sys-color-on-surface);
  transition: background-color var(--transition-speed);
}

.md3-icon-button:hover {
  background-color: var(--md3-sys-color-surface-variant);
}

.md3-icon-button .material-icons {
  font-size: 24px;
}
</style> 