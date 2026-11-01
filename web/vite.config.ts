import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import path from 'path';

// Đọc phiên bản thực tế của @mediapipe/tasks-vision từ package.json đã cài đặt
const mediapipePkgPath = path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/package.json');
let mediapipeVersion = '0.10.35';
try {
  const pkg = JSON.parse(fs.readFileSync(mediapipePkgPath, 'utf-8'));
  mediapipeVersion = pkg.version || '0.10.35';
} catch (e) {
  console.warn('Không thể đọc package.json của tasks-vision, dùng fallback:', mediapipeVersion);
}

export default defineConfig({
  plugins: [
    basicSsl()
  ],
  define: {
    __MEDIAPIPE_VERSION__: JSON.stringify(mediapipeVersion)
  },
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

