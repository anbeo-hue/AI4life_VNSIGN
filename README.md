# Hệ Thống Dịch Ngôn Ngữ Ký Hiệu Việt Nam (VSL) - AI4Life

Dự án phát triển nền tảng web dịch ngôn ngữ ký hiệu hai chiều chạy hoàn toàn trên trình duyệt (client-side static web):
1. **Ký hiệu → Văn bản**: Nhận diện cử chỉ từ Camera qua MediaPipe Landmarks $\rightarrow$ Chuẩn hóa đặc trưng $\rightarrow$ Mô hình chuỗi (ONNX Runtime Web) $\rightarrow$ Văn bản tiếng Việt.
2. **Văn bản → Mô hình 3D**: Văn bản tiếng Việt $\rightarrow$ Chuỗi cử chỉ ký hiệu $\rightarrow$ Avatar 3D (Three.js) diễn lại.

---

## Cấu trúc Dự án
- `web/`: Ứng dụng web giao diện người dùng (Vite + TypeScript + Three.js). Chạy được trên cả máy tính và điện thoại thông qua HTTPS nội bộ.
- `ml/`: Mã nguồn Python phục vụ sinh dummy model, tiền xử lý dữ liệu và huấn luyện mô hình nhận dạng chuỗi.
- `data/`: Thư mục lưu trữ dữ liệu landmark (không lưu video, không commit file dữ liệu lớn).
- `docs/`: Tài liệu kỹ thuật chi tiết:
  - `docs/data_collection_guide.md`: Sổ tay hướng dẫn thu thập dữ liệu VSL (đặt máy, ánh sáng, lớp Nghỉ, đạo đức).
  - `docs/onnx_compatibility.md`: Bảng tương thích ONNX (onnx 1.23.2, onnxruntime-web 1.31.1, ir_version 10, opset 14).
  - `docs/https_setup.md`: Hướng dẫn cấu hình và truy cập HTTPS trên điện thoại.
  - `docs/feature_vector_spec.md`: Đặc tả vector đặc trưng và quy tắc chuẩn hóa tọa độ.

---

## Ghi nhận Bản quyền & Nguồn Tham khảo (Credits & License)

Dự án này sử dụng và kế thừa các ý tưởng, cấu trúc dữ liệu và giải pháp tiền xử lý landmark từ kho mã nguồn mở:
- **Tên dự án gốc**: [hand-gesture-recognition-using-mediapipe](https://github.com/Kazuhito00/hand-gesture-recognition-using-mediapipe)
- **Tác giả**: Kazuhito Takahashi (Kazuhito00)
- **Giấy phép**: [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0)

Toàn bộ các cải tiến, bao gồm việc chuẩn hóa tỉ lệ theo khoảng cách vai, tách đặc trưng cục bộ bàn tay, và tích hợp bộ nhận diện chuỗi cử chỉ tiếng Việt cho cuộc thi AI4Life đều tuân thủ các điều khoản của Apache-2.0.

