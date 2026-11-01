# Hướng Dẫn Tương Thích ONNX (ONNX Compatibility Guide)

Để đảm bảo các mô hình học sâu huấn luyện từ Python (PyTorch/Scikit-Learn/ONNX) chạy trơn tru trên môi trường trình duyệt client-side qua **ONNX Runtime Web** (`onnxruntime-web`), toàn bộ đường ống xuất mô hình cần tuân thủ bảng tương thích dưới đây.

---

## 1. Bảng Thông Số Phiên Bản Chuẩn Hóa

| Thành phần | Phiên bản đang dùng | Giới hạn & Ghi chú |
|:---|:---|:---|
| **Python ONNX library** | `onnx==1.23.2` | Thư viện tạo/xuất mô hình trên Python |
| **onnxruntime-web** | `^1.20.1` (thực tế cài đặt: `1.31.1`) | Engine suy luận WebAssembly trên trình duyệt |
| **ONNX IR Version** | **`10`** | `onnxruntime-web` hỗ trợ tối đa **IR version $\le 13$**. ONNX 1.23.2 mặc định xuất IR 14 dẫn tới lỗi `Unsupported model IR version: 14`. Đã ghim cứng `model.ir_version = 10`. |
| **ONNX Opset Version** | **`14`** | Opset ổn định và được hỗ trợ đầy đủ trên tất cả các trình duyệt WebAssembly / WebGPU |

---

## 2. Quy Chuẩn Khi Xuất Mô Hình từ Python (`ml/`)

Bất kể mô hình được xuất từ `onnx.helper` hay `torch.onnx.export()`, luôn phải gán:

```python
import onnx

# 1. Nếu dùng torch.onnx.export:
# torch.onnx.export(
#     model, dummy_input, output_path,
#     opset_version=14,
#     input_names=['input'],
#     output_names=['probabilities']
# )

# 2. Sau khi lưu, luôn kiểm tra và ghim ir_version <= 13 (khuyến nghị 10):
model = onnx.load(output_path)
model.ir_version = 10
onnx.checker.check_model(model)
onnx.save(model, output_path)
```

---

## 3. Nhật Ký Lỗi Đã Xử Lý (Troubleshooting)

- **Lỗi**: `Unsupported model IR version: 14, max supported IR version: 13`.
- **Nguyên nhân**: Bản cập nhật mới của thư viện Python `onnx` (1.23.2) tự động nâng `IR_VERSION` mặc định từ 10 lên 14. Trong khi đó, `onnxruntime-web` (1.31.1) chỉ hỗ trợ tối đa `IR version: 13`.
- **Giải pháp**: Thiết lập `model_def.ir_version = 10` trước khi lưu file `.onnx`. Đã kiểm chứng nạp thành công và thực hiện suy luận client-side hoàn toàn bình thường.

