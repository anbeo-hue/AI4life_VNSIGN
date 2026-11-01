import { CameraManager } from './camera/camera_manager';
import { LandmarkTracker, LandmarkResultData } from './vision/landmark_tracker';
import { LandmarkNormalizer } from './normalizer/normalizer';
import { OnnxPipelineRunner } from './inference/onnx_runner';
import { BenchmarkManager } from './ui/benchmark';
import { DataCollector, CollectorState } from './collector/data_collector';
import { dbStorage } from './collector/storage';
import { DatasetExporter } from './collector/exporter';
import { TrackerMode, LabelItem, ExtractedFrame } from './types';

// DOM Elements - Camera & Viewport
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
const hudFpsWarning = document.getElementById('hud-fps-warning') as HTMLDivElement;

// Recording & Countdown Overlays
const countdownOverlay = document.getElementById('countdown-overlay') as HTMLDivElement;
const countdownNumber = document.getElementById('countdown-number') as HTMLDivElement;
const countdownLabel = document.getElementById('countdown-label') as HTMLParagraphElement;
const recordingOverlay = document.getElementById('recording-overlay') as HTMLDivElement;
const recProgressText = document.getElementById('rec-progress-text') as HTMLElement;

// Camera Controls
const btnToggleCamera = document.getElementById('btn-toggle-camera') as HTMLButtonElement;
const btnToggleMirror = document.getElementById('btn-toggle-mirror') as HTMLButtonElement;
const btnSwapHandedness = document.getElementById('btn-swap-handedness') as HTMLButtonElement;

// Tabs
const tabBtnCollector = document.getElementById('tab-btn-collector') as HTMLButtonElement;
const tabBtnBenchmark = document.getElementById('tab-btn-benchmark') as HTMLButtonElement;
const tabContentCollector = document.getElementById('tab-content-collector') as HTMLDivElement;
const tabContentBenchmark = document.getElementById('tab-content-benchmark') as HTMLDivElement;

// Tab 1: Collector Form Elements
const unconfirmedLabelBanner = document.getElementById('unconfirmed-label-banner') as HTMLDivElement;
const selectLabel = document.getElementById('select-label') as HTMLSelectElement;
const inputSignerId = document.getElementById('input-signer-id') as HTMLInputElement;
const selectRecordDuration = document.getElementById('select-record-duration') as HTMLSelectElement;
const displaySessionId = document.getElementById('display-session-id') as HTMLInputElement;
const btnStartRecord = document.getElementById('btn-start-record') as HTMLButtonElement;
const recordHint = document.getElementById('record-hint') as HTMLParagraphElement;

// Review Modal / Card Elements
const reviewCard = document.getElementById('review-card') as HTMLDivElement;
const reviewFrameCounter = document.getElementById('review-frame-counter') as HTMLSpanElement;
const replayCanvas = document.getElementById('replay-canvas') as HTMLCanvasElement;
const replayCtx = replayCanvas.getContext('2d')!;
const mFrames = document.getElementById('m-frames') as HTMLElement;
const mDuration = document.getElementById('m-duration') as HTMLElement;
const mFps = document.getElementById('m-fps') as HTMLElement;
const mLeftRate = document.getElementById('m-left-rate') as HTMLElement;
const mRightRate = document.getElementById('m-right-rate') as HTMLElement;
const reviewWarningBox = document.getElementById('review-warning-box') as HTMLDivElement;
const reviewWarningText = document.getElementById('review-warning-text') as HTMLSpanElement;

// Trim Sliders
const trimControlsContainer = document.getElementById('trim-controls-container') as HTMLDivElement;
const trimInfoText = document.getElementById('trim-info-text') as HTMLElement;
const sliderCropStart = document.getElementById('slider-crop-start') as HTMLInputElement;
const sliderCropEnd = document.getElementById('slider-crop-end') as HTMLInputElement;
const valCropStart = document.getElementById('val-crop-start') as HTMLElement;
const valCropEnd = document.getElementById('val-crop-end') as HTMLElement;

const btnSaveSample = document.getElementById('btn-save-sample') as HTMLButtonElement;
const btnDiscardSample = document.getElementById('btn-discard-sample') as HTMLButtonElement;

// Statistics & Export
const totalSamplesCount = document.getElementById('total-samples-count') as HTMLElement;
const labelStatsGrid = document.getElementById('label-stats-grid') as HTMLDivElement;
const btnExportAllJson = document.getElementById('btn-export-all-json') as HTMLButtonElement;
const btnExportAllCsv = document.getElementById('btn-export-all-csv') as HTMLButtonElement;
const btnClearDatabase = document.getElementById('btn-clear-database') as HTMLButtonElement;

// Tab 2: Benchmark & ONNX
const radioModes = document.querySelectorAll<HTMLInputElement>('input[name="tracker-mode"]');
const chkOptimizePoseHand = document.getElementById('chk-optimize-posehand') as HTMLInputElement;
const btnRunBenchmark = document.getElementById('btn-run-benchmark') as HTMLButtonElement;
const benchmarkProgressBox = document.getElementById('benchmark-progress-box') as HTMLDivElement;
const benchmarkProgressBar = document.getElementById('benchmark-progress-bar') as HTMLDivElement;
const benchmarkProgressText = document.getElementById('benchmark-progress-text') as HTMLParagraphElement;
const benchmarkResultCard = document.getElementById('benchmark-result-card') as HTMLDivElement;
const btnExportJson = document.getElementById('btn-export-json') as HTMLButtonElement;

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

// ONNX Elements
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

// Generate unique Session ID
const currentSessionId = `session_${Math.random().toString(36).substring(2, 9)}`;
displaySessionId.value = currentSessionId;

// Core Instances
const cameraManager = new CameraManager({ videoElement: videoEl });
// Mặc định khởi tạo pose_hand theo kết quả benchmark thực nghiệm vượt trội
const tracker = new LandmarkTracker();
const onnxRunner = new OnnxPipelineRunner();
const benchmarkManager = new BenchmarkManager(tracker, () => ({
  trackFrameRate: cameraManager.getTrackFrameRate(),
  videoWidth: cameraManager.getVideoWidth(),
  videoHeight: cameraManager.getVideoHeight(),
  facingMode: cameraManager.getFacingMode(),
  label: cameraManager.getTrackLabel()
}));

const dataCollector = new DataCollector(tracker, {
  labelId: 'nghi',
  labelName: 'Nghỉ (Idle)',
  signerId: inputSignerId.value.trim() || 'signer_01',
  sessionId: currentSessionId,
  durationSeconds: parseFloat(selectRecordDuration.value) || 3,
  facingMode: cameraManager.getFacingMode(),
  isMirrored: cameraManager.getIsMirrored(),
  videoWidth: 640,
  videoHeight: 480
});

// Circular Buffer 30 frames cho ONNX pipeline test
const RECENT_FRAME_BUFFER_SIZE = 30;
const frameFeatureBuffer: number[][] = [];

// State & FPS Counters
let latestResult: LandmarkResultData | null = null;
let isDetecting = false;
let cameraFrameCount = 0;
let detectionCount = 0;
let lastStatsUpdate = performance.now();
let currentCameraFps = 0;
let currentDetectFps = 0;
let labelsList: LabelItem[] = [];

// Khởi tạo Device Badge
function detectDevice(): void {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  deviceBadge.innerText = isMobile ? '📱 Mobile' : '💻 Máy tính';
}

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

function syncCanvasSize(): void {
  const w = videoEl.videoWidth || 640;
  const h = videoEl.videoHeight || 480;
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w;
    canvasEl.height = h;
  }
  if (replayCanvas.width !== w || replayCanvas.height !== h) {
    replayCanvas.width = w;
    replayCanvas.height = h;
  }
}

/**
 * Cập nhật cấu hình Collector theo trạng thái hiện tại
 */
function syncCollectorConfig(): void {
  const selectedOption = selectLabel.options[selectLabel.selectedIndex];
  const selectedId = selectLabel.value;
  const labelObj = labelsList.find(l => l.id === selectedId);

  // Kiểm tra cờ confirmed của nhãn
  if (labelObj && labelObj.confirmed === true) {
    unconfirmedLabelBanner.classList.add('hidden');
  } else {
    unconfirmedLabelBanner.classList.remove('hidden');
  }

  dataCollector.updateConfig({
    labelId: selectedId,
    labelName: selectedOption ? selectedOption.text : 'Chưa chọn',
    signerId: inputSignerId.value.trim() || 'signer_01',
    durationSeconds: parseFloat(selectRecordDuration.value) || 3,
    facingMode: cameraManager.getFacingMode(),
    isMirrored: cameraManager.getIsMirrored(),
    videoWidth: cameraManager.getVideoWidth(),
    videoHeight: cameraManager.getVideoHeight()
  });
}

/**
 * Xử lý khung camera mới nhận được
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

      // Hook benchmark nếu đang chạy
      if ((window as any).__vslBenchmarkHook) {
        (window as any).__vslBenchmarkHook({
          latencyMs: result.stats.latencyMs,
          hasLeftHand: result.stats.hasLeftHand,
          hasRightHand: result.stats.hasRightHand
        });
      }

      // Chuẩn hóa 272 features
      const normalized = LandmarkNormalizer.normalizeFrame(
        result.poseLandmarks,
        result.leftHandLandmarks,
        result.rightHandLandmarks,
        canvasEl.width,
        canvasEl.height,
        cameraTimestampMs
      );

      // Nếu Collector đang ở trạng thái recording -> đẩy frame vào bộ đệm
      if (dataCollector.getState() === 'recording') {
        const frameData: ExtractedFrame = {
          timestamp: cameraTimestampMs,
          features: normalized.vector,
          hasLeftHand: result.stats.hasLeftHand,
          hasRightHand: result.stats.hasRightHand,
          rawPoseLandmarks: result.poseLandmarks || undefined,
          rawLeftHandLandmarks: result.leftHandLandmarks || undefined,
          rawRightHandLandmarks: result.rightHandLandmarks || undefined
        };
        dataCollector.pushFrame(frameData);
      }

      // Buffer cho ONNX pipeline test
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
 * Lắng nghe khung hình camera mới qua requestVideoFrameCallback
 */
function startCameraFrameListener(): void {
  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  console.log(`[Camera] Bắt khung camera: ${hasRVFC ? 'requestVideoFrameCallback (Chuẩn)' : 'currentTime diff'}`);

  if (hasRVFC) {
    const onFrame = (now: DOMHighResTimeStamp, metadata: any) => {
      const frameTimeMs = (metadata && metadata.mediaTime > 0)
        ? metadata.mediaTime * 1000
        : now;

      processCameraFrame(frameTimeMs);

      if (cameraManager.isActive()) {
        (videoEl as any).requestVideoFrameCallback(onFrame);
      } else {
        setTimeout(() => {
          if (cameraManager.isActive()) {
            (videoEl as any).requestVideoFrameCallback(onFrame);
          }
        }, 100);
      }
    };
    (videoEl as any).requestVideoFrameCallback(onFrame);
  } else {
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

/**
 * Render Loop vẽ Skeleton lên Canvas
 */
function renderLoop(): void {
  if (latestResult && cameraManager.isActive()) {
    tracker.drawSkeleton(ctx, latestResult, canvasEl.width, canvasEl.height);
    badgePose.className = `status-pill ${latestResult.stats.hasPose ? 'status-on' : 'status-off'}`;
    badgeLeftHand.className = `status-pill ${latestResult.stats.hasLeftHand ? 'status-on' : 'status-off'}`;
    badgeRightHand.className = `status-pill ${latestResult.stats.hasRightHand ? 'status-on' : 'status-off'}`;
    statLatency.innerText = `${latestResult.stats.latencyMs} ms`;
  }

  const now = performance.now();
  const elapsed = now - lastStatsUpdate;
  if (elapsed >= 500) {
    const trackFps = cameraManager.getTrackFrameRate();
    currentCameraFps = Math.round((cameraFrameCount * 1000) / elapsed);
    currentDetectFps = Math.round((detectionCount * 1000) / elapsed);

    if (trackFps) {
      statCamFps.innerText = `${trackFps} (${currentCameraFps} thực)`;
    } else {
      statCamFps.innerText = `${currentCameraFps} fps`;
    }
    statDetectFps.innerText = `${currentDetectFps} /s`;

    // Cảnh báo nếu FPS thực tế của camera dưới 20
    if (currentCameraFps > 0 && currentCameraFps < 20) {
      hudFpsWarning.classList.remove('hidden');
      hudFpsWarning.innerHTML = `<span>⚠️ FPS camera thấp (${currentCameraFps} &lt; 20)</span>`;
    } else {
      hudFpsWarning.classList.add('hidden');
    }

    cameraFrameCount = 0;
    detectionCount = 0;
    lastStatsUpdate = now;
  }

  requestAnimationFrame(renderLoop);
}

/**
 * Hiển thị thống kê số mẫu theo từng nhãn từ IndexedDB
 */
async function refreshLabelStats(): Promise<void> {
  const counts = await dbStorage.getSampleCountsByLabel();
  const allSamples = await dbStorage.getAllSamples();
  totalSamplesCount.innerText = `${allSamples.length}`;

  labelStatsGrid.innerHTML = '';
  labelsList.forEach((label) => {
    const count = counts[label.id] || 0;
    const card = document.createElement('div');
    card.className = `label-stat-card ${selectLabel.value === label.id ? 'active' : ''}`;
    card.innerHTML = `
      <span class="label-stat-name" title="${label.name}">${label.name}</span>
      <span class="label-stat-count ${count > 0 ? 'has-data' : ''}">${count}</span>
    `;

    // Nhấp vào card để chuyển nhanh nhãn đang chọn
    card.addEventListener('click', () => {
      selectLabel.value = label.id;
      syncCollectorConfig();
      refreshLabelStats();
    });

    labelStatsGrid.appendChild(card);
  });
}

function updateTrimDisplay(start: number, end: number, total: number): void {
  valCropStart.innerText = start.toString();
  valCropEnd.innerText = end.toString();
  const count = end - start + 1;
  trimInfoText.innerText = `Khung ${start} → ${end} (${count}/${total} khung)`;
}

/**
 * Đăng ký callback cho DataCollector
 */
function setupCollectorCallbacks(): void {
  dataCollector.setCallbacks({
    onStateChange: (state: CollectorState) => {
      console.log(`[Collector] Trạng thái: ${state}`);
      if (state === 'idle') {
        btnStartRecord.disabled = false;
        btnStartRecord.innerHTML = '🔴 Bắt Đầu Thu Mẫu (Phím Space)';
        btnStartRecord.className = 'btn btn-danger full-width btn-lg';
        recordHint.innerHTML = '💡 Mẹo: Bấm <strong>Spacebar</strong> để Bắt đầu thu &rarr; Bấm <strong>Spacebar</strong> lần nữa để Dừng sớm khi làm xong.';

        countdownOverlay.classList.add('hidden');
        recordingOverlay.classList.add('hidden');
        reviewCard.classList.add('hidden');
        dataCollector.stopReplay();
      } else if (state === 'countdown') {
        btnStartRecord.disabled = true;
        btnStartRecord.innerText = 'Đang đếm ngược...';
        countdownOverlay.classList.remove('hidden');
        recordingOverlay.classList.add('hidden');
        reviewCard.classList.add('hidden');
      } else if (state === 'recording') {
        countdownOverlay.classList.add('hidden');
        recordingOverlay.classList.remove('hidden');
        // Nút đổi thành Dừng sớm
        btnStartRecord.disabled = false;
        btnStartRecord.innerHTML = '⏹️ Dừng Ghi Sớm (Phím Space)';
        btnStartRecord.className = 'btn btn-warning full-width btn-lg';
        recordHint.innerHTML = '💡 Đang ghi... Bấm <strong>Spacebar</strong> hoặc bấm nút trên để Dừng sớm ngay khi kết thúc cử chỉ.';
      } else if (state === 'reviewing') {
        recordingOverlay.classList.add('hidden');
        btnStartRecord.disabled = true;
        btnStartRecord.innerHTML = '🔴 Bắt Đầu Thu Mẫu (Phím Space)';
        btnStartRecord.className = 'btn btn-danger full-width btn-lg';
        reviewCard.classList.remove('hidden');

        // Hiển thị thông số mẫu vừa ghi
        const sample = dataCollector.getCurrentSample();
        if (sample) {
          const total = sample.frames.length;
          mFrames.innerText = `${total}`;
          mDuration.innerText = `${sample.metrics.durationMs} ms`;
          mFps.innerText = `${sample.metrics.actualFps}`;
          mLeftRate.innerText = `${sample.metrics.leftHandPresentRate}%`;
          mRightRate.innerText = `${sample.metrics.rightHandPresentRate}%`;

          // Thiết lập sliders cắt
          sliderCropStart.min = '0';
          sliderCropStart.max = (total - 1).toString();
          sliderCropStart.value = sample.trimRange.cropStart.toString();

          sliderCropEnd.min = '0';
          sliderCropEnd.max = (total - 1).toString();
          sliderCropEnd.value = sample.trimRange.cropEnd.toString();

          updateTrimDisplay(sample.trimRange.cropStart, sample.trimRange.cropEnd, total);

          // Nếu là lớp "nghi" (Nghỉ - Idle), ẩn điều khiển cắt (giữ nguyên toàn bộ)
          if (sample.labelId === 'nghi') {
            trimControlsContainer.classList.add('hidden');
          } else {
            trimControlsContainer.classList.remove('hidden');
          }

          // Cảnh báo chất lượng
          if (sample.metrics.qualityWarning) {
            reviewWarningBox.classList.remove('hidden');
            reviewWarningText.innerText = sample.metrics.qualityWarning;
          } else {
            reviewWarningBox.classList.add('hidden');
          }

          // Bắt đầu Replay trên replayCanvas trong khoảng [cropStart, cropEnd]
          dataCollector.startReplay(replayCanvas, replayCtx, (current, totalFrames, cropStart, cropEnd) => {
            reviewFrameCounter.innerText = `Frame: ${current}/${totalFrames} (Cắt: ${cropStart}→${cropEnd})`;
          });
        }
      }
    },
    onCountdown: (secondsLeft: number | null) => {
      if (secondsLeft !== null) {
        countdownOverlay.classList.remove('hidden');
        countdownNumber.innerText = `${secondsLeft}`;
        countdownLabel.innerText = 'Chuẩn bị thực hiện ký hiệu...';
      } else {
        countdownOverlay.classList.add('hidden');
      }
    },
    onRecordProgress: (currentFrames: number, elapsedMs: number, maxMs: number) => {
      const sec = (elapsedMs / 1000).toFixed(1);
      const maxSec = (maxMs / 1000).toFixed(1);
      recProgressText.innerText = `${currentFrames} frames (${sec}s / ${maxSec}s)`;
    }
  });
}

// Xử lý kéo thanh trượt cắt đầu / cuối
function handleSliderTrimChange(): void {
  let start = parseInt(sliderCropStart.value, 10);
  let end = parseInt(sliderCropEnd.value, 10);
  const sample = dataCollector.getCurrentSample();
  if (!sample) return;
  const total = sample.frames.length;

  if (start > end) {
    end = start;
    sliderCropEnd.value = end.toString();
  }

  updateTrimDisplay(start, end, total);
  dataCollector.updateTrimRange(start, end);
}

sliderCropStart.addEventListener('input', handleSliderTrimChange);
sliderCropEnd.addEventListener('input', handleSliderTrimChange);

/**
 * Xử lý phím tắt Spacebar & Escape
 */
window.addEventListener('keydown', (e: KeyboardEvent) => {
  // Tránh bắt phím khi đang nhập text trong input
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
    if (e.code === 'Space') return; // Cho phép gõ space trong ô text
  }

  if (e.code === 'Space') {
    e.preventDefault();
    const st = dataCollector.getState();
    if (st === 'idle') {
      syncCollectorConfig();
      dataCollector.startCollection();
    } else if (st === 'reviewing') {
      dataCollector.saveCurrentSample().then(() => {
        refreshLabelStats();
      });
    }
  } else if (e.code === 'Escape') {
    if (dataCollector.getState() === 'reviewing') {
      dataCollector.discardCurrentSample();
    }
  }
});

// Khởi tạo ứng dụng
async function initApp(): Promise<void> {
  detectDevice();
  updateMirrorUI(cameraManager.getIsMirrored());
  setupCollectorCallbacks();

  try {
    // 1. Tải danh sách nhãn
    const res = await fetch('/labels.json');
    labelsList = await res.json();
    selectLabel.innerHTML = '';
    labelsList.forEach((label) => {
      const opt = document.createElement('option');
      opt.value = label.id;
      opt.text = label.name;
      selectLabel.appendChild(opt);
    });
    // Mặc định chọn nhãn 'nghi' nếu có
    if (labelsList.some((l) => l.id === 'nghi')) {
      selectLabel.value = 'nghi';
    }
    syncCollectorConfig();

    // 2. Mở Camera
    loadingText.innerText = 'Đang kết nối camera...';
    await cameraManager.start();

    // 3. Tải MediaPipe: Mặc định pose_hand theo kết quả benchmark
    loadingText.innerText = 'Đang tải mô hình MediaPipe (Pose + Hand)...';
    await tracker.init('pose_hand');
    statTrackerMode.innerText = 'Pose + Hand';

    cameraLoader.classList.add('hidden');

    // 4. Khởi động Camera Frame Listener & Render Loop
    startCameraFrameListener();
    requestAnimationFrame(renderLoop);

    // 5. Nạp mô hình ONNX Dummy ở background
    try {
      onnxStatus.innerText = 'Đang nạp dummy_model.onnx...';
      await onnxRunner.loadModel('/models/dummy_model.onnx', '/labels.json');
      onnxStatus.className = 'status-tag status-ready';
      onnxStatus.innerText = 'Sẵn sàng (WASM)';
    } catch (err) {
      console.warn('[ONNX] Lỗi nạp mô hình:', err);
      onnxStatus.className = 'status-tag status-loading';
      onnxStatus.innerText = 'Lỗi nạp mô hình ONNX';
    }

    // 6. Cập nhật thống kê nhãn từ IndexedDB
    await refreshLabelStats();
  } catch (err) {
    console.error('Lỗi khởi tạo:', err);
    loadingText.innerText = 'Không thể mở Camera. Vui lòng cấp quyền camera trong cài đặt trình duyệt.';
  }
}

// ==================== EVENT LISTENERS ====================

// Tabs Switching
tabBtnCollector.addEventListener('click', () => {
  tabBtnCollector.classList.add('active');
  tabBtnBenchmark.classList.remove('active');
  tabContentCollector.classList.remove('hidden');
  tabContentCollector.classList.add('active');
  tabContentBenchmark.classList.add('hidden');
  tabContentBenchmark.classList.remove('active');
});

tabBtnBenchmark.addEventListener('click', () => {
  tabBtnBenchmark.classList.add('active');
  tabBtnCollector.classList.remove('active');
  tabContentBenchmark.classList.remove('hidden');
  tabContentBenchmark.classList.add('active');
  tabContentCollector.classList.add('hidden');
  tabContentCollector.classList.remove('active');
});

// Camera Toolbar Controls
btnToggleCamera.addEventListener('click', async () => {
  btnToggleCamera.disabled = true;
  await cameraManager.switchCamera();
  updateMirrorUI(cameraManager.getIsMirrored());
  syncCollectorConfig();
  btnToggleCamera.disabled = false;
});

btnToggleMirror.addEventListener('click', () => {
  const mirrored = cameraManager.toggleMirror();
  updateMirrorUI(mirrored);
  syncCollectorConfig();
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

// Collector Form Events
selectLabel.addEventListener('change', () => {
  syncCollectorConfig();
  refreshLabelStats();
});

inputSignerId.addEventListener('change', () => syncCollectorConfig());
selectTargetFrames.addEventListener('change', () => syncCollectorConfig());

btnStartRecord.addEventListener('click', () => {
  syncCollectorConfig();
  dataCollector.startCollection();
});

btnSaveSample.addEventListener('click', async () => {
  await dataCollector.saveCurrentSample();
  await refreshLabelStats();
});

btnDiscardSample.addEventListener('click', () => {
  dataCollector.discardCurrentSample();
});

// Export Dataset Actions
btnExportAllJson.addEventListener('click', async () => {
  const samples = await dbStorage.getAllSamples();
  if (samples.length === 0) {
    alert('Chưa có mẫu nào được lưu trong cơ sở dữ liệu!');
    return;
  }
  const jsonContent = DatasetExporter.samplesToJson(samples);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  DatasetExporter.triggerDownload(jsonContent, `vsl_dataset_${timestamp}.json`, 'application/json');
});

btnExportAllCsv.addEventListener('click', async () => {
  const samples = await dbStorage.getAllSamples();
  if (samples.length === 0) {
    alert('Chưa có mẫu nào được lưu trong cơ sở dữ liệu!');
    return;
  }
  const csvContent = DatasetExporter.samplesToCsv(samples);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  DatasetExporter.triggerDownload(csvContent, `vsl_dataset_${timestamp}.csv`, 'text/csv');
});

btnClearDatabase.addEventListener('click', async () => {
  const confirmed = confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu mẫu đã thu không? Hành động này không thể hoàn tác!');
  if (confirmed) {
    await dbStorage.clearAll();
    await refreshLabelStats();
    alert('Đã xóa toàn bộ dữ liệu mẫu!');
  }
});

// Benchmark Mode Switching
radioModes.forEach((radio) => {
  radio.addEventListener('change', async (e) => {
    const selectedMode = (e.target as HTMLInputElement).value as TrackerMode;
    statTrackerMode.innerText = selectedMode === 'holistic' ? 'Holistic' : 'Pose + Hand';
    cameraLoader.classList.remove('hidden');
    loadingText.innerText = `Đang chuyển sang ${statTrackerMode.innerText}...`;
    await tracker.switchMode(selectedMode);
    cameraLoader.classList.add('hidden');
  });
});

chkOptimizePoseHand.addEventListener('change', (e) => {
  tracker.setEnableOptimization((e.target as HTMLInputElement).checked);
});

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
    const report = await benchmarkManager.runFullBenchmark(5000);

    bmDeviceType.innerText = report.deviceInfo.isMobile ? '📱 Mobile' : '💻 Máy tính';
    bmCameraRes.innerText = `${report.cameraInfo.videoWidth}×${report.cameraInfo.videoHeight}`;
    const trackFps = report.cameraInfo.trackFrameRate;
    bmCameraFps.innerText = trackFps ? `${trackFps} fps (phần cứng)` : `${currentCameraFps} fps (đo đếm)`;

    bmHolisticFps.innerText = `${report.holistic.avgFps}`;
    bmHolisticLat.innerText = `${report.holistic.avgLatencyMs}`;
    bmHolisticOneHand.innerText = `${report.holistic.oneHandRate}`;
    bmHolisticBothHands.innerText = `${report.holistic.bothHandsRate}`;

    bmPoseFps.innerText = `${report.poseHand.avgFps}`;
    bmPoseLat.innerText = `${report.poseHand.avgLatencyMs}`;
    bmPoseOneHand.innerText = `${report.poseHand.oneHandRate}`;
    bmPoseBothHands.innerText = `${report.poseHand.bothHandsRate}`;

    bmRecommendation.innerText = report.recommendation === 'holistic' ? 'HolisticLandmarker' : 'Pose + HandLandmarker';
    bmNotes.innerText = report.reason;

    radioModes.forEach((r) => {
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

btnExportJson.addEventListener('click', () => {
  benchmarkManager.downloadJsonReport();
});

// ONNX Inference Runner
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
    labels.forEach((l) => {
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
btnHttpsHelp.addEventListener('click', () => modalHttps.classList.remove('hidden'));
btnCloseModal.addEventListener('click', () => modalHttps.classList.add('hidden'));
modalHttps.addEventListener('click', (e) => {
  if (e.target === modalHttps) modalHttps.classList.add('hidden');
});

// DOMContentLoaded Entry
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
