# Kiến trúc hệ thống — AI Discipline Coach (Sprint 01.1 & Sprint 02)

## 1. Tổng quan kiến trúc tách Provider & Môi trường

```text
[React 19 + Vite + Tailwind v4 SPA]
   ├── Navigation: Hôm nay (Central) | Chiến lược | Mục tiêu | Hồ sơ
   ├── Client Data Repository (DEV/MVP Primary: Firestore)
   │      └── FirestoreClientRepository -> src/lib/firestoreAppStore.ts
   │             └── Protected by hardened firestore.rules (email_verified + uid isolation)
   │
   └── HTTPS + Firebase ID Token (Bearer)
          ▼
[Express.js Server (server.ts -> src/server/createApp.ts)]
   ├── Auth Middleware (verifyIdToken) & Env Guard (APP_ENV / DATA_PROVIDER / AI_PROVIDER)
   ├── Consent & Input Validation (validateProfilePayload, validateGoalPayload)
   ├── AI Payload Minimizer (src/services/aiPayload.ts — Zero PII)
   ├── Goal & Strategy Engine v2 (src/services/strategyEngineV2.ts)
   │      ├── Feasibility Assessment (AI-independent)
   │      ├── Multi-sport Volume Allocation (bounded by SafetyProfile.loadLimits)
   │      ├── Multi-phase Roadmap & Measurable Milestones (Week 1..N)
   │      └── Real-Calendar Mapping (YYYY-MM-DD, timezone, free-time slot) + Daily Tasks
   ├── AI Orchestrator (src/services/aiStrategy.ts -> @google/genai | DEV mock)
   │      └── Independent Safety Rulebook (src/services/strategyValidator.ts)
   │             ├── validateWeekOneStrategy()
   │             └── validateStrategyV2Blueprint()
   └── Server Repository Interface (src/repositories/types.ts)
          ├── PostgresRepository (src/repositories/postgresRepository.ts -> Drizzle ORM)
          └── MemoryRepository (src/repositories/memoryRepository.ts -> Automated tests)
```

## 2. Nguyên tắc tách biệt nguồn dữ liệu & AI

- **Một nguồn dữ liệu chính cho mỗi môi trường (`DATA_PROVIDER`)**:
  - DEV/MVP trên AI Studio: Firestore (Account A DEV) cho toàn bộ trạng thái người dùng (`profile`, `goal`, `consent`, `smartwatch`, `plans`, `dailyGoals`), kết hợp backend Express stateless để sinh và kiểm định chiến lược AI.
  - Staging/Production với PostgreSQL/Cloud SQL (Account B — hiện ở trạng thái **DEFERRED — OWNER APPROVED**): sử dụng `PostgresRepository` + migration Drizzle (`drizzle/0000_panoramic_sebastian_shaw.sql`).
- **Tách Business Logic khỏi AI Provider (`AI_PROVIDER`)**:
  - `mock`: Dùng cho phát triển/kiểm thử không phụ thuộc quota Gemini; luôn gắn `aiProvider: 'mock'`, `isSimulated: true` và hiển thị thông báo rõ ràng trên UI.
  - `gemini`: Chạy trên server với `GEMINI_API_KEY`; nếu lỗi kết nối trong `production`, API trả lỗi tường minh (không fallback âm thầm sang `mock`).

## 3. Cấu trúc mã nguồn cốt lõi

- **Giao diện (`src/components/`)**:
  - `TodayTab.tsx`: Màn hình trung tâm **Hôm nay** (nhiệm vụ theo ngày thực tế, check-in 1 chạm, cam kết chiến lược hằng ngày, KPI kỷ luật, la bàn chiến lược).
  - `StrategyV2RoadmapPanel.tsx`: Hiển thị đủ **8 câu hỏi chiến lược bắt buộc**, lộ trình đa giai đoạn, bảng khối lượng theo từng môn và bộ chuyển đổi lịch sử phiên bản (`v1`, `v2`, ...).
  - `GoalTab.tsx` & `GoalOverviewDashboard.tsx`: Chọn nhiều bộ môn (1–3 môn), mục tiêu đo lường được, đánh giá tính khả thi trực tiếp, cấu hình lịch thực tế + múi giờ + khung giờ rảnh, quản lý sự đồng ý có phiên bản.
  - `PlanTab.tsx` & `SmartwatchAndExportSection.tsx`: Lịch thực thi 7 ngày gắn ngày dương lịch, biểu đồ check-in tuần (phản ánh trung thực `day_checkin_only`), Daily Goal Tracker, Streak Counter, Smartwatch BLE/ICS sync và xuất CSV.
  - `ProfileTab.tsx` & `AuthGate.tsx`: Hồ sơ thể chất, BMI phân nhóm tuổi (`<18` không áp ngưỡng người lớn), nhắc nhở trình duyệt.
- **Miền nghiệp vụ & An toàn (`src/services/`, `src/shared/`)**:
  - `src/shared/types.ts`: Hợp đồng kiểu dữ liệu, `evaluateBmi`, `evaluateSafetyProfile` (giới hạn tải tập theo nhóm tuổi `youth`/`teen`/`adult`/`senior` và giới hạn y khoa).
  - `src/services/strategyEngineV2.ts`: Engine tính khả thi, phân bổ khối lượng đa môn, lộ trình giai đoạn, ánh xạ lịch thực tế theo múi giờ và sinh cam kết hằng ngày.
  - `src/services/strategyValidator.ts`: Bộ kiểm định an toàn và chiến lược độc lập với AI.
  - `src/services/aiPayload.ts`: Tối giản dữ liệu gửi AI và loại bỏ hoàn toàn PII (họ tên, email, SĐT, URL).
- **Bảo mật Firestore (`firestore.rules`, `firebase-blueprint.json`, `security_spec.md`, `firebase.json`)**:
  - Default-deny toàn cục, bắt buộc `email_verified == true` và `request.auth.uid == userId`, kiểm tra schema chặt chẽ bằng `hasAll`/`hasOnly` (bao gồm các trường Sprint 02 tùy chọn), `request.time`, và khóa cập nhật kế hoạch chỉ cho phép sửa `completedDays` + `updatedAt`.

## 4. Đánh giá khả năng chuyển đổi sang Mobile App với Capacitor (Android / iOS)

- **Tái sử dụng UI (~90%)**: Giao diện mobile-first với 4-tab bottom navigation (`Hôm nay`, `Chiến lược`, `Mục tiêu`, `Hồ sơ`), vùng chạm `>= 44px`, static bundle tại `dist/` tương thích trực tiếp `webDir: "dist"`.
- **Hạng mục cần cấu hình khi đóng gói native**: `VITE_API_BASE_URL` + CORS allowlist cho `capacitor://localhost` & `https://localhost`, chuyển `signInWithPopup` sang native Google Auth plugin (`@capacitor-firebase/authentication`), tích hợp `@capacitor/app` cho nút Back Android và local cache offline cho màn hình `Hôm nay`.
