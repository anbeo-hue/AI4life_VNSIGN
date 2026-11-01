# Thư mục dữ liệu (VSL Dataset)

Thư mục này dùng để lưu trữ các tệp landmarks trích xuất (JSON/CSV) từ ứng dụng web thu thập dữ liệu (M1).

## Quy ước
- `raw/`: Chứa các file JSON/CSV thô được tải về từ công cụ web.
- `processed/`: Chứa các file dữ liệu đã được làm sạch, nội suy độ dài cố định phục vụ huấn luyện mô hình.
- **Lưu ý bảo mật & tài nguyên**: Không commit các file dữ liệu thô lớn lên Git. Chỉ lưu trữ các landmark (tọa độ điểm), tuyệt đối không lưu video.

