import { defineConfig } from 'vitest/config'

// 测试只覆盖 UI 无关 core(纯逻辑 + stub localStorage),node 环境足够,无需 DOM。
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
