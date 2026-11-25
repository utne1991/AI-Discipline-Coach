import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  EQUIPMENT_LABELS,
  FITNESS_LEVEL_LABELS,
  GOAL_LABELS,
  SPORT_LABELS,
  calculateBmi,
  evaluateCautionStatus,
  type EquipmentOption,
  type FitnessLevel,
  type GoalType,
  type SportOption,
  type WorkoutDay,
} from '../shared/types.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface StrategyProfileInput {
  fullName: string;
  age: number;
  weightKg: number;
  heightCm: number;
  fitnessLevel: FitnessLevel;
  daysPerWeek: number;
  equipment: EquipmentOption;
  healthLimitations: string[];
  healthNotes: string;
}

export interface StrategyGoalInput {
  sport: SportOption;
  goalType: GoalType;
  durationWeeks: number;
}

export interface GeneratedStrategyResult {
  cautiousMode: boolean;
  cautionReasons: string[];
  safetyAlert: string;
  strategySummary: string;
  coachPrinciples: string[];
  schedule: WorkoutDay[];
}

const DAY_LABELS = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ nhật',
];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    strategySummary: {
      type: Type.STRING,
      description:
        'Tóm tắt chiến lược tập luyện Tuần 1 (2-3 câu ngắn gọn, thực tế bằng tiếng Việt dựa trên hồ sơ và mục tiêu).',
    },
    safetyAlert: {
      type: Type.STRING,
      description:
        'Cảnh báo an toàn rõ ràng bằng tiếng Việt. Nếu chế độ thận trọng được bật, bắt buộc nêu rõ lý do, giới hạn cường độ, dấu hiệu phải dừng tập và khuyến nghị tham khảo ý kiến bác sĩ.',
    },
    coachPrinciples: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 nguyên tắc kỷ luật ngắn gọn cần giữ vững trong Tuần 1.',
    },
    days: {
      type: Type.ARRAY,
      description: 'Đúng 7 ngày từ Thứ 2 (dayIndex 1) đến Chủ nhật (dayIndex 7).',
      items: {
        type: Type.OBJECT,
        properties: {
          dayIndex: {
            type: Type.INTEGER,
            description: 'Số thứ tự từ 1 (Thứ 2) đến 7 (Chủ nhật).',
          },
          dayLabel: {
            type: Type.STRING,
            description: 'Nhãn ngày: Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6, Thứ 7, Chủ nhật.',
          },
          isRestDay: {
            type: Type.BOOLEAN,
            description: 'true nếu là ngày nghỉ / phục hồi chủ động, false nếu là ngày tập chính.',
          },
          title: {
            type: Type.STRING,
            description: 'Tên buổi tập hoặc chủ đề ngày nghỉ ngắn gọn.',
          },
          focusArea: {
            type: Type.STRING,
            description: 'Trọng tâm buổi tập (ví dụ: Nhịp tim vùng 2, Toàn thân, Phục hồi khớp).',
          },
          estimatedMinutes: {
            type: Type.INTEGER,
            description: 'Thời lượng ước tính tính bằng phút (0 hoặc 15-20 nếu giãn cơ ngày nghỉ).',
          },
          intensity: {
            type: Type.STRING,
            description: 'Một trong ba giá trị chính xác: Nhẹ, Trung bình, Cao.',
          },
          warmup: {
            type: Type.STRING,
            description: 'Hướng dẫn khởi động ngắn gọn (1 câu).',
          },
          cooldown: {
            type: Type.STRING,
            description: 'Hướng dẫn giãn cơ cuối buổi (1 câu).',
          },
          safetyNote: {
            type: Type.STRING,
            description: 'Ghi chú an toàn kỹ thuật cụ thể cho ngày này.',
          },
          exercises: {
            type: Type.ARRAY,
            description:
              'Danh sách bài tập trong ngày (4-6 bài cho ngày tập; 1-2 hoạt động nhẹ hoặc mảng rỗng cho ngày nghỉ).',
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Tên bài tập rõ ràng.' },
                sets: { type: Type.STRING, description: 'Số hiệp (ví dụ: 3 hiệp hoặc 1 phiên).' },
                repsOrDuration: {
                  type: Type.STRING,
                  description: 'Số lần lặp hoặc thời gian (ví dụ: 10–12 lần hoặc 20 phút).',
                },
                restSeconds: {
                  type: Type.INTEGER,
                  description: 'Thời gian nghỉ giữa các hiệp tính bằng giây.',
                },
                note: {
                  type: Type.STRING,
                  description: 'Ghi chú kỹ thuật, nhịp thở hoặc điều chỉnh an toàn.',
                },
              },
              required: ['name', 'sets', 'repsOrDuration', 'restSeconds', 'note'],
            },
          },
        },
        required: [
          'dayIndex',
          'dayLabel',
          'isRestDay',
          'title',
          'focusArea',
          'estimatedMinutes',
          'intensity',
          'warmup',
          'cooldown',
          'safetyNote',
          'exercises',
        ],
      },
    },
  },
  required: ['strategySummary', 'safetyAlert', 'coachPrinciples', 'days'],
};

function normalizeIntensity(
  raw: string,
  cautiousMode: boolean,
  isRestDay: boolean
): 'Nhẹ' | 'Trung bình' | 'Cao' {
  if (isRestDay) return 'Nhẹ';
  if (cautiousMode) {
    return raw === 'Trung bình' ? 'Trung bình' : 'Nhẹ';
  }
  if (raw === 'Cao') return 'Cao';
  if (raw === 'Trung bình') return 'Trung bình';
  return 'Nhẹ';
}

export async function generateWeekOneStrategy(
  profile: StrategyProfileInput,
  goal: StrategyGoalInput
): Promise<GeneratedStrategyResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'Chưa cấu hình khóa Gemini API trên máy chủ. Vui lòng kiểm tra mục Settings > Secrets.'
    );
  }

  const { cautiousMode, cautionReasons } = evaluateCautionStatus(
    profile.age,
    profile.healthLimitations,
    profile.healthNotes
  );
  const bmi = calculateBmi(profile.weightKg, profile.heightCm);

  const systemInstruction = `Bạn là AI Discipline Coach — huấn luyện viên thể chất chuyên nghiệp, khoa học và đề cao an toàn y khoa.
Nhiệm vụ của bạn: Phân tích hồ sơ người dùng và mục tiêu tập luyện để thiết kế Lịch Tập Tuần 1 (7 ngày từ Thứ 2 đến Chủ nhật) hoàn toàn bằng tiếng Việt tự nhiên, rõ ràng, ngắn gọn, dễ thực hiện trên điện thoại.

QUY TẮC BẮT BUỘC:
1. Số ngày tập chính (isRestDay = false) PHẢI KHỚP chính xác với số ngày tập/tuần người dùng chọn (${profile.daysPerWeek} ngày tập, ${7 - profile.daysPerWeek} ngày nghỉ/phục hồi). Sắp xếp xen kẽ hợp lý để cơ thể hồi phục.
2. Tất cả bài tập phải phù hợp tuyệt đối với dụng cụ có sẵn (${EQUIPMENT_LABELS[profile.equipment].label}) và môn chính (${SPORT_LABELS[goal.sport].label}).
3. Không bao giờ dùng ký tự mã máy móc hay thuật ngữ khó hiểu; trình bày mạch lạc, đo lường cụ thể (số hiệp, số lần hoặc phút/giây nghỉ).
${
  cautiousMode
    ? `4. CHẾ ĐỘ THẬN TRỌNG BẮT BUỘC ĐANG ĐƯỢC KÍCH HOẠT vì các yếu tố sau:
${cautionReasons.map((r) => `   - ${r}`).join('\n')}
   HÀNH ĐỘNG BẮT BUỘC KHI THẬN TRỌNG:
   - Chỉ chọn bài tập tác động thấp (low-impact), kiểm soát biên độ khớp an toàn, KHÔNG nhảy bật (plyometrics), KHÔNG chạy nước rút tối đa, KHÔNG gánh tạ nặng đè cột sống hoặc khớp đang tổn thương.
   - Cường độ tối đa ở mức "Nhẹ" (hoặc "Trung bình" rất nhẹ nếu không gây áp lực lên vùng giới hạn; ưu tiên "Nhẹ", tuyệt đối không xếp "Cao"). RPE <= 5-6/10.
   - Khởi động kỹ 8-10 phút, thời gian nghỉ giữa hiệp >= 60-90 giây.
   - Trong "safetyAlert": viết cảnh báo an toàn nổi bật, rõ ràng (2-4 câu) nêu rõ chế độ thận trọng đang áp dụng, tránh những chuyển động nào, dấu hiệu cần dừng tập ngay (đau nhói khớp, chóng mặt, tức ngực, khó thở) và khuyên tham khảo ý kiến bác sĩ / chuyên gia vật lý trị liệu trước khi tăng cường độ.
   - Nếu dưới 16 tuổi: ưu tiên kỹ thuật động tác với trọng lượng cơ thể, phát triển vận động tự nhiên, tránh tạ nặng tối đa và có người lớn giám sát.
   - Nếu trên 60 tuổi: ưu tiên giữ thăng bằng, độ linh hoạt khớp, tăng nhịp tim từ từ và bảo vệ gối/lưng.`
    : `4. Người dùng không có yếu tố hạn chế sức khỏe đặc biệt, vẫn cần đảm bảo tiến độ Tuần 1 mang tính xây dựng nền tảng kỷ luật, tránh quá tải đột ngột và ghi chú kỹ thuật an toàn rõ ràng ở từng buổi tập.`
}`;

  const userPrompt = `Hãy phân tích hồ sơ và mục tiêu sau để tạo Lịch Tập Tuần 1 chi tiết:

HỒ SƠ NGƯỜI DÙNG:
- Họ tên: ${profile.fullName}
- Độ tuổi: ${profile.age} tuổi
- Cân nặng: ${profile.weightKg} kg
- Chiều cao: ${profile.heightCm} cm${bmi ? ` (BMI: ${bmi.value} — ${bmi.category})` : ''}
- Trình độ hiện tại: ${FITNESS_LEVEL_LABELS[profile.fitnessLevel].label} (${FITNESS_LEVEL_LABELS[profile.fitnessLevel].desc})
- Số ngày tập mỗi tuần: ${profile.daysPerWeek} ngày tập / ${7 - profile.daysPerWeek} ngày nghỉ
- Dụng cụ có sẵn: ${EQUIPMENT_LABELS[profile.equipment].label} (${EQUIPMENT_LABELS[profile.equipment].desc})
- Giới hạn sức khỏe: ${
    profile.healthLimitations.length > 0 ? profile.healthLimitations.join(', ') : 'Không có'
  }
- Ghi chú sức khỏe thêm: ${profile.healthNotes.trim() || 'Không có'}
- Trạng thái an toàn bắt buộc: ${cautiousMode ? 'BẬT CHẾ ĐỘ THẬN TRỌNG' : 'Tiêu chuẩn'}

MỤC TIÊU TẬP LUYỆN:
- Môn chính: ${SPORT_LABELS[goal.sport].label}
- Mục tiêu: ${GOAL_LABELS[goal.goalType].label} (${GOAL_LABELS[goal.goalType].desc})
- Thời hạn lộ trình: ${goal.durationWeeks} tuần (đây là lịch cho Tuần 1 / ${goal.durationWeeks})

Hãy trả về đúng cấu trúc JSON theo schema với đúng 7 ngày (dayIndex từ 1 đến 7).`;

  let lastError: unknown;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Phản hồi từ AI trống.');
      }

      const parsed = JSON.parse(rawText) as {
        strategySummary?: string;
        safetyAlert?: string;
        coachPrinciples?: string[];
        days?: WorkoutDay[];
      };

      if (!Array.isArray(parsed.days) || parsed.days.length !== 7) {
        throw new Error('Lịch tập trả về không đủ 7 ngày.');
      }

      const sortedDays: WorkoutDay[] = [...parsed.days]
        .sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0))
        .map((day, idx) => {
          const dayIndex = idx + 1;
          const isRestDay = Boolean(day.isRestDay);
          return {
            dayIndex,
            dayLabel: DAY_LABELS[idx] ?? day.dayLabel ?? `Ngày ${dayIndex}`,
            isRestDay,
            title: (day.title || (isRestDay ? 'Ngày nghỉ phục hồi' : 'Buổi tập nền tảng')).trim(),
            focusArea: (day.focusArea || (isRestDay ? 'Phục hồi chủ động' : 'Toàn thân')).trim(),
            estimatedMinutes: Number.isFinite(Number(day.estimatedMinutes))
              ? Math.max(0, Math.round(Number(day.estimatedMinutes)))
              : isRestDay
                ? 15
                : 40,
            intensity: normalizeIntensity(String(day.intensity ?? 'Nhẹ'), cautiousMode, isRestDay),
            warmup: (day.warmup || 'Khởi động xoay khớp toàn thân nhẹ nhàng 5–10 phút.').trim(),
            cooldown: (day.cooldown || 'Giãn cơ tĩnh kết hợp hít thở sâu 5 phút.').trim(),
            safetyNote: (
              day.safetyNote ||
              (cautiousMode
                ? 'Giữ nhịp độ nhẹ nhàng, dừng ngay nếu cảm thấy đau nhói khớp, chóng mặt hoặc khó thở.'
                : 'Giữ đúng kỹ thuật trước khi tăng tốc độ hoặc mức tạ.')
            ).trim(),
            exercises: Array.isArray(day.exercises)
              ? day.exercises.map((ex) => ({
                  name: String(ex.name ?? 'Bài tập cơ bản').trim(),
                  sets: String(ex.sets ?? '3 hiệp').trim(),
                  repsOrDuration: String(ex.repsOrDuration ?? '10–12 lần').trim(),
                  restSeconds: Number.isFinite(Number(ex.restSeconds))
                    ? Math.max(0, Math.round(Number(ex.restSeconds)))
                    : cautiousMode
                      ? 75
                      : 60,
                  note: String(ex.note ?? 'Kiểm soát chuyển động chậm rãi và thở đều.').trim(),
                }))
              : [],
          };
        });

      const defaultCautiousAlert =
        'Chế độ thận trọng đang được áp dụng bắt buộc cho hồ sơ của bạn. Toàn bộ bài tập Tuần 1 được giảm tải tác động mạnh và ưu tiên bảo vệ khớp/tim mạch. Hãy dừng tập ngay nếu thấy đau nhói, chóng mặt, tức ngực hoặc khó thở, và tham khảo ý kiến bác sĩ trước khi nâng cường độ.';

      const safetyAlert = cautiousMode
        ? parsed.safetyAlert?.trim() || defaultCautiousAlert
        : parsed.safetyAlert?.trim() ||
          'Khởi động kỹ trước mỗi buổi tập, kiểm soát biên độ khớp và ưu tiên kỹ thuật chuẩn trong suốt Tuần 1.';

      const strategySummary =
        parsed.strategySummary?.trim() ||
        `Chiến lược Tuần 1 tập trung xây dựng nhịp kỷ luật ${profile.daysPerWeek} buổi/tuần cho mục tiêu ${GOAL_LABELS[goal.goalType].label} với bộ môn ${SPORT_LABELS[goal.sport].label}.`;

      const coachPrinciples =
        Array.isArray(parsed.coachPrinciples) && parsed.coachPrinciples.length > 0
          ? parsed.coachPrinciples.map((p) => String(p).trim()).filter(Boolean).slice(0, 4)
          : [
              'Hoàn thành đúng lịch trước khi nghĩ tới việc tăng cường độ.',
              'Ngủ đủ giấc và bù nước đều đặn để cơ thể thích nghi trong Tuần 1.',
              'Lắng nghe phản hồi cơ khớp và ưu tiên kỹ thuật chuẩn ở mọi hiệp tập.',
            ];

      return {
        cautiousMode,
        cautionReasons,
        safetyAlert,
        strategySummary,
        coachPrinciples,
        schedule: sortedDays,
      };
    } catch (error) {
      lastError = error;
      console.error(`Gemini strategy generation attempt ${attempt} failed:`, error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      }
    }
  }

  const errMsg =
    lastError instanceof Error ? lastError.message : 'Lỗi không xác định khi kết nối Gemini AI.';
  if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403')) {
    throw new Error(
      'Khóa Gemini API chưa hợp lệ hoặc thiếu quyền truy cập. Vui lòng kiểm tra trong mục Settings > Secrets.'
    );
  }
  if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
    throw new Error(
      'Hệ thống AI đang quá tải hạn mức tạm thời. Vui lòng thử lại sau ít phút hoặc kiểm tra khóa API trong Settings > Secrets.'
    );
  }
  throw new Error(`Không thể tạo lịch tập bằng AI lúc này: ${errMsg}`);
}
