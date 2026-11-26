# MVP Backlog & Trạng thái Triển khai (Sprint 01.1 & Sprint 02)

## Cổng 1 — Sprint 01.1 Development Gate

| ID | Hạng mục | Ưu tiên | Trạng thái | Ghi chú thực tế |
|---|---|---|---|---|
| S01.1-CI | Sửa lỗi GitHub Actions Secret hygiene check tự khớp regex của chính nó | P0 | **PASS** | Đã sửa tại `.github/workflows/ci.yml` bằng character-class regex; chạy kiểm chứng exit 0, 0 false positive |
| S01.1-REPO | Hoàn thiện Repository Interface, Firestore Adapter, PostgreSQL Adapter & Contract Tests | P0 | **PASS** | `src/repositories/{types,memoryRepository,postgresRepository,firestoreClientRepository}.ts` + `tests/repositoryContract.test.ts` |
| S01.1-RULES | Hardening Firestore Security Rules & bài kiểm thử đa tài khoản Emulator | P0 | **PASS (Rules + Audit + Spec)** / **BLOCKED (Live JVM Emulator)** | `firestore.rules` + `firebase.json` + `tests/firestoreRulesAudit.test.ts` + `tests/firestoreRules.emulator.ts` (đã deploy DEV & lint 0 lỗi; sandbox không có `java` để chạy JVM Emulator trực tiếp) |
| S01.1-SAFETY | Hoàn thiện AI Safety Validator, giới hạn tải tập, an toàn nhóm tuổi `<18` & y khoa | P0 | **PASS** | `src/shared/types.ts`, `src/services/strategyValidator.ts`, `tests/bmiAndSafety.test.ts`, `tests/strategyValidator.test.ts` |
| S01.1-PII | Loại bỏ họ tên / PII khỏi AI payload & quản lý sự đồng ý có phiên bản | P0 | **PASS** | `src/services/aiPayload.ts`, `tests/aiPayloadAndEnv.test.ts`, Firestore `appData/consent` |
| S01.1-TRACKER | Sửa diễn giải Progress Tracker (chỉ ghi nhận check-in theo ngày) | P0 | **PASS** | `trackingGranularity: 'day_checkin_only'`, `exerciseCompletionTracked: false` trong `src/components/PlanTab.tsx` + `tests/progressTracker.test.ts` |
| S01.1-DOCS | Hoàn thiện `.env.example`, `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `MVP_BACKLOG.md`, `ACCEPTANCE_TESTS.md` | P1 | **PASS** | Đã đồng bộ theo mã nguồn thực tế |
| S01.1-GIT | Tạo nhánh riêng, commit, push và mở Pull Request trên GitHub | P1 | **BLOCKED** | Môi trường sandbox không có `.git` và không có credential GitHub CLI |

## Cổng 2 — Production Gate (Tài khoản B)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Cloud SQL PostgreSQL chính thức, Firebase Auth/OAuth production, Gemini API production (Account B) | **DEFERRED — OWNER APPROVED** | Chủ dự án quyết định hoàn thiện toàn bộ MVP trước khi kết nối hạ tầng production Account B; không yêu cầu token/API key hay dữ liệu khách hàng thật trong giai đoạn phát triển |

## Sprint 02 — Goal & Strategy Engine v2 + Màn hình Hôm nay

| ID | Hạng mục | Ưu tiên | Trạng thái | Tệp triển khai & Kiểm chứng |
|---|---|---|---|---|
| S02-01 | Mục tiêu cá nhân đo lường được (`MeasurableGoalSpec`) | P0 | **PASS** | `src/shared/types.ts`, `src/services/strategyEngineV2.ts`, `src/components/GoalTab.tsx` |
| S02-02 | Đánh giá năng lực hiện tại & tính khả thi mục tiêu độc lập với AI | P0 | **PASS** | `assessGoalFeasibility()` trong `src/services/strategyEngineV2.ts`, hiển thị trực tiếp tại `GoalTab.tsx`, test tốc độ giảm cân quá dốc tại `tests/strategyEngineV2.test.ts` |
| S02-03 | Cho phép lựa chọn nhiều môn thể thao (1–3 môn) | P0 | **PASS** | `GoalData.sports`, `WorkoutPlanData.sports`, `GoalTab.tsx`, `aiStrategy.ts`, `firestoreAppStore.ts`, `firestore.rules` |
| S02-04 | Chiến lược toàn thời hạn chia thành từng giai đoạn liên tục & cột mốc đo lường | P0 | **PASS** | `buildMultiPhaseRoadmap()` + `StrategyV2RoadmapPanel.tsx` |
| S02-05 | Tính khối lượng tập luyện theo từng môn bị chặn trần bởi giới hạn an toàn | P0 | **PASS** | `calculateSportVolumeAllocation()` + kiểm chứng trần tải trong `validateStrategyV2Blueprint()` |
| S02-06 | Lịch tập theo ngày thực tế (`YYYY-MM-DD`), múi giờ và khung giờ rảnh | P0 | **PASS** | `buildCalendarScheduleContext()`, `resolveTodayScheduledDay()`, hiển thị tại `TodayTab.tsx` & `PlanTab.tsx` |
| S02-07 | Quản lý phiên bản kế hoạch & lịch sử thay đổi (`v1`, `v2`, `parentPlanId`, `revisionReason`) | P0 | **PASS** | `createApp.ts`, `firestoreAppStore.ts`, `App.tsx`, bộ chọn phiên bản tại `StrategyV2RoadmapPanel.tsx` |
| S02-08 | Sinh nhiệm vụ hằng ngày từ chiến lược & trả lời đủ 8 câu hỏi AI Agent | P0 | **PASS** | `generateDailyStrategyTasks()`, `buildStrategyV2Blueprint()`, `aiStrategy.ts` |
| S02-09 | Bộ quy tắc an toàn độc lập với AI cho Strategy v2 | P0 | **PASS** | `validateStrategyV2Blueprint()` trong `src/services/strategyValidator.ts` + test kiểm thử phá vỡ tại `tests/strategyEngineV2.test.ts` |
| S02-10 | Màn hình **Hôm nay** (`TodayTab`) làm dashboard trung tâm | P0 | **PASS** | `src/components/TodayTab.tsx` + điều hướng 4 tab tại `src/App.tsx` |
