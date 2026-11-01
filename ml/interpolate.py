"""
Module nội suy chuỗi thời gian các khung hình Landmarks về độ dài cố định (Fixed sequence length)
phục vụ huấn luyện mô hình học sâu (RNN / LSTM / Transformer).
"""
import numpy as np
from scipy.interpolate import interp1d
from typing import List, Dict, Any, Tuple

def interpolate_sequence(
    frames_data: np.ndarray,
    target_len: int = 30,
    timestamps: List[float] = None
) -> np.ndarray:
    """
    Nội suy chuỗi khung hình `(T, feature_dim)` về `(target_len, feature_dim)`.
    
    Args:
        frames_data: Ma trận kích thước (T, D), trong đó T là số frame thực tế, D là số chiều đặc trưng (ví dụ 272).
        target_len: Số frame cố định mong muốn (ví dụ 30).
        timestamps: Mảng thời gian (ms) thực tế của từng frame (nếu có). Nếu không có, giả định bước nhảy thời gian đều.
        
    Returns:
        Ma trận nội suy kích thước (target_len, D).
    """
    T, D = frames_data.shape
    if T == target_len:
        return frames_data.copy()
        
    if T == 1:
        # Nếu chỉ có 1 frame, lặp lại cho đủ
        return np.repeat(frames_data, target_len, axis=0)
        
    # Tạo trục thời gian gốc x
    if timestamps is not None and len(timestamps) == T:
        x_orig = np.array(timestamps, dtype=np.float32)
        # Chuẩn hóa về [0, 1]
        x_min, x_max = x_orig[0], x_orig[-1]
        if x_max > x_min:
            x_orig = (x_orig - x_min) / (x_max - x_min)
        else:
            x_orig = np.linspace(0.0, 1.0, num=T, dtype=np.float32)
    else:
        x_orig = np.linspace(0.0, 1.0, num=T, dtype=np.float32)
        
    # Trục thời gian mục tiêu
    x_target = np.linspace(0.0, 1.0, num=target_len, dtype=np.float32)
    
    # Sử dụng linear interpolation
    interp_fn = interp1d(x_orig, frames_data, axis=0, kind='linear', fill_value="extrapolate")
    interpolated = interp_fn(x_target)
    
    # Đối với cờ nhị phân (has_left_hand, has_right_hand ở index 0 và 1), làm tròn về 0 hoặc 1
    if D >= 2:
        interpolated[:, 0] = np.round(interpolated[:, 0])
        interpolated[:, 1] = np.round(interpolated[:, 1])
        
    return interpolated.astype(np.float32)


def test_interpolation():
    """Hàm kiểm tra tính đúng đắn của việc nội suy"""
    T_orig = 45
    D = 272
    dummy_input = np.random.randn(T_orig, D).astype(np.float32)
    dummy_input[:, 0] = 1.0  # has_left
    dummy_input[:, 1] = 0.0  # no_right
    
    out = interpolate_sequence(dummy_input, target_len=30)
    assert out.shape == (30, D), f"Kích thước sau nội suy sai: {out.shape}"
    assert np.all((out[:, 0] == 1.0) | (out[:, 0] == 0.0))
    print(f"[OK] Nội suy thành công từ {T_orig} frames về {out.shape[0]} frames.")

if __name__ == "__main__":
    test_interpolation()

