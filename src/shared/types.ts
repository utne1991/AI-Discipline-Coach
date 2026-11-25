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

export interface GoalData {
  id?: number;
  sport: SportOption;
  goalType: GoalType;
  durationWeeks: number;
  updatedAt?: string;
}

export interface WorkoutPlanData {
  id: number;
  weekNumber: number;
  sport: SportOption;
  goalType: GoalType;
  durationWeeks: number;
  cautiousMode: boolean;
  cautionReasons: string[];
  safetyAlert: string;
  strategySummary: string;
  coachPrinciples: string[];
  scheduleJson: WorkoutDay[];
  completedDays: number[];
  createdAt: string;
}

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

export function evaluateCautionStatus(
  age: number,
  healthLimitations: string[],
  healthNotes: string,
  weightKg?: number,
  heightCm?: number
): { cautiousMode: boolean; cautionReasons: string[] } {
  const reasons: string[] = [];

  if (!Number.isFinite(age) || age <= 0) {
    reasons.push('Thiếu thông tin độ tuổi hợp lệ — áp dụng chế độ thận trọng mặc định');
  } else if (age > 60) {
    reasons.push(
      `Độ tuổi trên 60 (${age} tuổi) — ưu tiên bảo vệ khớp, thăng bằng và kiểm soát nhịp tim`
    );
  } else if (age < 16) {
    reasons.push(
      `Độ tuổi dưới 16 (${age} tuổi) — ưu tiên kỹ thuật thể trọng cơ thể, tránh tạ nặng và cần người lớn giám sát`
    );
  }

  if (
    (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg <= 0)) ||
    (heightCm !== undefined && (!Number.isFinite(heightCm) || heightCm <= 0))
  ) {
    reasons.push('Thiếu dữ liệu cân nặng hoặc chiều cao — áp dụng chế độ thận trọng mặc định');
  } else if (
    weightKg !== undefined &&
    heightCm !== undefined &&
    Number.isFinite(age) &&
    age >= 18
  ) {
    const bmiEval = evaluateBmi(weightKg, heightCm, age);
    if (bmiEval.value !== null && bmiEval.value < 16.5) {
      reasons.push(
        `BMI rất thấp (${bmiEval.value}) — cần tránh kiệt sức, ưu tiên bài tập nhẹ và phục hồi`
      );
    } else if (bmiEval.value !== null && bmiEval.value >= 30) {
      reasons.push(
        `BMI cao (${bmiEval.value}) — ưu tiên bài tập tác động thấp để bảo vệ khớp và tim mạch`
      );
    }
  }

  const cleanLimitations = healthLimitations.map((s) => s.trim()).filter(Boolean);
  if (cleanLimitations.length > 0) {
    reasons.push(`Giới hạn sức khỏe: ${cleanLimitations.join(', ')}`);
  }

  const cleanNotes = healthNotes.trim();
  if (cleanNotes.length > 0) {
    reasons.push(`Ghi chú sức khỏe bổ sung: ${cleanNotes}`);
  }

  return {
    cautiousMode: reasons.length > 0,
    cautionReasons: reasons,
  };
}
