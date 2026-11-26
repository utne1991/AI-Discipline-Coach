# Kiểm thử Nghiệm thu — Development Gate (Sprint 01.1 & Sprint 02)

Tài liệu nghiệm thu theo nguyên tắc **Intent to Evidence** (chỉ ghi nhận kết quả đã chạy thực tế, không suy diễn, tách biệt **Development Gate** và **Production Gate** theo quyết định của chủ dự án).

---

## 1. Trạng thái tổng thể hai cổng nghiệm thu

| Cổng nghiệm thu | Trạng thái | Ghi chú |
|---|---|---|
| **Development Gate (Sprint 01.1 + Sprint 02)** | **PASS (phần mã nguồn, test tự động, build, lint & rules)** / **BLOCKED một phần (Git/PR & JVM Emulator)** | 53/53 test tự động PASS, `tsc --noEmit` PASS, `vite build` PASS, `eslint firestore.rules` PASS, secret scan sạch, `firestore.rules` đã deploy lên môi trường DEV. Các mục phụ thuộc công cụ ngoài sandbox được ghi nhận rõ là **BLOCKED**. |
| **Production Gate (Tài khoản B)** | **DEFERRED — OWNER APPROVED** | Theo chỉ đạo của chủ dự án: không kết nối hạ tầng Cloud SQL / Firebase OAuth / Gemini API chính thức của Tài khoản B và không sử dụng dữ liệu khách hàng thật trong giai đoạn MVP Development. |

---

## 2. Kết quả kiểm thử tự động (`npm test` / `bun run test`)

Lệnh thực thi: `bun run test` (`tsx --test tests/*.test.ts`)
Kết quả thực tế: **53/53 PASS** (`# tests 53`, `# pass 53`, `# fail 0`, `# skipped 0`).

| Tệp kiểm thử | Trạng thái | Nội dung kiểm chứng |
|---|---|---|
| `tests/aiPayloadAndEnv.test.ts` | **PASS** | Loại bỏ `fullName` khỏi AI payload (zero-PII), kiểm soát đồng ý `aiConsent`, không tự động fallback sang Mock AI ở `production`, hiển thị nguồn AI minh bạch. |
| `tests/apiSecurityAndFlow.test.ts` | **PASS** | Chặn `401` khi thiếu/sai token; luồng `M01 -> M02 -> M03 -> Check-in -> Reload`; cô lập dữ liệu chéo 2 tài khoản (`404`); thiếu `aiConsent` trả `400`; AI lỗi trả `500`; kế hoạch không an toàn trả `422` và không lưu; lỗi DB không lộ SQL. |
| `tests/bmiAndSafety.test.ts` | **PASS** | Phân nhóm tuổi (`<16`, `16-17`, `18-60`, `>60`); không áp dụng BMI người lớn cho `<18`; kích hoạt chế độ thận trọng và khuyến nghị thăm khám y tế khi có triệu chứng nguy cơ. |
| `tests/dailyGoal.test.ts` | **PASS** | Mục tiêu nhỏ hằng ngày, thống kê mục tiêu theo tháng và tính toán chuỗi ngày kỷ luật (`Streak Counter`). |
| `tests/firestoreRulesAudit.test.ts` | **PASS** | Kiểm toán tĩnh `firestore.rules` (default-deny toàn cục, yêu cầu `email_verified`, cô lập chéo theo `userId`, kiểm định giới hạn Sprint 02) và đồng bộ `firebase-blueprint.json`. |
| `tests/overallProgress.test.ts` | **PASS** | Dashboard tiến độ kỷ luật tổng thể: số tuần duy trì kỷ luật, chuỗi tuần liên tiếp, tỷ lệ check-in trung bình và xử lý trạng thái rỗng. |
| `tests/progressTracker.test.ts` | **PASS** | Diễn giải trung thực Progress Tracker theo cấp độ **check-in theo ngày**, không khẳng định sai toàn bộ bài tập đã hoàn thành. |
| `tests/reminder.test.ts` | **PASS** | Kiểm định định dạng giờ nhắc `HH:mm`, tính thời điểm nhắc tiếp theo và sanitize cấu hình nhắc nhở. |
| `tests/repositoryContract.test.ts` | **PASS** | Contract test dùng chung cho `MemoryRepository`, `PostgresRepository` adapter và các bộ sanitize dữ liệu Sprint 02 của Firestore adapter (`upsert`, cô lập chéo 2 user, thứ tự kế hoạch, toggle check-in). |
| `tests/smartwatchAndExport.test.ts` | **PASS** | Giải mã gói nhịp tim BLE Heart Rate (`UINT8`/`UINT16`), xuất lịch `.ics` (RFC 5545), xuất CSV có UTF-8 BOM và chống Spreadsheet Formula Injection. |
| `tests/strategyEngineV2.test.ts` | **PASS** | Sprint 02 với dữ liệu giả lập đa dạng (chạy bộ, gym, tập tại nhà, đa môn kết hợp, trẻ em 14 tuổi, thiếu niên 16 tuổi, người trưởng thành, người lớn tuổi 64 tuổi, hồ sơ có cảnh báo tim mạch/khớp): đủ 8 câu trả lời chiến lược, đánh giá tính khả thi, lộ trình nhiều giai đoạn liên tục, khối lượng theo từng môn bị chặn bởi giới hạn an toàn, ánh xạ ngày thực tế (`resolveTodayScheduledDay`), validator độc lập với AI chặn blueprint bị chỉnh sửa trái phép, và HTTP `POST /api/plans/generate` lưu phiên bản kế hoạch (`v1 -> v2`, `parentPlanId`, `revisionReason`). |
| `tests/strategyValidator.test.ts` | **PASS** | Sắp xếp `dayIndex` trước khi kiểm tra ngày tập liên tiếp; giới hạn số lần lặp, thời lượng, tổng khối lượng, thời gian nghỉ; quy tắc an toàn riêng cho `<16`, `16-17` và nhóm cần đánh giá y tế. |
| `tests/workoutHistory.test.ts` | **PASS** | Trích xuất lịch sử buổi tập đã check-in theo thứ tự thời gian giảm dần và định dạng ngày tiếng Việt. |

---

## 3. Kiểm tra Build, TypeScript, Security Rules & Secret Hygiene

| Hạng mục | Lệnh / Công cụ | Trạng thái | Bằng chứng |
|---|---|---|---|
| TypeScript check | `npm run lint` (`tsc --noEmit`) | **PASS** | 0 lỗi kiểu dữ liệu |
| Production bundle | `npm run build` (`vite build`) | **PASS** | Biên dịch sạch |
| Firestore Rules static lint | `npm run lint:rules` (`eslint firestore.rules`) | **PASS** | 0 lỗi, 0 cảnh báo |
| Deploy Firestore Rules (DEV) | `DeployRules` (`firestore.rules`) | **PASS** | Đã deploy thành công lên Firestore DEV của AI Studio |
| CI Secret Hygiene Check | Biểu thức đã sửa trong `.github/workflows/ci.yml` | **PASS** | Không còn tự khớp chuỗi regex trong `.github/workflows/ci.yml`; quét sạch `src`, `server.ts`, `tests`, `.github`, `docs` |

---

## 4. Hạng mục Sprint 01.1 & Sprint 02 theo trạng thái chi tiết

| Mã / Hạng mục | Trạng thái | Tệp liên quan |
|---|---|---|
| S01.1 — Sửa Secret hygiene check tự khớp trong CI | **PASS** | `.github/workflows/ci.yml` |
| S01.1 — Repository Interface, Firestore Adapter, PostgreSQL Adapter & Contract Tests | **PASS** | `src/repositories/types.ts`, `src/repositories/memoryRepository.ts`, `src/repositories/postgresRepository.ts`, `src/lib/firestoreAppStore.ts`, `tests/repositoryContract.test.ts` |
| S01.1 — Firestore Security Rules hardening & bộ test đa tài khoản cho Emulator | **PASS (rules & mã test)** / **BLOCKED (chạy JVM Emulator trong sandbox)** | `firestore.rules`, `firebase.json`, `firebase-blueprint.json`, `security_spec.md`, `tests/firestoreRules.emulator.ts`, `tests/firestoreRulesAudit.test.ts` |
| S01.1 — Tài liệu quy trình & kiến trúc (`AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `MVP_BACKLOG.md`, `ACCEPTANCE_TESTS.md`) | **PASS** | `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/MVP_BACKLOG.md`, `docs/ACCEPTANCE_TESTS.md` |
| S02 — Mục tiêu đo lường, đa môn, đánh giá khả thi, lộ trình đa giai đoạn, khối lượng theo môn, lịch theo ngày/múi giờ/khung giờ, quản lý phiên bản, nhiệm vụ hằng ngày, quy tắc an toàn độc lập AI & 8 câu hỏi chiến lược | **PASS** | `src/shared/types.ts`, `src/services/strategyEngineV2.ts`, `src/services/strategyValidator.ts`, `src/services/aiPayload.ts`, `src/services/aiStrategy.ts`, `src/server/createApp.ts`, `tests/strategyEngineV2.test.ts` |
| S02 — Màn hình trung tâm **Hôm nay** & UI Chiến lược v2 + chọn phiên bản | **PASS** | `src/components/TodayTab.tsx`, `src/components/StrategyV2RoadmapPanel.tsx`, `src/components/GoalTab.tsx`, `src/components/PlanTab.tsx`, `src/App.tsx` |

---

## 5. Các hạng mục bị BLOCKED hoặc DEFERRED (Minh bạch, không giả lập)

| Hạng mục | Trạng thái | Nguyên nhân & Thao tác chủ dự án cần thực hiện |
|---|---|---|
| Chạy trực tiếp Firestore Security Rules Emulator test trên sandbox | **BLOCKED** | Môi trường sandbox không cài đặt `java` runtime để khởi chạy Firestore Emulator (dù `firebase` CLI có sẵn và mã test đa tài khoản đã hoàn chỉnh tại `tests/firestoreRules.emulator.ts`). Chủ dự án chạy trên máy local có Java hoặc GitHub Actions (`ubuntu-latest`): `firebase emulators:exec --only firestore "bun run test:rules:emulator"` (hoặc `npm run test:rules:emulator`). |
| Tạo nhánh Git mới, commit, push và mở Pull Request trên GitHub | **BLOCKED** | Thư mục workspace hiện tại không có `.git` và không có thông tin xác thực GitHub CLI. Chủ dự án đồng bộ thay đổi từ workspace lên nhánh tính năng mới (ví dụ `feat/sprint-02-strategy-engine-v2`), commit, push và mở Pull Request để kích hoạt workflow `.github/workflows/ci.yml`. |
| Production Gate — Kết nối Cloud SQL, Firebase OAuth & Gemini API của Tài khoản B | **DEFERRED — OWNER APPROVED** | Chỉ thực hiện ở giai đoạn nối hạ tầng production sau khi chủ dự án hoàn tất nghiệm thu MVP Development Gate. |
