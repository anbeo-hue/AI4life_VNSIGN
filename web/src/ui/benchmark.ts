import { LandmarkTracker } from '../vision/landmark_tracker';
import { TrackerMode } from '../types';

export interface BenchmarkReport {
  holistic: {
    avgFps: number;
    avgLatencyMs: number;
    handDetectRate: number;
    sampleCount: number;
  };
  poseHand: {
    avgFps: number;
    avgLatencyMs: number;
    handDetectRate: number;
    sampleCount: number;
  };
  recommendation: TrackerMode;
  notes: string;
}

export class BenchmarkManager {
  private tracker: LandmarkTracker;
  private isBenchmarking: boolean = false;
  private onProgressCallback?: (message: string, percent: number) => void;

  constructor(tracker: LandmarkTracker) {
    this.tracker = tracker;
  }

  public isRunning(): boolean {
    return this.isBenchmarking;
  }

  public setProgressCallback(cb: (message: string, percent: number) => void): void {
    this.onProgressCallback = cb;
  }

  /**
   * Chạy benchmark so sánh giữa Holistic và Pose+Hand
   * @param durationPerModeMs Thời gian đo cho mỗi mode (mặc định 5000ms = 5s)
   */
  public async runFullBenchmark(durationPerModeMs: number = 5000): Promise<BenchmarkReport> {
    if (this.isBenchmarking) {
      throw new Error('Benchmark đang chạy');
    }
    this.isBenchmarking = true;

    try {
      // 1. Đo HolisticLandmarker
      this.onProgressCallback?.('Đang đo HolisticLandmarker...', 10);
      await this.tracker.switchMode('holistic');
      await this.wait(500); // Đợi ổn định

      const holisticData = await this.collectStats(durationPerModeMs, 10, 50, 'Holistic');

      // 2. Đo Pose + HandLandmarker
      this.onProgressCallback?.('Đang chuyển và đo Pose + HandLandmarker...', 55);
      await this.tracker.switchMode('pose_hand');
      await this.wait(500);

      const poseHandData = await this.collectStats(durationPerModeMs, 55, 95, 'Pose+Hand');

      // Đưa ra khuyến nghị
      let recommendation: TrackerMode = 'holistic';
      let notes = '';

      if (poseHandData.avgFps > holisticData.avgFps * 1.15) {
        recommendation = 'pose_hand';
        notes = `Pose + HandLandmarker nhanh hơn khoảng ${Math.round(((poseHandData.avgFps - holisticData.avgFps) / (holisticData.avgFps || 1)) * 100)}% FPS.`;
      } else if (holisticData.handDetectRate > poseHandData.handDetectRate * 1.1) {
        recommendation = 'holistic';
        notes = 'HolisticLandmarker có độ ổn định và tỉ lệ phát hiện bàn tay đồng bộ tốt hơn.';
      } else {
        recommendation = holisticData.avgFps >= poseHandData.avgFps ? 'holistic' : 'pose_hand';
        notes = 'Hiệu năng giữa hai chế độ tương đương. Ưu tiên chế độ có FPS cao hơn một chút.';
      }

      // Đặt lại tracker về mode được khuyến nghị
      await this.tracker.switchMode(recommendation);
      this.onProgressCallback?.(`Hoàn tất! Khuyến nghị: ${recommendation === 'holistic' ? 'Holistic' : 'Pose + Hand'}`, 100);

      return {
        holistic: holisticData,
        poseHand: poseHandData,
        recommendation,
        notes
      };
    } finally {
      this.isBenchmarking = false;
    }
  }

  private async collectStats(
    durationMs: number,
    progressStart: number,
    progressEnd: number,
    label: string
  ): Promise<{ avgFps: number; avgLatencyMs: number; handDetectRate: number; sampleCount: number }> {
    const startTime = performance.now();
    const fpsSamples: number[] = [];
    const latencySamples: number[] = [];
    let detectedHandCount = 0;
    let totalFrames = 0;

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = progressStart + (elapsed / durationMs) * (progressEnd - progressStart);
        this.onProgressCallback?.(`Đo ${label}... (${Math.round((elapsed / 1000))}s / ${Math.round(durationMs / 1000)}s)`, Math.min(progressEnd, Math.round(progress)));

        if (elapsed >= durationMs) {
          clearInterval(interval);
          const avgFps = fpsSamples.length > 0 ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0;
          const avgLatency = latencySamples.length > 0 ? latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length : 0;
          const handRate = totalFrames > 0 ? (detectedHandCount / totalFrames) * 100 : 0;

          resolve({
            avgFps: Math.round(avgFps * 10) / 10,
            avgLatencyMs: Math.round(avgLatency),
            handDetectRate: Math.round(handRate),
            sampleCount: totalFrames
          });
        }
      }, 100);

      // Listener này sẽ được cung cấp từ hook bên ngoài hoặc ta cập nhật mẫu từ main loop
      (window as any).__vslBenchmarkCollector = (stats: { fps: number; latencyMs: number; hasLeftHand: boolean; hasRightHand: boolean }) => {
        if (stats.fps > 0) fpsSamples.push(stats.fps);
        if (stats.latencyMs > 0) latencySamples.push(stats.latencyMs);
        if (stats.hasLeftHand || stats.hasRightHand) detectedHandCount++;
        totalFrames++;
      };
    }).then((res: any) => {
      delete (window as any).__vslBenchmarkCollector;
      return res;
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

