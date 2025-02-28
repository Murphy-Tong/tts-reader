/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'vue' {
  export { ref, computed, onMounted, onUnmounted } from '@vue/runtime-core'
  export { createApp, watch } from '@vue/runtime-dom'
}

declare module '@vueuse/gesture' {
  export function useSwipe(target: any, options?: any): any
}

declare global {
  interface Window {
    speechSynthesis: SpeechSynthesis
  }
}

declare module 'vue' {
  interface HTMLAttributes {
    ref?: string
    class?: any
    style?: any
  }
}

declare module '@vue/runtime-dom' {
  interface HTMLAttributes {
    ref?: string
    class?: any
    style?: any
  }
} 