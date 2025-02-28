<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import { ref, computed } from 'vue'

const content = ref('')
const currentPage = ref(0)
const pageSize = 1000 // 每页字符数
const isReading = ref(false)
const currentReadingIndex = ref(-1)
let speechSynthesis
let speechUtterance

// 处理文件上传
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const text = await file.text()
  content.value = text
  currentPage.value = 0
  stopReading()
}

// 分页逻辑
const pages = computed(() => {
  if (!content.value) return []
  const paragraphs = content.value.split('\n').filter(p => p.trim())
  const pages = []
  let currentPageContent = []
  let currentLength = 0
  
  for (const paragraph of paragraphs) {
    if (currentLength + paragraph.length > pageSize) {
      pages.push(currentPageContent)
      currentPageContent = [paragraph]
      currentLength = paragraph.length
    } else {
      currentPageContent.push(paragraph)
      currentLength += paragraph.length
    }
  }
  
  if (currentPageContent.length > 0) {
    pages.push(currentPageContent)
  }
  
  return pages
})

const totalPages = computed(() => pages.value.length)
const currentPageContent = computed(() => pages.value[currentPage.value] || [])

// 翻页功能
const nextPage = () => {
  if (currentPage.value < totalPages.value - 1) {
    currentPage.value++
    stopReading()
  }
}

const prevPage = () => {
  if (currentPage.value > 0) {
    currentPage.value--
    stopReading()
  }
}

// TTS 功能
const initSpeech = () => {
  speechSynthesis = window.speechSynthesis
  speechUtterance = new SpeechSynthesisUtterance()
  speechUtterance.lang = 'zh-CN'
  
  speechUtterance.onboundary = (event) => {
    if (event.name === 'word') {
      // 更新当前正在阅读的段落
      const text = event.target.text
      const charIndex = event.charIndex
      let totalLength = 0
      currentPageContent.value.some((paragraph, index) => {
        if (totalLength + paragraph.length >= charIndex) {
          currentReadingIndex.value = index
          return true
        }
        totalLength += paragraph.length + 1 // +1 for newline
        return false
      })
    }
  }
  
  speechUtterance.onend = () => {
    isReading.value = false
    currentReadingIndex.value = -1
  }
}

const startReading = () => {
  if (!speechSynthesis) initSpeech()
  
  const text = currentPageContent.value.join('\n')
  speechUtterance.text = text
  speechSynthesis.speak(speechUtterance)
  isReading.value = true
}

const stopReading = () => {
  if (speechSynthesis) {
    speechSynthesis.cancel()
    isReading.value = false
    currentReadingIndex.value = -1
  }
}

const toggleReading = () => {
  if (isReading.value) {
    stopReading()
  } else {
    startReading()
  }
}
</script>

<template>
  <RouterView />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  background-color: #f5f5f5;
}

#app {
  height: 100vh;
  width: 100vw;
  padding: 0;
  overflow: hidden scroll;
}
</style>
