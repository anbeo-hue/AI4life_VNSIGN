# Đặc Tả Vector Đặc Trưng và Chuẩn Hóa Tọa Độ Landmark (Feature Vector Specification)

Tài liệu này quy định cấu trúc và thứ tự của vector đặc trưng trích xuất từ mỗi khung hình video cho bài toán nhận dạng Ngôn ngữ Ký hiệu Việt Nam (VSL) tại AI4Life.

---

## 1. Nguyên Tắc Chuẩn Hóa

### 1.1. Chuyển đổi sang hệ tọa độ Pixel thực tế
MediaPipe trả về tọa độ chuẩn hóa $(x, y, z) \in [0, 1]$ đối với chiều rộng $W$ và chiều cao $H$ của khung hình gốc. Để triệt tiêu ảnh hưởng của tỉ lệ khung hình (ví dụ 16:9, 4:3, 1:1, 9:16 trên điện thoại), trước khi tính toán khoảng cách hình học, toàn bộ tọa độ được đưa về hệ pixel:
$$x_{px} = x \times W$$
$$y_{px} = y \times H$$
$$z_{px} = z \times W$$

### 1.2. Gốc Tọa Độ và Thước Đo Toàn Thân (Body-Relative Normalization)
- **Gốc tọa độ thân**: Trung điểm nối 2 mỏm vai:
  $$O_{px} = \frac{P_{vai\_trai, px} + P_{vai\_phai, px}}{2}$$
- **Thước đo tỉ lệ cơ thể**: Khoảng cách Euclid giữa 2 vai tính theo pixel:
  $$D_{px} = \sqrt{(x_{vai\_phai, px} - x_{vai\_trai, px})^2 + (y_{vai\_phai, px} - y_{vai\_trai, px})^2 + (z_{vai\_phai, px} - z_{vai\_trai, px})^2}$$
  *(Nếu không phát hiện được thân người hoặc $D_{px} \le 1.0$, gán mặc định $D_{px} = 0.25 \times W$ để tránh chia cho 0).*
- **Tọa độ toàn thân chuẩn hóa**:
  $$P'_{body} = \frac{P_{px} - O_{px}}{D_{px}}$$

### 1.3. Gốc Tọa Độ và Thước Đo Cục Bộ Bàn Tay (Hand-Local Normalization)
Để phân biệt rõ ràng hình dạng ngón tay độc lập với vị trí vươn tay:
- **Gốc tọa độ cục bộ bàn tay**: Tọa độ cổ tay (Wrist - Landmark 0 của bàn tay):
  $$W_{wrist} = P_{0, px}$$
- **Thước đo kích thước bàn tay**: Khoảng cách từ cổ tay (Landmark 0) đến khớp gốc ngón giữa (MCP - Landmark 9):
  $$S_{hand} = \|P_{9, px} - P_{0, px}\|_2$$
  *(Nếu $S_{hand} \le 1.0$, lấy khoảng cách thay thế hoặc $0.1 \times W$).*
- **Tọa độ cục bộ chuẩn hóa**:
  $$P'_{local} = \frac{P_{px} - W_{wrist}}{S_{hand}}$$

### 1.4. Xử Lý Khi Tay Bị Khuất hoặc Vắng Mặt (Missing Hand Handling)
- Khi một bàn tay không xuất hiện trong khung hình:
  - Tất cả tọa độ $P'_{body}$ và $P'_{local}$ của tay đó được gán giá trị `0.0`.
  - Cờ tương ứng (`has_left_hand` hoặc `has_right_hand`) mang giá trị `0.0` (khi có mang giá trị `1.0`).

---

## 2. Quy Ước Tay Trái / Tay Phải & Góc Nhìn
- **Quy ước theo người ký (Signer's perspective)**: Tay phải là bàn tay giải phẫu bên phải của người thực hiện ký hiệu.
- **Khung hình trích xuất**: MediaPipe nhận khung hình gốc **CHƯA LẬT**.
- Lật gương (Mirroring) chỉ áp dụng thuần túy ở tầng hiển thị CSS/Canvas nhằm tạo cảm giác tự nhiên như soi gương cho người dùng.

---

## 3. Thứ Tự Chi Tiết Các Phần Tử Trong Vector Đặc Trưng 1 Frame ($D = 272$)

Vector $V \in \mathbb{R}^{272}$ được sắp xếp theo thứ tự nghiêm ngặt sau:

| STT | Khối đặc trưng | Kích thước | Chi tiết |
|:---:|:---|:---:|:---|
| 1 | Cờ nhận diện tay | 2 | `[has_left_hand, has_right_hand]` (0.0 hoặc 1.0) |
| 2 | Thân trên (Body-relative) | 18 | 6 điểm khớp thân trên $\times (x, y, z)$: Vai trái (11), Vai phải (12), Khuỷu trái (13), Khuỷu phải (14), Cổ tay trái (15), Cổ tay phải (16) |
| 3 | Tay trái (Body-relative) | 63 | 21 điểm mấu chốt tay trái $\times (x, y, z)$ theo gốc vai & khoảng cách vai |
| 4 | Tay phải (Body-relative) | 63 | 21 điểm mấu chốt tay phải $\times (x, y, z)$ theo gốc vai & khoảng cách vai |
| 5 | Tay trái cục bộ (Hand-local) | 63 | 21 điểm mấu chốt tay trái $\times (x, y, z)$ theo gốc cổ tay trái & kích thước tay trái |
| 6 | Tay phải cục bộ (Hand-local) | 63 | 21 điểm mấu chốt tay phải $\times (x, y, z)$ theo gốc cổ tay phải & kích thước tay phải |

**Tổng số chiều**: $2 + 18 + 63 + 63 + 63 + 63 = 272$ giá trị `float32` cho mỗi khung hình.

Một mẫu ký hiệu hoàn chỉnh độ dài $T$ frames sẽ có ma trận đặc trưng $M \in \mathbb{R}^{T \times 272}$.

