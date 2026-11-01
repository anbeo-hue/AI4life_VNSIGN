import { Point3D, NormalizedFrameFeatures } from '../types';

// Chỉ số các điểm Pose cần dùng (MediaPipe 33 pose landmarks)
// 11: Vai trái, 12: Vai phải, 13: Khuỷu trái, 14: Khuỷu phải, 15: Cổ tay trái, 16: Cổ tay phải
export const UPPER_BODY_POSE_INDICES = [11, 12, 13, 14, 15, 16];

export class LandmarkNormalizer {
  /**
   * Chuẩn hóa landmarks của một khung hình thành vector 272 phần tử
   * @param rawPose Mảng landmarks thân người (33 điểm nếu có)
   * @param rawLeftHand 21 điểm bàn tay trái (theo người ký)
   * @param rawRightHand 21 điểm bàn tay phải (theo người ký)
   * @param width Chiều rộng video pixel
   * @param height Chiều cao video pixel
   * @param timestamp Thời điểm khung hình (ms)
   */
  public static normalizeFrame(
    rawPose: Point3D[] | null,
    rawLeftHand: Point3D[] | null,
    rawRightHand: Point3D[] | null,
    width: number,
    height: number,
    timestamp: number
  ): NormalizedFrameFeatures {
    const W = width > 0 ? width : 640;
    const H = height > 0 ? height : 480;

    // 1. Chuyển đổi Pose sang Pixel
    let leftShoulderPx: Point3D = { x: 0.4 * W, y: 0.4 * H, z: 0 };
    let rightShoulderPx: Point3D = { x: 0.6 * W, y: 0.4 * H, z: 0 };

    if (rawPose && rawPose.length >= 17) {
      const p11 = rawPose[11];
      const p12 = rawPose[12];
      if (p11 && p12) {
        leftShoulderPx = { x: p11.x * W, y: p11.y * H, z: p11.z * W };
        rightShoulderPx = { x: p12.x * W, y: p12.y * H, z: p12.z * W };
      }
    }

    // Gốc tọa độ thân: Trung điểm 2 vai (Pixel)
    const shoulderCenterPx: Point3D = {
      x: (leftShoulderPx.x + rightShoulderPx.x) / 2,
      y: (leftShoulderPx.y + rightShoulderPx.y) / 2,
      z: (leftShoulderPx.z + rightShoulderPx.z) / 2
    };

    // Độ rộng vai (Pixel metric)
    const dx = rightShoulderPx.x - leftShoulderPx.x;
    const dy = rightShoulderPx.y - leftShoulderPx.y;
    const dz = rightShoulderPx.z - leftShoulderPx.z;
    let shoulderDistPx = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Tránh chia cho 0 hoặc khoảng cách quá nhỏ
    if (shoulderDistPx < 10.0) {
      shoulderDistPx = 0.25 * W;
    }

    // Helper: chuẩn hóa theo gốc vai và độ rộng vai
    const toBodyRelative = (p: Point3D): [number, number, number] => {
      const px = p.x * W;
      const py = p.y * H;
      const pz = p.z * W;
      return [
        (px - shoulderCenterPx.x) / shoulderDistPx,
        (py - shoulderCenterPx.y) / shoulderDistPx,
        (pz - shoulderCenterPx.z) / shoulderDistPx
      ];
    };

    // Helper: chuẩn hóa đặc trưng cục bộ bàn tay (Hand-Local)
    // Tương đối cổ tay (điểm 0) và chia cho khoảng cách từ cổ tay đến khớp gốc ngón giữa (điểm 9)
    const toHandLocal = (handLandmarks: Point3D[]): number[] => {
      if (!handLandmarks || handLandmarks.length < 21) {
        return new Array(63).fill(0.0);
      }
      const wrist = handLandmarks[0];
      const wristPx: Point3D = { x: wrist.x * W, y: wrist.y * H, z: wrist.z * W };

      const mcp9 = handLandmarks[9];
      const mcp9Px: Point3D = { x: mcp9.x * W, y: mcp9.y * H, z: mcp9.z * W };

      const hdx = mcp9Px.x - wristPx.x;
      const hdy = mcp9Px.y - wristPx.y;
      const hdz = mcp9Px.z - wristPx.z;
      let handScale = Math.sqrt(hdx * hdx + hdy * hdy + hdz * hdz);
      if (handScale < 5.0) {
        handScale = 0.1 * W;
      }

      const localVec: number[] = [];
      for (let i = 0; i < 21; i++) {
        const pt = handLandmarks[i];
        const ptx = pt.x * W;
        const pty = pt.y * H;
        const ptz = pt.z * W;
        localVec.push(
          (ptx - wristPx.x) / handScale,
          (pty - wristPx.y) / handScale,
          (ptz - wristPx.z) / handScale
        );
      }
      return localVec;
    };

    // 2. Vector Cờ hiện diện (2 giá trị)
    const hasLeftHand = !!(rawLeftHand && rawLeftHand.length === 21);
    const hasRightHand = !!(rawRightHand && rawRightHand.length === 21);
    const flags: [number, number] = [hasLeftHand ? 1.0 : 0.0, hasRightHand ? 1.0 : 0.0];

    // 3. Thân trên Body-Relative (6 điểm * 3 = 18 giá trị)
    const upperBodyVec: number[] = [];
    for (const idx of UPPER_BODY_POSE_INDICES) {
      if (rawPose && rawPose[idx]) {
        const [nx, ny, nz] = toBodyRelative(rawPose[idx]);
        upperBodyVec.push(nx, ny, nz);
      } else {
        upperBodyVec.push(0.0, 0.0, 0.0);
      }
    }

    // 4. Tay trái Body-Relative (21 điểm * 3 = 63 giá trị)
    const leftHandBodyVec: number[] = [];
    if (hasLeftHand && rawLeftHand) {
      for (let i = 0; i < 21; i++) {
        const [nx, ny, nz] = toBodyRelative(rawLeftHand[i]);
        leftHandBodyVec.push(nx, ny, nz);
      }
    } else {
      for (let i = 0; i < 63; i++) leftHandBodyVec.push(0.0);
    }

    // 5. Tay phải Body-Relative (21 điểm * 3 = 63 giá trị)
    const rightHandBodyVec: number[] = [];
    if (hasRightHand && rawRightHand) {
      for (let i = 0; i < 21; i++) {
        const [nx, ny, nz] = toBodyRelative(rawRightHand[i]);
        rightHandBodyVec.push(nx, ny, nz);
      }
    } else {
      for (let i = 0; i < 63; i++) rightHandBodyVec.push(0.0);
    }

    // 6. Tay trái Hand-Local (21 điểm * 3 = 63 giá trị)
    const leftHandLocalVec = hasLeftHand && rawLeftHand ? toHandLocal(rawLeftHand) : new Array(63).fill(0.0);

    // 7. Tay phải Hand-Local (21 điểm * 3 = 63 giá trị)
    const rightHandLocalVec = hasRightHand && rawRightHand ? toHandLocal(rawRightHand) : new Array(63).fill(0.0);

    // Ghép vector theo đúng thứ tự đặc tả: 2 + 18 + 63 + 63 + 63 + 63 = 272
    const totalVector: number[] = [
      ...flags,
      ...upperBodyVec,
      ...leftHandBodyVec,
      ...rightHandBodyVec,
      ...leftHandLocalVec,
      ...rightHandLocalVec
    ];

    return {
      vector: totalVector,
      hasLeftHand,
      hasRightHand,
      leftHandLocal: rawLeftHand,
      rightHandLocal: rawRightHand,
      timestamp
    };
  }
}

