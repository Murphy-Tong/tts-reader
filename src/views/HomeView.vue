<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  // 将文件内容存储到 localStorage
  const text = await file.text()
  localStorage.setItem('bookContent', text)
  
  // 跳转到阅读器页面
  router.push('/reader')
}
</script>

<template>
  <div class="home">
    <div class="upload-container">
      <h1>TXT 阅读器</h1>
      <label class="upload-button">
        选择文件
        <input
          type="file"
          accept=".txt"
          @change="handleFileUpload"
          style="display: none"
        >
      </label>
    </div>
  </div>
</template>

<style scoped>
.home {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
}

.upload-container {
  text-align: center;
}

h1 {
  color: #333;
  margin-bottom: 2rem;
  font-size: 2rem;
}

.upload-button {
  display: inline-block;
  padding: 1rem 2rem;
  background-color: #4CAF50;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: background-color 0.3s;
}

.upload-button:hover {
  background-color: #45a049;
}
</style>
