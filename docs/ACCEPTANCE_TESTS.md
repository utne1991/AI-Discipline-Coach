# Kiểm thử Nghiệm thu — Sprint 01 (`ACCEPTANCE_TESTS`)

## 1. Kết quả chạy kiểm thử tự động (`npm test`)

Chạy lệnh `npm test` (`tsx --test tests/*.test.ts`): **15/15 PASS** (0 fail, 0 skipped).

| Nhóm kiểm thử | Tệp test | Số test | Trạng thái | Nội dung kiểm chứng |
|---|---|---|---|---|
| BMI & An toàn nhóm tuổi | `tests/bmiAndSafety.test.ts` | 4 | **PASS** | Phân nhóm tuổi; `<18` không áp dụng BMI người lớn; thiếu dữ liệu / `<16` / `>60` / BMI cực đoan bật chế độ thận trọng |
| AI Strategy Validator | `tests/strategyValidator.test.ts` | 6 | **PASS** | Đủ 7 ngày duy nhất; khớp `daysPerWeek`; cấm cường độ `Cao` và nghỉ `<45s` khi thận trọng; cấm bài tập nguy cơ cho `<16`, `>60`, đau khớp, tim mạch; kiểm tra dụng cụ và số hiệp |
| Bảo mật API & Luồng nghiệp vụ | `tests/apiSecurityAndFlow.test.ts` | 5 | **PASS** | Chặn `401` khi thiếu/sai token; luồng `M01 -> M02 -> M03 -> Check-in -> Reload`; cô lập dữ liệu chéo 2 user (`404`); thiếu `aiConsent` trả `400`; AI lỗi trả `500`; kế hoạch không an toàn trả `422` và không lưu; lỗi DB không lộ SQL |

## 2. Kiểm thử môi trường & Build

| Hạng mục | Lệnh / Công cụ | Kết quả |
|---|---|---|
| TypeScript check | `npm run lint` (`tsc --noEmit`) | **PASS** |
| Production build | `npm run build` (`vite build`) | **PASS** |
| Sinh SQL Migration | `npm run db:generate` | **PASS** (`drizzle/0000_panoramic_sebastian_shaw.sql`) |
| Kiểm tra Auth trên server chạy thực | `curl -i http://127.0.0.1:3000/api/bootstrap` | **PASS** (`401 Unauthorized`) |

## 3. Các hạng mục bị BLOCKED trong môi trường hiện tại

| Hạng mục | Trạng thái | Nguyên nhân thực tế |
|---|---|---|
| Kết nối & ghi/đọc thật trên Cloud SQL | **BLOCKED** | Lệch project Cloud SQL (`emerald-water-402004`) và Firebase/OAuth (`gen-lang-client-0979661187`), socket Proxy trả `PERMISSION_DENIED` / `Connection terminated unexpectedly` |
| Sinh lịch tập thật từ Gemini API | **BLOCKED** | `GEMINI_API_KEY` chưa được nạp trong môi trường shell sandbox (`GEMINI_API_KEY: false`) |
| Kiểm thử E2E trình duyệt (Google Sign-In -> Lưu -> Reload -> Đăng xuất -> Đăng nhập lại) | **BLOCKED** | Phụ thuộc Cloud SQL + Gemini key hoạt động và phiên đăng nhập Google OAuth thực tế trên trình duyệt |
| Tạo branch Sprint 01 & Pull Request trên GitHub | **BLOCKED** | Workspace không chứa `.git` và không có quyền/credential GitHub CLI |
