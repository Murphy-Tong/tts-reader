import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue')
    },
    {
      path: '/reader',
      name: 'reader',
      component: () => import('../views/ReaderView.vue')
    },
    {
      path: '/tts-settings',
      name: 'tts-settings',
      component: () => import('../views/TTSSettingsView.vue')
    }
  ]
})
