"""
Module tải và tiền xử lý dữ liệu Dataset VSL xuất từ Web (JSON / CSV).
Hỗ trợ kiểm tra schema, cắt đoạn ký hiệu (trimming) và nội suy thời gian về độ dài cố định.
"""
import os
import json
import numpy as np
import pandas as pd
from typing import Tuple, List, Dict, Any
from interpolate import interpolate_sequence

def load_dataset_json(json_path: str, target_len: int = 30) -> Tuple[np.ndarray, np.ndarray, Dict[str, int]]:
    """
    Đọc tệp dataset JSON xuất từ web collector.
    Tự động lấy ĐOẠN ĐÃ CẮT (cropStart -> cropEnd) để nội suy về target_len khung hình.
    Lớp 'nghi' (Nghỉ - Idle) giữ nguyên toàn bộ không cắt.
    
    Args:
        json_path: Đường dẫn tới file .json
        target_len: Số frame cố định sau khi nội suy (mặc định 30)
        
    Returns:
        X: Tensor numpy shape (num_samples, target_len, 272)
        y: Mảng nhãn dạng số nguyên (num_samples,)
        label_map: Ánh xạ từ label_id sang số nguyên { 'nghi': 0, 'xin_chao': 1, ... }
    """
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Không tìm thấy file: {json_path}")
        
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    schema_version = data.get('schemaVersion', 'unknown')
    mediapipe_version = data.get('mediaPipeVersion', 'unknown')
    samples = data.get('samples', [])
    print(f"[DatasetLoader] Nạp dataset JSON (Schema: {schema_version}, MediaPipe: {mediapipe_version}), tổng số mẫu: {len(samples)}")
    
    unique_labels = sorted(list(set(s['labelId'] for s in samples)))
    label_map = {lbl: idx for idx, lbl in enumerate(unique_labels)}
    print(f"[DatasetLoader] Các lớp nhận dạng ({len(label_map)}): {label_map}")
    
    X_list = []
    y_list = []
    
    for sample in samples:
        label_id = sample['labelId']
        frames = sample.get('frames', [])
        if len(frames) == 0:
            continue
            
        # Lớp 'nghi' không cắt; các lớp ký hiệu lấy theo trimRange (nếu có)
        if label_id == 'nghi' or 'trimRange' not in sample:
            selected_frames = frames
        else:
            start = sample['trimRange'].get('cropStart', 0)
            end = sample['trimRange'].get('cropEnd', len(frames) - 1)
            start = max(0, min(start, len(frames) - 1))
            end = max(start, min(end, len(frames) - 1))
            selected_frames = frames[start : end + 1]
            
        if len(selected_frames) == 0:
            selected_frames = frames
            
        frame_features = np.array([f['features'] for f in selected_frames], dtype=np.float32)
        timestamps = [f['timestamp'] for f in selected_frames]
        
        # Nội suy đoạn đã cắt về target_len cố định
        interpolated = interpolate_sequence(frame_features, target_len=target_len, timestamps=timestamps)
        
        X_list.append(interpolated)
        y_list.append(label_map[label_id])
        
    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int64)
    
    print(f"[DatasetLoader] Đã nạp thành công: X.shape={X.shape}, y.shape={y.shape}")
    return X, y, label_map


def load_dataset_csv(csv_path: str, target_len: int = 30) -> Tuple[np.ndarray, np.ndarray, Dict[str, int]]:
    """
    Đọc tệp dataset CSV xuất từ web collector.
    Tự động lọc theo crop_start và crop_end (ngoại trừ lớp 'nghi') rồi nội suy về target_len.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Không tìm thấy file: {csv_path}")
        
    df = pd.read_csv(csv_path)
    print(f"[DatasetLoader] Nạp dataset CSV, tổng số dòng khung hình: {len(df)}")
    
    unique_labels = sorted(df['label_id'].unique().tolist())
    label_map = {lbl: idx for idx, lbl in enumerate(unique_labels)}
    
    grouped = df.groupby(['session_id', 'sample_id', 'label_id'], sort=False)
    
    feature_cols = [c for c in df.columns if c not in [
        'label_id', 'label_name', 'signer_id', 'session_id', 'sample_id',
        'crop_start', 'crop_end', 'frame_index', 'timestamp_ms'
    ]]
    
    X_list = []
    y_list = []
    
    for (sess, sid, lbl), group in grouped:
        group_sorted = group.sort_values(by='frame_index')
        
        # Lớp 'nghi' không cắt; các ký hiệu khác cắt theo crop_start/end nếu có
        if lbl != 'nghi' and 'crop_start' in group_sorted.columns and 'crop_end' in group_sorted.columns:
            c_start = int(group_sorted['crop_start'].iloc[0])
            c_end = int(group_sorted['crop_end'].iloc[0])
            group_trimmed = group_sorted[(group_sorted['frame_index'] >= c_start) & (group_sorted['frame_index'] <= c_end)]
            if len(group_trimmed) > 0:
                group_sorted = group_trimmed
                
        feats = group_sorted[feature_cols].values.astype(np.float32)
        ts = group_sorted['timestamp_ms'].values.tolist()
        
        interpolated = interpolate_sequence(feats, target_len=target_len, timestamps=ts)
        X_list.append(interpolated)
        y_list.append(label_map[lbl])
        
    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int64)
    
    print(f"[DatasetLoader] Đã nạp CSV thành công: X.shape={X.shape}, y.shape={y.shape}")
    return X, y, label_map
