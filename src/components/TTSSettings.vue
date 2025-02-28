<template>
  <div class="tts-settings">
    <h3>语音设置</h3>
    <div class="settings-group">
      <label>
        TTS 服务
        <select v-model="settings.type">
          <option value="browser">浏览器原生</option>
          <option value="azure">Azure</option>
          <option value="cosyvoice2">CosyVoice2</option>
          <option value="chatTTS">ChatTTS</option>
          <option value="googleCloud">Google Cloud</option>
          <option value="custom">自定义服务</option>
        </select>
      </label>
    </div>

    <!-- Azure 设置 -->
    <div v-if="settings.type === 'azure'" class="settings-group">
      <label>
        API Key
        <input type="password" v-model="settings.apiKey" placeholder="输入 Azure API Key" />
      </label>
      <label>
        区域
        <input type="text" v-model="settings.region" placeholder="如：eastasia" />
      </label>
    </div>

    <!-- CosyVoice2 设置 -->
    <div v-if="settings.type === 'cosyvoice2'" class="settings-group">
      <label>
        服务地址
        <input type="text" v-model="settings.endpoint" placeholder="http://localhost:5000/tts" />
      </label>
    </div>

    <!-- ChatTTS 设置 -->
    <div v-if="settings.type === 'chatTTS'" class="settings-group">
      <label>
        API Key
        <input type="password" v-model="settings.apiKey" placeholder="输入 ChatTTS API Key" />
      </label>
    </div>

    <!-- Google Cloud 设置 -->
    <div v-if="settings.type === 'googleCloud'" class="settings-group">
      <label>
        API Key
        <input type="password" v-model="settings.apiKey" placeholder="输入 Google Cloud API Key" />
      </label>
    </div>

    <!-- 自定义服务设置 -->
    <div v-if="settings.type === 'custom'" class="settings-group">
      <label>
        服务地址
        <input type="text" v-model="settings.endpoint" placeholder="输入服务地址" />
      </label>
      <label>
        API Key
        <input type="password" v-model="settings.apiKey" placeholder="输入 API Key（可选）" />
      </label>
    </div>

    <!-- 通用语音设置 -->
    <div class="settings-group">
      <label>
        语速
        <input type="range" v-model.number="settings.rate" min="0.5" max="2" step="0.1" />
        <span>{{ settings.rate }}</span>
      </label>
      <label>
        音调
        <input type="range" v-model.number="settings.pitch" min="0.5" max="2" step="0.1" />
        <span>{{ settings.pitch }}</span>
      </label>
      <label>
        音量
        <input type="range" v-model.number="settings.volume" min="0" max="1" step="0.1" />
        <span>{{ settings.volume }}</span>
      </label>
    </div>

    <div class="settings-actions">
      <button @click="saveSettings" class="primary">保存设置</button>
      <button @click="testVoice">测试语音</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { TTSServiceFactory } from '../services/tts/TTSService'

const emit = defineEmits<{
  (event: 'update', settings: any): void
}>()

const settings = ref({
  type: 'browser',
  apiKey: '',
  region: '',
  endpoint: 'http://localhost:5000/tts',
  rate: 1,
  pitch: 1,
  volume: 1
})

// 从 localStorage 加载设置
onMounted(() => {
  const savedSettings = localStorage.getItem('ttsSettings')
  if (savedSettings) {
    settings.value = JSON.parse(savedSettings)
  }
})

const saveSettings = () => {
  localStorage.setItem('ttsSettings', JSON.stringify(settings.value))
  emit('update', settings.value)
}

const testVoice = async () => {
  try {
    const tts = TTSServiceFactory.createService(settings.value.type, {
      apiKey: settings.value.apiKey,
      region: settings.value.region,
      endpoint: settings.value.endpoint
    })

    await tts.speak('这是一段测试语音', {
      rate: settings.value.rate,
      pitch: settings.value.pitch,
      volume: settings.value.volume
    })
  } catch (error) {
    console.error('TTS test failed:', error)
    alert('语音测试失败，请检查设置')
  }
}
</script>

<style scoped>
.tts-settings {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.settings-group {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

input[type="text"],
input[type="password"],
select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

input[type="range"] {
  width: 200px;
}

.settings-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #e0e0e0;
  transition: background-color 0.2s;
}

button:hover {
  background: #d0d0d0;
}

button.primary {
  background: #4CAF50;
  color: white;
}

button.primary:hover {
  background: #45a049;
}
</style> 