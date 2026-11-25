import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  EQUIPMENT_LABELS,
  FITNESS_LEVEL_LABELS,
  GOAL_LABELS,
  SPORT_LABELS,
  evaluateBmi,
  evaluateCautionStatus,
  type EquipmentOption,
  type FitnessLevel,
  type GoalType,
  type SportOption,
  type WorkoutDay,
} from '../shared/types.ts';
import { validateWorkoutStrategy } from './strategyValidator.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình khóa Gemini API trên máy chủ. Vui lòng kiểm tra mục Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class StrategyValidationError extends Error {
  readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[]) {
    super(message);
    this.name = 'StrategyValidationError';
    this.validationErrors = validationErrors;
  }
}

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
              'Danh sách bài tập trong ngày (3-6 bài cho ngày tập; 0-2 hoạt động nhẹ cho ngày nghỉ).',
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Tên bài tập rõ ràng.' },
                sets: { type: Type.STRING, description: 'Số hiệp (ví dụ: 3 hiệp).' },
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

export async function generateWeekOneStrategy(
  profile: StrategyProfileInput,
  goal: StrategyGoalInput
): Promise<GeneratedStrategyResult> {
  const ai = getAiClient();

  const { cautiousMode, cautionReasons } = evaluateCautionStatus(
    profile.age,
    profile.healthLimitations,
    profile.healthNotes,
    profile.weightKg,
    profile.heightCm
  );
  const bmiEval = evaluateBmi(profile.weightKg, profile.heightCm, profile.age);

  const systemInstruction = `Bạn là AI Discipline Coach — huấn luyện viên thể chất chuyên nghiệp, khoa học và đề cao an toàn y khoa.
Nhiệm vụ của bạn: Phân tích hồ sơ người dùng và mục tiêu tập luyện để thiết kế Lịch Tập Tuần 1 (7 ngày từ Thứ 2 đến Chủ nhật) hoàn toàn bằng tiếng Việt tự nhiên, rõ ràng, ngắn gọn, dễ thực hiện trên điện thoại.

QUY TẮC BẮT BUỘC (HỆ THỐNG KIỂM ĐỊNH ĐỘC LẬP SẼ TỪ CHỐI NẾU VI PHẠM):
1. Bắt buộc trả về đúng 7 ngày với dayIndex duy nhất từ 1 (Thứ 2) đến 7 (Chủ nhật).
2. Số ngày tập chính (isRestDay = false) PHẢI KHỚP chính xác ${profile.daysPerWeek} ngày tập và ${7 - profile.daysPerWeek} ngày nghỉ (isRestDay = true). Ngày nghỉ phải có intensity = "Nhẹ", estimatedMinutes <= 30, tối đa 2 hoạt động giãn cơ nhẹ.
3. Tất cả bài tập phải phù hợp tuyệt đối với dụng cụ có sẵn (${EQUIPMENT_LABELS[profile.equipment].label}) và môn chính (${SPORT_LABELS[goal.sport].label}).
4. Không bao giờ dùng ký tự mã máy móc; ghi rõ số hiệp (1–5 hiệp khi thận trọng), số lần/thời gian, thời gian nghỉ (giây) và ghi chú kỹ thuật an toàn cho từng bài.
${
  cautiousMode
    ? `5. CHẾ ĐỘ THẬN TRỌNG BẮT BUỘC ĐANG ĐƯỢC KÍCH HOẠT vì các yếu tố sau:
${cautionReasons.map((r) => `   - ${r}`).join('\n')}
   HÀNH ĐỘNG BẮT BUỘC KHI THẬN TRỌNG:
   - Chỉ chọn bài tập tác động thấp (low-impact), kiểm soát biên độ khớp an toàn, KHÔNG nhảy bật (burpee, box jump, jump squat, bật nhảy), KHÔNG chạy nước rút tối đa, KHÔNG gánh tạ nặng đè cột sống hoặc khớp đang tổn thương.
   - Tuyệt đối KHÔNG dùng cường độ "Cao" ở bất kỳ ngày nào; chỉ dùng "Nhẹ" hoặc "Trung bình". Thời lượng ngày tập <= 60 phút.
   - Thời gian nghỉ giữa hiệp PHẢI >= 45 giây (khuyến nghị 60–90 giây).
   - Nếu có <= 4 buổi/tuần, sắp xếp ngày nghỉ xen kẽ, không xếp 3 ngày tập liên tiếp.
   - Trong "safetyAlert": viết cảnh báo an toàn nổi bật, rõ ràng (>= 30 ký tự) nêu rõ lý do thận trọng, chuyển động cần tránh, dấu hiệu phải dừng tập ngay và khuyên tham khảo ý kiến bác sĩ.
   - Nếu dưới 16 tuổi: chỉ dùng thể trọng cơ thể, tuyệt đối không dùng tạ đòn/deadlift/1RM và cần người lớn giám sát.
   - Nếu trên 60 tuổi: ưu tiên giữ thăng bằng, độ linh hoạt khớp, tăng nhịp tim từ từ và bảo vệ gối/lưng.`
    : `5. Người dùng không có yếu tố hạn chế sức khỏe đặc biệt, vẫn cần đảm bảo tiến độ Tuần 1 mang tính xây dựng nền tảng kỷ luật, tránh quá tải đột ngột và không xếp 3 ngày liên tiếp cường độ "Cao".`
}`;

  const baseUserPrompt = `Hãy phân tích hồ sơ và mục tiêu sau để tạo Lịch Tập Tuần 1 chi tiết:

HỒ SƠ NGƯỜI DÙNG:
- Họ tên: ${profile.fullName}
- Độ tuổi: ${profile.age} tuổi (${bmiEval.ageGroup})
- Cân nặng: ${profile.weightKg} kg
- Chiều cao: ${profile.heightCm} cm${bmiEval.value !== null ? ` (BMI: ${bmiEval.value} — ${bmiEval.category})` : ''}
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
  let lastValidationErrors: string[] = [];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const promptWithFeedback =
        attempt === 1 || lastValidationErrors.length === 0
          ? baseUserPrompt
          : `${baseUserPrompt}\n\nLẦN TẠO TRƯỚC BỊ BỘ KIỂM ĐỊNH AN TOÀN TỪ CHỐI VÌ CÁC LỖI SAU — HÃY SỬA TRIỆT ĐỂ:\n${lastValidationErrors
              .map((err) => `- ${err}`)
              .join('\n')}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptWithFeedback,
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

      let parsed: {
        strategySummary?: string;
        safetyAlert?: string;
        coachPrinciples?: string[];
        days?: unknown[];
      };

      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new StrategyValidationError('AI trả về dữ liệu JSON không hợp lệ.', [
          'JSON phản hồi từ AI không đúng cú pháp.',
        ]);
      }

      const validation = validateWorkoutStrategy(
        parsed,
        {
          age: profile.age,
          weightKg: profile.weightKg,
          heightCm: profile.heightCm,
          fitnessLevel: profile.fitnessLevel,
          daysPerWeek: profile.daysPerWeek,
          equipment: profile.equipment,
          healthLimitations: profile.healthLimitations,
          healthNotes: profile.healthNotes,
        },
        goal
      );

      if (!validation.valid) {
        lastValidationErrors = validation.errors;
        throw new StrategyValidationError(
          'Giáo án AI tạo ra chưa đạt chuẩn kiểm định an toàn.',
          validation.errors
        );
      }

      return {
        cautiousMode,
        cautionReasons,
        safetyAlert: String(parsed.safetyAlert ?? '').trim(),
        strategySummary: String(parsed.strategySummary ?? '').trim(),
        coachPrinciples: (parsed.coachPrinciples ?? [])
          .map((p) => String(p).trim())
          .filter(Boolean)
          .slice(0, 4),
        schedule: validation.normalizedDays,
      };
    } catch (error) {
      lastError = error;
      console.error(`Gemini strategy generation attempt ${attempt} failed:`, error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }

  if (lastError instanceof StrategyValidationError) {
    throw lastError;
  }

  const errMsg =
    lastError instanceof Error ? lastError.message : 'Lỗi không xác định khi kết nối Gemini AI.';
  if (
    errMsg.includes('API_KEY_INVALID') ||
    errMsg.includes('PERMISSION_DENIED') ||
    errMsg.includes('403')
  ) {
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
