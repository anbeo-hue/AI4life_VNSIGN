# Sổ Tay Hướng Dẫn Thu Thập Dữ Liệu Ngôn Ngữ Ký Hiệu Việt Nam (VSL)

Tài liệu này cung cấp quy chuẩn thực nghiệm thu thập dữ liệu landmark ký hiệu VSL cho cuộc thi **AI4Life**, đảm bảo dữ liệu đạt chất lượng cao, đồng nhất và mô hình học sâu có khả năng tổng quát hóa tốt.

---

## 1. Thiết Lập Thiết Bị & Không Gian Quay

### 1.1. Vị trí và Góc đặt Camera
- **Độ cao camera**: Đặt camera ngang tầm mắt hoặc ngang ngực của người ký. Tuyệt đối tránh góc quay từ dưới hất lên hoặc từ trên chúc xuống quá lớn vì sẽ làm biến dạng tỉ lệ hình học của cánh tay và bàn tay.
- **Khoảng cách lý tưởng**: Từ **1.2 mét đến 1.8 mét** tính từ camera đến người ký.
- **Khung hình chuẩn**:
  - Người ký ngồi thẳng lưng hoặc đứng thoải mái.
  - Khung hình camera bao quát trọn vẹn từ **đầu đến ngang thắt lưng (thân trên)**.
  - Khi người ký vươn hai tay sang hai bên hoặc đưa tay lên cao, toàn bộ các ngón tay vẫn phải nằm trọn trong khung hình, không bị tràn viền (out-of-frame).

### 1.2. Ánh Sáng (Lighting)
- **Ánh sáng đều phía trước**: Bố trí nguồn sáng (đèn phòng, đèn bàn, ánh sáng tự nhiên qua cửa sổ) chiếu thẳng vào mặt trước của người ký.
- **Tránh ngược sáng (Backlight)**: Tuyệt đối không ngồi quay lưng về phía cửa sổ có nắng gắt hoặc bóng đèn chiếu thẳng vào camera (gây tối đen bàn tay, camera bị giảm tương phản).
- **Tránh bóng đổ gắt**: Tránh ánh sáng chiếu lệch một bên quá mạnh làm khuất các kẽ ngón tay.
- **Đảm bảo FPS camera $\ge 20$**: Nếu ánh sáng quá yếu, cảm biến camera tự động tăng thời gian phơi sáng dẫn đến hiện tượng mờ nhòe chuyển động (motion blur) và FPS bị tụt xuống dưới 20.

### 1.3. Phông Nền (Background) & Trang Phục
- **Phông nền**: Ưu tiên nền tường phẳng, đơn sắc (trắng, xám nhạt, xanh nhạt), ít họa tiết phức tạp hoặc đồ vật gây nhiễu thị giác.
- **Trang phục**:
  - Nên mặc áo màu trơn, sẫm màu (đen, xanh than, nâu...) tương phản rõ rệt với màu da tay.
  - Áo cộc tay hoặc xắn tay áo qua khỏi cổ tay để camera nhận diện chính xác khớp cổ tay và độ dài cẳng tay.
  - Tháo bớt đồng hồ lớn, vòng tay kim loại sáng bóng để tránh gây nhiễu cho detector bàn tay.

---

## 2. Quy Chuẩn Thu Thập & Số Lượng Mẫu

### 2.1. Số Lượng Mẫu Mục Tiêu
- **Mục tiêu giai đoạn M1**: Thu tối thiểu **25 – 30 mẫu cho mỗi nhãn**.
- **Đa dạng người ký (Signers)**: Nên có ít nhất **2 – 3 người ký khác nhau** (khác biệt về vóc dáng, chiều dài cánh tay, tốc độ thao tác) để mô hình có khả năng tổng quát hóa với người dùng mới.

### 2.2. Thời Gian Nghỉ Giữa Các Lần Quay
- Sau mỗi lần thu một mẫu ký hiệu, người ký nên **nghỉ 5 – 10 giây**.
- Cứ sau 10 – 15 mẫu, nên cho người ký nghỉ giải lao 2 phút. Việc quay liên tục không nghỉ sẽ gây mỏi cơ vai/cổ tay, dẫn đến động tác bị cứng, làm giảm biên độ và làm sai lệch cử chỉ tự nhiên.

---

## 3. Cách Thu Thập Lớp "Nghỉ" (Idle) Đa Dạng

Lớp **"Nghỉ" (`nghi`)** là lớp quan trọng nhất trong hệ thống dịch thời gian thực. Nếu không có lớp nghỉ chất lượng, mô hình sẽ liên tục kích hoạt nhận diện nhầm khi người dùng chỉ đang cử động bình thường.

Thu thập lớp "Nghỉ" cần chia đều theo 3 nhóm trạng thái:

1. **Nghỉ tĩnh (Static Rest) (~40% số mẫu)**:
   - Hai tay buông xuôi tự nhiên bên hông.
   - Hoặc hai tay đặt thư giãn trên đùi / trên mặt bàn.
   - Thân người và đầu hơi cử động nhẹ tự nhiên (thở, chớp mắt).
2. **Nghỉ động không phải ký hiệu (Non-sign Movements) (~40% số mẫu)**:
   - Các hành vi tự nhiên hàng ngày: gãi cằm, vuốt tóc, đẩy kính mắt, xoa tay, chỉ tay vô định, chỉnh lại cổ áo.
   - Các cử động này giúp mô hình phân biệt rõ ràng giữa "cử động tay thông thường" và "ký hiệu ngôn ngữ có cấu trúc".
3. **Chuyển tiếp ký hiệu (Transition / Preparation) (~20% số mẫu)**:
   - Người ký nhấc tay từ tư thế buông xuôi lên ngang ngực nhưng không tạo hình ngón tay, sau đó hạ tay xuống.
   - Mô phỏng khoảnh khắc chuyển giao giữa hai câu nói.

> [!NOTE]
> Khác với các lớp ký hiệu cần cắt đoạn thừa, **lớp "Nghỉ" được giữ nguyên toàn bộ đoạn thu thô**, không cắt đầu/cuối để mô hình học trọn vẹn ngữ cảnh thời gian của trạng thái nghỉ.

---

## 4. Đạo Đức Nghiên Cứu & Quyền Riêng Tư (Ethics & Consent)

- **Nguyên tắc bảo vệ dữ liệu**: Ứng dụng web chạy hoàn toàn trên trình duyệt, chỉ trích xuất các tọa độ số thực (landmarks) và **tuyệt đối KHÔNG lưu hay truyền tải video/hình ảnh khuôn mặt của người ký lên mạng hay máy chủ**.
- **Xin phép người tham gia**: Trước khi quay, người hướng dẫn phải giải thích rõ:
  1. Dữ liệu chỉ dùng cho mục đích nghiên cứu học thuật và tham gia cuộc thi AI4Life.
  2. Mã người ký được gán ẩn danh (ví dụ `signer_01`, `signer_02`), không lưu thông tin định danh cá nhân.
  3. Người ký có quyền yêu cầu xem lại và xóa bỏ bất kỳ mẫu nào họ cảm thấy không đạt hoặc không thoải mái.

---

## 5. Quy Trình Thao Tác Chuẩn Trên Web

1. Nhập mã người ký: `signer_xx`.
2. Chọn nhãn trong danh sách (lưu ý banner cảnh báo nếu là nhãn tạm chưa chuẩn hóa).
3. Bấm **Spacebar** $\rightarrow$ Hệ thống đếm ngược `3... 2... 1...`
4. Thực hiện ký hiệu dứt khoát, rõ ràng.
5. Sau khi kết thúc, nếu cử chỉ ngắn hơn 3 giây, bấm phím **Spacebar** để dừng sớm.
6. Màn hình Xem lại (Replay) hiện ra:
   - Quan sát chuyển động khung xương xem có bị mất khớp tay hay không.
   - Kéo thanh trượt để tinh chỉnh khung bắt đầu (`cropStart`) và khung kết thúc (`cropEnd`) nếu đoạn tự cắt chưa ưng ý.
7. Bấm **Spacebar** để Lưu mẫu (hoặc **Esc** để Hủy bỏ và thu lại).
8. Định kỳ bấm **"Tải Dataset JSON"** hoặc **"Tải Dataset CSV"** để sao lưu file vào máy tính.

