# AI Discipline Coach

**AI Discipline Coach** không đơn thuần là ứng dụng liệt kê bài tập. Giá trị cốt lõi của sản phẩm là **rèn luyện kỷ luật cá nhân để đạt mục tiêu đo lường được** thông qua chiến lược đa giai đoạn, cam kết hành động hằng ngày, đo lường trung thực và điều chỉnh kịp thời — phục vụ nhiều độ tuổi, trình độ và nhiều bộ môn thể thao.

## Tính năng chính (Sprint 01.1 & Sprint 02)

1. **Màn hình trung tâm `Hôm nay` (`TodayTab`)**:
   - Hiển thị nhiệm vụ trọng tâm theo **ngày dương lịch thực tế** (`YYYY-MM-DD`), múi giờ địa phương và khung giờ rảnh ưu tiên.
   - Check-in 1 chạm cho buổi tập hôm nay, danh sách cam kết hành động sinh tự động từ chiến lược, mục tiêu nhỏ hằng ngày (đồng bộ Firestore) và bảng chỉ số kỷ luật (chuỗi ngày, tuần duy trì, chế độ an toàn).
2. **Goal & Strategy Engine v2 (`Mục tiêu` + `Chiến lược`)**:
   - **Mục tiêu cá nhân đo lường được** (`MeasurableGoalSpec`: chỉ số nền hiện tại, con số đích, đơn vị).
   - **Đánh giá năng lực & tính khả thi độc lập với AI** (`assessGoalFeasibility`): tính điểm khả thi `0..100`, phát hiện tốc độ quá dốc và đề xuất giãn tiến độ.
   - **Hỗ trợ chọn nhiều môn thể thao** (`Chạy bộ`, `Tập tại nhà`, `Gym` — tối đa 3 môn đồng thời).
   - **Chiến lược toàn thời hạn (4–12 tuần)** chia thành các **giai đoạn liên tục** và **cột mốc kiểm chứng**, kèm **bảng phân bổ khối lượng theo từng môn** bị chặn trần bởi giới hạn an toàn.
   - **8 câu hỏi chiến lược bắt buộc** từ AI Agent (Mục tiêu cuối cùng, Vị trí hiện tại, Các giai đoạn, Phân bổ khối lượng, Nhiệm vụ hôm nay, Lịch đánh giá lại, Tín hiệu điều chỉnh, Quy tắc dừng/phục hồi/tham khảo chuyên gia).
   - **Quản lý phiên bản kế hoạch (`v1`, `v2`, ...)** với `parentPlanId`, `revisionReason` và bộ chọn đối chiếu lịch sử.
3. **An toàn, Quyền riêng tư & Tách môi trường**:
   - **Bộ kiểm định an toàn độc lập với AI** (`src/services/strategyValidator.ts`): kiểm định cả lịch tuần lẫn bản thiết kế đa giai đoạn, giới hạn tải tập, quy tắc riêng cho người chưa thành niên (`<18`) và nhóm cần đánh giá y khoa.
   - **Tối giản dữ liệu gửi AI** (`src/services/aiPayload.ts`): tuyệt đối loại bỏ họ tên, email, số điện thoại khỏi AI payload; quản lý sự đồng ý có phiên bản (`CONSENT_POLICY_VERSION`).
   - **Diễn giải trung thực Progress Tracker**: check-in chỉ tính theo ngày (`day_checkin_only`), không tự động đánh đồng là hoàn thành 100% từng bài tập.
   - **Đồng hồ thông minh & Xuất lưu trữ**: kết nối cảm biến nhịp tim BLE / xuất lịch `.ics` và xuất dữ liệu mục tiêu + nhật ký tập luyện ra CSV (an toàn chống CSV injection).

## Kiến trúc tách môi trường & Provider

- **Tách hoàn toàn `development`, `staging`, `production` (`APP_ENV`)**. Không hardcode thông tin tài khoản production vào mã nguồn.
- **Repository Interface** (`src/repositories/types.ts`):
  - `FirestoreClientRepository` (`src/repositories/firestoreClientRepository.ts` -> `src/lib/firestoreAppStore.ts`) bảo vệ bằng `firestore.rules`.
  - `PostgresRepository` (`src/repositories/postgresRepository.ts` -> Drizzle ORM `src/db/schema.ts`).
  - `MemoryRepository` (`src/repositories/memoryRepository.ts`) cho kiểm thử tự động.
- **AI Provider (`AI_PROVIDER`)**:
  - `mock`: Dùng cho DEV/test, luôn gắn nhãn rõ `isSimulated: true` và cảnh báo người dùng trên UI (không bao giờ trình bày như Gemini thật).
  - `gemini`: Gọi `@google/genai` trên server; **tuyệt đối không fallback âm thầm sang mock trong production**.

## Yêu cầu môi trường & Cài đặt

- Trình quản lý gói chuẩn: **Bun** (`bun@1.4.4`, `packageManager` trong `package.json`, lockfile `bun.lock`) + Node.js `>= 20`.
- Biến môi trường: xem đầy đủ tại `.env.example` (không commit secret hay dữ liệu người dùng thật).

```bash
# 1. Cài đặt phụ thuộc
bun install

# 2. Kiểm tra TypeScript & Firestore Security Rules lint
bun run lint
bun run lint:rules

# 3. Chạy toàn bộ unit, contract, safety & API integration test
bun run test

# 4. Chạy kiểm thử đa tài khoản Firestore Security Rules trên Emulator (yêu cầu Java + Firebase CLI)
firebase emulators:exec --only firestore "bun run test:rules:emulator"

# 5. Build production
bun run build

# 6. Chạy môi trường phát triển (Express + Vite trên cổng 3000)
bun run dev
```

## Tài liệu dự án
- `AGENTS.md`: Quy trình kỹ thuật **Intent to Evidence**, nguyên tắc bảo mật và cổng nghiệm thu.
- `docs/PRD.md`: Yêu cầu sản phẩm và phạm vi MVP.
- `docs/ARCHITECTURE.md`: Kiến trúc hệ thống, Repository Interface, Strategy Engine v2 & đánh giá Capacitor.
- `docs/SAFETY_RULES.md`: Quy tắc an toàn y khoa, phân loại BMI theo tuổi và kiểm định chiến lược.
- `docs/MVP_BACKLOG.md`: Tiến độ Sprint 01.1 (Development Gate / Production Gate) và Sprint 02.
- `docs/ACCEPTANCE_TESTS.md`: Ma trận nghiệm thu PASS / FAIL / BLOCKED / DEFERRED dựa trên bằng chứng thực tế.
- `security_spec.md` & `firebase-blueprint.json`: Đặc tả bảo mật và lược đồ Firestore.
