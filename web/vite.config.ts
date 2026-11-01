import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl()
  ],
  server: {
    host: '0.0.0.0', // Cho phép truy cập từ điện thoại qua mạng LAN
    port: 5173,
    https: true,     // Bật HTTPS tự động với SSL tự ký
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision', 'onnxruntime-web']
  }
});

