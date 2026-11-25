# AI Discipline Coach

Ứng dụng Web MVP tối ưu cho màn hình điện thoại giúp người dùng thiết lập hồ sơ thể chất, đặt mục tiêu tập luyện 4–12 tuần và nhận **Lịch tập Tuần 1** an toàn do AI thiết kế kết hợp **bộ kiểm định an toàn độc lập**.

## Tính năng chính (Sprint 01)
1. **M01 — Hồ sơ người dùng (`Hồ sơ`)**: Nhập thông tin cơ thể, trình độ, số ngày tập/tuần, dụng cụ có sẵn và giới hạn sức khỏe; tính BMI theo nhóm tuổi (không áp dụng ngưỡng người lớn cho người dưới 18 tuổi).
2. **M02 — Thiết lập mục tiêu (`Mục tiêu`)**: Chọn môn chính (Chạy bộ, Tập tại nhà, Gym), mục tiêu (Giảm cân, Tăng cơ, Tăng sức bền), thời hạn 4–12 tuần và xác nhận đồng ý chia sẻ dữ liệu sức khỏe cho AI.
3. **M03 — AI Strategy Engine & Kiểm định an toàn (`Lịch tập tuần`)**: Tạo lịch 7 ngày có khởi động, bài tập chi tiết, số hiệp/lần, thời gian nghỉ và đánh dấu hoàn thành từng buổi. Tự động bật **Chế độ thận trọng** khi có giới hạn sức khỏe, thiếu dữ liệu hoặc người dùng `<16` / `>60` tuổi.

## Yêu cầu môi trường
- Node.js `>= 20` (đã kiểm chứng trên `v22.23.5`)
- PostgreSQL / Google Cloud SQL Auth Proxy
- Dự án Firebase Authentication (Google Sign-In) và `firebase-applet-config.json` tại thư mục gốc
- Gemini API Key (`GEMINI_API_KEY`)

## Biến môi trường

Không lưu bất kỳ khóa bí mật nào vào Git. Tham khảo `.env.example`:
- `GEMINI_API_KEY`: Khóa API Gemini chạy trên máy chủ (cấu hình qua Secrets panel hoặc `.env` cục bộ).
- `APP_URL`: URL ứng dụng.
- Các biến kết nối PostgreSQL (runtime Cloud SQL):
  - `SQL_HOST` (đường dẫn Unix socket hoặc host PostgreSQL)
  - `SQL_DB_NAME`
  - `SQL_USER` / `SQL_PASSWORD` (quyền đọc/ghi ứng dụng)
  - `SQL_ADMIN_USER` / `SQL_ADMIN_PASSWORD` (quyền migration cho Drizzle Kit)

## Cài đặt & Chạy thử

```bash
# 1. Cài đặt thư viện
npm install

# 2. Sinh hoặc cập nhật migration SQL từ src/db/schema.ts
npm run db:generate
npx drizzle-kit push --config=./src/db/drizzle.config.ts

# 3. Kiểm tra TypeScript, bộ test tự động và build
npm run lint
npm test
npm run build

# 4. Chạy ứng dụng (Express + Vite trên cổng 3000)
npm run dev
```

## Tài liệu dự án
- `docs/PRD.md`: Yêu cầu sản phẩm và phạm vi MVP.
- `docs/ARCHITECTURE.md`: Kiến trúc hệ thống & đánh giá khả năng chuyển đổi sang Capacitor (Android/iOS).
- `docs/SAFETY_RULES.md`: Quy tắc an toàn y khoa, phân loại BMI theo tuổi và kiểm định chiến lược.
- `docs/AUDIT_REPORT.md`: Báo cáo kiểm toán kỹ thuật Sprint 01.
- `docs/ACCEPTANCE_TESTS.md`: Kết quả kiểm thử tự động và các hạng mục còn bị chặn.
- `docs/MVP_BACKLOG.md`: Tiến độ Sprint 01 và đề xuất Sprint 02.
