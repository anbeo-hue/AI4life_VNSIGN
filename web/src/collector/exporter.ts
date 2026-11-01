import { RecordedSample, ACTUAL_MEDIAPIPE_VERSION } from '../types';

export class DatasetExporter {
  /**
   * Tạo tiêu đề các cột cho file CSV (272 đặc trưng + metadata + chỉ số cắt crop_start, crop_end)
   */
  public static generateCsvHeader(): string[] {
    const headers = [
      'label_id',
      'label_name',
      'signer_id',
      'session_id',
      'sample_id',
      'crop_start',
      'crop_end',
      'frame_index',
      'timestamp_ms',
      'has_left_hand',
      'has_right_hand'
    ];

    // Thân trên (6 điểm mấu chốt: 11, 12, 13, 14, 15, 16)
    const upperPoseIndices = [11, 12, 13, 14, 15, 16];
    for (const idx of upperPoseIndices) {
      headers.push(`upper_pose_${idx}_x`, `upper_pose_${idx}_y`, `upper_pose_${idx}_z`);
    }

    // Tay trái toàn thân (21 điểm)
    for (let i = 0; i < 21; i++) {
      headers.push(`left_body_${i}_x`, `left_body_${i}_y`, `left_body_${i}_z`);
    }

    // Tay phải toàn thân (21 điểm)
    for (let i = 0; i < 21; i++) {
      headers.push(`right_body_${i}_x`, `right_body_${i}_y`, `right_body_${i}_z`);
    }

    // Tay trái cục bộ (21 điểm)
    for (let i = 0; i < 21; i++) {
      headers.push(`left_local_${i}_x`, `left_local_${i}_y`, `left_local_${i}_z`);
    }

    // Tay phải cục bộ (21 điểm)
    for (let i = 0; i < 21; i++) {
      headers.push(`right_local_${i}_x`, `right_local_${i}_y`, `right_local_${i}_z`);
    }

    return headers;
  }

  /**
   * Chuyển danh sách mẫu thành chuỗi CSV (mỗi dòng là 1 khung hình trong đoạn thô kèm crop_start/end)
   */
  public static samplesToCsv(samples: (RecordedSample & { id?: number })[]): string {
    const headers = this.generateCsvHeader();
    const rows: string[] = [headers.join(',')];

    samples.forEach((sample, sampleIdx) => {
      const sampleId = sample.id !== undefined ? sample.id : sampleIdx + 1;
      const cropStart = sample.trimRange ? sample.trimRange.cropStart : 0;
      const cropEnd = sample.trimRange ? sample.trimRange.cropEnd : (sample.frames.length - 1);

      sample.frames.forEach((frame, frameIdx) => {
        const row = [
          JSON.stringify(sample.labelId),
          JSON.stringify(sample.labelName),
          JSON.stringify(sample.signerId),
          JSON.stringify(sample.sessionId),
          sampleId,
          cropStart,
          cropEnd,
          frameIdx,
          frame.timestamp.toFixed(1),
          // 272 features đã bao gồm flags và các tọa độ
          ...frame.features.map((v) => v.toFixed(6))
        ];
        rows.push(row.join(','));
      });
    });

    return rows.join('\n');
  }

  /**
   * Xuất danh sách mẫu thành chuỗi JSON (đầy đủ metadata, schemaVersion và phiên bản MediaPipe thực tế)
   */
  public static samplesToJson(samples: (RecordedSample & { id?: number })[]): string {
    const exportBundle = {
      schemaVersion: '1.2.0',
      mediaPipeVersion: ACTUAL_MEDIAPIPE_VERSION,
      exportedAt: new Date().toISOString(),
      totalSamples: samples.length,
      samples: samples
    };
    return JSON.stringify(exportBundle, null, 2);
  }

  /**
   * Tải tệp xuống máy tính người dùng
   */
  public static triggerDownload(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
