import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

// 库构建:ESM + d.ts;样式由 libInjectCss 注入进 JS(消费方无需单独 import 样式)。
// dev 模式(npm run dev)忽略 build.lib,直接用根 index.html 起 playground 调试。
export default defineConfig({
  plugins: [
    vue(),
    libInjectCss(),
    dts({ include: ['src'], tsconfigPath: './tsconfig.json' }),
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // 宿主自带 vue/naive-ui,保持外部;sortablejs 为运行时依赖且懒加载,外部化交消费端 code-split
      external: ['vue', 'naive-ui', 'sortablejs'],
    },
  },
})
