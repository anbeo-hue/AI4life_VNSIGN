import { CameraManager } from './camera/camera_manager';
import { LandmarkTracker } from './vision/landmark_tracker';
import { LandmarkNormalizer } from './normalizer/normalizer';
import { OnnxPipelineRunner } from './inference/onnx_runner';
import { BenchmarkManager } from './ui/benchmark';
import { TrackerMode } from './types';

// DOM Elements
const videoEl = document.getElementById('webcam') as HTMLVideoElement;
const canvasEl = document.getElementById('skeleton-canvas') as HTMLCanvasElement;
const ctx = canvasEl.getContext('2d')!;
const viewportWrapper = document.getElementById('viewport-wrapper') as HTMLDivElement;
const cameraLoader = document.getElementById('camera-loading') as HTMLDivElement;
const loadingText = document.getElementById('loading-text') as HTMLParagraphElement;
const deviceBadge = document.getElementById('device-badge') as HTMLSpanElement;

// HUD Elements
const statFps = document.getElementById('stat-fps') as HTMLSpanElement;
const statLatency = document.getElementById('stat-latency') as HTMLSpanElement;
const statTrackerMode = document.getElementById('stat-tracker-mode') as HTMLSpanElement;
const badgePose = document.getElementById('badge-pose') as HTMLSpanElement;
const badgeLeftHand = document.getElementById('badge-left-hand') as HTMLSpanElement;
const badgeRightHand = document.getElementById('badge-right-hand') as HTMLSpanElement;

// Controls
const btnToggleCamera = document.getElementById('btn-toggle-camera') as HTMLButtonElement;
const btnToggleMirror = document.getElementById('btn-toggle-mirror') as HTMLButtonElement;
const btnSwapHandedness = document.getElementById('btn-swap-handedness') as HTMLButtonElement;
const radioModes = document.querySelectorAll<HTMLInputElement>('input[name="tracker-mode"]');

// Benchmark
const btnRunBenchmark = document.getElementById('btn-run-benchmark') as HTMLButtonElement;
const benchmarkProgressBox = document.getElementById('benchmark-progress-box') as HTMLDivElement;
const benchmarkProgressBar = document.getElementById('benchmark-progress-bar') as HTMLDivElement;
const benchmarkProgressText = document.getElementById('benchmark-progress-text') as HTMLParagraphElement;
const benchmarkResultCard = document.getElementById('benchmark-result-card') as HTMLDivElement;
const bmHolisticFps = document.getElementById('bm-holistic-fps') as HTMLSpanElement;
const bmHolisticLat = document.getElementById('bm-holistic-lat') as HTMLSpanElement;
const bmHolisticRate = document.getElementById('bm-holistic-rate') as HTMLSpanElement;
const bmPoseFps = document.getElementById('bm-pose-fps') as HTMLSpanElement;
const bmPoseLat = document.getElementById('bm-pose-lat') as HTMLSpanElement;
const bmPoseRate = document.getElementById('bm-pose-rate') as HTMLSpanElement;
const bmRecommendation = document.getElementById('bm-recommendation') as HTMLElement;
const bmNotes = document.getElementById('bm-notes') as HTMLParagraphElement;

// ONNX Pipeline
const onnxStatus = document.getElementById('onnx-status') as HTMLSpanElement;
const btnRunInference = document.getElementById('btn-run-inference') as HTMLButtonElement;
const inferenceResultBox = document.getElementById('inference-result-box') as HTMLDivElement;
const infTopLabel = document.getElementById('inf-top-label') as HTMLElement;
const infLatency = document.getElementById('inf-latency') as HTMLSpanElement;
const probList = document.getElementById('prob-list') as HTMLDivElement;

// Modal Help
const btnHttpsHelp = document.getElementById('btn-https-help') as HTMLButtonElement;
const btnCloseModal = document.getElementById('btn-close-modal') as HTMLButtonElement;
const modalHttps = document.getElementById('modal-https') as HTMLDivElement;

// Core Instances
const cameraManager = new CameraManager({ videoElement: videoEl });
const tracker = new LandmarkTracker();
const onnxRunner = new OnnxPipelineRunner();
const benchmarkManager = new BenchmarkManager(tracker);

// Buffer lưu trữ 30 frames gần nhất phục vụ kiểm tra Pipeline
const RECENT_FRAME_BUFFER_SIZE = 30;
const frameFeatureBuffer: number[][] = [];

// Device Info helper
function detectDevice(): void {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  deviceBadge.innerText = isMobile ? '📱 Thiết bị Di Động' : '💻 Máy Tính';
}

// Cập nhật trạng thái lật gương
function updateMirrorUI(isMirrored: boolean): void {
  if (isMirrored) {
    viewportWrapper.classList.add('mirrored');
    btnToggleMirror.classList.add('active');
    btnToggleMirror.innerHTML = '<span class="btn-icon">🪞</span> Lật gương: BẬT';
  } else {
    viewportWrapper.classList.remove('mirrored');
    btnToggleMirror.classList.remove('active');
    btnToggleMirror.innerHTML = '<span class="btn-icon">🪞</span> Lật gương: TẮT';
  }
}

// Điều chỉnh kích thước canvas khớp với video thực tế
function syncCanvasSize(): void {
  const w = videoEl.videoWidth || 640;
  const h = videoEl.videoHeight || 480;
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w;
    canvasEl.height = h;
  }
}

// Vòng lặp xử lý chính (Render loop)
let lastTimestamp = -1;
function renderLoop(): void {
  if (cameraManager.isActive()) {
    syncCanvasSize();
    const now = performance.now();

    // Timestamp truyền vào detectForVideo phải tăng dần
    if (now > lastTimestamp) {
      lastTimestamp = now;
      const result = tracker.processVideoFrame(videoEl, now);

      if (result) {
        // 1. Vẽ khung xương
        tracker.drawSkeleton(ctx, result, canvasEl.width, canvasEl.height);

        // 2. Cập nhật HUD & Badge
        statFps.innerText = `${result.stats.fps}`;
        statLatency.innerText = `${result.stats.latencyMs} ms`;

        badgePose.className = `status-pill ${result.stats.hasPose ? 'status-on' : 'status-off'}`;
        badgeLeftHand.className = `status-pill ${result.stats.hasLeftHand ? 'status-on' : 'status-off'}`;
        badgeRightHand.className = `status-pill ${result.stats.hasRightHand ? 'status-on' : 'status-off'}`;

        // Hook benchmark collector nếu đang chạy bài đo
        if ((window as any).__vslBenchmarkCollector) {
          (window as any).__vslBenchmarkCollector(result.stats);
        }

        // 3. Chuẩn hóa đặc trưng khung hình và lưu vào Circular Buffer (30 frames)
        const normalized = LandmarkNormalizer.normalizeFrame(
          result.poseLandmarks,
          result.leftHandLandmarks,
          result.rightHandLandmarks,
          canvasEl.width,
          canvasEl.height,
          now
        );

        frameFeatureBuffer.push(normalized.vector);
        if (frameFeatureBuffer.length > RECENT_FRAME_BUFFER_SIZE) {
          frameFeatureBuffer.shift();
        }

        // Kích hoạt nút chạy inference nếu buffer đã có dữ liệu và ONNX đã sẵn sàng
        if (onnxRunner.isReady() && frameFeatureBuffer.length >= 10 && btnRunInference.disabled) {
          btnRunInference.disabled = false;
        }
      }
    }
  }

  requestAnimationFrame(renderLoop);
}

// Khởi tạo ứng dụng
async function initApp(): Promise<void> {
  detectDevice();
  updateMirrorUI(cameraManager.getIsMirrored());

  try {
    // 1. Mở camera
    loadingText.innerText = 'Đang kết nối camera...';
    await cameraManager.start();

    // 2. Tải MediaPipe (mặc định Holistic)
    loadingText.innerText = 'Đang tải mô hình MediaPipe Holistic...';
    await tracker.init('holistic');
    statTrackerMode.innerText = 'Holistic';

    cameraLoader.classList.add('hidden');

    // 3. Khởi động render loop
    requestAnimationFrame(renderLoop);

    // 4. Tải mô hình ONNX Dummy ở chế độ ngầm
    try {
      onnxStatus.innerText = 'Đang nạp dummy_model.onnx...';
      await onnxRunner.loadModel('/models/dummy_model.onnx', '/labels.json');
      onnxStatus.className = 'status-tag status-ready';
      onnxStatus.innerText = 'Sẵn sàng (WASM)';
    } catch (err) {
      console.warn('[ONNX] Chưa thể tải mô hình ONNX:', err);
      onnxStatus.className = 'status-tag status-loading';
      onnxStatus.innerText = 'Lỗi nạp mô hình ONNX';
    }
  } catch (err) {
    console.error('Lỗi khởi tạo:', err);
    loadingText.innerText = 'Không thể mở Camera. Vui lòng cấp quyền camera trong cài đặt trình duyệt.';
  }
}

// Xử lý sự kiện giao diện
btnToggleCamera.addEventListener('click', async () => {
  btnToggleCamera.disabled = true;
  const newFacing = await cameraManager.switchCamera();
  updateMirrorUI(cameraManager.getIsMirrored());
  btnToggleCamera.disabled = false;
});

btnToggleMirror.addEventListener('click', () => {
  const mirrored = cameraManager.toggleMirror();
  updateMirrorUI(mirrored);
});

btnSwapHandedness.addEventListener('click', () => {
  const current = tracker.getSwapHandedness();
  tracker.setSwapHandedness(!current);
  if (!current) {
    btnSwapHandedness.classList.add('active');
    btnSwapHandedness.innerHTML = '<span class="btn-icon">🔄</span> Đổi nhãn L/R: BẬT';
  } else {
    btnSwapHandedness.classList.remove('active');
    btnSwapHandedness.innerHTML = '<span class="btn-icon">🔄</span> Đổi nhãn L/R: TẮT';
  }
});

radioModes.forEach(radio => {
  radio.addEventListener('change', async (e) => {
    const selectedMode = (e.target as HTMLInputElement).value as TrackerMode;
    statTrackerMode.innerText = selectedMode === 'holistic' ? 'Holistic' : 'Pose + Hand';
    cameraLoader.classList.remove('hidden');
    loadingText.innerText = `Đang chuyển sang ${statTrackerMode.innerText}...`;
    await tracker.switchMode(selectedMode);
    cameraLoader.classList.add('hidden');
  });
});

// Benchmark Runner
btnRunBenchmark.addEventListener('click', async () => {
  if (benchmarkManager.isRunning()) return;

  btnRunBenchmark.disabled = true;
  benchmarkProgressBox.classList.remove('hidden');
  benchmarkResultCard.classList.add('hidden');

  benchmarkManager.setProgressCallback((msg, pct) => {
    benchmarkProgressBar.style.width = `${pct}%`;
    benchmarkProgressText.innerText = msg;
  });

  try {
    const report = await benchmarkManager.runFullBenchmark(5000); // 5s mỗi chế độ = 10s tổng

    // Hiển thị kết quả
    bmHolisticFps.innerText = `${report.holistic.avgFps}`;
    bmHolisticLat.innerText = `${report.holistic.avgLatencyMs}`;
    bmHolisticRate.innerText = `${report.holistic.handDetectRate}`;

    bmPoseFps.innerText = `${report.poseHand.avgFps}`;
    bmPoseLat.innerText = `${report.poseHand.avgLatencyMs}`;
    bmPoseRate.innerText = `${report.poseHand.handDetectRate}`;

    bmRecommendation.innerText = report.recommendation === 'holistic' ? 'HolisticLandmarker' : 'Pose + HandLandmarker';
    bmNotes.innerText = report.notes;

    // Đồng bộ radio button
    radioModes.forEach(r => {
      r.checked = r.value === report.recommendation;
    });
    statTrackerMode.innerText = report.recommendation === 'holistic' ? 'Holistic' : 'Pose + Hand';

    benchmarkResultCard.classList.remove('hidden');
  } catch (err) {
    console.error('Lỗi khi chạy benchmark:', err);
    benchmarkProgressText.innerText = 'Benchmark thất bại hoặc bị gián đoạn.';
  } finally {
    btnRunBenchmark.disabled = false;
    benchmarkProgressBox.classList.add('hidden');
  }
});

// Chạy thử suy luận ONNX với Buffer 30 frames hiện tại
btnRunInference.addEventListener('click', async () => {
  if (!onnxRunner.isReady() || frameFeatureBuffer.length === 0) return;

  btnRunInference.disabled = true;

  // Lấy 30 frames (nếu buffer chưa đủ 30, lặp frame cuối cho đủ)
  const seq: number[] = [];
  const bufferLen = frameFeatureBuffer.length;
  for (let i = 0; i < RECENT_FRAME_BUFFER_SIZE; i++) {
    const idx = Math.min(i, bufferLen - 1);
    seq.push(...frameFeatureBuffer[idx]);
  }

  const flatArray = new Float32Array(seq);
  const result = await onnxRunner.runInference(flatArray);

  if (result) {
    inferenceResultBox.classList.remove('hidden');
    infTopLabel.innerText = result.topLabel;
    infLatency.innerText = `(${result.latencyMs} ms)`;

    // Render thanh xác suất cho từng nhãn
    probList.innerHTML = '';
    const labels = onnxRunner.getLabels();
    labels.forEach(l => {
      const score = result.scores[l.id] || 0;
      const pct = Math.round(score * 100);

      const item = document.createElement('div');
      item.className = 'prob-item';
      item.innerHTML = `
        <span style="min-width: 90px;">${l.name}</span>
        <div class="prob-bar-bg">
          <div class="prob-bar-fill" style="width: ${pct}%"></div>
        </div>
        <span style="min-width: 40px; text-align: right; color: var(--text-muted);">${pct}%</span>
      `;
      probList.appendChild(item);
    });
  }

  btnRunInference.disabled = false;
});

// Modal Dialog Handlers
btnHttpsHelp.addEventListener('click', () => {
  modalHttps.classList.remove('hidden');
});

btnCloseModal.addEventListener('click', () => {
  modalHttps.classList.add('hidden');
});

modalHttps.addEventListener('click', (e) => {
  if (e.target === modalHttps) {
    modalHttps.classList.add('hidden');
  }
});

// Bắt đầu khi load trang
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

