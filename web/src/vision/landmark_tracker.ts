import {
  FilesetResolver,
  HolisticLandmarker,
  PoseLandmarker,
  HandLandmarker,
  DrawingUtils,
  NormalizedLandmark
} from '@mediapipe/tasks-vision';
import { Point3D, TrackerMode } from '../types';

export interface TrackerStats {
  mode: TrackerMode;
  fps: number;
  latencyMs: number;
  hasPose: boolean;
  hasLeftHand: boolean;
  hasRightHand: boolean;
}

export interface LandmarkResultData {
  poseLandmarks: Point3D[] | null;
  leftHandLandmarks: Point3D[] | null;
  rightHandLandmarks: Point3D[] | null;
  stats: TrackerStats;
}

export class LandmarkTracker {
  private mode: TrackerMode = 'holistic';
  private wasmBasePath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

  private holisticLandmarker: HolisticLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;

  private isReady: boolean = false;
  private swapHandedness: boolean = false; // Tùy chọn đảo nhãn nếu thực nghiệm phát hiện ngược

  // Biến đo FPS và Latency
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private currentFps = 0;
  private lastFpsUpdate = performance.now();
  private lastLatencyMs = 0;

  constructor() {}

  public async init(initialMode: TrackerMode = 'holistic'): Promise<void> {
    this.mode = initialMode;
    const vision = await FilesetResolver.forVisionTasks(this.wasmBasePath);

    if (this.mode === 'holistic') {
      await this.initHolistic(vision);
    } else {
      await this.initPoseAndHand(vision);
    }
    this.isReady = true;
  }

  private async initHolistic(vision: any): Promise<void> {
    console.log('[MediaPipe] Khởi tạo HolisticLandmarker...');
    this.holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO'
    });
    console.log('[MediaPipe] HolisticLandmarker đã sẵn sàng.');
  }

  private async initPoseAndHand(vision: any): Promise<void> {
    console.log('[MediaPipe] Khởi tạo PoseLandmarker và HandLandmarker...');
    const [pose, hand] = await Promise.all([
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1
      }),
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2
      })
    ]);

    this.poseLandmarker = pose;
    this.handLandmarker = hand;
    console.log('[MediaPipe] Pose & HandLandmarker đã sẵn sàng.');
  }

  public async switchMode(newMode: TrackerMode): Promise<void> {
    if (this.mode === newMode) return;
    this.isReady = false;
    this.mode = newMode;
    const vision = await FilesetResolver.forVisionTasks(this.wasmBasePath);

    if (newMode === 'holistic') {
      if (!this.holisticLandmarker) {
        await this.initHolistic(vision);
      }
    } else {
      if (!this.poseLandmarker || !this.handLandmarker) {
        await this.initPoseAndHand(vision);
      }
    }
    this.isReady = true;
  }

  public setSwapHandedness(swap: boolean): void {
    this.swapHandedness = swap;
  }

  public getSwapHandedness(): boolean {
    return this.swapHandedness;
  }

  public getMode(): TrackerMode {
    return this.mode;
  }

  public processVideoFrame(video: HTMLVideoElement, timestampMs: number): LandmarkResultData | null {
    if (!this.isReady || video.readyState < 2) return null;

    const startTime = performance.now();
    let poseLandmarks: Point3D[] | null = null;
    let leftHand: Point3D[] | null = null;
    let rightHand: Point3D[] | null = null;

    try {
      if (this.mode === 'holistic' && this.holisticLandmarker) {
        const result = this.holisticLandmarker.detectForVideo(video, timestampMs);

        if (result.poseLandmarks && result.poseLandmarks.length > 0) {
          poseLandmarks = result.poseLandmarks[0].map(pt => ({ x: pt.x, y: pt.y, z: pt.z, visibility: pt.visibility }));
        }

        if (result.leftHandLandmarks && result.leftHandLandmarks.length > 0) {
          leftHand = result.leftHandLandmarks[0].map(pt => ({ x: pt.x, y: pt.y, z: pt.z }));
        }

        if (result.rightHandLandmarks && result.rightHandLandmarks.length > 0) {
          rightHand = result.rightHandLandmarks[0].map(pt => ({ x: pt.x, y: pt.y, z: pt.z }));
        }
      } else if (this.poseLandmarker && this.handLandmarker) {
        const poseResult = this.poseLandmarker.detectForVideo(video, timestampMs);
        if (poseResult.landmarks && poseResult.landmarks.length > 0) {
          poseLandmarks = poseResult.landmarks[0].map(pt => ({ x: pt.x, y: pt.y, z: pt.z, visibility: pt.visibility }));
        }

        const handResult = this.handLandmarker.detectForVideo(video, timestampMs);
        if (handResult.landmarks && handResult.landmarks.length > 0) {
          for (let i = 0; i < handResult.landmarks.length; i++) {
            const rawHand = handResult.landmarks[i].map(pt => ({ x: pt.x, y: pt.y, z: pt.z }));
            const handednessCategory = handResult.handednesses[i]?.[0]?.categoryName; // 'Left' hoặc 'Right'

            if (handednessCategory === 'Left') {
              leftHand = rawHand;
            } else if (handednessCategory === 'Right') {
              rightHand = rawHand;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Tracker] Lỗi detectForVideo:', e);
      return null;
    }

    // Đảo nhãn nếu cờ swapHandedness được kích hoạt bởi người dùng
    if (this.swapHandedness) {
      const temp = leftHand;
      leftHand = rightHand;
      rightHand = temp;
    }

    const endTime = performance.now();
    this.lastLatencyMs = Math.round(endTime - startTime);

    // Tính FPS xử lý
    this.frameCount++;
    if (endTime - this.lastFpsUpdate >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (endTime - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = endTime;
    }

    return {
      poseLandmarks,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      stats: {
        mode: this.mode,
        fps: this.currentFps,
        latencyMs: this.lastLatencyMs,
        hasPose: !!poseLandmarks,
        hasLeftHand: !!leftHand,
        hasRightHand: !!rightHand
      }
    };
  }

  /**
   * Vẽ khung xương lên canvas
   */
  public drawSkeleton(
    ctx: CanvasRenderingContext2D,
    data: LandmarkResultData,
    width: number,
    height: number
  ): void {
    ctx.clearRect(0, 0, width, height);

    // 1. Vẽ các đường nối thân trên (Pose)
    if (data.poseLandmarks && data.poseLandmarks.length >= 17) {
      const pose = data.poseLandmarks;
      const connections: [number, number][] = [
        [11, 12], // vai trái - vai phải
        [11, 13], // vai trái - khuỷu trái
        [13, 15], // khuỷu trái - cổ tay trái
        [12, 14], // vai phải - khuỷu phải
        [14, 16]  // khuỷu phải - cổ tay phải
      ];

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#22c55e'; // Xanh lá cây

      for (const [p1, p2] of connections) {
        if (pose[p1] && pose[p2]) {
          ctx.beginPath();
          ctx.moveTo(pose[p1].x * width, pose[p1].y * height);
          ctx.lineTo(pose[p2].x * width, pose[p2].y * height);
          ctx.stroke();
        }
      }

      // Vẽ các khớp
      for (const idx of [11, 12, 13, 14, 15, 16]) {
        if (pose[idx]) {
          ctx.beginPath();
          ctx.arc(pose[idx].x * width, pose[idx].y * height, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#eab308'; // Vàng
          ctx.fill();
        }
      }
    }

    // 2. Vẽ bàn tay trái (Left Hand: màu Cyan / Xanh ngọc)
    if (data.leftHandLandmarks) {
      this.drawHand(ctx, data.leftHandLandmarks, width, height, '#06b6d4', 'Tay Trái (L)');
    }

    // 3. Vẽ bàn tay phải (Right Hand: màu Cam / Đỏ)
    if (data.rightHandLandmarks) {
      this.drawHand(ctx, data.rightHandLandmarks, width, height, '#f97316', 'Tay Phải (R)');
    }
  }

  private drawHand(
    ctx: CanvasRenderingContext2D,
    landmarks: Point3D[],
    width: number,
    height: number,
    color: string,
    label: string
  ): void {
    if (landmarks.length < 21) return;

    // Đường nối ngón tay chuẩn MediaPipe
    const handConnections: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Ngón cái
      [0, 5], [5, 6], [6, 7], [7, 8],       // Ngón trỏ
      [5, 9], [9, 10], [10, 11], [11, 12],  // Ngón giữa
      [9, 13], [13, 14], [14, 15], [15, 16],// Ngón áp út
      [13, 17], [17, 18], [18, 19], [19, 20],// Ngón út
      [0, 17]                               // Đáy lòng bàn tay
    ];

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;

    for (const [s, e] of handConnections) {
      ctx.beginPath();
      ctx.moveTo(landmarks[s].x * width, landmarks[s].y * height);
      ctx.lineTo(landmarks[e].x * width, landmarks[e].y * height);
      ctx.stroke();
    }

    // Vẽ khớp
    for (let i = 0; i < 21; i++) {
      ctx.beginPath();
      ctx.arc(landmarks[i].x * width, landmarks[i].y * height, i === 0 ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
    }

    // Vẽ nhãn văn bản tại cổ tay
    const wrist = landmarks[0];
    const wx = wrist.x * width;
    const wy = wrist.y * height;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(label, wx - 20, wy - 10);
  }
}

