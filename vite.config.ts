import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Cho phép mở trực tiếp từ file:// trong thư mục dist
  plugins: [
    react(),
    tailwindcss(),
  ],
})
