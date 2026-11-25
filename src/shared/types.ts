export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentOption = 'none' | 'home' | 'gym';
export type SportOption = 'running' | 'home_workout' | 'gym';
export type GoalType = 'weight_loss' | 'muscle_gain' | 'endurance';

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

export function evaluateCautionStatus(
  age: number,
  healthLimitations: string[],
  healthNotes: string
): { cautiousMode: boolean; cautionReasons: string[] } {
  const reasons: string[] = [];

  if (Number.isFinite(age) && age > 60) {
    reasons.push(`Độ tuổi trên 60 (${age} tuổi) — cần ưu tiên bảo vệ khớp, thăng bằng và nhịp tim`);
  } else if (Number.isFinite(age) && age < 16) {
    reasons.push(`Độ tuổi dưới 16 (${age} tuổi) — cần ưu tiên kỹ thuật thể trọng cơ thể, tránh tạ nặng`);
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

export function calculateBmi(weightKg: number, heightCm: number): { value: number; category: string } | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const rounded = Math.round(bmi * 10) / 10;

  let category = 'Bình thường';
  if (rounded < 18.5) category = 'Thiếu cân';
  else if (rounded < 23) category = 'Cân đối';
  else if (rounded < 25) category = 'Thừa cân nhẹ';
  else category = 'Cần kiểm soát cân nặng';

  return { value: rounded, category };
}
