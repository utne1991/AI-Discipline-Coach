# Kiến trúc hệ thống & Đánh giá Capacitor (Sprint 01)

## 1. Tổng quan kiến trúc Web Full-Stack

```text
[React 19 + Vite + Tailwind v4 SPA]
        │  HTTPS + Firebase ID Token (Bearer)
        ▼
[Express.js Server (server.ts -> src/server/createApp.ts)]
   ├── Middleware xác thực (src/middleware/auth.ts / Firebase Admin verifyIdToken)
   ├── Kiểm tra dữ liệu đầu vào & aiConsent (validateProfilePayload, validateGoalPayload)
   ├── AI Strategy Engine (src/services/aiStrategy.ts -> @google/genai gemini-4-hydrogen)
   │      └── Bộ kiểm định độc lập (src/services/strategyValidator.ts)
   └── Tầng dữ liệu Drizzle ORM (src/db/repository.ts + src/db/schema.ts)
          │  pg.Pool (Unix Socket SQL_HOST)
          ▼
[Cloud SQL for PostgreSQL]
```

## 2. Cấu trúc thư mục chính

- `src/App.tsx`: Điều phối xác thực Firebase (`onAuthStateChanged`, `signInWithPopup`), trạng thái bootstrap và thanh điều hướng dưới cùng (`Hồ sơ | Mục tiêu | Lịch tập tuần`).
- `src/components/`: `AuthGate.tsx`, `ProfileTab.tsx`, `GoalTab.tsx`, `PlanTab.tsx`.
- `src/shared/types.ts`: Kiểu dữ liệu dùng chung, nhãn tiếng Việt, `evaluateBmi` (tách biệt trẻ em/vị thành niên với người lớn), `evaluateCautionStatus`.
- `src/server/createApp.ts`: Express app factory có dependency injection phục vụ kiểm thử HTTP tự động.
- `src/services/aiStrategy.ts`: Gọi `@google/genai` trên server với `responseSchema` và cơ chế thử lại kèm phản hồi lỗi từ validator.
- `src/services/strategyValidator.ts`: Bộ kiểm định an toàn và cấu trúc độc lập với Gemini.
- `src/db/schema.ts`, `src/db/index.ts`, `src/db/repository.ts`, `src/db/drizzle.config.ts`, `drizzle/0000_panoramic_sebastian_shaw.sql`: Định nghĩa schema, connection pool và migration SQL.

## 3. Lược đồ cơ sở dữ liệu PostgreSQL

- `users` (`id`, `uid` UNIQUE, `email`, `display_name`, `created_at`, `updated_at`)
- `user_profiles` (`id`, `user_id` UNIQUE FK -> `users.id`, `full_name`, `age`, `weight_kg`, `height_cm`, `fitness_level`, `days_per_week`, `equipment`, `health_limitations` JSONB, `health_notes`, `updated_at`)
- `user_goals` (`id`, `user_id` UNIQUE FK -> `users.id`, `sport`, `goal_type`, `duration_weeks`, `updated_at`)
- `workout_plans` (`id`, `user_id` FK -> `users.id`, `week_number`, `sport`, `goal_type`, `duration_weeks`, `cautious_mode`, `caution_reasons` JSONB, `safety_alert`, `strategy_summary`, `coach_principles` JSONB, `schedule_json` JSONB, `completed_days` JSONB, `created_at`)

---

## 4. Đánh giá kiến trúc chuyển đổi sang Mobile App với Capacitor (Android / iOS)

> Phạm vi Sprint 01: Chỉ đánh giá kiến trúc và khả năng tái sử dụng; chưa chuyển đổi mã nguồn.

### 4.1 Mức độ tương thích hiện tại
- **Tái sử dụng UI React (~85–90%)**: Giao diện hiện tại đã thiết kế theo chuẩn mobile-first (`viewport-fit=cover`, vùng chạm `>= 44px`, bottom navigation bar cố định `pb-safe`, không phụ thuộc SSR). Build đầu ra là static bundle tại `dist/`, hoàn toàn khớp với `webDir: "dist"` của Capacitor.
- **Tách biệt Backend API**: Mọi tác vụ AI (`GEMINI_API_KEY`) và PostgreSQL (`SQL_*`) đã nằm ở Express server (`server.ts`), nên khi đóng gói WebView qua Capacitor, app di động chỉ cần gọi tới URL HTTPS của backend mà không làm lộ khóa bí mật.

### 4.2 Các điểm cần thay đổi trước khi đóng gói Capacitor
1. **API Base URL (`VITE_API_BASE_URL`)**: Hiện `src/App.tsx` gọi đường dẫn tương đối `/api/...`. Trong Capacitor (`capacitor://localhost` trên iOS hoặc `https://localhost` trên Android), đường dẫn tương đối sẽ trỏ vào local asset thay vì server thật. Cần cấu hình `VITE_API_BASE_URL` trỏ về Cloud Run URL và cấu hình CORS allowlist cho `capacitor://localhost` và `https://localhost`.
2. **Firebase Google Sign-In trong WebView**: `signInWithPopup` thường bị chặn hoặc lỗi trong WebView của Android/iOS. Khi làm mobile app cần chuyển sang plugin native (ví dụ `@capacitor-firebase/authentication` hoặc `@codetrix-studio/capacitor-google-auth`) để lấy Google ID Token rồi đăng nhập vào Firebase Auth (`signInWithCredential`), đồng thời lưu phiên ổn định qua Preferences/Keychain.
3. **Safe Area & Hardware Back Button**: Cần bổ sung `@capacitor/app` để xử lý nút Back vật lý trên Android (chuyển tab / xác nhận thoát) và `@capacitor/status-bar` để đồng bộ màu thanh trạng thái.
4. **Offline & Local Cache**: Có thể bổ sung lớp cache đọc-only (`@capacitor/preferences` hoặc SQLite local) để người dùng xem lại lịch tập Tuần 1 khi mất mạng trong phòng tập, đồng bộ check-in khi có mạng trở lại.

### 4.3 Kết luận kiến trúc
Kiến trúc React + REST API hiện tại rất phù hợp để bọc bằng Capacitor trong các sprint tiếp theo với chi phí chuyển đổi thấp, với điều kiện bắt buộc xử lý **native Google Auth**, **API Base URL + CORS allowlist**, và **lưu trữ offline**.
