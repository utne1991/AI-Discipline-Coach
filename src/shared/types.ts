export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentOption = 'none' | 'home' | 'gym';
export type SportOption = 'running' | 'home_workout' | 'gym';
export type GoalType = 'weight_loss' | 'muscle_gain' | 'endurance';
export type AgeGroup = 'youth' | 'teen' | 'adult' | 'senior' | 'unknown';

export interface WorkoutExercise {
  name: string;
  sets: string;
  repsOrDuration: string;
  restSeconds: number;
  note: string;
}

export interface WorkoutDay {
  dayIndex: number;
  dayLabel: string;
  isRestDay: boolean;
  title: string;
  focusArea: string;
  estimatedMinutes: number;
  intensity: 'Nhẹ' | 'Trung bình' | 'Cao';
  warmup: string;
  cooldown: string;
  safetyNote: string;
  exercises: WorkoutExercise[];
}

export interface ProfileData {
  id?: number;
  fullName: string;
  age: number;
  weightKg: number;
  heightCm: number;
  fitnessLevel: FitnessLevel;
  daysPerWeek: number;
  equipment: EquipmentOption;
  healthLimitations: string[];
  healthNotes: string;
  updatedAt?: string;
}

export type PreferredTimeSlot = 'morning' | 'noon' | 'evening';

export type MeasurableMetricKey =
  | 'run_distance_km'
  | 'weight_change_kg'
  | 'weekly_sessions'
  | 'strength_reps'
  | 'endurance_minutes';

export interface MeasurableGoalSpec {
  metricKey: MeasurableMetricKey;
  targetLabel: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

export interface SchedulePreferences {
  startDateKey: string; // YYYY-MM-DD in user's local timezone
  timezone: string; // IANA timezone e.g. Asia/Ho_Chi_Minh
  preferredTimeSlot: PreferredTimeSlot;
  minutesPerSessionBudget: number; // 20..90
  preferredDays?: number[]; // optional 1..7 weekday preferences
}

export interface GoalData {
  id?: number;
  sport: SportOption;
  sports?: SportOption[]; // Multi-sport support (1..3); sport remains primary for backward compatibility
  goalType: GoalType;
  durationWeeks: number;
  measurableGoal?: MeasurableGoalSpec;
  schedulePreferences?: SchedulePreferences;
  updatedAt?: string;
}

export type AiProviderName = 'gemini' | 'mock';

export const CONSENT_POLICY_VERSION = '2026-11-v1';

export interface ConsentRecord {
  policyVersion: string;
  aiHealthDataConsent: boolean;
  guardianConsentConfirmed: boolean;
  medicalClearanceAcknowledged: boolean;
  consentedAt?: string;
  updatedAt?: string;
}

export type FeasibilityStatus = 'feasible' | 'ambitious_adjust' | 'caution_required';

export interface FeasibilityAssessment {
  status: FeasibilityStatus;
  score: number; // 0..100 deterministic pacing feasibility index
  baselineSummary: string;
  weeklyDeltaRequired: string;
  recommendedDurationWeeks: number;
  rationale: string;
  adjustments: string[];
}

export interface StrategyPhase {
  phaseNumber: number;
  name: string;
  weekStart: number;
  weekEnd: number;
  objective: string;
  weeklyVolumeTarget: string;
  milestone: string;
}

export interface StrategyMilestone {
  weekNumber: number;
  title: string;
  measurableCheck: string;
  passCriteria: string;
}

export interface SportVolumePlan {
  sport: SportOption;
  sportLabel: string;
  sessionsPerWeek: number;
  weeklyMinutes: number;
  volumeMetricLabel: string; // e.g., "10–14 km/tuần" or "36 hiệp/tuần"
  intensityDistribution: string; // e.g., "80% Nhẹ · 20% Trung bình"
  rationale: string;
}

export interface ScheduledCalendarDay {
  dayIndex: number; // 1..7
  dateKey: string; // YYYY-MM-DD
  dayLabel: string;
  timeWindow: string; // e.g. "06:00–07:00"
  isRestDay: boolean;
}

export interface DailyStrategyTask {
  id: string;
  dayIndex: number;
  dateKey: string;
  category: 'training' | 'recovery' | 'discipline' | 'measurement';
  title: string;
  detail: string;
  estimatedMinutes: number;
}

export interface StrategyV2Blueprint {
  engineVersion: '2.0';
  sports: SportOption[];
  measurableGoal: MeasurableGoalSpec;
  feasibility: FeasibilityAssessment;
  // 8 mandatory strategic pillars required from AI Agent
  ultimateGoal: string;
  currentPosition: string;
  phases: StrategyPhase[];
  milestones: StrategyMilestone[];
  volumeAllocation: SportVolumePlan[];
  todayDirective: string;
  reassessmentSchedule: string;
  adjustmentSignals: string[];
  stopAndEscalateCriteria: string[];
  // Real-calendar scheduling & daily tasks derived from strategy
  calendarContext: {
    startDateKey: string;
    timezone: string;
    preferredTimeSlot: PreferredTimeSlot;
    timeWindowLabel: string;
    minutesPerSessionBudget: number;
    scheduledDays: ScheduledCalendarDay[];
  };
  dailyCommitments: DailyStrategyTask[];
}

export interface WorkoutPlanData {
  id: number;
  weekNumber: number;
  sport: SportOption;
  sports?: SportOption[];
  goalType: GoalType;
  durationWeeks: number;
  versionNumber?: number;
  parentPlanId?: number | null;
  revisionReason?: string;
  cautiousMode: boolean;
  cautionReasons: string[];
  safetyAlert: string;
  strategySummary: string;
  coachPrinciples: string[];
  scheduleJson: WorkoutDay[];
  completedDays: number[];
  strategyV2?: StrategyV2Blueprint;
  aiProvider?: AiProviderName;
  isSimulated?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const TIME_SLOT_LABELS: Record<
  PreferredTimeSlot,
  { label: string; window: string; desc: string }
> = {
  morning: {
    label: 'Buổi sáng',
    window: '06:00–07:30',
    desc: 'Khởi đầu ngày mới kỷ luật, ít bị công việc chen ngang',
  },
  noon: {
    label: 'Buổi trưa',
    window: '12:00–13:15',
    desc: 'Buổi tập gọn nhẹ giữa ngày tái tạo tập trung',
  },
  evening: {
    label: 'Buổi tối',
    window: '18:00–20:00',
    desc: 'Giải tỏa căng thẳng sau giờ làm, kết thúc trước ngủ >= 2 giờ',
  },
};

export interface BootstrapResponse {
  user: {
    id: number;
    uid: string;
    email: string;
    displayName: string;
  };
  profile: ProfileData | null;
  goal: GoalData | null;
  latestPlan: WorkoutPlanData | null;
  planCount: number;
}

export interface BmiEvaluation {
  value: number | null;
  status: 'missing_data' | 'pediatric_notice' | 'adult_classified';
  ageGroup: AgeGroup;
  isAdultClassification: boolean;
  category: string;
  guidance: string;
}

export interface SafetyLoadLimits {
  allowHighIntensity: boolean;
  maxSessionMinutes: number;
  maxWeeklyMinutes: number;
  maxExercisesPerDay: number;
  maxSetsPerExercise: number;
  maxDailySets: number;
  maxWeeklySets: number;
  maxRepsPerSet: number;
  maxExerciseDurationMinutes: number;
  minRestSeconds: number;
  maxConsecutiveWorkoutDays: number;
  maxConsecutiveHighDays: number;
}

export interface SafetyProfile {
  ageGroup: AgeGroup;
  isMinor: boolean;
  requiresGuardianSupervision: boolean;
  requiresMedicalClearance: boolean;
  medicalClearanceReasons: string[];
  cautiousMode: boolean;
  cautionReasons: string[];
  loadLimits: SafetyLoadLimits;
}

export const FITNESS_LEVEL_LABELS: Record<FitnessLevel, { label: string; desc: string }> = {
  beginner: {
    label: 'Mới bắt đầu',
    desc: 'Ít vận động hoặc mới quay lại dưới 3 tháng',
  },
  intermediate: {
    label: 'Trung bình',
    desc: 'Tập đều 3–12 tháng, nắm vững kỹ thuật cơ bản',
  },
  advanced: {
    label: 'Nâng cao',
    desc: 'Tập ổn định trên 1 năm, chịu tải tốt',
  },
};

export const EQUIPMENT_LABELS: Record<EquipmentOption, { label: string; desc: string }> = {
  none: {
    label: 'Không dụng cụ',
    desc: 'Chỉ dùng trọng lượng cơ thể & thảm tập',
  },
  home: {
    label: 'Tại nhà',
    desc: 'Tạ đơn, dây kháng lực, xà đơn cơ bản',
  },
  gym: {
    label: 'Phòng gym',
    desc: 'Đầy đủ máy tập, tạ đòn, máy chạy bộ',
  },
};

export const SPORT_LABELS: Record<SportOption, { label: string; subtitle: string; desc: string }> = {
  running: {
    label: 'Chạy bộ',
    subtitle: 'Cardio & nhịp bền',
    desc: 'Xây dựng nền tảng tim mạch, sức bền và đốt năng lượng ổn định.',
  },
  home_workout: {
    label: 'Tập tại nhà',
    subtitle: 'Linh hoạt & kỷ luật',
    desc: 'Tối ưu không gian nhỏ với bodyweight hoặc dụng cụ tại nhà.',
  },
  gym: {
    label: 'Gym',
    subtitle: 'Kháng lực & hình thể',
    desc: 'Tăng sức mạnh, phát triển nhóm cơ có hệ thống với máy và tạ.',
  },
};

export const GOAL_LABELS: Record<GoalType, { label: string; desc: string }> = {
  weight_loss: {
    label: 'Giảm cân',
    desc: 'Tăng tiêu hao năng lượng, bảo toàn cơ bắp và duy trì thói quen.',
  },
  muscle_gain: {
    label: 'Tăng cơ',
    desc: 'Tập trung kích thích cơ bắp, kiểm soát kỹ thuật và phục hồi.',
  },
  endurance: {
    label: 'Tăng sức bền',
    desc: 'Nâng cao thể lực tim mạch, kéo dài thời gian vận động bền bỉ.',
  },
};

export const HEALTH_LIMITATION_OPTIONS: string[] = [
  'Đau khớp gối',
  'Đau lưng / cột sống',
  'Đau vai / cổ tay',
  'Tim mạch / Huyết áp',
  'Hen suyễn / Hô hấp',
  'Chấn thương cũ đang phục hồi',
];

export function classifyAgeGroup(age: number): AgeGroup {
  if (!Number.isFinite(age) || age <= 0) return 'unknown';
  if (age < 16) return 'youth';
  if (age < 18) return 'teen';
  if (age <= 60) return 'adult';
  return 'senior';
}

export function evaluateBmi(
  weightKg: number,
  heightCm: number,
  age?: number
): BmiEvaluation {
  const ageGroup = age === undefined ? 'unknown' : classifyAgeGroup(age);

  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    weightKg <= 0 ||
    heightCm <= 0 ||
    ageGroup === 'unknown'
  ) {
    return {
      value: null,
      status: 'missing_data',
      ageGroup,
      isAdultClassification: false,
      category: 'Thiếu dữ liệu đánh giá',
      guidance:
        'Chưa đủ thông tin tuổi, cân nặng hoặc chiều cao hợp lệ; hệ thống áp dụng chế độ thận trọng mặc định.',
    };
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const rounded = Math.round(bmi * 10) / 10;

  if (ageGroup === 'youth' || ageGroup === 'teen') {
    return {
      value: rounded,
      status: 'pediatric_notice',
      ageGroup,
      isAdultClassification: false,
      category: 'Đánh giá theo bách phân vị trẻ em & vị thành niên (WHO/CDC)',
      guidance:
        'Không áp dụng ngưỡng phân loại BMI người lớn cho người dưới 18 tuổi. Cần đối chiếu biểu đồ BMI theo tuổi và giới tính hoặc tham khảo bác sĩ nhi khoa.',
    };
  }

  let category = 'Cân đối';
  let guidance = 'Chỉ số nằm trong ngưỡng tham khảo ổn định cho người trưởng thành.';

  if (rounded < 18.5) {
    category = 'Thiếu cân';
    guidance = 'Nên ưu tiên tập kháng lực vừa phải và bổ sung dinh dưỡng đầy đủ.';
  } else if (rounded < 23) {
    category = 'Cân đối';
    guidance = 'Nền tảng cân đối theo ngưỡng tham chiếu châu Á – Thái Bình Dương.';
  } else if (rounded < 25) {
    category = 'Thừa cân nhẹ';
    guidance = 'Phù hợp kết hợp vận động đều đặn và kiểm soát tổng năng lượng.';
  } else if (rounded < 30) {
    category = 'Cần kiểm soát cân nặng';
    guidance = 'Ưu tiên bài tập tác động thấp để bảo vệ khớp gối và cổ chân trong tuần đầu.';
  } else {
    category = 'Nguy cơ béo phì — cần thận trọng';
    guidance =
      'Chỉ số BMI >= 30: hệ thống kích hoạt chế độ thận trọng nhằm giảm tải khớp gối, cột sống và tim mạch.';
  }

  return {
    value: rounded,
    status: 'adult_classified',
    ageGroup,
    isAdultClassification: true,
    category,
    guidance,
  };
}

export function calculateBmi(
  weightKg: number,
  heightCm: number,
  age?: number
): { value: number; category: string; isAdultClassification: boolean } | null {
  const evaluation = evaluateBmi(weightKg, heightCm, age);
  if (evaluation.value === null) return null;
  return {
    value: evaluation.value,
    category: evaluation.category,
    isAdultClassification: evaluation.isAdultClassification,
  };
}

const MEDICAL_CLEARANCE_NOTE_KEYWORDS = [
  'đau ngực',
  'tức ngực',
  'ngất',
  'chóng mặt',
  'khó thở',
  'phẫu thuật',
  'mổ',
  'gãy xương',
  'thoát vị',
  'rối loạn nhịp tim',
  'mang thai',
  'thai kỳ',
  'tiểu đường',
  'đột quỵ',
  'huyết áp cao',
  'chest pain',
  'fainting',
  'surgery',
  'fracture',
  'pregnant',
];

export function evaluateSafetyProfile(input: {
  age: number;
  healthLimitations: string[];
  healthNotes: string;
  weightKg?: number;
  heightCm?: number;
  fitnessLevel?: FitnessLevel;
  daysPerWeek?: number;
}): SafetyProfile {
  const { age, healthLimitations, healthNotes, weightKg, heightCm } = input;
  const fitnessLevel: FitnessLevel = input.fitnessLevel ?? 'beginner';
  const daysPerWeek = Number.isFinite(input.daysPerWeek) ? Number(input.daysPerWeek) : 3;

  const ageGroup = classifyAgeGroup(age);
  const isMinor = ageGroup === 'youth' || ageGroup === 'teen';
  const requiresGuardianSupervision = isMinor;

  const cautionReasons: string[] = [];
  const medicalClearanceReasons: string[] = [];

  if (ageGroup === 'unknown') {
    cautionReasons.push('Thiếu thông tin độ tuổi hợp lệ — áp dụng chế độ thận trọng mặc định');
  } else if (ageGroup === 'youth') {
    cautionReasons.push(
      `Độ tuổi dưới 16 (${age} tuổi) — ưu tiên kỹ thuật thể trọng cơ thể, tránh tạ nặng và cần người giám hộ đồng hành`
    );
  } else if (ageGroup === 'teen') {
    cautionReasons.push(
      `Độ tuổi vị thành niên (${age} tuổi) — không áp dụng ngưỡng BMI người lớn, ưu tiên kỹ thuật chuẩn, tránh nâng tạ tối đa (1RM) và cần phụ huynh/người giám hộ nắm rõ`
    );
  } else if (ageGroup === 'senior') {
    cautionReasons.push(
      `Độ tuổi trên 60 (${age} tuổi) — ưu tiên bảo vệ khớp, thăng bằng và kiểm soát nhịp tim`
    );
  }

  if (
    (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg <= 0)) ||
    (heightCm !== undefined && (!Number.isFinite(heightCm) || heightCm <= 0))
  ) {
    cautionReasons.push('Thiếu dữ liệu cân nặng hoặc chiều cao — áp dụng chế độ thận trọng mặc định');
  } else if (
    weightKg !== undefined &&
    heightCm !== undefined &&
    Number.isFinite(age) &&
    age >= 18
  ) {
    const bmiEval = evaluateBmi(weightKg, heightCm, age);
    if (bmiEval.value !== null && bmiEval.value < 16.5) {
      const msg = `BMI rất thấp (${bmiEval.value}) — cần đánh giá y tế trước khi tập tải trung bình/cao, tránh kiệt sức`;
      cautionReasons.push(msg);
      medicalClearanceReasons.push(msg);
    } else if (bmiEval.value !== null && bmiEval.value >= 35) {
      const msg = `BMI ở mức nguy cơ cao (${bmiEval.value}) — cần bác sĩ/chuyên gia y tế đánh giá tim mạch và khớp trước khi tăng tải`;
      cautionReasons.push(msg);
      medicalClearanceReasons.push(msg);
    } else if (bmiEval.value !== null && bmiEval.value >= 30) {
      cautionReasons.push(
        `BMI cao (${bmiEval.value}) — ưu tiên bài tập tác động thấp để bảo vệ khớp và tim mạch`
      );
    }
  }

  const cleanLimitations = healthLimitations.map((s) => s.trim()).filter(Boolean);
  if (cleanLimitations.length > 0) {
    cautionReasons.push(`Giới hạn sức khỏe: ${cleanLimitations.join(', ')}`);
  }

  const normalizedLimitations = cleanLimitations.join(' ').toLowerCase();
  if (normalizedLimitations.includes('tim mạch') || normalizedLimitations.includes('huyết áp')) {
    medicalClearanceReasons.push(
      'Có tiền sử Tim mạch / Huyết áp — cần được bác sĩ xác nhận mức vận động an toàn trước khi bắt đầu'
    );
  }
  if (
    (normalizedLimitations.includes('hô hấp') || normalizedLimitations.includes('hen')) &&
    (age > 60 || isMinor)
  ) {
    medicalClearanceReasons.push(
      'Tình trạng Hô hấp / Hen suyễn kết hợp nhóm tuổi nhạy cảm — cần tham khảo bác sĩ trước khi tập'
    );
  }
  if (normalizedLimitations.includes('chấn thương')) {
    medicalClearanceReasons.push(
      'Đang phục hồi chấn thương cũ — cần chuyên gia vật lý trị liệu hoặc bác sĩ xác nhận biên độ vận động an toàn'
    );
  }
  if (age >= 65 && cleanLimitations.length >= 2) {
    medicalClearanceReasons.push(
      'Người trên 65 tuổi có nhiều giới hạn sức khỏe đồng thời — cần đánh giá sức khỏe chuyên môn trước khi áp dụng giáo án'
    );
  }

  const cleanNotes = healthNotes.trim();
  if (cleanNotes.length > 0) {
    cautionReasons.push('Có ghi chú sức khỏe bổ sung — áp dụng giới hạn tải an toàn');
    const lowerNotes = cleanNotes.toLowerCase();
    const matchedKeywords = MEDICAL_CLEARANCE_NOTE_KEYWORDS.filter((kw) => lowerNotes.includes(kw));
    if (matchedKeywords.length > 0) {
      medicalClearanceReasons.push(
        `Ghi chú sức khỏe xuất hiện dấu hiệu cần đánh giá chuyên môn (${matchedKeywords.slice(0, 3).join(', ')})`
      );
    }
  }

  const requiresMedicalClearance = medicalClearanceReasons.length > 0;
  const cautiousMode = cautionReasons.length > 0 || requiresMedicalClearance;

  let allowHighIntensity = !cautiousMode && !isMinor && fitnessLevel !== 'beginner';
  let maxSessionMinutes = cautiousMode ? 60 : fitnessLevel === 'beginner' ? 75 : 105;
  let maxWeeklyMinutes = cautiousMode ? 240 : fitnessLevel === 'beginner' ? 300 : 420;
  let maxExercisesPerDay = cautiousMode ? 6 : 8;
  let maxSetsPerExercise = cautiousMode ? 5 : fitnessLevel === 'beginner' ? 5 : 8;
  let maxDailySets = cautiousMode ? 15 : fitnessLevel === 'beginner' ? 16 : 24;
  let maxWeeklySets = cautiousMode ? 60 : fitnessLevel === 'beginner' ? 70 : 120;
  let maxRepsPerSet = cautiousMode ? 20 : 30;
  let maxExerciseDurationMinutes = cautiousMode ? 35 : 60;
  let minRestSeconds = cautiousMode ? 45 : 30;
  let maxConsecutiveWorkoutDays = daysPerWeek <= 4 ? (cautiousMode ? 2 : 3) : daysPerWeek <= 5 ? 4 : 5;
  let maxConsecutiveHighDays = allowHighIntensity ? 2 : 0;

  if (ageGroup === 'youth') {
    allowHighIntensity = false;
    maxSessionMinutes = Math.min(maxSessionMinutes, 45);
    maxWeeklyMinutes = Math.min(maxWeeklyMinutes, 180);
    maxExercisesPerDay = Math.min(maxExercisesPerDay, 5);
    maxSetsPerExercise = Math.min(maxSetsPerExercise, 4);
    maxDailySets = Math.min(maxDailySets, 12);
    maxWeeklySets = Math.min(maxWeeklySets, 48);
    maxRepsPerSet = Math.min(maxRepsPerSet, 15);
    maxExerciseDurationMinutes = Math.min(maxExerciseDurationMinutes, 25);
    minRestSeconds = Math.max(minRestSeconds, 60);
    maxConsecutiveWorkoutDays = Math.min(maxConsecutiveWorkoutDays, daysPerWeek <= 4 ? 2 : 3);
    maxConsecutiveHighDays = 0;
  } else if (ageGroup === 'teen') {
    allowHighIntensity = false;
    maxSessionMinutes = Math.min(maxSessionMinutes, 60);
    maxWeeklyMinutes = Math.min(maxWeeklyMinutes, 270);
    maxExercisesPerDay = Math.min(maxExercisesPerDay, 6);
    maxSetsPerExercise = Math.min(maxSetsPerExercise, 5);
    maxDailySets = Math.min(maxDailySets, 18);
    maxWeeklySets = Math.min(maxWeeklySets, 72);
    maxRepsPerSet = Math.min(maxRepsPerSet, 18);
    maxExerciseDurationMinutes = Math.min(maxExerciseDurationMinutes, 35);
    minRestSeconds = Math.max(minRestSeconds, 45);
    maxConsecutiveHighDays = 0;
  }

  if (requiresMedicalClearance) {
    allowHighIntensity = false;
    maxSessionMinutes = Math.min(maxSessionMinutes, 45);
    maxWeeklyMinutes = Math.min(maxWeeklyMinutes, 180);
    maxSetsPerExercise = Math.min(maxSetsPerExercise, 4);
    maxDailySets = Math.min(maxDailySets, 12);
    maxWeeklySets = Math.min(maxWeeklySets, 48);
    maxRepsPerSet = Math.min(maxRepsPerSet, 15);
    maxExerciseDurationMinutes = Math.min(maxExerciseDurationMinutes, 25);
    minRestSeconds = Math.max(minRestSeconds, 60);
    maxConsecutiveHighDays = 0;
  }

  if (daysPerWeek === 7) {
    maxConsecutiveWorkoutDays = 7;
  } else if (daysPerWeek === 6) {
    maxConsecutiveWorkoutDays = Math.max(maxConsecutiveWorkoutDays, 6);
  }

  return {
    ageGroup,
    isMinor,
    requiresGuardianSupervision,
    requiresMedicalClearance,
    medicalClearanceReasons,
    cautiousMode,
    cautionReasons,
    loadLimits: {
      allowHighIntensity,
      maxSessionMinutes,
      maxWeeklyMinutes,
      maxExercisesPerDay,
      maxSetsPerExercise,
      maxDailySets,
      maxWeeklySets,
      maxRepsPerSet,
      maxExerciseDurationMinutes,
      minRestSeconds,
      maxConsecutiveWorkoutDays,
      maxConsecutiveHighDays,
    },
  };
}

export function evaluateCautionStatus(
  age: number,
  healthLimitations: string[],
  healthNotes: string,
  weightKg?: number,
  heightCm?: number
): { cautiousMode: boolean; cautionReasons: string[] } {
  const safety = evaluateSafetyProfile({
    age,
    healthLimitations,
    healthNotes,
    weightKg,
    heightCm,
  });
  return {
    cautiousMode: safety.cautiousMode,
    cautionReasons: safety.cautionReasons,
  };
}
