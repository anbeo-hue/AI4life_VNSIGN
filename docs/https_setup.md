# Hướng Dẫn Cấu Hình và Truy Cập HTTPS Cục Bộ (Local LAN)

Trình duyệt hiện đại (Chrome, Safari, Edge, Firefox) trên cả máy tính và điện thoại thông minh đều **bắt buộc ngữ cảnh an toàn (Secure Context - HTTPS)** mới cấp quyền truy cập Camera (`navigator.mediaDevices.getUserMedia`). Ứng dụng web chạy trên `localhost` được mặc định coi là an toàn, nhưng khi kết nối qua IP mạng nội bộ từ điện thoại (ví dụ: `https://192.168.1.x:5173/`), bạn cần sử dụng chứng chỉ SSL tự ký (self-signed certificate).

---

## 1. Khởi chạy Vite Dev Server với HTTPS

Dự án đã tích hợp sẵn plugin `@vitejs/plugin-basic-ssl` trong `vite.config.ts`.

Để khởi chạy máy chủ phát triển cho phép truy cập từ mọi thiết bị trong cùng mạng Wi-Fi:
```bash
cd web
npm run dev -- --host
```

Vite sẽ hiển thị địa chỉ truy cập cục bộ và mạng LAN:
```text
  ➜  Local:   https://localhost:5173/
  ➜  Network: https://192.168.x.y:5173/
```

---

## 2. Cách Bỏ Qua Cảnh Báo Chứng Chỉ Trên Điện Thoại

Vì chứng chỉ SSL được sinh tự động bởi plugin và không ký bởi CA công cộng (Let's Encrypt / DigiCert), trình duyệt trên điện thoại sẽ hiển thị cảnh báo bảo mật khi bạn truy cập lần đầu:

### Trên Google Chrome / Cốc Cốc / Edge (Android & iOS):
1. Nhập URL mạng LAN (ví dụ: `https://192.168.1.50:5173/`).
2. Màn hình cảnh báo: *"Kết nối của bạn không phải là kết nối riêng tư"* (Your connection is not private / `NET::ERR_CERT_AUTHORITY_INVALID`).
3. Bấm vào nút **Nâng cao** (Advanced).
4. Chọn liên kết **Tiếp tục truy cập 192.168.x.y (không an toàn)** (Proceed to ... unsafe).
5. Khi trang web tải xong, cấp quyền **Cho phép truy cập Máy ảnh (Camera)** khi được hỏi.

### Trên Safari (iOS / iPadOS):
1. Mở Safari và nhập URL mạng LAN `https://192.168.x.y:5173/`.
2. Màn hình cảnh báo: *"Trang web này không thể xác minh danh tính"* (This Connection Is Not Private).
3. Bấm vào **Hiển thị chi tiết** (Show Details) ở cuối trang.
4. Bấm vào dòng **truy cập trang web này** (visit this website).
5. Xác nhận **Truy cập trang web** (Visit Website) trong hộp thoại thông báo.
6. Cho phép quyền Camera khi trang yêu cầu.

---

## 3. Mẹo Kiểm Tra Nhanh
- Đảm bảo máy tính phát triển và điện thoại kết nối **cùng một mạng Wi-Fi**.
- Nếu điện thoại không tải được trang, hãy kiểm tra Firewall trên máy tính (Windows Defender Firewall) để chắc chắn cổng `5173` được cho phép kết nối trong Private Network.

