# MVP Backlog & Trạng thái Sprint 01

## Sprint 01 — Audit, Repair & Foundation

| ID | Hạng mục | Mức độ | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|
| S1-01 | Kiểm toán toàn bộ kiến trúc React/Express/Drizzle/Firebase/Gemini | P0 | Hoàn thành | Ghi nhận đầy đủ tại `docs/AUDIT_REPORT.md` |
| S1-02 | Tách Express App Factory & hardening API (`createApp.ts`) | P0 | Hoàn thành | Bổ sung header bảo mật, JSON 404/400 handler, `GET /api/plans/:planId` |
| S1-03 | Xây dựng AI Strategy Validator độc lập | P0 | Hoàn thành | `src/services/strategyValidator.ts` + tích hợp retry/reject `422` |
| S1-04 | Sửa phân loại BMI & an toàn theo nhóm tuổi (`<18` không dùng ngưỡng người lớn) | P0 | Hoàn thành | `evaluateBmi` và `evaluateCautionStatus` trong `src/shared/types.ts` |
| S1-05 | Cơ chế xác nhận đồng ý trước khi gửi dữ liệu sức khỏe sang AI | P1 | Hoàn thành | Checkbox đồng ý ở `GoalTab.tsx` + kiểm tra `aiConsent: true` ở API |
| S1-06 | Tạo file migration SQL Drizzle (`drizzle/0000_*.sql`) | P1 | Hoàn thành | Sinh thành công từ `src/db/schema.ts` |
| S1-07 | Bộ kiểm thử tự động (Unit + HTTP Integration) | P0 | Hoàn thành | 15/15 bài test pass qua `npm test` |
| S1-08 | Báo cáo kiến trúc Capacitor Android/iOS | P2 | Hoàn thành | Ghi nhận tại mục 4 của `docs/ARCHITECTURE.md` |
| S1-09 | Kiểm thử thực tế Cloud SQL & E2E trên trình duyệt với tài khoản Google thật | P0 | **BLOCKED** | Bị chặn bởi lệch project Cloud SQL (`emerald-water-402004` vs `gen-lang-client-0979661187`), thiếu `GEMINI_API_KEY` trong shell, và không có headless browser/OAuth session tự động |
| S1-10 | Tạo nhánh Sprint 01 trên GitHub & mở Pull Request | P1 | **BLOCKED** | Thư mục làm việc không có `.git` và không có kết nối/credential GitHub CLI |

## Sprint 02 — Goal & Strategy Engine v2 (Đề xuất sau khi nghiệm thu Sprint 01)
- Khắc phục triệt để kết nối Cloud SQL trên đúng project và chạy kiểm thử E2E thật.
- Bổ sung theo dõi tuần tiếp theo (Tuần 2–12) dựa trên tỷ lệ hoàn thành và RPE phản hồi.
- Lưu lịch sử các tuần và biểu đồ chuỗi ngày kỷ luật.
