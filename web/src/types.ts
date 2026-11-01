export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type HandednessLabel = 'Left' | 'Right';

export interface HandResult {
  landmarks: Point3D[]; // 21 điểm
  handedness: HandednessLabel; // Quy ước THEO NGƯỜI KÝ (Signer's perspective)
}

export interface NormalizedFrameFeatures {
  vector: number[]; // 272 phần tử theo spec
  hasLeftHand: boolean;
  hasRightHand: boolean;
  leftHandLocal: Point3D[] | null;
  rightHandLocal: Point3D[] | null;
  timestamp: number;
}

export interface ExtractedFrame {
  timestamp: number; // ms
  features: number[]; // 272 floats
  hasLeftHand: boolean;
  hasRightHand: boolean;
  rawPoseLandmarks?: Point3D[];
  rawLeftHandLandmarks?: Point3D[];
  rawRightHandLandmarks?: Point3D[];
}

export interface RecordedSample {
  schemaVersion: string;
  mediaPipeVersion: string;
  labelId: string;
  labelName: string;
  signerId: string;
  sessionId: string;
  timestamp: string;
  deviceInfo: {
    facingMode: 'user' | 'environment';
    isMirrored: boolean;
    screenWidth: number;
    screenHeight: number;
    videoWidth: number;
    videoHeight: number;
    userAgent: string;
  };
  metrics: {
    targetFrames: number;
    actualFrames: number;
    durationMs: number;
    actualFps: number;
    leftHandPresentRate: number;
    rightHandPresentRate: number;
    qualityWarning?: string;
  };
  frames: ExtractedFrame[];
}

export interface LabelItem {
  id: string;
  name: string;
}

export interface BenchmarkModeStats {
  avgFps: number; // Detection rate (lần/giây)
  avgLatencyMs: number;
  oneHandRate: number; // Tỉ lệ khung có ít nhất 1 tay (%)
  bothHandsRate: number; // Tỉ lệ khung có đủ 2 tay (%)
  sampleCount: number;
}

export interface BenchmarkReportData {
  schemaVersion: string;
  timestamp: string;
  deviceInfo: {
    userAgent: string;
    isMobile: boolean;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
  };
  cameraInfo: {
    videoWidth: number;
    videoHeight: number;
    trackFrameRate: number | null;
    facingMode: 'user' | 'environment';
    label: string;
  };
  holistic: BenchmarkModeStats;
  poseHand: BenchmarkModeStats & {
    isOptimized: boolean;
  };
  recommendation: TrackerMode;
  reason: string;
}

export type TrackerMode = 'holistic' | 'pose_hand';

