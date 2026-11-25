# AI Discipline Coach — Product Requirements Document (PRD)

## 1. Tầm nhìn & Định vị sản phẩm

**AI Discipline Coach** là huấn luyện viên kỷ luật và thể chất cá nhân hóa (tối ưu cho màn hình điện thoại), giúp người dùng chuyển từ ý định tập luyện thành **cam kết hành động có cấu trúc, an toàn và đo lường được**.

Sản phẩm hướng đến nhiều độ tuổi (thiếu niên, thanh niên, trưởng thành, người cao tuổi), nhiều trình độ (Mới bắt đầu, Trung bình, Nâng cao) và các bộ môn phổ biến (Chạy bộ, Tập tại nhà, Gym), trong đó **an toàn y khoa và giới hạn thể chất luôn được kiểm định độc lập ở tầng mã nguồn**.

## 2. Phạm vi MVP (Sprint 01 — Foundation)

### M01 — Hồ sơ người dùng (`Hồ sơ`)
- Thu thập: Họ tên, độ tuổi (`10–100`), cân nặng (`25–250 kg`), chiều cao (`100–230 cm`), trình độ (`beginner | intermediate | advanced`), số ngày tập/tuần (`1–7`), dụng cụ có sẵn (`none | home | gym`), danh sách giới hạn sức khỏe và ghi chú sức khỏe bổ sung.
- Tính toán BMI theo nhóm tuổi (`evaluateBmi`):
  - Người dưới 18 tuổi (`youth` `<16`, `teen` `16–17`): **không** phân loại bằng ngưỡng BMI người lớn; hiển thị thông báo đối chiếu biểu đồ bách phân vị WHO/CDC theo tuổi và giới tính.
  - Người trưởng thành (`>=18`): phân loại theo ngưỡng tham chiếu châu Á – Thái Bình Dương và kích hoạt thận trọng nếu BMI `<16.5` hoặc `>=30`.
- Lưu bền vững vào bảng `user_profiles` (PostgreSQL).

### M02 — Thiết lập mục tiêu (`Mục tiêu`)
- Chọn môn chính: Chạy bộ (`running`), Tập tại nhà (`home_workout`), Gym (`gym`).
- Chọn mục tiêu: Giảm cân (`weight_loss`), Tăng cơ (`muscle_gain`), Tăng sức bền (`endurance`).
- Chọn thời hạn lộ trình: `4–12` tuần.
- Yêu cầu xác nhận đồng ý chia sẻ dữ liệu sức khỏe (`aiConsent`) trước khi gửi thông tin tới Gemini API.
- Lưu bền vững vào bảng `user_goals` (PostgreSQL).

### M03 — AI Strategy Engine & Lịch tập Tuần 1 (`Lịch tập tuần`)
- Tổng hợp hồ sơ (`M01`) + mục tiêu (`M02`), gọi Gemini API (`gemini-4-hydrogen`) từ backend để sinh lịch 7 ngày (Thứ 2 – Chủ nhật).
- Kiểm định bắt buộc bằng bộ **AI Strategy Validator** độc lập (`src/services/strategyValidator.ts`) trước khi lưu vào `workout_plans`.
- Khi người dùng `<16` tuổi, `>60` tuổi, thiếu dữ liệu thể chất, BMI rủi ro cao, hoặc có giới hạn sức khỏe: bắt buộc bật **Chế độ thận trọng (`cautiousMode`)**, hiển thị cảnh báo an toàn rõ ràng và loại bỏ bài tập nguy cơ cao.
- Hỗ trợ đánh dấu hoàn thành từng ngày tập (`PATCH /api/plans/:planId/days/:dayIndex/toggle`) và tải lại trang không mất dữ liệu.

## 3. Ngoài phạm vi Sprint 01 (Chờ Sprint 02)
- Lộ trình thích ứng Tuần 2–12 (Adaptive Progression Engine v2).
- Nhắc nhở Push Notification / lịch đồng bộ.
- Nhật ký RPE / cảm giác đau sau buổi tập và biểu đồ kỷ luật dài hạn.
- Chuyển đổi đóng gói Capacitor Android/iOS (mới đánh giá kiến trúc trong Sprint 01).
