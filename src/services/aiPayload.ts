import {
  evaluateBmi,
  evaluateSafetyProfile,
  type AgeGroup,
  type EquipmentOption,
  type FitnessLevel,
  type GoalType,
  type SafetyProfile,
  type SportOption,
} from '../shared/types.ts';

export interface RawAiProfileSource {
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

export interface RawAiGoalSource {
  sport: SportOption;
  goalType: GoalType;
  durationWeeks: number;
}

/**
 * Strictly minimized, de-identified payload sent to external AI models (Gemini).
 * Deliberately excludes fullName, email, UID, raw phone/URL identifiers, and raw free-text PII.
 */
export interface MinimizedAiPayload {
  ageGroup: AgeGroup;
  ageBracket: string;
  isMinor: boolean;
  bmiSummary: string;
  fitnessLevel: FitnessLevel;
  daysPerWeek: number;
  equipment: EquipmentOption;
  healthLimitationCategories: string[];
  hasAdditionalHealthNote: boolean;
  clinicalRiskFlags: string[];
  safetyProfile: SafetyProfile;
  goal: {
    sport: SportOption;
    goalType: GoalType;
    durationWeeks: number;
  };
}

const CLINICAL_TAG_RULES: Array<{ tag: string; keywords: string[] }> = [
  { tag: 'han_che_khop_goi', keywords: ['gối', 'knee', 'dây chằng', 'sụn'] },
  { tag: 'han_che_co_chan_ban_chan', keywords: ['cổ chân', 'bàn chân', 'ankle', 'gót'] },
  { tag: 'han_che_cot_song_lung', keywords: ['lưng', 'cột sống', 'thoát vị', 'back', 'spine'] },
  { tag: 'han_che_vai_co_tay', keywords: ['vai', 'cổ tay', 'khuỷu', 'shoulder', 'wrist'] },
  { tag: 'can_than_trong_tim_mach', keywords: ['tim', 'huyết áp', 'đau ngực', 'tức ngực', 'nhịp tim'] },
  { tag: 'can_than_trong_ho_hap', keywords: ['hen', 'hô hấp', 'khó thở', 'asthma'] },
  { tag: 'dang_phuc_hoi_chan_thuong_hoac_phau_thuat', keywords: ['chấn thương', 'phẫu thuật', 'mổ', 'gãy xương', 'surgery', 'fracture'] },
  { tag: 'trieu_chung_can_danh_gia_y_te', keywords: ['chóng mặt', 'ngất', 'mang thai', 'thai kỳ', 'tiểu đường', 'fainting'] },
];

export function toAgeBracket(age: number): string {
  if (!Number.isFinite(age) || age <= 0) return 'unknown';
  if (age < 16) return 'under_16';
  if (age < 18) return '16_17';
  if (age <= 29) return '18_29';
  if (age <= 44) return '30_44';
  if (age <= 60) return '45_60';
  if (age <= 70) return '61_70';
  return 'over_70';
}

export function extractClinicalRiskFlags(
  healthLimitations: string[],
  healthNotes: string
): string[] {
  const combined = `${healthLimitations.join(' ')} ${healthNotes}`.toLowerCase();
  const flags: string[] = [];
  for (const rule of CLINICAL_TAG_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      flags.push(rule.tag);
    }
  }
  return Array.from(new Set(flags));
}

export function stripDirectIdentifiers(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:\+?\d[\d\s\-().]{7,}\d)\b/g, '[redacted-phone]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .trim();
}

export function buildMinimizedAiPayload(
  profile: RawAiProfileSource,
  goal: RawAiGoalSource
): MinimizedAiPayload {
  const bmiEval = evaluateBmi(profile.weightKg, profile.heightCm, profile.age);
  const safetyProfile = evaluateSafetyProfile({
    age: profile.age,
    healthLimitations: profile.healthLimitations,
    healthNotes: profile.healthNotes,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    fitnessLevel: profile.fitnessLevel,
    daysPerWeek: profile.daysPerWeek,
  });

  const cleanLimitations = profile.healthLimitations
    .map((item) => stripDirectIdentifiers(item))
    .filter(Boolean)
    .slice(0, 10);

  const clinicalRiskFlags = extractClinicalRiskFlags(cleanLimitations, profile.healthNotes);
  const hasAdditionalHealthNote = profile.healthNotes.trim().length > 0;

  let bmiSummary = 'Thiếu dữ liệu BMI — áp dụng ngưỡng an toàn mặc định';
  if (bmiEval.status === 'pediatric_notice') {
    bmiSummary = 'Nhóm dưới 18 tuổi — không áp dụng phân loại BMI người lớn (WHO/CDC bách phân vị)';
  } else if (bmiEval.status === 'adult_classified' && bmiEval.value !== null) {
    bmiSummary = `Phân nhóm thể trạng người lớn: ${bmiEval.category}`;
  }

  return {
    ageGroup: safetyProfile.ageGroup,
    ageBracket: toAgeBracket(profile.age),
    isMinor: safetyProfile.isMinor,
    bmiSummary,
    fitnessLevel: profile.fitnessLevel,
    daysPerWeek: profile.daysPerWeek,
    equipment: profile.equipment,
    healthLimitationCategories: cleanLimitations,
    hasAdditionalHealthNote,
    clinicalRiskFlags,
    safetyProfile,
    goal: {
      sport: goal.sport,
      goalType: goal.goalType,
      durationWeeks: goal.durationWeeks,
    },
  };
}
