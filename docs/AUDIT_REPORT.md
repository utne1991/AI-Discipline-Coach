# Báo cáo Kiểm toán Hệ thống — Sprint 01 (`AUDIT_REPORT`)

**Ngày kiểm toán:** 2026-11-24  
**Phạm vi:** Toàn bộ mã nguồn React, Express, PostgreSQL/Drizzle, Firebase Auth, Gemini API và hạ tầng chạy thử hiện có trong workspace.

## 1. Tóm tắt hiện trạng thực tế

| Thành phần | Hiện trạng kiểm chứng | Kết quả |
|---|---|---|
| TypeScript (`npm run lint`) | Chạy `tsc --noEmit` | **PASS** (0 lỗi) |
| Production Build (`npm run build`) | Chạy `vite build` | **PASS** |
| Automated Test Suite (`npm test`) | Chạy `tsx --test tests/*.test.ts` | **PASS** (15/15 tests) |
| Drizzle SQL Migration (`npm run db:generate`) | Sinh `drizzle/0000_panoramic_sebastian_shaw.sql` | **PASS** |
| HTTP Auth Guard trên dev server | `curl http://127.0.0.1:3000/api/bootstrap` trả `401` | **PASS** |
| Cloud SQL kết nối thực tế | Lệch project giữa Cloud SQL (`emerald-water-402004`) và OAuth/Firebase (`gen-lang-client-0979661187`) | **BLOCKED (P0)** |
| Gemini API gọi thật | `GEMINI_API_KEY` chưa được nạp trong môi trường shell kiểm thử | **BLOCKED** |
| Luồng E2E trình duyệt với Google Sign-In thật | Không có browser automation + phiên đăng nhập Google thật trong sandbox | **BLOCKED** |
| Git branch & Pull Request trên GitHub | Thư mục hiện tại không có `.git` và không có token GitHub | **BLOCKED** |

## 2. Các lỗi phát hiện & Biện pháp xử lý (có mức độ ưu tiên & bằng chứng)

### Lỗi P0-01 — Lệch Project ID giữa Cloud SQL và Firebase Auth (BLOCKED về hạ tầng)
- **Mức độ:** P0 (Blocker cho lưu trữ thật).
- **Cách tái hiện:**
  1. Gọi `cloudsql.ExecuteSql` hoặc kiểm tra `/app/cloudsql` và `.env`.
  2. `firebase-applet-config.json` hiện cấu hình `projectId: "gen-lang-client-0979661187"`.
  3. `.env` trỏ `SQL_HOST=/app/cloudsql/emerald-water-402004:asia-southeast1:ai-studio-226c94b8`, nhưng thư mục socket đó trống.
  4. Thử kết nối trực tiếp tới `/app/cloudsql/gen-lang-client-0979661187:asia-southeast1:ai-studio-226c94b8` trả về `Connection terminated unexpectedly`, và RPC `cloudsql.ExecuteSql` trả `PERMISSION_DENIED: Not authorized to access instance: gen-lang-client-0979661187:ai-studio-226c94b8`.
- **Trạng thái:** **BLOCKED** — cần cấu hình lại Cloud SQL instance trên cùng project `gen-lang-client-0979661187` (hoặc đồng bộ lại project `emerald-water-402004`) trong bảng điều khiển AI Studio.

### Lỗi P0-02 — Thiếu bộ AI Strategy Validator độc lập (Đã sửa trong Sprint 01)
- **Mức độ:** P0.
- **Hiện trạng trước sửa:** `src/services/aiStrategy.ts` chỉ kiểm tra độ dài mảng 7 ngày và tự hạ cường độ bằng `normalizeIntensity`, không phát hiện trùng `dayIndex`, lệch `daysPerWeek`, bài tập chống chỉ định với chấn thương/tuổi, hoặc số hiệp/thời gian nghỉ bất hợp lý.
- **Khắc phục:** Tạo `src/services/strategyValidator.ts`, tích hợp vòng lặp retry kèm phản hồi lỗi vào `generateWeekOneStrategy`, và trả mã HTTP `422` nếu AI vẫn sinh kế hoạch không đạt chuẩn.
- **Bằng chứng:** 6 test case trong `tests/strategyValidator.test.ts` và test từ chối `422` trong `tests/apiSecurityAndFlow.test.ts` đều PASS.

### Lỗi P0-03 — Phân loại BMI người lớn áp dụng sai cho trẻ em/vị thành niên (Đã sửa trong Sprint 01)
- **Mức độ:** P0 (An toàn y khoa).
- **Hiện trạng trước sửa:** `calculateBmi()` trong `src/shared/types.ts` gán nhãn `Thiếu cân / Cân đối / Thừa cân nhẹ / Cần kiểm soát cân nặng` theo ngưỡng người lớn cho mọi độ tuổi, kể cả dưới 18 tuổi.
- **Khắc phục:** Tạo `evaluateBmi(weightKg, heightCm, age)` phân nhóm tuổi (`youth`, `teen`, `adult`, `senior`, `unknown`), không phân loại BMI người lớn cho `<18` tuổi, hiển thị hướng dẫn bảng bách phân vị WHO/CDC, và kích hoạt chế độ thận trọng khi thiếu dữ liệu hoặc BMI rủi ro cao (`<16.5` hoặc `>=30`).
- **Bằng chứng:** 4 test case trong `tests/bmiAndSafety.test.ts` PASS.

### Lỗi P1-01 — Thiếu cơ chế xác nhận đồng ý trước khi gửi dữ liệu sức khỏe tới Gemini API (Đã sửa trong Sprint 01)
- **Mức độ:** P1.
- **Khắc phục:** Bổ sung checkbox đồng ý rõ ràng tại `src/components/GoalTab.tsx` và ràng buộc `body.aiConsent === true` tại `POST /api/plans/generate` trong `src/server/createApp.ts`.
- **Bằng chứng:** Test `noConsentRes.status === 400` trong `tests/apiSecurityAndFlow.test.ts` PASS.

### Lỗi P1-02 — Thiếu endpoint đọc chi tiết lịch tập theo ID & fallback JSON cho `/api/*` (Đã sửa trong Sprint 01)
- **Mức độ:** P1.
- **Hiện trạng trước sửa:** Request sai JSON body rơi vào error handler mặc định của Express; route `/api/*` không tồn tại rơi xuống SPA HTML thay vì trả JSON `404`; chưa có `GET /api/plans/:planId` có kiểm tra chủ sở hữu.
- **Khắc phục:** Thêm `GET /api/plans/:planId` lọc theo `userId`, handler 404 JSON cho `/api/*`, handler `400` cho JSON malformed, và header `X-Content-Type-Options: nosniff`, `Referrer-Policy`, tắt `x-powered-by`.

### Lỗi P2-01 — Cảnh báo `bun audit` từ gói phụ thuộc gián tiếp
- **Mức độ:** P2 (Trung bình / Thấp trong dev tooling).
- **Bằng chứng:** `bun audit` ghi nhận 3 cảnh báo gián tiếp (`@grpc/grpc-js` trong `firebase`/`firebase-admin`, và `esbuild` trong `vite`/`tsx`/`drizzle-kit`). Không phát hiện khóa bí mật bị hardcode trong mã nguồn ứng dụng.
