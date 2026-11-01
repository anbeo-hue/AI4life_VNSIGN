import { LandmarkTracker } from '../vision/landmark_tracker';
import { TrackerMode, BenchmarkReportData, BenchmarkModeStats } from '../types';

export class BenchmarkManager {
  private tracker: LandmarkTracker;
  private isBenchmarking: boolean = false;
  private onProgressCallback?: (message: string, percent: number) => void;
  private onCountdownCallback?: (secondsLeft: number | null) => void;
  private getCameraInfoFn?: () => {
    trackFrameRate: number | null;
    videoWidth: number;
    videoHeight: number;
    facingMode: 'user' | 'environment';
    label: string;
  };

  private latestReport: BenchmarkReportData | null = null;

  constructor(
    tracker: LandmarkTracker,
    getCameraInfoFn?: () => {
      trackFrameRate: number | null;
      videoWidth: number;
      videoHeight: number;
      facingMode: 'user' | 'environment';
      label: string;
    }
  ) {
    this.tracker = tracker;
    this.getCameraInfoFn = getCameraInfoFn;
  }

  public isRunning(): boolean {
    return this.isBenchmarking;
  }

  public setProgressCallback(cb: (message: string, percent: number) => void): void {
    this.onProgressCallback = cb;
  }

  public setCountdownCallback(cb: (secondsLeft: number | null) => void): void {
    this.onCountdownCallback = cb;
  }

  public getLatestReport(): BenchmarkReportData | null {
    return this.latestReport;
  }

  /**
   * Đếm ngược 5 giây trước khi tiến hành benchmark
   */
  private async runCountdown(seconds: number = 5): Promise<void> {
    for (let i = seconds; i > 0; i--) {
      this.onCountdownCallback?.(i);
      this.onProgressCallback?.(`Chuẩn bị giơ hai tay trước camera... Bắt đầu sau ${i}s`, 0);
      await this.wait(1000);
    }
    this.onCountdownCallback?.(null); // Tắt overlay đếm ngược
  }

  /**
   * Chạy benchmark hoàn chỉnh: Đếm ngược 5s -> Đo 5s Holistic -> Đo 5s Pose+Hand
   */
  public async runFullBenchmark(durationPerModeMs: number = 5000): Promise<BenchmarkReportData> {
    if (this.isBenchmarking) {
      throw new Error('Benchmark đang chạy');
    }
    this.isBenchmarking = true;

    try {
      // 1. Đếm ngược 5 giây
      await this.runCountdown(5);

      const cameraInfo = this.getCameraInfoFn ? this.getCameraInfoFn() : {
        trackFrameRate: null,
        videoWidth: 640,
        videoHeight: 480,
        facingMode: 'user' as const,
        label: 'Default Camera'
      };

      // 2. Đo HolisticLandmarker (5 giây)
      this.onProgressCallback?.('Đang đo HolisticLandmarker...', 10);
      await this.tracker.switchMode('holistic');
      await this.wait(400);

      const holisticData = await this.collectStats(durationPerModeMs, 10, 50, 'HolisticLandmarker');

      // 3. Đo Pose + HandLandmarker (5 giây)
      this.onProgressCallback?.('Đang chuyển và đo Pose + HandLandmarker...', 55);
      await this.tracker.switchMode('pose_hand');
      await this.wait(400);

      const poseHandData = await this.collectStats(durationPerModeMs, 55, 95, 'Pose + HandLandmarker');

      // 4. Logic Khuyến nghị: Ưu tiên tỉ lệ nhận diện tay; chỉ so FPS khi chênh lệch dưới 5 điểm phần trăm (< 5%)
      let recommendation: TrackerMode = 'holistic';
      let reason = '';

      // Đánh giá tỉ lệ nhận diện tay (dùng tỉ lệ đủ cả 2 tay bothHandsRate làm chỉ số then chốt, kết hợp 1 tay)
      const handQualityHolistic = holisticData.bothHandsRate * 0.7 + holisticData.oneHandRate * 0.3;
      const handQualityPoseHand = poseHandData.bothHandsRate * 0.7 + poseHandData.oneHandRate * 0.3;
      const handDiff = Math.abs(handQualityHolistic - handQualityPoseHand);

      if (handDiff >= 5.0) {
        // Chênh lệch tỉ lệ nhận diện tay >= 5%: Ưu tiên bên nhận diện tay tốt hơn
        if (handQualityHolistic > handQualityPoseHand) {
          recommendation = 'holistic';
          reason = `HolisticLandmarker nhận diện tay vượt trội (${holisticData.bothHandsRate}% 2 tay vs ${poseHandData.bothHandsRate}% 2 tay, chênh ${handDiff.toFixed(1)}%). Ưu tiên độ chính xác nhận diện.`;
        } else {
          recommendation = 'pose_hand';
          reason = `Pose + HandLandmarker nhận diện tay tốt hơn (${poseHandData.bothHandsRate}% 2 tay vs ${holisticData.bothHandsRate}% 2 tay, chênh ${handDiff.toFixed(1)}%).`;
        }
      } else {
        // Chênh lệch tỉ lệ nhận diện dưới 5 điểm phần trăm: So sánh FPS để chọn bên nhanh hơn
        if (poseHandData.avgFps > holisticData.avgFps * 1.05) {
          recommendation = 'pose_hand';
          reason = `Tỉ lệ nhận diện tay tương đương (chênh lệch < 5%). Chọn Pose + HandLandmarker vì FPS cao hơn (${poseHandData.avgFps} vs ${holisticData.avgFps} lần/s).`;
        } else if (holisticData.avgFps > poseHandData.avgFps * 1.05) {
          recommendation = 'holistic';
          reason = `Tỉ lệ nhận diện tay tương đương (chênh lệch < 5%). Chọn HolisticLandmarker vì FPS cao hơn (${holisticData.avgFps} vs ${poseHandData.avgFps} lần/s).`;
        } else {
          recommendation = 'holistic';
          reason = `Cả tỉ lệ nhận diện và FPS đều tương đương. Khuyến nghị dùng HolisticLandmarker làm mặc định.`;
        }
      }

      // Đặt lại tracker về mode được khuyến nghị
      await this.tracker.switchMode(recommendation);
      this.onProgressCallback?.(`Hoàn tất benchmark! Khuyến nghị: ${recommendation === 'holistic' ? 'HolisticLandmarker' : 'Pose + HandLandmarker'}`, 100);

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const report: BenchmarkReportData = {
        schemaVersion: '1.1.0',
        timestamp: new Date().toISOString(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          isMobile,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1
        },
        cameraInfo,
        holistic: holisticData,
        poseHand: {
          ...poseHandData,
          isOptimized: this.tracker.isOptimizationEnabled()
        },
        recommendation,
        reason
      };

      this.latestReport = report;
      return report;
    } finally {
      this.isBenchmarking = false;
      this.onCountdownCallback?.(null);
    }
  }

  /**
   * Thu thập thống kê cho một mode trong thời gian quy định
   */
  private async collectStats(
    durationMs: number,
    progressStart: number,
    progressEnd: number,
    label: string
  ): Promise<BenchmarkModeStats> {
    let detectionCount = 0;
    let totalLatencyMs = 0;
    let oneHandCount = 0;
    let bothHandsCount = 0;
    const startTime = performance.now();

    return new Promise((resolve) => {
      (window as any).__vslBenchmarkHook = (stats: {
        latencyMs: number;
        hasLeftHand: boolean;
        hasRightHand: boolean;
      }) => {
        detectionCount++;
        totalLatencyMs += stats.latencyMs;

        const countHands = (stats.hasLeftHand ? 1 : 0) + (stats.hasRightHand ? 1 : 0);
        if (countHands >= 1) oneHandCount++;
        if (countHands === 2) bothHandsCount++;
      };

      const interval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = progressStart + (elapsed / durationMs) * (progressEnd - progressStart);
        this.onProgressCallback?.(
          `Đo ${label}... (${(elapsed / 1000).toFixed(1)}s / ${(durationMs / 1000).toFixed(0)}s | ${detectionCount} detections)`,
          Math.min(progressEnd, Math.round(progress))
        );

        if (elapsed >= durationMs) {
          clearInterval(interval);
          delete (window as any).__vslBenchmarkHook;

          const elapsedSec = elapsed / 1000;
          const avgFps = elapsedSec > 0 ? Math.round((detectionCount / elapsedSec) * 10) / 10 : 0;
          const avgLatency = detectionCount > 0 ? Math.round(totalLatencyMs / detectionCount) : 0;
          const oneHandRate = detectionCount > 0 ? Math.round((oneHandCount / detectionCount) * 1000) / 10 : 0;
          const bothHandsRate = detectionCount > 0 ? Math.round((bothHandsCount / detectionCount) * 1000) / 10 : 0;

          resolve({
            avgFps,
            avgLatencyMs: avgLatency,
            oneHandRate,
            bothHandsRate,
            sampleCount: detectionCount
          });
        }
      }, 80);
    });
  }

  /**
   * Xuất báo cáo benchmark ra file JSON tải về
   */
  public downloadJsonReport(): void {
    if (!this.latestReport) {
      alert('Chưa có dữ liệu benchmark để xuất file!');
      return;
    }

    const jsonStr = JSON.stringify(this.latestReport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `vsl_benchmark_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
