import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { resolveRuntimeConfig, type AiProviderMode } from '../config/env.ts';
import {
  EQUIPMENT_LABELS,
  FITNESS_LEVEL_LABELS,
  GOAL_LABELS,
  SPORT_LABELS,
  TIME_SLOT_LABELS,
  type AiProviderName,
  type EquipmentOption,
  type FitnessLevel,
  type GoalType,
  type MeasurableGoalSpec,
  type SchedulePreferences,
  type SportOption,
  type StrategyV2Blueprint,
  type WorkoutDay,
} from '../shared/types.ts';
import { buildMinimizedAiPayload } from './aiPayload.ts';
import {
  buildStrategyV2Blueprint,
  normalizeSchedulePreferences,
  normalizeSportsList,
} from './strategyEngineV2.ts';
import {
  validateStrategyV2Blueprint,
  validateWorkoutStrategy,
} from './strategyValidator.ts';

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
  fullName?: string;
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
  sports?: SportOption[];
  goalType: GoalType;
  durationWeeks: number;
  measurableGoal?: MeasurableGoalSpec;
  schedulePreferences?: Partial<SchedulePreferences>;
}

export interface GeneratedStrategyResult {
  cautiousMode: boolean;
  cautionReasons: string[];
  safetyAlert: string;
  strategySummary: string;
  coachPrinciples: string[];
  schedule: WorkoutDay[];
  sports?: SportOption[];
  strategyV2?: StrategyV2Blueprint;
  aiProvider: AiProviderName;
  isSimulated: boolean;
}

export interface StrategyGeneratorOptions {
  providerOverride?: AiProviderMode;
  referenceDate?: Date;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    strategySummary: {
      type: Type.STRING,
      description:
        'Tóm tắt chiến lược tập luyện tổng thể (2-3 câu ngắn gọn, thực tế bằng tiếng Việt dựa trên hồ sơ đã ẩn danh và mục tiêu).',
    },
    ultimateGoal: {
      type: Type.STRING,
      description: 'Trả lời rõ câu hỏi: Mục tiêu cuối cùng đo lường được là gì?',
    },
    currentPosition: {
      type: Type.STRING,
      description: 'Trả lời rõ câu hỏi: Người dùng hiện đang ở đâu về nền tảng thể chất & kỷ luật?',
    },
    todayDirective: {
      type: Type.STRING,
      description: 'Trả lời rõ câu hỏi: Nhiệm vụ trọng tâm hôm nay là gì?',
    },
    reassessmentSchedule: {
      type: Type.STRING,
      description: 'Trả lời rõ câu hỏi: Khi nào cần đánh giá lại lộ trình?',
    },
    adjustmentSignals: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3-4 dữ liệu cụ thể cần thu thập để điều chỉnh chiến lược.',
    },
    stopAndEscalateCriteria: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3-4 tiêu chí rõ ràng về thời điểm cần dừng tập, phục hồi hoặc tham khảo chuyên gia/phụ huynh.',
    },
    safetyAlert: {
      type: Type.STRING,
      description:
        'Cảnh báo an toàn rõ ràng bằng tiếng Việt. Nếu chế độ thận trọng được bật, bắt buộc nêu rõ lý do, giới hạn cường độ, dấu hiệu phải dừng tập và khuyến nghị tham khảo ý kiến bác sĩ / người giám hộ nếu áp dụng.',
    },
    coachPrinciples: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 nguyên tắc kỷ luật ngắn gọn cần giữ vững.',
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
              'Danh sách bài tập trong ngày (2-6 bài cho ngày tập; 0-2 hoạt động nhẹ cho ngày nghỉ).',
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
  required: [
    'strategySummary',
    'ultimateGoal',
    'currentPosition',
    'todayDirective',
    'reassessmentSchedule',
    'adjustmentSignals',
    'stopAndEscalateCriteria',
    'safetyAlert',
    'coachPrinciples',
    'days',
  ],
};

/**
 * Builds the minimized, PII-free system instruction and user prompt for Gemini.
 * Never includes fullName, email, UID, or raw unredacted free-text health notes.
 */
export function buildGeminiPrompt(
  profile: StrategyProfileInput,
  goal: StrategyGoalInput
): {
  systemInstruction: string;
  userPrompt: string;
  minimizedPayload: ReturnType<typeof buildMinimizedAiPayload>;
} {
  const minimized = buildMinimizedAiPayload(profile, goal);
  const { safetyProfile } = minimized;
  const { cautiousMode, cautionReasons, isMinor, requiresMedicalClearance, loadLimits } =
    safetyProfile;
  const sports = normalizeSportsList(goal.sport, goal.sports);
  const sportNames = sports.map((s) => SPORT_LABELS[s]?.label ?? s).join(', ');
  const prefs = normalizeSchedulePreferences(goal.schedulePreferences);
  const slotInfo = TIME_SLOT_LABELS[prefs.preferredTimeSlot] ?? TIME_SLOT_LABELS.evening;

  const systemInstruction = `Bạn là AI Discipline Coach — huấn luyện viên kỷ luật và thể chất chuyên nghiệp, khoa học và đề cao an toàn y khoa.
Triết lý cốt lõi: Tập luyện thể thao là phương tiện, rèn luyện kỷ luật để đạt mục tiêu cá nhân mới là giá trị cốt lõi.
Nhiệm vụ của bạn: Không chỉ liệt kê bài tập Tuần 1, mà phải xây dựng chiến lược rõ ràng trả lời đủ: mục tiêu cuối cùng, người dùng đang ở đâu, các giai đoạn, khối lượng tập luyện, nhiệm vụ hôm nay, lịch đánh giá lại, dữ liệu điều chỉnh, và tiêu chí dừng/phục hồi/tham khảo chuyên gia, cùng lịch 7 ngày chi tiết (Thứ 2 đến Chủ nhật) hoàn toàn bằng tiếng Việt tự nhiên.

QUY TẮC BẮT BUỘC (HỆ THỐNG KIỂM ĐỊNH ĐỘC LẬP SẼ TỪ CHỐI NẾU VI PHẠM):
1. Bắt buộc trả về đúng 7 ngày theo thứ tự dayIndex duy nhất từ 1 (Thứ 2) đến 7 (Chủ nhật).
2. Số ngày tập chính (isRestDay = false) PHẢI KHỚP chính xác ${minimized.daysPerWeek} ngày tập và ${7 - minimized.daysPerWeek} ngày nghỉ (isRestDay = true). Ngày nghỉ phải có intensity = "Nhẹ", estimatedMinutes <= 30, tối đa 2 hoạt động giãn cơ nhẹ.
3. Giới hạn tải tập bắt buộc cho hồ sơ này:
   - Thời lượng mỗi buổi tập: 15–${Math.min(loadLimits.maxSessionMinutes, prefs.minutesPerSessionBudget)} phút; tổng thời lượng tuần <= ${loadLimits.maxWeeklyMinutes} phút.
   - Số bài tập mỗi ngày tập: 1–${loadLimits.maxExercisesPerDay} bài; số hiệp mỗi bài: 1–${loadLimits.maxSetsPerExercise} hiệp; tổng số hiệp/ngày <= ${loadLimits.maxDailySets}; tổng hiệp/tuần <= ${loadLimits.maxWeeklySets}.
   - Số lần mỗi hiệp <= ${loadLimits.maxRepsPerSet} lần; thời lượng mỗi bài <= ${loadLimits.maxExerciseDurationMinutes} phút.
   - Nghỉ giữa hiệp >= ${loadLimits.minRestSeconds} giây.
   - Không xếp quá ${loadLimits.maxConsecutiveWorkoutDays} ngày tập liên tiếp không nghỉ.
   - ${loadLimits.allowHighIntensity ? `Tối đa ${loadLimits.maxConsecutiveHighDays} ngày liên tiếp cường độ "Cao".` : 'TUYỆT ĐỐI KHÔNG dùng cường độ "Cao" ở bất kỳ ngày nào; chỉ dùng "Nhẹ" hoặc "Trung bình".'}
4. Tất cả bài tập phải phù hợp tuyệt đối với dụng cụ có sẵn (${EQUIPMENT_LABELS[minimized.equipment].label}) và phân bổ cân bằng giữa các môn đã chọn (${sportNames}).
${
  isMinor
    ? `5. QUY TẮC NGƯỜI CHƯA THÀNH NIÊN (${minimized.ageGroup}):
   - Không áp dụng chuẩn BMI người lớn.
   - Ưu tiên kỹ thuật chuẩn, thể trọng cơ thể và hình thành kỷ luật; cấm tuyệt đối nâng tạ tối đa (1RM), cử giật/cử đẩy, tập đến kiệt sức${minimized.ageGroup === 'youth' ? ', tạ đòn/barbell/deadlift' : ''}.
   - Trong "safetyAlert" và "stopAndEscalateCriteria" bắt buộc nêu rõ yêu cầu phụ huynh hoặc người giám hộ đồng hành/giám sát.`
    : ''
}
${
  cautiousMode
    ? `6. CHẾ ĐỘ THẬN TRỌNG BẮT BUỘC ĐANG ĐƯỢC KÍCH HOẠT:
${cautionReasons.map((r) => `   - ${r}`).join('\n')}
   - Chỉ chọn bài tập tác động thấp (low-impact), kiểm soát biên độ khớp an toàn, KHÔNG nhảy bật (burpee, box jump, jump squat, bật nhảy), KHÔNG chạy nước rút tối đa, KHÔNG tạ nặng đè khớp/cột sống.
   - Trong "safetyAlert": viết cảnh báo an toàn chi tiết (>= 30 ký tự) nêu rõ dấu hiệu dừng tập ngay.${
     requiresMedicalClearance
       ? ' BẮT BUỘC khuyến nghị rõ ràng việc tham khảo ý kiến bác sĩ hoặc chuyên gia y tế trước khi tập.'
       : ''
   }`
    : '6. Xây dựng nền tảng kỷ luật bền vững theo đúng thời hạn mục tiêu, tránh quá tải đột ngột.'
}`;

  const userPrompt = `Hãy phân tích hồ sơ đã ẩn danh và mục tiêu sau để xây dựng Chiến lược toàn diện (Strategy Engine v2) và Lịch Tập Tuần 1 chi tiết:

HỒ SƠ THỂ CHẤT TỐI GIẢN (KHÔNG CHỨA HỌ TÊN / EMAIL):
- Nhóm tuổi: ${minimized.ageGroup} (khung tuổi: ${minimized.ageBracket})
- Đánh giá BMI: ${minimized.bmiSummary}
- Trình độ hiện tại: ${FITNESS_LEVEL_LABELS[minimized.fitnessLevel].label} (${FITNESS_LEVEL_LABELS[minimized.fitnessLevel].desc})
- Số ngày tập mỗi tuần: ${minimized.daysPerWeek} ngày tập / ${7 - minimized.daysPerWeek} ngày nghỉ
- Dụng cụ có sẵn: ${EQUIPMENT_LABELS[minimized.equipment].label} (${EQUIPMENT_LABELS[minimized.equipment].desc})
- Nhóm giới hạn sức khỏe: ${
    minimized.healthLimitationCategories.length > 0
      ? minimized.healthLimitationCategories.join(', ')
      : 'Không có'
  }
- Cờ rủi ro lâm sàng tóm tắt: ${
    minimized.clinicalRiskFlags.length > 0 ? minimized.clinicalRiskFlags.join(', ') : 'Không có'
  }
- Trạng thái an toàn bắt buộc: ${cautiousMode ? 'BẬT CHẾ ĐỘ THẬN TRỌNG' : 'Tiêu chuẩn'}${
    requiresMedicalClearance ? ' · YÊU CẦU ĐÁNH GIÁ SỨC KHỎE CHUYÊN MÔN' : ''
  }

MỤC TIÊU & LỊCH THỰC TẾ:
- Nhóm môn thể thao: ${sportNames} (môn chính: ${SPORT_LABELS[minimized.goal.sport].label})
- Mục tiêu trọng tâm: ${GOAL_LABELS[minimized.goal.goalType].label} (${GOAL_LABELS[minimized.goal.goalType].desc})
- Mục tiêu đo lường cụ thể: ${minimized.goal.measurableTargetSummary ?? 'Duy trì đều lịch cam kết theo tuần'}
- Thời hạn lộ trình: ${minimized.goal.durationWeeks} tuần (lịch chi tiết cho Tuần 1 / ${minimized.goal.durationWeeks})
- Khung giờ rảnh & thời lượng mỗi buổi: ${slotInfo.label} (${slotInfo.window}), ngân sách ~${prefs.minutesPerSessionBudget} phút/buổi, múi giờ ${prefs.timezone}

Hãy trả về đúng cấu trúc JSON theo schema với đầy đủ câu trả lời chiến lược và đúng 7 ngày (dayIndex từ 1 đến 7).`;

  return { systemInstruction, userPrompt, minimizedPayload: minimized };
}

function selectBalancedWorkoutDayIndices(
  daysPerWeek: number,
  preferredDays?: number[],
  maxConsecutive = 5
): number[] {
  if (Array.isArray(preferredDays) && preferredDays.length === daysPerWeek) {
    const sorted = Array.from(new Set(preferredDays))
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
      .sort((a, b) => a - b);
    if (sorted.length === daysPerWeek) {
      let streak = 0;
      let maxStreak = 0;
      for (let d = 1; d <= 7; d += 1) {
        if (sorted.includes(d)) {
          streak += 1;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 0;
        }
      }
      if (maxStreak <= maxConsecutive) {
        return sorted;
      }
    }
  }

  const presets: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 6],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 7],
  };
  return presets[daysPerWeek] ?? [1, 3, 5];
}

function buildExercisesForSport(params: {
  sport: SportOption;
  equipment: EquipmentOption;
  setCount: number;
  repCount: number;
  restSec: number;
  cautiousMode: boolean;
  isYouth: boolean;
}) {
  const { sport, equipment, setCount, repCount, restSec, cautiousMode, isYouth } = params;

  if (sport === 'running') {
    return [
      {
        name: cautiousMode
          ? 'Đi bộ nhanh nhịp đều kết hợp bước chạy nhẹ kiểm soát'
          : 'Chạy nhịp nền Zone 2 kết hợp kiểm soát hơi thở',
        sets: `${setCount} hiệp`,
        repsOrDuration: cautiousMode ? '5 phút' : '7 phút',
        restSeconds: restSec,
        note: 'Giữ nhịp thở nói chuyện được, đáp chân êm tránh sốc khớp gối.',
      },
      {
        name: 'Nâng gót chân chậm ổn định cổ chân',
        sets: `${setCount} hiệp`,
        repsOrDuration: `${repCount} lần`,
        restSeconds: restSec,
        note: 'Giữ thẳng thân người, hạ gót chậm có kiểm soát.',
      },
    ];
  }

  if (sport === 'gym' && equipment === 'gym' && !isYouth) {
    return [
      {
        name: 'Đẩy ngực kiểm soát với tạ nhẹ vừa sức (Chest Press kiểm soát)',
        sets: `${setCount} hiệp`,
        repsOrDuration: `${repCount} lần`,
        restSeconds: restSec,
        note: 'Hạ chậm 2 giây, không khóa khớp khuỷu, giữ nhịp thở đều không nín thở.',
      },
      {
        name: 'Kéo lưng ngồi máy kiểm soát vai (Seated Row kiểm soát)',
        sets: `${setCount} hiệp`,
        repsOrDuration: `${repCount} lần`,
        restSeconds: restSec,
        note: 'Giữ lưng trung tính, kéo bằng cơ lưng và ép bả vai nhẹ.',
      },
      {
        name: 'Goblet Squat biên độ an toàn kiểm soát gối',
        sets: `${setCount} hiệp`,
        repsOrDuration: `${repCount} lần`,
        restSeconds: restSec,
        note: 'Đẩy gối theo hướng mũi chân, dừng ở biên độ thoải mái cho khớp.',
      },
    ];
  }

  // home_workout (or safe bodyweight equivalent when equipment=none or youth)
  return [
    {
      name: 'Đứng lên ngồi xuống ghế chậm (Chair Squat)',
      sets: `${setCount} hiệp`,
      repsOrDuration: `${repCount} lần`,
      restSeconds: restSec,
      note: 'Hạ hông chậm có kiểm soát, giữ lưng trung tính và thở đều.',
    },
    {
      name:
        equipment === 'home' && !cautiousMode && !isYouth
          ? 'Chống đẩy nghiêng hoặc đẩy vai kiểm soát với dây kháng lực'
          : 'Chống đẩy tường kiểm soát thân trên (Wall Push-up)',
      sets: `${setCount} hiệp`,
      repsOrDuration: `${repCount} lần`,
      restSeconds: restSec,
      note: 'Siết nhẹ cơ lõi, giữ cổ tay và vai thẳng hàng.',
    },
    {
      name: 'Giữ thăng bằng Bird-Dog chậm',
      sets: `${setCount} hiệp`,
      repsOrDuration: '30 giây',
      restSeconds: restSec,
      note: 'Không võng lưng dưới, giữ nhịp thở đều đặn.',
    },
  ];
}

/**
 * Deterministic DEV/test strategy provider (Strategy Engine v2).
 * Strictly forbidden in production and always labeled with isSimulated: true so it is never
 * presented as real Gemini API output. Still verified by validateWorkoutStrategy() and validateStrategyV2Blueprint().
 */
export function generateMockWeekOneStrategy(
  profile: StrategyProfileInput,
  goal: StrategyGoalInput,
  referenceDate: Date = new Date()
): GeneratedStrategyResult {
  const { minimizedPayload } = buildGeminiPrompt(profile, goal);
  const { safetyProfile } = minimizedPayload;
  const { cautiousMode, cautionReasons, isMinor, requiresMedicalClearance, loadLimits } =
    safetyProfile;

  const sports = normalizeSportsList(goal.sport, goal.sports);
  const prefs = normalizeSchedulePreferences(goal.schedulePreferences, referenceDate);

  const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const activeIndicesList = selectBalancedWorkoutDayIndices(
    profile.daysPerWeek,
    prefs.preferredDays,
    loadLimits.maxConsecutiveWorkoutDays
  );
  const activeIndices = new Set(activeIndicesList);
  const sessionMinutes = Math.max(
    20,
    Math.min(prefs.minutesPerSessionBudget, loadLimits.maxSessionMinutes)
  );
  const restSec = Math.max(60, loadLimits.minRestSeconds);
  const setCount = Math.min(3, loadLimits.maxSetsPerExercise);
  const repCount = Math.min(10, loadLimits.maxRepsPerSet);
  const intensity: WorkoutDay['intensity'] = cautiousMode || isMinor ? 'Nhẹ' : 'Trung bình';

  const sportNames = sports.map((s) => SPORT_LABELS[s]?.label ?? s).join(' + ');
  const goalLabel = GOAL_LABELS[goal.goalType]?.label ?? goal.goalType;

  const alertParts: string[] = [
    'Khởi động kỹ trước buổi tập, giữ kỹ thuật chuẩn và dừng ngay nếu đau nhói khớp, chóng mặt hoặc khó thở.',
  ];
  if (isMinor) {
    alertParts.push(
      'Người dưới 18 tuổi cần phụ huynh hoặc người giám hộ theo dõi buổi tập và chỉ tập kiểm soát thể trọng.'
    );
  }
  if (requiresMedicalClearance || cautiousMode) {
    alertParts.push(
      'Khuyến nghị tham khảo ý kiến bác sĩ hoặc chuyên gia y tế trước khi tăng khối lượng tập.'
    );
  }

  let activeSessionCounter = 0;
  const days: WorkoutDay[] = labels.map((dayLabel, idx) => {
    const dayIndex = idx + 1;
    const isRestDay = !activeIndices.has(dayIndex);
    if (isRestDay) {
      return {
        dayIndex,
        dayLabel,
        isRestDay: true,
        title: 'Nghỉ phục hồi chủ động',
        focusArea: 'Thư giãn khớp & hít thở',
        estimatedMinutes: 15,
        intensity: 'Nhẹ',
        warmup: 'Đi lại nhẹ nhàng 5 phút để lưu thông máu.',
        cooldown: 'Thở bụng chậm 5 phút giúp hạ nhịp tim.',
        safetyNote: 'Ưu tiên giấc ngủ và uống đủ nước, không tập nặng trong ngày nghỉ.',
        exercises: [
          {
            name: 'Giãn cơ toàn thân nhẹ nhàng',
            sets: '1 hiệp',
            repsOrDuration: '10 phút',
            restSeconds: 0,
            note: 'Kéo giãn chậm rãi trong biên độ thoải mái, không bật giật.',
          },
        ],
      };
    }

    const sessionSport = sports[activeSessionCounter % sports.length];
    activeSessionCounter += 1;
    const sessionSportLabel = SPORT_LABELS[sessionSport]?.label ?? sessionSport;

    const exerciseList = buildExercisesForSport({
      sport: sessionSport,
      equipment: profile.equipment,
      setCount,
      repCount,
      restSec,
      cautiousMode,
      isYouth: safetyProfile.ageGroup === 'youth',
    });

    return {
      dayIndex,
      dayLabel,
      isRestDay: false,
      title: `Buổi ${sessionSportLabel} nền tảng #${activeSessionCounter}`,
      focusArea: `Xây nền kỷ luật · ${sessionSportLabel} · ${goalLabel}`,
      estimatedMinutes: sessionMinutes,
      intensity,
      warmup: 'Xoay khớp cổ tay, vai, hông và đi bộ tại chỗ 6 phút.',
      cooldown: 'Giãn cơ tĩnh nhẹ và hít thở sâu 5 phút.',
      safetyNote: 'Duy trì kỹ thuật ổn định, dừng ngay nếu xuất hiện đau nhói hoặc choáng.',
      exercises: exerciseList,
    };
  });

  const candidatePayload = {
    strategySummary: `[Mô phỏng DEV — không phải kết quả Gemini thật] Lộ trình ${goal.durationWeeks} tuần nhóm môn ${sportNames} theo mục tiêu ${goalLabel.toLowerCase()}, gồm ${profile.daysPerWeek} buổi/tuần (~${sessionMinutes} phút/buổi) trong ngưỡng tải an toàn.`,
    safetyAlert: alertParts.join(' '),
    coachPrinciples: [
      'Hoàn thành đúng lịch cam kết theo khung giờ rảnh trước khi tăng độ khó.',
      'Ưu tiên kỹ thuật chuẩn, nhịp thở đều và phục hồi đầy đủ giữa các buổi.',
      'Ghi nhận check-in trung thực hằng ngày để đánh giá và điều chỉnh ở mốc Tuần 2.',
    ],
    days,
  };

  const validation = validateWorkoutStrategy(candidatePayload, profile, goal);
  if (!validation.valid) {
    throw new StrategyValidationError(
      'Giáo án mô phỏng DEV chưa đạt chuẩn kiểm định an toàn.',
      validation.errors
    );
  }

  const strategyV2 = buildStrategyV2Blueprint({
    profile,
    goal: { ...goal, sports, schedulePreferences: prefs },
    schedule: validation.normalizedDays,
    referenceDate,
  });

  const v2Validation = validateStrategyV2Blueprint(strategyV2, profile, goal);
  if (!v2Validation.valid) {
    throw new StrategyValidationError(
      'Chiến lược tổng thể v2 chưa đạt chuẩn quy tắc an toàn độc lập.',
      v2Validation.errors
    );
  }

  return {
    cautiousMode,
    cautionReasons,
    safetyAlert: candidatePayload.safetyAlert,
    strategySummary: candidatePayload.strategySummary,
    coachPrinciples: candidatePayload.coachPrinciples,
    schedule: validation.normalizedDays,
    sports,
    strategyV2,
    aiProvider: 'mock',
    isSimulated: true,
  };
}

export async function generateWeekOneStrategy(
  profile: StrategyProfileInput,
  goal: StrategyGoalInput,
  options?: StrategyGeneratorOptions
): Promise<GeneratedStrategyResult> {
  const runtime = resolveRuntimeConfig();
  const provider: AiProviderMode = options?.providerOverride ?? runtime.aiProvider;
  const referenceDate = options?.referenceDate ?? new Date();

  if (runtime.appEnv === 'production' && provider === 'mock') {
    throw new Error('Không được phép sử dụng Mock AI trong môi trường Production.');
  }

  if (provider === 'mock') {
    return generateMockWeekOneStrategy(profile, goal, referenceDate);
  }

  // Real Gemini provider — NEVER silently falls back to mock AI on error or missing key
  const ai = getAiClient();
  const { systemInstruction, userPrompt, minimizedPayload } = buildGeminiPrompt(profile, goal);
  const { cautiousMode, cautionReasons } = minimizedPayload.safetyProfile;
  const sports = normalizeSportsList(goal.sport, goal.sports);
  const prefs = normalizeSchedulePreferences(goal.schedulePreferences, referenceDate);

  let lastError: unknown;
  let lastValidationErrors: string[] = [];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const promptWithFeedback =
        attempt === 1 || lastValidationErrors.length === 0
          ? userPrompt
          : `${userPrompt}\n\nLẦN TẠO TRƯỚC BỊ BỘ KIỂM ĐỊNH AN TOÀN TỪ CHỐI VÌ CÁC LỖI SAU — HÃY SỬA TRIỆT ĐỂ:\n${lastValidationErrors
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
        ultimateGoal?: string;
        currentPosition?: string;
        todayDirective?: string;
        reassessmentSchedule?: string;
        adjustmentSignals?: string[];
        stopAndEscalateCriteria?: string[];
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

      const strategyV2 = buildStrategyV2Blueprint({
        profile,
        goal: { ...goal, sports, schedulePreferences: prefs },
        schedule: validation.normalizedDays,
        aiNarrativeOverrides: {
          ultimateGoal: parsed.ultimateGoal,
          currentPosition: parsed.currentPosition,
          todayDirective: parsed.todayDirective,
          reassessmentSchedule: parsed.reassessmentSchedule,
          adjustmentSignals: parsed.adjustmentSignals,
          stopAndEscalateCriteria: parsed.stopAndEscalateCriteria,
        },
        referenceDate,
      });

      const v2Validation = validateStrategyV2Blueprint(strategyV2, profile, goal);
      if (!v2Validation.valid) {
        lastValidationErrors = v2Validation.errors;
        throw new StrategyValidationError(
          'Chiến lược tổng thể AI tạo ra chưa đạt chuẩn kiểm định độc lập.',
          v2Validation.errors
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
        sports,
        strategyV2,
        aiProvider: 'gemini',
        isSimulated: false,
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
