import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), tailwindcss()],
    
    build: {
      cssMinify: 'esbuild',
    },
    server: {
      host: '0.0.0.0',

      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/unit/setup.js'],
      include: ['src/test/unit/**/*.{test,spec}.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        reportsDirectory: './coverage',
        include: [
          'src/api/**/*.js',
          'src/components/**/*.vue',
          'src/router/**/*.js',
          'src/utils/**/*.js',
          'src/views/**/*.vue',
          'src/App.vue',
        ],
        exclude: [
          'src/main.js',
          'src/test/**',
          '**/*.test.js',
          '**/*.spec.js',
        ],
        watermarks: {
          statements: [90, 100],
          branches: [90, 100],
          functions: [90, 100],
          lines: [90, 100],
        },
      },
    },
  }
})
