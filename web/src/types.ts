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

export type TrackerMode = 'holistic' | 'pose_hand';

