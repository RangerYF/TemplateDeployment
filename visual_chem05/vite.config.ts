import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { viteSingleFile } from 'vite-plugin-singlefile'

const isSingleFile = process.env.SINGLE_FILE === 'true'

export default defineConfig({
  plugins: [
    react(),
    ...(isSingleFile ? [viteSingleFile()] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    ...(isSingleFile
      ? {
          cssCodeSplit: false,
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
            },
          },
        }
      : {
          rollupOptions: {
            output: {
              manualChunks: {
                'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
                'vendor-react': ['react', 'react-dom'],
                'vendor-ui': ['zustand', 'lucide-react'],
              },
            },
          },
        }),
  },
})
