<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import { TTSService, TTSServiceFactory } from '../services/tts/TTSService'

const router = useRouter()
const content = ref('')
const currentPage = ref(0)
const pageSize = 1000 // 每页字符数
const isReading = ref(false)
const currentReadingIndex = ref(-1)
const currentPlayingIndex = ref(-1)
const showToolbar = ref(false)
const showSettings = ref(false)
const showChapters = ref(false)
const showSearch = ref(false)
const searchQuery = ref('')
const searchResults = ref<{ text: string; page: number }[]>([])
let ttsService: TTSService
let hideToolbarTimer: number | null = null
let ttsQueue: string[] = []
let ttsBuffer: { text: string; audio: HTMLAudioElement }[] = []
let isProcessingTTS = false
let isPlayingAudio = false
const BUFFER_SIZE = 3

// 章节相关
interface Chapter {
  title: string
  startPage: number
}

const chapters = ref<Chapter[]>([])

// 添加触摸相关的状态
const touchStartX = ref(0)
const touchEndX = ref(0)
const MIN_SWIPE_DISTANCE = 50

// 字体大小调整
const fontSize = ref(16)
const adjustFontSize = (delta: number) => {
  fontSize.value = Math.max(12, Math.min(24, fontSize.value + delta))
  localStorage.setItem('fontSize', fontSize.value.toString())
}

// 主题切换
const isDarkTheme = ref(true)
const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value
  localStorage.setItem('isDarkTheme', isDarkTheme.value.toString())
  document.documentElement.setAttribute('data-theme', isDarkTheme.value ? 'dark' : 'light')
}

// 从 localStorage 获取内容和设置
onMounted(() => {
  const savedContent = localStorage.getItem('bookContent')
  if (!savedContent) {
    router.push('/')
    return
  }
  content.value = savedContent
  
  // 加载上次阅读位置
  const lastPage = localStorage.getItem('lastReadPage')
  if (lastPage) {
    currentPage.value = parseInt(lastPage)
  }
  
  // 解析章节
  parseChapters()
  
  // 加载字体大小设置
  const savedFontSize = localStorage.getItem('fontSize')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize)
  }
  
  // 加载主题设置
  const savedTheme = localStorage.getItem('isDarkTheme')
  if (savedTheme !== null) {
    isDarkTheme.value = savedTheme === 'true'
  }
  
  // 初始化 TTS 服务
  initTTSService()
  
  // 设置主题
  document.documentElement.setAttribute('data-theme', isDarkTheme.value ? 'dark' : 'light')
})

const initTTSService = () => {
  const savedSettings = localStorage.getItem('ttsSettings')
  const settings = savedSettings ? JSON.parse(savedSettings) : { type: 'browser' }
  
  ttsService = TTSServiceFactory.createService(settings.type, {
    apiKey: settings.apiKey,
    region: settings.region,
    endpoint: settings.endpoint
  })
  
  // 设置 TTS 事件处理
  ttsService.onStart = () => {
    isReading.value = true
  }
  
  ttsService.onEnd = () => {
    isReading.value = false
    currentReadingIndex.value = -1
  }
  
  ttsService.onError = (error) => {
    console.error('TTS error:', error)
    isReading.value = false
    currentReadingIndex.value = -1
  }
  
  ttsService.onBoundary = (event) => {
    if (event.name === 'word') {
      let totalLength = 0
      currentPageContent.value.some((paragraph: string, index: number) => {
        if (totalLength + paragraph.length >= event.charIndex) {
          currentReadingIndex.value = index
          return true
        }
        totalLength += paragraph.length + 1 // +1 for newline
        return false
      })
    }
  }
}

const handleSettingsUpdate = () => {
  initTTSService()
  showSettings.value = false
}

const contentRef = ref<HTMLElement | null>(null)
const pageContentRef = ref<HTMLElement | null>(null)

// 计算每页可显示的行数
const calculatePageLayout = () => {
  const containerHeight = window.innerHeight - 160 // 减去工具栏、页码等固定高度
  const contentPadding = 40 // content padding (20px * 2)
  const pageContentPadding = 40 // page-content padding (20px * 2)
  const marginBottom = 40 // page-content margin-bottom
  const availableHeight = containerHeight - contentPadding - pageContentPadding - marginBottom
  
  const lineHeight = fontSize.value * 1.6
  const paragraphSpacing = fontSize.value * 0.8
  
  return {
    containerHeight: availableHeight,
    lineHeight,
    paragraphSpacing,
    maxLines: Math.floor(availableHeight / lineHeight)
  }
}

// 计算段落占用的行数
const calculateParagraphLines = (text: string) => {
  const contentPadding = 40 // content padding (20px * 2)
  const pageContentPadding = 40 // page-content padding (20px * 2)
  const maxWidth = Math.min(800, window.innerWidth) // 考虑小屏幕设备
  const availableWidth = maxWidth - contentPadding - pageContentPadding
  
  // 使用更准确的字符宽度估算
  const averageCharWidth = fontSize.value * 0.6 // 假设平均字符宽度为字体大小的 0.6 倍
  const charsPerLine = Math.floor(availableWidth / averageCharWidth)
  return Math.ceil(text.length / charsPerLine)
}

const pages = computed(() => {
  if (!content.value) return []
  const paragraphs = content.value.split('\n').filter((p: string) => p.trim())
  const pages: string[][] = []
  let currentPageContent: string[] = []
  let currentPageLines = 0
  const { maxLines, lineHeight, paragraphSpacing } = calculatePageLayout()
  
  const processPage = () => {
    if (currentPageContent.length === 0) return
    
    // 检查最后一段是否超出容器
    while (currentPageLines > maxLines && currentPageContent.length > 0) {
      const lastParagraph = currentPageContent[currentPageContent.length - 1]
      const averageCharWidth = fontSize.value * 0.6
      const availableWidth = Math.min(800, window.innerWidth) - 80 // 减去所有 padding
      const charsPerLine = Math.floor(availableWidth / averageCharWidth)
      
      // 如果最后一段超过一行，将最后一行移到下一页
      if (lastParagraph.length > charsPerLine) {
        const lastLineStart = lastParagraph.length - charsPerLine
        const nextPageText = lastParagraph.slice(lastLineStart)
        const currentPageText = lastParagraph.slice(0, lastLineStart)
        
        // 更新当前页的最后一段
        currentPageContent[currentPageContent.length - 1] = currentPageText
        
        // 将剩余文本添加到临时存储中，供下一页使用
        paragraphs.unshift(nextPageText)
        
        // 重新计算当前页行数
        currentPageLines -= 1
      } else {
        // 如果最后一段只有一行，将整段移到下一页
        const lastText = currentPageContent.pop()!
        paragraphs.unshift(lastText)
        currentPageLines -= calculateParagraphLines(lastText) + 1
      }
    }
    
    pages.push([...currentPageContent])
    currentPageContent = []
    currentPageLines = 0
  }
  
  for (const paragraph of paragraphs) {
    const paragraphLines = calculateParagraphLines(paragraph)
    const totalLines = paragraphLines + (currentPageLines > 0 ? 1 : 0) // 如果不是页面第一段，加上段间距
    
    if (currentPageLines + totalLines > maxLines && currentPageContent.length > 0) {
      processPage()
    }
    
    currentPageContent.push(paragraph)
    currentPageLines += totalLines
  }
  
  if (currentPageContent.length > 0) {
    processPage()
  }
  
  return pages
})

const totalPages = computed(() => pages.value.length)
const currentPageContent = computed(() => pages.value[currentPage.value] || [])

// 解析章节
const parseChapters = () => {
  const lines = content.value.split('\n')
  const chapterPattern = /^第[一二三四五六七八九十百千]+章|^Chapter\s+\d+/
  
  chapters.value = []
  let currentPage = 0
  let currentLines = 0
  const { maxLines } = calculatePageLayout()
  
  lines.forEach((line, index) => {
    if (chapterPattern.test(line.trim())) {
      chapters.value.push({
        title: line.trim(),
        startPage: Math.floor(currentLines / maxLines)
      })
    }
    const paragraphLines = calculateParagraphLines(line)
    currentLines += paragraphLines + (currentLines > 0 ? 1 : 0) // 加上段间距
  })
}

// 跳转到指定章节
const goToChapter = (chapter: Chapter) => {
  currentPage.value = chapter.startPage
  showChapters.value = false
  stopReading()
  saveLastReadPage()
}

// 保存最后阅读位置
const saveLastReadPage = () => {
  localStorage.setItem('lastReadPage', currentPage.value.toString())
}

// 优化 TTS 队列管理
const prepareTTSQueue = () => {
  const text = currentPageContent.value.join('\n')
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]/g) || []
  ttsQueue = sentences
  processNextTTSItem()
}

const processNextTTSItem = async () => {
  // 如果缓冲区已满或没有需要处理的句子，则返回
  if (ttsBuffer.length >= BUFFER_SIZE || ttsQueue.length === 0 || !isReading.value) return
  
  isProcessingTTS = true
  const sentence = ttsQueue.shift()
  if (sentence) {
    const savedSettings = localStorage.getItem('ttsSettings')
    const settings = savedSettings ? JSON.parse(savedSettings) : {}
    
    try {
      const audio = new Audio()
      const response = await ttsService.speak(sentence, {
        rate: settings.rate || 1,
        pitch: settings.pitch || 1,
        volume: settings.volume || 1,
        voice: settings.voice
      })
      
      // 将转换好的音频添加到缓冲区
      ttsBuffer.push({ text: sentence, audio })
      
      isProcessingTTS = false
      
      // 如果缓冲区未满且还有句子需要转换，继续处理下一句
      if (ttsBuffer.length < BUFFER_SIZE && ttsQueue.length > 0) {
        processNextTTSItem()
      }
      
      // 如果当前没有在播放，开始播放
      if (!isPlayingAudio) {
        playNextAudio()
      }
    } catch (error) {
      console.error('TTS error:', error)
      isProcessingTTS = false
    }
  }
}

// 播放音频
const playNextAudio = async () => {
  if (!isReading.value || ttsBuffer.length === 0) {
    // 如果缓冲区为空但还有句子需要转换，继续处理
    if (ttsQueue.length > 0 && isReading.value) {
      await processNextTTSItem()
      return
    }
    isPlayingAudio = false
    return
  }
  
  isPlayingAudio = true
  const { text, audio } = ttsBuffer.shift()!
  
  // 更新当前播放段落的索引
  const paragraphIndex = currentPageContent.value.findIndex(p => p.includes(text))
  if (paragraphIndex !== -1) {
    currentPlayingIndex.value = paragraphIndex
  }
  
  // 播放音频
  audio.onended = () => {
    // 播放结束后，继续播放下一段
    if (isReading.value) {
      playNextAudio()
    } else {
      isPlayingAudio = false
      currentPlayingIndex.value = -1
    }
  }
  
  try {
    await audio.play()
    
    // 如果缓冲区不足，继续转换下一句
    if (ttsBuffer.length < BUFFER_SIZE && ttsQueue.length > 0) {
      processNextTTSItem()
    }
  } catch (error) {
    console.error('Audio playback error:', error)
    isPlayingAudio = false
    currentPlayingIndex.value = -1
  }
}

// 修改开始阅读逻辑
const startReading = () => {
  isReading.value = true
  prepareTTSQueue()
}

// 搜索功能
const search = () => {
  if (!searchQuery.value) return
  
  const results: { text: string; page: number }[] = []
  const query = searchQuery.value.toLowerCase()
  let currentPage = 0
  let currentLines = 0
  const { maxLines } = calculatePageLayout()
  
  content.value.split('\n').forEach(line => {
    if (line.toLowerCase().includes(query)) {
      results.push({
        text: line,
        page: Math.floor(currentLines / maxLines)
      })
    }
    const paragraphLines = calculateParagraphLines(line)
    currentLines += paragraphLines + (currentLines > 0 ? 1 : 0) // 加上段间距
  })
  
  searchResults.value = results
}

const goToSearchResult = (page: number) => {
  currentPage.value = page
  showSearch.value = false
  saveLastReadPage()
}

// 修改翻页功能
const nextPage = () => {
  if (currentPage.value < totalPages.value - 1) {
    currentPage.value++
    stopReading()
    saveLastReadPage()
  }
}

const prevPage = () => {
  if (currentPage.value > 0) {
    currentPage.value--
    stopReading()
    saveLastReadPage()
  }
}

// 处理触摸事件
const handleTouchStart = (e: TouchEvent) => {
  touchStartX.value = e.touches[0].clientX
}

const handleTouchEnd = (e: TouchEvent) => {
  touchEndX.value = e.changedTouches[0].clientX
  const swipeDistance = touchEndX.value - touchStartX.value
  
  if (Math.abs(swipeDistance) >= MIN_SWIPE_DISTANCE) {
    if (swipeDistance > 0) {
      // 向右滑动，上一页
      prevPage()
    } else {
      // 向左滑动，下一页
      nextPage()
    }
  }
}

// 处理点击事件
const handleClick = (e: MouseEvent) => {
  // 如果点击了工具栏或全局播放按钮，不处理
  if ((e.target as HTMLElement).closest('.toolbar, .global-play-button')) {
    return
  }

  showToolbar.value = !showToolbar.value
  if (showToolbar.value) {
    // 清除之前的定时器
    if (hideToolbarTimer) {
      clearTimeout(hideToolbarTimer)
    }
    // 3秒后自动隐藏
    hideToolbarTimer = window.setTimeout(() => {
      showToolbar.value = false
      hideToolbarTimer = null
    }, 3000)
  }
}

const stopReading = () => {
  isReading.value = false
  isPlayingAudio = false
  ttsService.stop()
  ttsQueue = []
  ttsBuffer = []
  isProcessingTTS = false
  currentPlayingIndex.value = -1
}

const toggleReading = () => {
  if (isReading.value) {
    stopReading()
  } else {
    startReading()
  }
}

// 监听键盘事件
useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'ArrowLeft') prevPage()
  else if (e.key === 'ArrowRight') nextPage()
})

// 监听窗口大小变化
window.addEventListener('resize', () => {
  // 保存当前阅读进度的百分比
  const progress = currentPage.value / (totalPages.value - 1)
  // 重新计算分页
  setTimeout(() => {
    // 根据进度恢复到相应位置
    currentPage.value = Math.round(progress * (totalPages.value - 1))
  }, 0)
})

// 清理资源
onUnmounted(() => {
  if (hideToolbarTimer) {
    clearTimeout(hideToolbarTimer)
  }
  if (isReading.value) {
    stopReading()
  }
})
</script>

<template>
  <div 
    class="reader-container"
    @click="handleClick"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    :data-theme="isDarkTheme ? 'dark' : 'light'"
  >
    <div class="content" ref="contentRef">
      <div class="page-content" ref="pageContentRef">
        <p
          v-for="(paragraph, index) in currentPageContent"
          :key="index"
          :class="{
            'paragraph': true,
            'playing': currentPlayingIndex === index
          }"
        >
          {{ paragraph }}
        </p>
      </div>
      <div class="page-number">{{ currentPage + 1 }} / {{ totalPages }}</div>
    </div>

    <!-- 全局播放按钮 -->
    <button 
      v-show="currentReadingIndex >= 0"
      @click.stop="toggleReading"
      class="global-play-button"
    >
      <span class="material-icons">{{ isReading ? 'pause' : 'play_arrow' }}</span>
    </button>

    <!-- 目录面板 -->
    <div :class="['side-panel', { show: showChapters }]">
      <div class="panel-header">
        <h2>目录</h2>
        <button @click="showChapters = false" class="md3-icon-button">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="panel-content">
        <div
          v-for="chapter in chapters"
          :key="chapter.title"
          class="chapter-item"
          @click="goToChapter(chapter)"
        >
          {{ chapter.title }}
        </div>
      </div>
    </div>

    <!-- 搜索面板 -->
    <div :class="['side-panel', { show: showSearch }]">
      <div class="panel-header">
        <h2>搜索</h2>
        <button @click="showSearch = false" class="md3-icon-button">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="panel-content">
        <div class="search-box">
          <input
            v-model="searchQuery"
            @input="search"
            type="text"
            placeholder="输入搜索关键词"
          >
          <button @click="search" class="md3-icon-button">
            <span class="material-icons">search</span>
          </button>
        </div>
        <div class="search-results">
          <div
            v-for="(result, index) in searchResults"
            :key="index"
            class="search-result-item"
            @click="goToSearchResult(result.page)"
          >
            <div class="result-text">{{ result.text }}</div>
            <div class="result-page">第 {{ result.page + 1 }} 页</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div :class="['bottom-toolbar', { show: showToolbar }]">
      <div class="toolbar-left">
        <button @click.stop="prevPage" :disabled="currentPage === 0" class="md3-icon-button">
          <span class="material-icons">navigate_before</span>
        </button>
        <button @click.stop="nextPage" :disabled="currentPage >= totalPages - 1" class="md3-icon-button">
          <span class="material-icons">navigate_next</span>
        </button>
      </div>
      <div class="toolbar-center">
        <button @click.stop="showChapters = true" class="md3-button">
          <span class="material-icons">menu</span>
          目录
        </button>
        <button @click.stop="showSearch = true" class="md3-button">
          <span class="material-icons">search</span>
          搜索
        </button>
        <button @click.stop="toggleReading" class="md3-button">
          <span class="material-icons">{{ isReading ? 'stop' : 'play_arrow' }}</span>
          {{ isReading ? '停止朗读' : '开始朗读' }}
        </button>
        <button @click.stop="router.push('/tts-settings')" class="md3-button">
          <span class="material-icons">settings</span>
          语音设置
        </button>
      </div>
      <div class="toolbar-right">
        <button @click.stop="toggleTheme" class="md3-icon-button">
          <span class="material-icons">{{ isDarkTheme ? 'light_mode' : 'dark_mode' }}</span>
        </button>
        <button @click.stop="adjustFontSize(1)" class="md3-icon-button">
          <span class="material-icons">text_increase</span>
        </button>
        <button @click.stop="adjustFontSize(-1)" class="md3-icon-button">
          <span class="material-icons">text_decrease</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reader-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--md3-sys-color-surface);
  color: var(--md3-sys-color-on-surface);
  overflow: hidden;
}

.content {
  flex: 1;
  position: relative;
  padding: 20px;
  margin: 0 auto;
  max-width: 800px;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-content {
  flex: 1;
  padding: 20px;
  line-height: 1.8;
  font-size: v-bind('`${fontSize}px`');
  margin-bottom: 40px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 0;
}

.paragraph {
  margin: 0 0 1em;
  text-align: justify;
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.playing {
  background-color: var(--md3-sys-color-primary-container);
  color: var(--md3-sys-color-on-primary-container);
  padding: 0.5em;
  border-radius: 4px;
  margin: -0.5em;
  transition: all 0.3s ease;
}

.page-number {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 10px;
  background-color: var(--md3-sys-color-surface-container);
  color: var(--md3-sys-color-on-surface);
  border-radius: var(--border-radius-sm);
  font-size: 14px;
  opacity: 0.8;
}

.side-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 300px;
  background-color: var(--md3-sys-color-surface-container);
  box-shadow: var(--md3-elevation-2);
  transform: translateX(100%);
  transition: transform var(--transition-speed);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.side-panel.show {
  transform: translateX(0);
}

.panel-header {
  padding: var(--spacing-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--md3-sys-color-outline);
}

.panel-header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.chapter-item {
  padding: var(--spacing-md);
  cursor: pointer;
  border-radius: var(--border-radius-sm);
  transition: background-color var(--transition-speed);
}

.chapter-item:hover {
  background-color: var(--md3-sys-color-surface-container-high);
}

.search-box {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.search-box input {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--md3-sys-color-outline);
  border-radius: var(--border-radius-sm);
  background-color: var(--md3-sys-color-surface);
  color: var(--md3-sys-color-on-surface);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.search-result-item {
  padding: var(--spacing-md);
  cursor: pointer;
  border-radius: var(--border-radius-sm);
  background-color: var(--md3-sys-color-surface-container-low);
  transition: background-color var(--transition-speed);
}

.search-result-item:hover {
  background-color: var(--md3-sys-color-surface-container-high);
}

.result-text {
  margin-bottom: var(--spacing-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.result-page {
  font-size: var(--font-size-sm);
  color: var(--md3-sys-color-outline);
}

/* 修改全局播放按钮样式 */
.global-play-button {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--md3-sys-color-primary);
  color: var(--md3-sys-color-on-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--md3-elevation-2);
  transition: all var(--transition-speed);
  z-index: 1000;
}

.global-play-button:hover {
  box-shadow: var(--md3-elevation-3);
  transform: scale(1.05);
}

.global-play-button .material-icons {
  font-size: 24px;
}
</style> 