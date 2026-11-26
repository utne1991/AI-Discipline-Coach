# AGENTS.md — Quy trình Kỹ thuật & Nghiệm thu (AI Discipline Coach)

Tài liệu này định nghĩa nguyên tắc thực thi **Intent to Evidence** dành cho mọi kỹ sư và AI Agent làm việc trên kho mã nguồn `AI-Discipline-Coach`.

## 1. Triết lý sản phẩm
- **Kỷ luật đạt mục tiêu cá nhân là giá trị cốt lõi**; tập luyện thể thao là phương tiện rèn luyện kỷ luật.
- Phục vụ nhiều độ tuổi (`10–100`), trình độ (`beginner`, `intermediate`, `advanced`), và nhiều môn (`running`, `home_workout`, `gym` — hỗ trợ kết hợp đa môn).
- Mọi chiến lược do AI hoặc công cụ chiến lược tạo ra phải trả lời đầy đủ **8 câu hỏi chiến lược bắt buộc**:
  1. Mục tiêu cuối cùng là gì?
  2. Người dùng hiện đang ở đâu?
  3. Cần trải qua những giai đoạn nào (kèm cột mốc đo lường)?
  4. Khối lượng tập luyện theo từng môn được xác định ra sao?
  5. Nhiệm vụ hôm nay là gì?
  6. Khi nào cần đánh giá lại?
  7. Cần dữ liệu nào để điều chỉnh chiến lược?
  8. Khi nào cần dừng tập, phục hồi hoặc tham khảo chuyên gia?

## 2. Nguyên tắc kiến trúc & Tách môi trường
- **Tách biệt hoàn toàn `development`, `staging`, `production` (`APP_ENV`)**. Không hardcode cấu hình production, API key, hay tài khoản hạ tầng vào mã nguồn.
- **Một nguồn dữ liệu chính cho mỗi môi trường (`DATA_PROVIDER`)**:
  - `firestore`: DEV/MVP lưu trữ trực tiếp người dùng qua `FirestoreClientRepository` (`src/lib/firestoreAppStore.ts`) bảo vệ bằng `firestore.rules`.
  - `postgres`: Backend `PostgresRepository` (`src/repositories/postgresRepository.ts`) với Drizzle ORM (`src/db/schema.ts`).
  - `memory`: Kiểm thử tích hợp tự động (`src/repositories/memoryRepository.ts`).
- **Tách biệt AI Provider (`AI_PROVIDER`)**:
  - `mock`: Chỉ dùng trong `development` / `test`. Kết quả luôn gắn nhãn `aiProvider: 'mock'`, `isSimulated: true` và hiển thị rõ ràng với người dùng là **AI mô phỏng (DEV)**.
  - `gemini`: Sử dụng `@google/genai` trên server (`src/services/aiStrategy.ts`).
  - **Cấm tuyệt đối** tự động fallback âm thầm sang `mock` trong `production` khi mất kết nối Gemini.

## 3. Quy tắc an toàn, bảo mật & quyền riêng tư bắt buộc
1. **Không gửi PII sang AI**: Tuyệt đối không đưa `fullName`, `email`, số điện thoại, URL vào payload gửi AI (`src/services/aiPayload.ts`).
2. **Quản lý sự đồng ý có phiên bản (`CONSENT_POLICY_VERSION`)**:
   - Bắt buộc `aiHealthDataConsent == true` trước khi gọi AI.
   - Bắt buộc `guardianConsentConfirmed == true` cho người chưa thành niên (`< 18` tuổi).
   - Bắt buộc `medicalClearanceAcknowledged == true` khi hồ sơ có yếu tố nguy cơ sức khỏe cần đánh giá chuyên môn.
3. **Bộ kiểm định an toàn độc lập với AI (`src/services/strategyValidator.ts`)**:
   - Kiểm tra cả lịch tuần (`validateWeekOneStrategy`) lẫn bản thiết kế đa giai đoạn (`validateStrategyV2Blueprint`).
   - Giới hạn tải tập (số buổi/tuần, thời lượng/buổi, tổng phút/tuần, số hiệp, số ngày tập liên tiếp) và quy tắc riêng cho nhóm tuổi (`youth`, `teen`, `senior`) và bệnh lý.
4. **Diễn giải trung thực Progress Tracker**:
   - Check-in chỉ ghi nhận ở cấp ngày (`trackingGranularity: 'day_checkin_only'`, `exerciseCompletionTracked: false`). Không bao giờ coi toàn bộ từng bài tập/hiệp đã hoàn thành chỉ từ check-in ngày.
5. **Cô lập dữ liệu chéo tài khoản**:
   - `firestore.rules` bắt buộc `request.auth != null && request.auth.token.email_verified == true && request.auth.uid == userId`, global default-deny, `hasOnly`, `request.time`, và `existing().uid == request.auth.uid` trên mọi `allow list`.

## 4. Quy trình Intent to Evidence & Cổng Nghiệm Thu
Mọi thay đổi phải có bằng chứng kiểm chứng thực tế trước khi báo cáo **PASS**:

```bash
# 1. Kiểm tra kiểu TypeScript
bun run lint

# 2. Kiểm tra lint Firestore Security Rules
bun run lint:rules

# 3. Chạy toàn bộ unit test, contract test, safety & API integration test
bun run test

# 4. Chạy bộ kiểm thử đa tài khoản trên Firestore Emulator (yêu cầu Java + Firebase CLI)
firebase emulators:exec --only firestore "bun run test:rules:emulator"

# 5. Build production
bun run build
```

### Quy tắc báo cáo trung thực
- Mọi tiêu chí phải được gắn trạng thái rõ ràng: **PASS** / **FAIL** / **BLOCKED** / **DEFERRED — OWNER APPROVED**.
- Không bao giờ báo **PASS** cho hạng mục chưa chạy được trong môi trường thực thi (ví dụ: không có Java cho Firestore Emulator, không có `.git`/GitHub CLI để push PR, hoặc Production Gate đang tạm hoãn theo quyết định chủ dự án).
- Không yêu cầu token, mật khẩu, API key production hoặc dữ liệu sức khỏe khách hàng thật trong giai đoạn phát triển.
