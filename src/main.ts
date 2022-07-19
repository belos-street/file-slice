import { createApp } from 'vue'
import App from './App.vue'
import { Upload, Progress } from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'

createApp(App).use(Upload).use(Progress).mount('#app')
