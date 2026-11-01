import { RecordedSample, ExtractedFrame, TrimRange, ACTUAL_MEDIAPIPE_VERSION } from '../types';
import { dbStorage } from './storage';
import { LandmarkTracker } from '../vision/landmark_tracker';

export type CollectorState = 'idle' | 'countdown' | 'recording' | 'reviewing';

export interface CollectorConfig {
  labelId: string;
  labelName: string;
  signerId: string;
  sessionId: string;
  durationSeconds: number; // Mặc định 3 giây
  facingMode: 'user' | 'environment';
  isMirrored: boolean;
  videoWidth: number;
  videoHeight: number;
}

export class DataCollector {
  private state: CollectorState = 'idle';
  private config: CollectorConfig;
  private tracker: LandmarkTracker;

  private recordedFrames: ExtractedFrame[] = [];
  private currentSample: RecordedSample | null = null;

  private onStateChangeCb?: (state: CollectorState) => void;
  private onCountdownCb?: (secondsLeft: number | null) => void;
  private onRecordProgressCb?: (currentFrames: number, elapsedMs: number, maxMs: number) => void;

  // Thời gian ghi
  private recordStartTime: number = 0;
  private recordTimer: any = null;

  // Replay loop
  private isReplaying = false;
  private replayFrameIdx = 0;
  private replayTimer: any = null;

  constructor(tracker: LandmarkTracker, initialConfig: CollectorConfig) {
    this.tracker = tracker;
    this.config = initialConfig;
  }

  public updateConfig(newConfig: Partial<CollectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): CollectorConfig {
    return this.config;
  }

  public getState(): CollectorState {
    return this.state;
  }

  public getCurrentSample(): RecordedSample | null {
    return this.currentSample;
  }

  public setCallbacks(cbs: {
    onStateChange?: (state: CollectorState) => void;
    onCountdown?: (secondsLeft: number | null) => void;
    onRecordProgress?: (currentFrames: number, elapsedMs: number, maxMs: number) => void;
  }): void {
    this.onStateChangeCb = cbs.onStateChange;
    this.onCountdownCb = cbs.onCountdown;
    this.onRecordProgressCb = cbs.onRecordProgress;
  }

  private setState(newState: CollectorState): void {
    this.state = newState;
    this.onStateChangeCb?.(newState);
  }

  /**
   * Bắt đầu quy trình thu mẫu: Đếm ngược 3s -> Ghi đoạn dài
   */
  public async startCollection(): Promise<void> {
    if (this.state !== 'idle') return;

    this.stopReplay();
    this.recordedFrames = [];
    this.currentSample = null;
    this.setState('countdown');

    // Đếm ngược 3 giây
    for (let i = 3; i > 0; i--) {
      this.onCountdownCb?.(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    this.onCountdownCb?.(null);

    // Chuyển sang trạng thái Ghi
    this.setState('recording');
    this.recordStartTime = performance.now();
    const maxMs = this.config.durationSeconds * 1000;
    this.onRecordProgressCb?.(0, 0, maxMs);

    // Timer tự động dừng khi hết thời lượng quy định (mặc định 3s)
    if (this.recordTimer) clearTimeout(this.recordTimer);
    this.recordTimer = setTimeout(() => {
      if (this.state === 'recording') {
        this.finishRecording();
      }
    }, maxMs);
  }

  /**
   * Cho phép người dùng dừng ghi sớm khi đã làm xong ký hiệu
   */
  public stopRecordingEarly(): void {
    if (this.state !== 'recording') return;
    if (this.recordTimer) {
      clearTimeout(this.recordTimer);
      this.recordTimer = null;
    }
    this.finishRecording();
  }

  /**
   * Đưa một khung hình đã trích xuất từ camera vào buffer
   */
  public pushFrame(frame: ExtractedFrame): void {
    if (this.state !== 'recording') return;

    this.recordedFrames.push(frame);
    const elapsedMs = Math.round(performance.now() - this.recordStartTime);
    const maxMs = this.config.durationSeconds * 1000;
    this.onRecordProgressCb?.(this.recordedFrames.length, elapsedMs, maxMs);
  }

  /**
   * Thuật toán tự động cắt đầu/cuối:
   * - Lớp "nghi" (Nghỉ - Idle): Giữ nguyên toàn bộ (cropStart = 0, cropEnd = total - 1).
   * - Các ký hiệu khác: Tìm khung đầu tiên và khung cuối cùng có tay cử động, bỏ đoạn không có tay hoặc tay đứng yên.
   */
  private autoDetectTrimRange(frames: ExtractedFrame[], labelId: string): TrimRange {
    const total = frames.length;
    if (total <= 5 || labelId === 'nghi') {
      return { cropStart: 0, cropEnd: Math.max(0, total - 1), isAutoTrimmed: false };
    }

    // 1. Tính vận tốc cử động cổ tay và độ hiện diện của tay
    const handVelocities: number[] = new Array(total).fill(0);

    for (let i = 1; i < total; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];

      let dist = 0;
      let count = 0;

      // Tay trái (so sánh cổ tay landmark 0)
      if (curr.hasLeftHand && prev.hasLeftHand && curr.rawLeftHandLandmarks && prev.rawLeftHandLandmarks) {
        const dx = curr.rawLeftHandLandmarks[0].x - prev.rawLeftHandLandmarks[0].x;
        const dy = curr.rawLeftHandLandmarks[0].y - prev.rawLeftHandLandmarks[0].y;
        dist += Math.sqrt(dx * dx + dy * dy);
        count++;
      }

      // Tay phải
      if (curr.hasRightHand && prev.hasRightHand && curr.rawRightHandLandmarks && prev.rawRightHandLandmarks) {
        const dx = curr.rawRightHandLandmarks[0].x - prev.rawRightHandLandmarks[0].x;
        const dy = curr.rawRightHandLandmarks[0].y - prev.rawRightHandLandmarks[0].y;
        dist += Math.sqrt(dx * dx + dy * dy);
        count++;
      }

      handVelocities[i] = count > 0 ? dist / count : 0;
    }

    // 2. Tìm điểm bắt đầu cử chỉ: Khung đầu tiên có tay và có cử động (hoặc vận tốc > ngưỡng)
    let startIdx = 0;
    let foundStart = false;
    for (let i = 0; i < total; i++) {
      const hasHand = frames[i].hasLeftHand || frames[i].hasRightHand;
      const isMoving = handVelocities[i] > 0.003; // Ngưỡng dịch chuyển tối thiểu
      if (hasHand && isMoving) {
        // Lùi lại 2 khung làm biên an toàn (safety buffer)
        startIdx = Math.max(0, i - 2);
        foundStart = true;
        break;
      }
    }

    // Nếu không tìm thấy bằng vận tốc, tìm khung đầu tiên có tay
    if (!foundStart) {
      for (let i = 0; i < total; i++) {
        if (frames[i].hasLeftHand || frames[i].hasRightHand) {
          startIdx = i;
          foundStart = true;
          break;
        }
      }
    }

    // 3. Tìm điểm kết thúc cử chỉ từ cuối lên
    let endIdx = total - 1;
    let foundEnd = false;
    for (let i = total - 1; i >= startIdx; i--) {
      const hasHand = frames[i].hasLeftHand || frames[i].hasRightHand;
      const isMoving = handVelocities[i] > 0.003;
      if (hasHand && isMoving) {
        // Tiến thêm 2 khung làm biên an toàn
        endIdx = Math.min(total - 1, i + 2);
        foundEnd = true;
        break;
      }
    }

    if (!foundEnd) {
      for (let i = total - 1; i >= startIdx; i--) {
        if (frames[i].hasLeftHand || frames[i].hasRightHand) {
          endIdx = i;
          foundEnd = true;
          break;
        }
      }
    }

    // Đảm bảo tối thiểu 10 khung hình
    if (endIdx - startIdx < 5) {
      startIdx = 0;
      endIdx = total - 1;
    }

    return {
      cropStart: startIdx,
      cropEnd: endIdx,
      isAutoTrimmed: true
    };
  }

  /**
   * Kết thúc ghi khung hình và chuyển sang chế độ Xem lại (Reviewing)
   */
  private finishRecording(): void {
    if (this.recordTimer) {
      clearTimeout(this.recordTimer);
      this.recordTimer = null;
    }

    const actualFrames = this.recordedFrames.length;
    if (actualFrames === 0) {
      this.setState('idle');
      return;
    }

    const firstTime = this.recordedFrames[0].timestamp;
    const lastTime = this.recordedFrames[actualFrames - 1].timestamp;
    const durationMs = Math.max(1, Math.round(lastTime - firstTime));
    const actualFps = Math.round((actualFrames * 10000) / durationMs) / 10;

    let leftCount = 0;
    let rightCount = 0;
    for (const f of this.recordedFrames) {
      if (f.hasLeftHand) leftCount++;
      if (f.hasRightHand) rightCount++;
    }

    const leftHandRate = Math.round((leftCount / actualFrames) * 100);
    const rightHandRate = Math.round((rightCount / actualFrames) * 100);

    // Tự động phát hiện khoảng cắt đầu/cuối
    const trimRange = this.autoDetectTrimRange(this.recordedFrames, this.config.labelId);

    // Cảnh báo chất lượng nếu thiếu tay
    let qualityWarning: string | undefined = undefined;
    if (this.config.labelId !== 'nghi') {
      const maxPresent = Math.max(leftHandRate, rightHandRate);
      if (maxPresent < 50) {
        qualityWarning = `Cảnh báo: Mẫu chỉ phát hiện tay trong ${maxPresent}% số khung hình. Cử chỉ có thể bị khuất hoặc nằm ngoài khung camera!`;
      }
    }

    const sample: RecordedSample = {
      schemaVersion: '1.2.0',
      mediaPipeVersion: ACTUAL_MEDIAPIPE_VERSION,
      labelId: this.config.labelId,
      labelName: this.config.labelName,
      signerId: this.config.signerId,
      sessionId: this.config.sessionId,
      timestamp: new Date().toISOString(),
      deviceInfo: {
        facingMode: this.config.facingMode,
        isMirrored: this.config.isMirrored,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        videoWidth: this.config.videoWidth,
        videoHeight: this.config.videoHeight,
        userAgent: navigator.userAgent
      },
      metrics: {
        targetFrames: Math.round(this.config.durationSeconds * 30),
        actualFrames,
        durationMs,
        actualFps,
        leftHandPresentRate: leftHandRate,
        rightHandPresentRate: rightHandRate,
        qualityWarning
      },
      trimRange,
      frames: [...this.recordedFrames] // Lưu TOÀN BỘ đoạn thô
    };

    this.currentSample = sample;
    this.setState('reviewing');
  }

  /**
   * Cập nhật điểm cắt do người ký điều chỉnh thủ công
   */
  public updateTrimRange(cropStart: number, cropEnd: number): void {
    if (!this.currentSample) return;
    const total = this.currentSample.frames.length;
    const start = Math.max(0, Math.min(cropStart, total - 1));
    const end = Math.max(start, Math.min(cropEnd, total - 1));

    this.currentSample.trimRange = {
      cropStart: start,
      cropEnd: end,
      isAutoTrimmed: false
    };

    // Khởi động lại vòng lặp Replay theo điểm cắt mới
    this.replayFrameIdx = start;
  }

  /**
   * Lưu mẫu hiện tại vào IndexedDB
   */
  public async saveCurrentSample(): Promise<number | null> {
    if (!this.currentSample) return null;
    this.stopReplay();
    const id = await dbStorage.saveSample(this.currentSample);
    this.currentSample = null;
    this.recordedFrames = [];
    this.setState('idle');
    return id;
  }

  /**
   * Bỏ mẫu hiện tại và sẵn sàng thu lại
   */
  public discardCurrentSample(): void {
    this.stopReplay();
    this.currentSample = null;
    this.recordedFrames = [];
    this.setState('idle');
  }

  /**
   * Bắt đầu vòng lặp Replay phát lại chuyển động skeleton trên canvas (chỉ phát trong khoảng cropStart -> cropEnd)
   */
  public startReplay(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    onProgress?: (frameIdx: number, total: number, cropStart: number, cropEnd: number) => void
  ): void {
    if (!this.currentSample || this.currentSample.frames.length === 0) return;
    this.stopReplay();

    this.isReplaying = true;
    const { cropStart, cropEnd } = this.currentSample.trimRange;
    this.replayFrameIdx = cropStart;
    const frames = this.currentSample.frames;
    const total = frames.length;

    const intervalMs = Math.max(25, Math.round(this.currentSample.metrics.durationMs / total));

    this.replayTimer = setInterval(() => {
      if (!this.isReplaying || !this.currentSample) return;

      const f = frames[this.replayFrameIdx];
      if (f) {
        this.tracker.drawSkeleton(
          ctx,
          {
            poseLandmarks: f.rawPoseLandmarks || null,
            leftHandLandmarks: f.rawLeftHandLandmarks || null,
            rightHandLandmarks: f.rawRightHandLandmarks || null,
            stats: {
              mode: 'pose_hand',
              fps: this.currentSample.metrics.actualFps,
              latencyMs: 0,
              hasPose: !!f.rawPoseLandmarks,
              hasLeftHand: f.hasLeftHand,
              hasRightHand: f.hasRightHand
            }
          },
          canvas.width,
          canvas.height
        );
      }

      const activeRange = this.currentSample.trimRange;
      onProgress?.(this.replayFrameIdx + 1, total, activeRange.cropStart, activeRange.cropEnd);

      // Chạy lặp lại trong khoảng đã cắt
      this.replayFrameIdx++;
      if (this.replayFrameIdx > activeRange.cropEnd) {
        this.replayFrameIdx = activeRange.cropStart;
      }
    }, intervalMs);
  }

  public stopReplay(): void {
    this.isReplaying = false;
    if (this.replayTimer) {
      clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
  }
}
