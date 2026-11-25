# Quy tắc an toàn & Kiểm định chiến lược (`SAFETY_RULES`)

## 1. Nguyên tắc cốt lõi
1. **Không giao toàn quyền quyết định an toàn cho AI prompt**: Mọi lịch tập trả về từ Gemini API phải vượt qua bộ **AI Strategy Validator** (`src/services/strategyValidator.ts`) chạy độc lập bằng mã TypeScript xác định (deterministic).
2. **Từ chối hoặc tạo lại khi vi phạm**: Nếu giáo án vi phạm bất kỳ quy tắc an toàn hoặc cấu trúc nào, backend tự động yêu cầu Gemini tạo lại 1 lần kèm danh sách lỗi cụ thể; nếu vẫn vi phạm, API trả về mã `422 Unprocessable Entity` và **không lưu** vào cơ sở dữ liệu.
3. **Đồng ý trước khi xử lý dữ liệu sức khỏe**: Người dùng phải đánh dấu đồng ý (`aiConsent: true`) trước khi hồ sơ thể chất và giới hạn sức khỏe được gửi đến Gemini API.

## 2. Quy tắc phân loại BMI & Nhóm tuổi (`src/shared/types.ts`)
- **Dưới 16 tuổi (`youth`)**:
  - **Không** áp dụng ngưỡng phân loại BMI người lớn.
  - Hiển thị khuyến nghị đối chiếu biểu đồ bách phân vị BMI theo tuổi & giới tính (WHO/CDC).
  - Bắt buộc bật **Chế độ thận trọng**: chỉ dùng bài tập trọng lượng cơ thể, cấm tạ đòn/barbell/deadlift/1RM, khuyến nghị có người lớn giám sát.
- **16–17 tuổi (`teen`)**:
  - **Không** áp dụng ngưỡng phân loại BMI người lớn; hiển thị thông báo tra bảng bách phân vị WHO/CDC.
- **18–60 tuổi (`adult`)**:
  - Áp dụng ngưỡng tham chiếu châu Á – Thái Bình Dương (`<18.5`, `18.5–22.9`, `23.0–24.9`, `25.0–29.9`, `>=30.0`).
  - Nếu BMI `<16.5` hoặc `>=30.0`, tự động kích hoạt **Chế độ thận trọng**.
- **Trên 60 tuổi (`senior`)**:
  - Bắt buộc bật **Chế độ thận trọng**: ưu tiên thăng bằng, độ linh hoạt khớp, tăng nhịp tim từ từ; cấm bài tập bật nhảy (`box jump`, `burpee`, `sprint`, `handstand`).
- **Thiếu dữ liệu (`missing_data`)**:
  - Khi thiếu hoặc sai định dạng tuổi/cân nặng/chiều cao, mặc định kích hoạt **Chế độ thận trọng**.

## 3. Quy tắc kiểm định bắt buộc (`strategyValidator.ts`)
- **Cấu trúc 7 ngày**: Đúng 7 phần tử, `dayIndex` duy nhất từ `1` đến `7` (không trùng, không thiếu).
- **Khớp lịch đăng ký**: Tổng số ngày `isRestDay === false` phải bằng `profile.daysPerWeek`.
- **Cường độ & Thời lượng**:
  - Cường độ chỉ nhận `Nhẹ | Trung bình | Cao`.
  - Khi `cautiousMode = true`: **cấm tuyệt đối** cường độ `Cao`, thời lượng buổi tập `15–60` phút, nghỉ giữa hiệp `>= 45` giây, số hiệp `1–5`. Nếu `daysPerWeek <= 4`, không được xếp quá 2 ngày tập liên tiếp không có ngày nghỉ.
  - Ngày nghỉ (`isRestDay = true`): cường độ bắt buộc `Nhẹ`, thời lượng `<= 35` phút, tối đa 2 hoạt động giãn cơ nhẹ.
  - Không xếp 3 ngày liên tiếp cường độ `Cao` trong mọi chế độ.
- **Sàng lọc bài tập theo giới hạn sức khỏe & dụng cụ**:
  - *Đau khớp gối*: cấm `jump squat`, `jump lunge`, `box jump`, `bật nhảy`, `pistol squat`, `chạy xuống dốc`.
  - *Đau lưng / cột sống*: cấm `deadlift`, `good morning`, `barbell row`, `sit-up`, `gập bụng gắt`.
  - *Đau vai / cổ tay*: cấm `handstand`, `trồng chuối`, `overhead press nặng`, `dip sâu`, `burpee`.
  - *Tim mạch / Huyết áp*: cấm `HIIT`, `Tabata`, `sprint`, `chạy nước rút`, `valsalva`.
  - *Hen suyễn / Hô hấp*: cấm `sprint`, `chạy nước rút`, `HIIT cường độ cao`.
  - *Không dụng cụ (`none`)*: cấm máy gym, tạ đòn, tạ đơn, kettlebell.
  - *Tại nhà (`home`)*: cấm máy phòng gym (`leg press`, `smith machine`, `hack squat`, `cable crossover`).
