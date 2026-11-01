import { CameraManager } from './camera/camera_manager';
import { LandmarkTracker, LandmarkResultData } from './vision/landmark_tracker';
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
const statCamFps = document.getElementById('stat-cam-fps') as HTMLSpanElement;
const statDetectFps = document.getElementById('stat-detect-fps') as HTMLSpanElement;
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

// Countdown Overlay
const countdownOverlay = document.getElementById('countdown-overlay') as HTMLDivElement;
const countdownNumber = document.getElementById('countdown-number') as HTMLDivElement;

// Benchmark Elements
const btnRunBenchmark = document.getElementById('btn-run-benchmark') as HTMLButtonElement;
const benchmarkProgressBox = document.getElementById('benchmark-progress-box') as HTMLDivElement;
const benchmarkProgressBar = document.getElementById('benchmark-progress-bar') as HTMLDivElement;
const benchmarkProgressText = document.getElementById('benchmark-progress-text') as HTMLParagraphElement;
const benchmarkResultCard = document.getElementById('benchmark-result-card') as HTMLDivElement;
const btnExportJson = document.getElementById('btn-export-json') as HTMLButtonElement;
const chkOptimizePoseHand = document.getElementById('chk-optimize-posehand') as HTMLInputElement;

const bmDeviceType = document.getElementById('bm-device-type') as HTMLElement;
const bmCameraRes = document.getElementById('bm-camera-res') as HTMLElement;
const bmCameraFps = document.getElementById('bm-camera-fps') as HTMLElement;

const bmHolisticFps = document.getElementById('bm-holistic-fps') as HTMLSpanElement;
const bmHolisticLat = document.getElementById('bm-holistic-lat') as HTMLSpanElement;
const bmHolisticOneHand = document.getElementById('bm-holistic-one-hand') as HTMLSpanElement;
const bmHolisticBothHands = document.getElementById('bm-holistic-both-hands') as HTMLSpanElement;

const bmPoseFps = document.getElementById('bm-pose-fps') as HTMLSpanElement;
const bmPoseLat = document.getElementById('bm-pose-lat') as HTMLSpanElement;
const bmPoseOneHand = document.getElementById('bm-pose-one-hand') as HTMLSpanElement;
const bmPoseBothHands = document.getElementById('bm-pose-both-hands') as HTMLSpanElement;

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
const benchmarkManager = new BenchmarkManager(tracker, () => ({
  trackFrameRate: cameraManager.getTrackFrameRate(),
  videoWidth: cameraManager.getVideoWidth(),
  videoHeight: cameraManager.getVideoHeight(),
  facingMode: cameraManager.getFacingMode(),
  label: cameraManager.getTrackLabel()
}));

// Kết nối callback đếm ngược cho benchmark
benchmarkManager.setCountdownCallback((secondsLeft) => {
  if (secondsLeft !== null) {
    countdownOverlay.classList.remove('hidden');
    countdownNumber.innerText = `${secondsLeft}`;
  } else {
    countdownOverlay.classList.add('hidden');
  }
});

// Buffer lưu trữ 30 frames gần nhất phục vụ kiểm tra Pipeline
const RECENT_FRAME_BUFFER_SIZE = 30;
const frameFeatureBuffer: number[][] = [];

// Trạng thái khung hình và bộ đếm FPS
let latestResult: LandmarkResultData | null = null;
let isDetecting = false;
let lastProcessedTime = -1;
let lastCameraFrameTime = performance.now();

// Thống kê tốc độ khung hình
let cameraFrameCount = 0;
let detectionCount = 0;
let lastStatsUpdate = performance.now();
let currentCameraFps = 0;
let currentDetectFps = 0;

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

/**
 * Xử lý phát hiện Landmark cho đúng 1 khung camera mới
 * @param cameraTimestampMs Timestamp thực của khung camera (ms)
 */
function processCameraFrame(cameraTimestampMs: number): void {
  if (!cameraManager.isActive() || isDetecting) return;

  syncCanvasSize();
  isDetecting = true;
  cameraFrameCount++;

  try {
    const result = tracker.processVideoFrame(videoEl, cameraTimestampMs);
    if (result) {
      latestResult = result;
      detectionCount++;

      // Hook benchmark
      if ((window as any).__vslBenchmarkHook) {
        (window as any).__vslBenchmarkHook({
          latencyMs: result.stats.latencyMs,
          hasLeftHand: result.stats.hasLeftHand,
          hasRightHand: result.stats.hasRightHand
        });
      }

      // Chuẩn hóa đặc trưng khung hình
      const normalized = LandmarkNormalizer.normalizeFrame(
        result.poseLandmarks,
        result.leftHandLandmarks,
        result.rightHandLandmarks,
        canvasEl.width,
        canvasEl.height,
        cameraTimestampMs
      );

      frameFeatureBuffer.push(normalized.vector);
      if (frameFeatureBuffer.length > RECENT_FRAME_BUFFER_SIZE) {
        frameFeatureBuffer.shift();
      }

      if (onnxRunner.isReady() && frameFeatureBuffer.length >= 10 && btnRunInference.disabled) {
        btnRunInference.disabled = false;
      }
    }
  } finally {
    isDetecting = false;
  }
}

/**
 * Vòng lặp nhận diện khung camera mới:
 * Sử dụng HTMLVideoElement.requestVideoFrameCallback (nếu có)
 * Fallback: so sánh videoEl.currentTime trong requestAnimationFrame
 */
function startCameraFrameListener(): void {
  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  console.log(`[Camera] Cơ chế bắt khung hình mới: ${hasRVFC ? 'requestVideoFrameCallback (Chuẩn)' : 'currentTime diff (Fallback)'}`);

  if (hasRVFC) {
    const onFrame = (now: DOMHighResTimeStamp, metadata: any) => {
      // metadata.mediaTime là thời gian khung hình trong video (s)
      // Nếu live stream không hỗ trợ mediaTime (trả về 0 hoặc không đổi), dùng metadata.presentationTime hoặc now
      const frameTimeMs = (metadata && metadata.mediaTime > 0)
        ? metadata.mediaTime * 1000
        : now;

      processCameraFrame(frameTimeMs);

      if (cameraManager.isActive()) {
        (videoEl as any).requestVideoFrameCallback(onFrame);
      } else {
        // Kiểm tra lại sau 100ms nếu camera tạm dừng
        setTimeout(() => {
          if (cameraManager.isActive()) {
            (videoEl as any).requestVideoFrameCallback(onFrame);
          }
        }, 100);
      }
    };
    (videoEl as any).requestVideoFrameCallback(onFrame);
  } else {
    // Fallback cho trình duyệt cũ
    let lastVideoTime = -1;
    const checkFrame = () => {
      if (cameraManager.isActive()) {
        const curTime = videoEl.currentTime;
        if (curTime !== lastVideoTime && curTime > 0) {
          lastVideoTime = curTime;
          processCameraFrame(curTime * 1000);
        }
      }
      requestAnimationFrame(checkFrame);
    };
    requestAnimationFrame(checkFrame);
  }
}

// Vòng lặp hiển thị giao diện & vẽ Canvas (Render Loop mượt mà 60fps)
function renderLoop(): void {
  if (latestResult && cameraManager.isActive()) {
    // 1. Vẽ khung xương
    tracker.drawSkeleton(ctx, latestResult, canvasEl.width, canvasEl.height);

    // 2. Cập nhật Badge
    badgePose.className = `status-pill ${latestResult.stats.hasPose ? 'status-on' : 'status-off'}`;
    badgeLeftHand.className = `status-pill ${latestResult.stats.hasLeftHand ? 'status-on' : 'status-off'}`;
    badgeRightHand.className = `status-pill ${latestResult.stats.hasRightHand ? 'status-on' : 'status-off'}`;

    statLatency.innerText = `${latestResult.stats.latencyMs} ms`;
  }

  // Cập nhật tốc độ khung hình và số lần phát hiện/giây mỗi 500ms
  const now = performance.now();
  const elapsed = now - lastStatsUpdate;
  if (elapsed >= 500) {
    const trackFps = cameraManager.getTrackFrameRate();
    currentCameraFps = Math.round((cameraFrameCount * 1000) / elapsed);
    currentDetectFps = Math.round((detectionCount * 1000) / elapsed);

    // Hiển thị tốc độ camera: ưu tiên track.getSettings().frameRate nếu có, kèm theo FPS đo đếm thực tế
    if (trackFps) {
      statCamFps.innerText = `${trackFps} (${currentCameraFps} thực)`;
    } else {
      statCamFps.innerText = `${currentCameraFps} fps`;
    }

    statDetectFps.innerText = `${currentDetectFps} /s`;

    cameraFrameCount = 0;
    detectionCount = 0;
    lastStatsUpdate = now;
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

    // 3. Khởi động cơ chế lắng nghe khung camera mới & Render loop
    startCameraFrameListener();
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
  await cameraManager.switchCamera();
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

    // Hiển thị thông tin thiết bị & camera
    bmDeviceType.innerText = report.deviceInfo.isMobile ? '📱 Mobile' : '💻 Máy tính';
    bmCameraRes.innerText = `${report.cameraInfo.videoWidth}×${report.cameraInfo.videoHeight}`;
    const trackFps = report.cameraInfo.trackFrameRate;
    bmCameraFps.innerText = trackFps ? `${trackFps} fps (phần cứng)` : `${currentCameraFps} fps (đo đếm)`;

    // Hiển thị số liệu Holistic
    bmHolisticFps.innerText = `${report.holistic.avgFps}`;
    bmHolisticLat.innerText = `${report.holistic.avgLatencyMs}`;
    bmHolisticOneHand.innerText = `${report.holistic.oneHandRate}`;
    bmHolisticBothHands.innerText = `${report.holistic.bothHandsRate}`;

    // Hiển thị số liệu Pose + Hand
    bmPoseFps.innerText = `${report.poseHand.avgFps}`;
    bmPoseLat.innerText = `${report.poseHand.avgLatencyMs}`;
    bmPoseOneHand.innerText = `${report.poseHand.oneHandRate}`;
    bmPoseBothHands.innerText = `${report.poseHand.bothHandsRate}`;

    // Khuyến nghị
    bmRecommendation.innerText = report.recommendation === 'holistic' ? 'HolisticLandmarker' : 'Pose + HandLandmarker';
    bmNotes.innerText = report.reason;

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

// Nút xuất báo cáo JSON
btnExportJson.addEventListener('click', () => {
  benchmarkManager.downloadJsonReport();
});

// Checkbox bật/tắt tối ưu hóa Pose+Hand
chkOptimizePoseHand.addEventListener('change', (e) => {
  const isChecked = (e.target as HTMLInputElement).checked;
  tracker.setEnableOptimization(isChecked);
});

// Chạy thử suy luận ONNX với Buffer 30 frames hiện tại
btnRunInference.addEventListener('click', async () => {
  if (!onnxRunner.isReady() || frameFeatureBuffer.length === 0) return;

  btnRunInference.disabled = true;

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
