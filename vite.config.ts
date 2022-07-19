import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 7000, // 设置服务启动端口号
    open: false, // 设置服务启动时是否自动打开浏览器
    https: false,
    cors: true, // 允许跨域
    proxy: {
      '/api': {
        target: 'http://192.168.6.215:8000/',
        rewrite: (path) => path.replace(/^\/api/, ''),
        changeOrigin: true
      }
    }
  }
})
