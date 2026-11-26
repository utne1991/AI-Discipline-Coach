import {
  EQUIPMENT_LABELS,
  FITNESS_LEVEL_LABELS,
  GOAL_LABELS,
  SPORT_LABELS,
  TIME_SLOT_LABELS,
  evaluateSafetyProfile,
  type DailyStrategyTask,
  type EquipmentOption,
  type FeasibilityAssessment,
  type FitnessLevel,
  type GoalData,
  type GoalType,
  type MeasurableGoalSpec,
  type PreferredTimeSlot,
  type SafetyProfile,
  type SchedulePreferences,
  type ScheduledCalendarDay,
  type SportOption,
  type SportVolumePlan,
  type StrategyMilestone,
  type StrategyPhase,
  type StrategyV2Blueprint,
  type WorkoutDay,
} from '../shared/types.ts';

export interface StrategyEngineProfileInput {
  age: number;
  weightKg: number;
  heightCm: number;
  fitnessLevel: FitnessLevel;
  daysPerWeek: number;
  equipment: EquipmentOption;
  healthLimitations: string[];
  healthNotes: string;
}

export interface StrategyEngineGoalInput {
  sport: SportOption;
  sports?: SportOption[];
  goalType: GoalType;
  durationWeeks: number;
  measurableGoal?: MeasurableGoalSpec;
  schedulePreferences?: Partial<SchedulePreferences>;
}

const VALID_SPORTS: SportOption[] = ['running', 'home_workout', 'gym'];
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeSportsList(primarySport: SportOption, sports?: SportOption[]): SportOption[] {
  const unique: SportOption[] = [];
  const raw = Array.isArray(sports) && sports.length > 0 ? sports : [primarySport];
  for (const s of raw) {
    if (VALID_SPORTS.includes(s) && !unique.includes(s)) {
      unique.push(s);
    }
  }
  if (unique.length === 0) {
    unique.push(VALID_SPORTS.includes(primarySport) ? primarySport : 'home_workout');
  }
  return unique.slice(0, 3);
}

export function formatLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalDateKeyInTimezone(date: Date = new Date(), timezone?: string): string {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const year = parts.find((p) => p.type === 'year')?.value;
      const month = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    } catch {
      // Fallback to host local calendar date if IANA timezone string is unsupported
    }
  }
  return formatLocalDateKey(date);
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const safeKey = DATE_KEY_REGEX.test(dateKey) ? dateKey : formatLocalDateKey();
  const [y, m, d] = safeKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Returns ISO weekday index 1 (Monday) .. 7 (Sunday) for a YYYY-MM-DD key.
 */
export function getIsoWeekdayFromDateKey(dateKey: string): number {
  const safeKey = DATE_KEY_REGEX.test(dateKey) ? dateKey : formatLocalDateKey();
  const [y, m, d] = safeKey.split('-').map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

/**
 * Returns the Monday dateKey of the week containing the given dateKey.
 */
export function getWeekStartMondayDateKey(dateKey: string): string {
  const isoWeekday = getIsoWeekdayFromDateKey(dateKey);
  return addDaysToDateKey(dateKey, -(isoWeekday - 1));
}

export function getDefaultMeasurableGoal(
  sport: SportOption,
  goalType: GoalType,
  fitnessLevel: FitnessLevel = 'beginner'
): MeasurableGoalSpec {
  if (sport === 'running') {
    if (goalType === 'endurance') {
      const currentValue = fitnessLevel === 'beginner' ? 1.5 : fitnessLevel === 'intermediate' ? 4 : 8;
      const targetValue = fitnessLevel === 'beginner' ? 5 : fitnessLevel === 'intermediate' ? 10 : 15;
      return {
        metricKey: 'run_distance_km',
        targetLabel: `Chạy liên tục ${targetValue} km đúng nhịp kiểm soát`,
        currentValue,
        targetValue,
        unit: 'km',
      };
    }
    if (goalType === 'weight_loss') {
      return {
        metricKey: 'weight_change_kg',
        targetLabel: 'Giảm 3 kg bền vững kết hợp duy trì nhịp chạy đều',
        currentValue: 0,
        targetValue: 3,
        unit: 'kg',
      };
    }
    return {
      metricKey: 'endurance_minutes',
      targetLabel: 'Chạy bền liên tục 40 phút ổn định nhịp tim',
      currentValue: fitnessLevel === 'beginner' ? 15 : 25,
      targetValue: 40,
      unit: 'phút',
    };
  }

  if (sport === 'gym') {
    if (goalType === 'muscle_gain') {
      const currentValue = fitnessLevel === 'beginner' ? 2 : 3;
      const targetValue = fitnessLevel === 'beginner' ? 4 : 5;
      return {
        metricKey: 'weekly_sessions',
        targetLabel: `Duy trì đều ${targetValue} buổi kháng lực chuẩn kỹ thuật mỗi tuần`,
        currentValue,
        targetValue,
        unit: 'buổi/tuần',
      };
    }
    if (goalType === 'weight_loss') {
      return {
        metricKey: 'weight_change_kg',
        targetLabel: 'Giảm 4 kg mỡ thừa và giữ sức mạnh cơ bản',
        currentValue: 0,
        targetValue: 4,
        unit: 'kg',
      };
    }
    return {
      metricKey: 'endurance_minutes',
      targetLabel: 'Hoàn thành 45 phút tập kháng lực + cardio liên tục không hụt hơi',
      currentValue: fitnessLevel === 'beginner' ? 20 : 30,
      targetValue: 45,
      unit: 'phút',
    };
  }

  // home_workout
  if (goalType === 'weight_loss') {
    return {
      metricKey: 'weight_change_kg',
      targetLabel: 'Giảm 3.5 kg ổn định nhờ kỷ luật tập tại nhà',
      currentValue: 0,
      targetValue: 3.5,
      unit: 'kg',
    };
  }
  if (goalType === 'muscle_gain') {
    const currentValue = fitnessLevel === 'beginner' ? 8 : fitnessLevel === 'intermediate' ? 18 : 30;
    const targetValue = fitnessLevel === 'beginner' ? 20 : fitnessLevel === 'intermediate' ? 35 : 50;
    return {
      metricKey: 'strength_reps',
      targetLabel: `Hoàn thành ${targetValue} lần chống đẩy / squat chuẩn kỹ thuật tích lũy`,
      currentValue,
      targetValue,
      unit: 'lần',
    };
  }
  return {
    metricKey: 'endurance_minutes',
    targetLabel: 'Duy trì 35 phút vận động toàn thân liên tục ổn định nhịp thở',
    currentValue: fitnessLevel === 'beginner' ? 15 : 25,
    targetValue: 35,
    unit: 'phút',
  };
}

export function normalizeSchedulePreferences(
  prefs?: Partial<SchedulePreferences>,
  referenceDate: Date = new Date()
): SchedulePreferences {
  const timezone =
    typeof prefs?.timezone === 'string' && prefs.timezone.trim().length > 0
      ? prefs.timezone.trim().slice(0, 64)
      : 'Asia/Ho_Chi_Minh';
  const startDateKey =
    typeof prefs?.startDateKey === 'string' && DATE_KEY_REGEX.test(prefs.startDateKey)
      ? prefs.startDateKey
      : getLocalDateKeyInTimezone(referenceDate, timezone);
  const preferredTimeSlot: PreferredTimeSlot =
    prefs?.preferredTimeSlot === 'morning' ||
    prefs?.preferredTimeSlot === 'noon' ||
    prefs?.preferredTimeSlot === 'evening'
      ? prefs.preferredTimeSlot
      : 'evening';
  const rawBudget = Number(prefs?.minutesPerSessionBudget);
  const minutesPerSessionBudget =
    Number.isFinite(rawBudget) && rawBudget >= 20 && rawBudget <= 90 ? Math.round(rawBudget) : 40;
  const preferredDays = Array.isArray(prefs?.preferredDays)
    ? Array.from(
        new Set(
          prefs.preferredDays
            .map((d) => Math.round(Number(d)))
            .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
        )
      ).sort((a, b) => a - b)
    : undefined;

  return {
    startDateKey,
    timezone,
    preferredTimeSlot,
    minutesPerSessionBudget,
    ...(preferredDays && preferredDays.length > 0 ? { preferredDays } : {}),
  };
}

/**
 * Deterministic Baseline & Feasibility Assessment Engine (100% independent of LLM output).
 */
export function assessGoalFeasibility(
  profile: StrategyEngineProfileInput,
  goal: StrategyEngineGoalInput,
  safetyProfileInput?: SafetyProfile
): FeasibilityAssessment {
  const safety =
    safetyProfileInput ??
    evaluateSafetyProfile({
      age: profile.age,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      fitnessLevel: profile.fitnessLevel,
      daysPerWeek: profile.daysPerWeek,
      healthLimitations: profile.healthLimitations,
      healthNotes: profile.healthNotes,
    });

  const sports = normalizeSportsList(goal.sport, goal.sports);
  const measurable =
    goal.measurableGoal ?? getDefaultMeasurableGoal(sports[0], goal.goalType, profile.fitnessLevel);
  const durationWeeks = Math.max(4, Math.min(12, Math.round(goal.durationWeeks || 8)));
  const delta = Math.max(0, Number(measurable.targetValue) - Number(measurable.currentValue));
  const ratePerWeek = delta / durationWeeks;

  const adjustments: string[] = [];
  let score = 88;
  let recommendedDurationWeeks = durationWeeks;

  if (measurable.metricKey === 'weight_change_kg') {
    // Safe evidence-based weight loss rate: <= 0.75 kg/week standard, <= 0.5 kg/week in cautious/minor mode
    const safeMaxRate = safety.cautiousMode || safety.isMinor ? 0.45 : 0.75;
    if (ratePerWeek > safeMaxRate) {
      const neededWeeks = Math.min(12, Math.ceil(delta / safeMaxRate));
      recommendedDurationWeeks = Math.max(durationWeeks, neededWeeks);
      score -= Math.min(38, Math.round(((ratePerWeek - safeMaxRate) / safeMaxRate) * 35));
      adjustments.push(
        `Tốc độ thay đổi ${ratePerWeek.toFixed(2)} kg/tuần vượt ngưỡng bền vững (${safeMaxRate} kg/tuần). Đề xuất kéo dài lên ${recommendedDurationWeeks} tuần hoặc giảm mục tiêu xuống ${(safeMaxRate * durationWeeks).toFixed(1)} kg.`
      );
    }
    if (safety.isMinor) {
      score = Math.min(score, 62);
      adjustments.push(
        'Người dưới 18 tuổi không nên ép giảm cân nhanh; chuyển trọng tâm sang tăng vận động lành mạnh và kỷ luật sinh hoạt.'
      );
    }
  } else if (measurable.metricKey === 'run_distance_km') {
    const safeMaxKmGainPerWeek =
      profile.fitnessLevel === 'beginner' || safety.cautiousMode ? 0.75 : profile.fitnessLevel === 'intermediate' ? 1.25 : 1.8;
    if (ratePerWeek > safeMaxKmGainPerWeek) {
      recommendedDurationWeeks = Math.min(12, Math.max(durationWeeks, Math.ceil(delta / safeMaxKmGainPerWeek)));
      score -= Math.min(35, Math.round(((ratePerWeek - safeMaxKmGainPerWeek) / safeMaxKmGainPerWeek) * 30));
      adjustments.push(
        `Tăng cự ly trung bình +${ratePerWeek.toFixed(2)} km/tuần khá dốc so với nền tảng hiện tại. Khuyến nghị tăng tiến độ từng tuần <= 10–15% để tránh đau ống đồng và khớp gối.`
      );
    }
  } else if (measurable.metricKey === 'strength_reps') {
    const safeMaxRepsGain = profile.fitnessLevel === 'beginner' ? 3.5 : 5;
    if (ratePerWeek > safeMaxRepsGain) {
      recommendedDurationWeeks = Math.min(12, Math.max(durationWeeks, Math.ceil(delta / safeMaxRepsGain)));
      score -= 20;
      adjustments.push(
        `Tăng +${ratePerWeek.toFixed(1)} lần/tuần cần kiểm soát kỹ thuật chặt, ưu tiên chia nhỏ nhiều hiệp chất lượng.`
      );
    }
  } else if (measurable.metricKey === 'endurance_minutes') {
    const safeMaxMinGain = profile.fitnessLevel === 'beginner' ? 5 : 8;
    if (ratePerWeek > safeMaxMinGain) {
      recommendedDurationWeeks = Math.min(12, Math.max(durationWeeks, Math.ceil(delta / safeMaxMinGain)));
      score -= 18;
      adjustments.push(
        `Tăng thời lượng liên tục +${ratePerWeek.toFixed(1)} phút/tuần cần phân bổ xen kẽ ngày phục hồi chủ động.`
      );
    }
  }

  if (profile.daysPerWeek < 2) {
    score -= 15;
    adjustments.push('Tần suất 1 buổi/tuần chỉ đủ duy trì; nên hướng tới ít nhất 3 buổi/tuần để thấy tiến bộ đo lường rõ.');
  }
  if (sports.length >= 2 && profile.daysPerWeek < sports.length) {
    score -= 15;
    adjustments.push(
      `Bạn chọn ${sports.length} môn nhưng lịch hiện có ${profile.daysPerWeek} buổi/tuần; hệ thống sẽ xoay vòng môn tập theo chu kỳ tuần.`
    );
  }
  if (sports.includes('gym') && profile.equipment === 'none') {
    score -= 18;
    adjustments.push(
      'Bạn chọn môn Gym nhưng hồ sơ ghi "Không dụng cụ" — hệ thống sẽ điều chỉnh bài tập kháng lực thể trọng tương đương hoặc bạn cần cập nhật dụng cụ ở tab Hồ sơ.'
    );
  }
  if (safety.requiresMedicalClearance) {
    score = Math.min(score, 65);
    adjustments.push(
      'Hồ sơ có yếu tố sức khỏe cần đánh giá chuyên môn: bắt buộc ưu tiên Chế độ thận trọng và tham khảo ý kiến bác sĩ trước khi tăng tải.'
    );
  }

  const clampedScore = Math.max(30, Math.min(98, Math.round(score)));
  let status: FeasibilityAssessment['status'] = 'feasible';
  if (safety.requiresMedicalClearance || safety.isMinor) {
    status = 'caution_required';
  } else if (clampedScore < 70 || recommendedDurationWeeks > durationWeeks) {
    status = 'ambitious_adjust';
  }

  const levelLabel = FITNESS_LEVEL_LABELS[profile.fitnessLevel]?.label ?? profile.fitnessLevel;
  const sportNames = sports.map((s) => SPORT_LABELS[s]?.label ?? s).join(' + ');
  const baselineSummary = `Hiện tại: trình độ ${levelLabel}, lịch ${profile.daysPerWeek} buổi/tuần (${EQUIPMENT_LABELS[profile.equipment]?.label ?? profile.equipment}), chỉ số nền ${measurable.currentValue} ${measurable.unit} cho nhóm môn ${sportNames}.`;

  const weeklyDeltaRequired =
    delta > 0
      ? `+${ratePerWeek.toFixed(2)} ${measurable.unit}/tuần trong ${durationWeeks} tuần`
      : `Duy trì ổn định ${measurable.targetValue} ${measurable.unit} trong ${durationWeeks} tuần`;

  let rationale = `Mục tiêu "${measurable.targetLabel}" có mức độ khả thi cao (${clampedScore}/100) với nhịp tăng tiến an toàn trong ${durationWeeks} tuần.`;
  if (status === 'caution_required') {
    rationale = `Mục tiêu cần triển khai theo Chế độ thận trọng (${clampedScore}/100) để bảo vệ an toàn độ tuổi/sức khỏe trước khi theo đuổi thành tích.`;
  } else if (status === 'ambitious_adjust') {
    rationale = `Mục tiêu khá tham vọng (${clampedScore}/100) so với thời hạn ${durationWeeks} tuần; cần giữ nhịp tích lũy kỷ luật và sẵn sàng điều chỉnh biên độ ở mốc đánh giá Tuần 2.`;
  }

  return {
    status,
    score: clampedScore,
    baselineSummary,
    weeklyDeltaRequired,
    recommendedDurationWeeks,
    rationale,
    adjustments,
  };
}

/**
 * Calculates deterministic, sport-specific weekly training volume strictly bounded by SafetyProfile.loadLimits.
 */
export function calculateSportVolumeAllocation(
  profile: StrategyEngineProfileInput,
  goal: StrategyEngineGoalInput,
  safetyProfileInput?: SafetyProfile
): SportVolumePlan[] {
  const safety =
    safetyProfileInput ??
    evaluateSafetyProfile({
      age: profile.age,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      fitnessLevel: profile.fitnessLevel,
      daysPerWeek: profile.daysPerWeek,
      healthLimitations: profile.healthLimitations,
      healthNotes: profile.healthNotes,
    });

  const sports = normalizeSportsList(goal.sport, goal.sports);
  const prefs = normalizeSchedulePreferences(goal.schedulePreferences);
  const sessionMinutesCap = Math.min(
    prefs.minutesPerSessionBudget,
    safety.loadLimits.maxSessionMinutes
  );

  // Distribute profile.daysPerWeek across selected sports deterministically
  const totalSessions = Math.max(1, Math.min(7, profile.daysPerWeek));
  const totalWeeklyMinutesBudget = Math.min(
    totalSessions * sessionMinutesCap,
    safety.loadLimits.maxWeeklyMinutes
  );

  const sessionCounts = sports.map((_, idx) => {
    const base = Math.floor(totalSessions / sports.length);
    const remainder = totalSessions % sports.length;
    return Math.max(idx === 0 ? 1 : 0, base + (idx < remainder ? 1 : 0));
  });
  // Normalize sum strictly to totalSessions
  let allocatedSessions = sessionCounts.reduce((a, b) => a + b, 0);
  let cursor = sessionCounts.length - 1;
  while (allocatedSessions > totalSessions && cursor >= 0) {
    if (sessionCounts[cursor] > 0) {
      sessionCounts[cursor] -= 1;
      allocatedSessions -= 1;
    }
    cursor -= 1;
  }

  const intensityDistribution = safety.loadLimits.allowHighIntensity
    ? profile.fitnessLevel === 'advanced'
      ? '65% Nhẹ/Nền · 25% Trung bình · 10% Cao kiểm soát'
      : '75% Nhẹ/Nền · 20% Trung bình · 5% Cao kiểm soát'
    : '80% Nhẹ kiểm soát · 20% Trung bình (khóa cường độ Cao vì quy tắc an toàn)';

  return sports.map((sport, idx) => {
    const sessions = sessionCounts[idx];
    const ratio = totalSessions > 0 ? sessions / totalSessions : 1 / sports.length;
    const weeklyMinutes = Math.max(
      sessions > 0 ? 15 : 0,
      Math.min(
        Math.round(totalWeeklyMinutesBudget * ratio),
        sessions * safety.loadLimits.maxSessionMinutes
      )
    );

    let volumeMetricLabel = '';
    let rationale = '';

    if (sport === 'running') {
      const kmPerMinute =
        safety.cautiousMode || profile.fitnessLevel === 'beginner'
          ? 0.11
          : profile.fitnessLevel === 'intermediate'
            ? 0.14
            : 0.16;
      const estimatedKm = Math.max(1.5, Math.round(weeklyMinutes * kmPerMinute * 10) / 10);
      volumeMetricLabel = `~${estimatedKm} km/tuần (${weeklyMinutes} phút nhịp bền)`;
      rationale =
        'Tính từ tốc độ chạy/đi bộ nhanh an toàn ở vùng nhịp tim nói chuyện được (Zone 2), giới hạn tăng tối đa 10% mỗi tuần.';
    } else if (sport === 'gym') {
      const setsPerSession = Math.min(
        safety.loadLimits.maxDailySets,
        safety.cautiousMode ? 10 : profile.fitnessLevel === 'beginner' ? 12 : 16
      );
      const weeklySets = Math.min(
        Math.round(safety.loadLimits.maxWeeklySets * ratio),
        sessions * setsPerSession
      );
      volumeMetricLabel = `${weeklySets} hiệp kháng lực/tuần (${weeklyMinutes} phút)`;
      rationale =
        'Phân bổ số hiệp hiệu dụng (effective sets) cho nhóm cơ chính, giới hạn bởi trần hiệp an toàn theo độ tuổi và phục hồi.';
    } else {
      const setsPerSession = Math.min(
        safety.loadLimits.maxDailySets,
        safety.cautiousMode ? 9 : profile.fitnessLevel === 'beginner' ? 11 : 14
      );
      const weeklySets = Math.min(
        Math.round(safety.loadLimits.maxWeeklySets * ratio),
        sessions * setsPerSession
      );
      volumeMetricLabel = `${weeklySets} hiệp thể trọng/tuần (${weeklyMinutes} phút)`;
      rationale =
        'Ưu tiên nhịp thực hiện chậm có kiểm soát kỹ thuật (bodyweight/home), giữ biên độ khớp an toàn và dễ duy trì kỷ luật hằng ngày.';
    }

    return {
      sport,
      sportLabel: SPORT_LABELS[sport]?.label ?? sport,
      sessionsPerWeek: sessions,
      weeklyMinutes,
      volumeMetricLabel,
      intensityDistribution,
      rationale,
    };
  });
}

/**
 * Divides the full goal duration (4..12 weeks) into contiguous, non-overlapping phases and measurable milestones.
 */
export function buildMultiPhaseRoadmap(
  durationWeeks: number,
  measurable: MeasurableGoalSpec,
  volumes: SportVolumePlan[],
  safety: SafetyProfile
): { phases: StrategyPhase[]; milestones: StrategyMilestone[] } {
  const totalWeeks = Math.max(4, Math.min(12, Math.round(durationWeeks || 8)));
  const totalWeeklyMinutes = volumes.reduce((sum, v) => sum + v.weeklyMinutes, 0);
  const delta = Math.max(0, measurable.targetValue - measurable.currentValue);

  const phases: StrategyPhase[] = [];
  const milestones: StrategyMilestone[] = [];

  if (totalWeeks <= 5) {
    const p1End = 2;
    phases.push(
      {
        phaseNumber: 1,
        name: 'Giai đoạn 1: Xây nền kỷ luật & Chuẩn hóa kỹ thuật',
        weekStart: 1,
        weekEnd: p1End,
        objective: 'Thiết lập thói quen ra sân đúng giờ, làm chủ kỹ thuật thở và biên độ khớp an toàn.',
        weeklyVolumeTarget: `${Math.round(totalWeeklyMinutes * 0.85)}–${totalWeeklyMinutes} phút/tuần`,
        milestone: `Hoàn thành >= 80% số buổi cam kết và chạm mốc ${(measurable.currentValue + delta * 0.4).toFixed(1)} ${measurable.unit}.`,
      },
      {
        phaseNumber: 2,
        name: 'Giai đoạn 2: Tích lũy ổn định & Hoàn tất mục tiêu',
        weekStart: p1End + 1,
        weekEnd: totalWeeks,
        objective: 'Tăng nhẹ khối lượng có kiểm soát, củng cố nhịp kỷ luật và kiểm chứng chỉ số đích.',
        weeklyVolumeTarget: `${totalWeeklyMinutes}–${Math.min(safety.loadLimits.maxWeeklyMinutes, Math.round(totalWeeklyMinutes * 1.1))} phút/tuần`,
        milestone: `Đạt mục tiêu ${measurable.targetValue} ${measurable.unit} và duy trì check-in ổn định.`,
      }
    );
  } else {
    const p1End = Math.max(2, Math.floor(totalWeeks * 0.3));
    const p2End = Math.max(p1End + 2, totalWeeks - Math.max(1, Math.floor(totalWeeks * 0.25)));
    phases.push(
      {
        phaseNumber: 1,
        name: 'Giai đoạn 1: Khởi động kỷ luật & Nền tảng kỹ thuật',
        weekStart: 1,
        weekEnd: p1End,
        objective: 'Ổn định lịch sinh hoạt, kiểm soát kỹ thuật từng động tác và xây dựng chuỗi check-in không đứt quãng.',
        weeklyVolumeTarget: `${Math.round(totalWeeklyMinutes * 0.85)}–${totalWeeklyMinutes} phút/tuần`,
        milestone: `Chạm mốc ${(measurable.currentValue + delta * 0.25).toFixed(1)} ${measurable.unit} với >= 80% tỷ lệ check-in.`,
      },
      {
        phaseNumber: 2,
        name: 'Giai đoạn 2: Tích lũy khối lượng & Nâng sức chịu đựng',
        weekStart: p1End + 1,
        weekEnd: p2End,
        objective: 'Tăng dần khối lượng trong trần an toàn, kết hợp các môn đã chọn và theo dõi sát tín hiệu phục hồi.',
        weeklyVolumeTarget: `${totalWeeklyMinutes}–${Math.min(safety.loadLimits.maxWeeklyMinutes, Math.round(totalWeeklyMinutes * 1.12))} phút/tuần`,
        milestone: `Đạt ${(measurable.currentValue + delta * 0.7).toFixed(1)} ${measurable.unit} mà không xuất hiện đau khớp kéo dài.`,
      },
      {
        phaseNumber: 3,
        name: 'Giai đoạn 3: Chinh phục cột mốc & Giảm tải phục hồi (Deload)',
        weekStart: p2End + 1,
        weekEnd: totalWeeks,
        objective: 'Tối ưu hiệu suất tại cột mốc đích, giảm tải hợp lý tuần cuối để củng cố thói quen bền vững.',
        weeklyVolumeTarget: `${Math.round(totalWeeklyMinutes * 0.9)}–${totalWeeklyMinutes} phút/tuần`,
        milestone: `Chinh phục mục tiêu ${measurable.targetValue} ${measurable.unit} (${measurable.targetLabel}).`,
      }
    );
  }

  // Deterministic checkpoints
  milestones.push({
    weekNumber: Math.min(2, totalWeeks),
    title: 'Cột mốc Tuần 2 — Kiểm chứng kỷ luật khởi đầu',
    measurableCheck: `Tỷ lệ check-in >= 80% lịch cam kết; chỉ số tiến gần ${(measurable.currentValue + delta * 0.25).toFixed(1)} ${measurable.unit}`,
    passCriteria: 'Không đau khớp sau tập 24h, duy trì đúng khung giờ rảnh đã chọn.',
  });

  const midWeek = Math.max(3, Math.ceil(totalWeeks / 2));
  if (midWeek < totalWeeks) {
    milestones.push({
      weekNumber: midWeek,
      title: `Cột mốc Tuần ${midWeek} — Đánh giá giữa lộ trình`,
      measurableCheck: `Đạt tối thiểu ${(measurable.currentValue + delta * 0.55).toFixed(1)} ${measurable.unit}`,
      passCriteria: 'RPE trung bình <= 7/10, hoàn thành >= 75% cam kết hằng ngày.',
    });
  }

  milestones.push({
    weekNumber: totalWeeks,
    title: `Cột mốc Tuần ${totalWeeks} — Nghiệm thu mục tiêu`,
    measurableCheck: `Hoàn thành mục tiêu ${measurable.targetValue} ${measurable.unit}`,
    passCriteria: 'Tự đo lại chỉ số nền, tổng kết chuỗi tuần kỷ luật và thiết lập chu kỳ mới.',
  });

  return { phases, milestones };
}

/**
 * Maps the 7-day weekly schedule onto real local calendar dates based on startDateKey & timezone.
 */
export function buildCalendarScheduleContext(
  schedule: WorkoutDay[],
  prefs: SchedulePreferences
): StrategyV2Blueprint['calendarContext'] {
  const weekMonday = getWeekStartMondayDateKey(prefs.startDateKey);
  const slotInfo = TIME_SLOT_LABELS[prefs.preferredTimeSlot] ?? TIME_SLOT_LABELS.evening;

  const sorted = [...schedule].sort((a, b) => a.dayIndex - b.dayIndex);
  const scheduledDays: ScheduledCalendarDay[] = sorted.map((day) => ({
    dayIndex: day.dayIndex,
    dateKey: addDaysToDateKey(weekMonday, day.dayIndex - 1),
    dayLabel: day.dayLabel,
    timeWindow: day.isRestDay ? 'Linh hoạt trong ngày' : slotInfo.window,
    isRestDay: day.isRestDay,
  }));

  return {
    startDateKey: prefs.startDateKey,
    timezone: prefs.timezone,
    preferredTimeSlot: prefs.preferredTimeSlot,
    timeWindowLabel: `${slotInfo.label} (${slotInfo.window})`,
    minutesPerSessionBudget: prefs.minutesPerSessionBudget,
    scheduledDays,
  };
}

/**
 * Generates actionable daily strategy tasks derived directly from the 7-day schedule & real dates.
 */
export function generateDailyStrategyTasks(
  schedule: WorkoutDay[],
  calendarContext: StrategyV2Blueprint['calendarContext'],
  measurable: MeasurableGoalSpec
): DailyStrategyTask[] {
  const dateByDayIndex = new Map(calendarContext.scheduledDays.map((d) => [d.dayIndex, d]));
  const tasks: DailyStrategyTask[] = [];

  const sorted = [...schedule].sort((a, b) => a.dayIndex - b.dayIndex);
  for (const day of sorted) {
    const cal = dateByDayIndex.get(day.dayIndex);
    const dateKey = cal?.dateKey ?? calendarContext.startDateKey;

    if (day.isRestDay) {
      tasks.push(
        {
          id: `day-${day.dayIndex}-recovery`,
          dayIndex: day.dayIndex,
          dateKey,
          category: 'recovery',
          title: `Phục hồi chủ động: ${day.title}`,
          detail: `${day.cooldown} Uống đủ nước và ngủ đúng giờ để sẵn sàng buổi tập tiếp theo.`,
          estimatedMinutes: Math.max(10, day.estimatedMinutes || 15),
        },
        {
          id: `day-${day.dayIndex}-discipline`,
          dayIndex: day.dayIndex,
          dateKey,
          category: 'discipline',
          title: 'Kiểm tra phục hồi & ghi nhận cảm giác cơ thể',
          detail: 'Đánh giá nhanh mức mỏi cơ, giấc ngủ và chuẩn bị đồ tập cho buổi kế tiếp.',
          estimatedMinutes: 5,
        }
      );
    } else {
      tasks.push(
        {
          id: `day-${day.dayIndex}-training`,
          dayIndex: day.dayIndex,
          dateKey,
          category: 'training',
          title: `Hoàn thành buổi tập: ${day.title}`,
          detail: `Khung giờ ${cal?.timeWindow ?? calendarContext.timeWindowLabel} · Cường độ ${day.intensity} · Trọng tâm ${day.focusArea}.`,
          estimatedMinutes: day.estimatedMinutes,
        },
        {
          id: `day-${day.dayIndex}-measurement`,
          dayIndex: day.dayIndex,
          dateKey,
          category: 'measurement',
          title: 'Check-in ngày tập & tự chấm RPE sau buổi',
          detail: `Ghi nhận check-in trung thực để theo dõi tiến độ hướng tới ${measurable.targetValue} ${measurable.unit}.`,
          estimatedMinutes: 3,
        }
      );
    }
  }

  return tasks;
}

export function resolveTodayScheduledDay(
  schedule: WorkoutDay[],
  strategyV2?: StrategyV2Blueprint,
  referenceDate: Date = new Date()
): {
  todayDateKey: string;
  todayIsoWeekday: number;
  day: WorkoutDay | null;
  scheduledDay: ScheduledCalendarDay | null;
  tasks: DailyStrategyTask[];
} {
  const timezone = strategyV2?.calendarContext?.timezone;
  const todayDateKey = getLocalDateKeyInTimezone(referenceDate, timezone);
  const todayIsoWeekday = getIsoWeekdayFromDateKey(todayDateKey);

  const scheduledByDate = strategyV2?.calendarContext?.scheduledDays.find(
    (d) => d.dateKey === todayDateKey
  );
  const targetDayIndex = scheduledByDate?.dayIndex ?? todayIsoWeekday;
  const day =
    schedule.find((d) => d.dayIndex === targetDayIndex) ??
    schedule.find((d) => d.dayIndex === todayIsoWeekday) ??
    schedule[0] ??
    null;

  const scheduledDay =
    scheduledByDate ??
    strategyV2?.calendarContext?.scheduledDays.find((d) => d.dayIndex === day?.dayIndex) ??
    null;

  const tasks =
    strategyV2?.dailyCommitments.filter(
      (t) => t.dateKey === todayDateKey || (day && t.dayIndex === day.dayIndex)
    ) ?? [];

  // Deduplicate if matched by both dateKey and dayIndex
  const uniqueTasks = Array.from(new Map(tasks.map((t) => [t.id, t])).values());

  return {
    todayDateKey,
    todayIsoWeekday,
    day,
    scheduledDay,
    tasks: uniqueTasks,
  };
}

/**
 * Assembles the complete Sprint 02 StrategyV2Blueprint, merging optional AI narrative overrides
 * while keeping safety rules, feasibility math, volume caps, and calendar mapping deterministic.
 */
export function buildStrategyV2Blueprint(params: {
  profile: StrategyEngineProfileInput;
  goal: StrategyEngineGoalInput;
  schedule: WorkoutDay[];
  aiNarrativeOverrides?: Partial<{
    ultimateGoal: string;
    currentPosition: string;
    todayDirective: string;
    reassessmentSchedule: string;
    adjustmentSignals: string[];
    stopAndEscalateCriteria: string[];
  }>;
  referenceDate?: Date;
}): StrategyV2Blueprint {
  const { profile, goal, schedule, aiNarrativeOverrides, referenceDate = new Date() } = params;
  const safety = evaluateSafetyProfile({
    age: profile.age,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    fitnessLevel: profile.fitnessLevel,
    daysPerWeek: profile.daysPerWeek,
    healthLimitations: profile.healthLimitations,
    healthNotes: profile.healthNotes,
  });

  const sports = normalizeSportsList(goal.sport, goal.sports);
  const measurableGoal =
    goal.measurableGoal ?? getDefaultMeasurableGoal(sports[0], goal.goalType, profile.fitnessLevel);
  const prefs = normalizeSchedulePreferences(goal.schedulePreferences, referenceDate);

  const feasibility = assessGoalFeasibility(profile, { ...goal, sports, measurableGoal }, safety);
  const volumeAllocation = calculateSportVolumeAllocation(
    profile,
    { ...goal, sports, measurableGoal, schedulePreferences: prefs },
    safety
  );
  const { phases, milestones } = buildMultiPhaseRoadmap(
    goal.durationWeeks,
    measurableGoal,
    volumeAllocation,
    safety
  );
  const calendarContext = buildCalendarScheduleContext(schedule, prefs);
  const dailyCommitments = generateDailyStrategyTasks(schedule, calendarContext, measurableGoal);

  const sportNames = sports.map((s) => SPORT_LABELS[s]?.label ?? s).join(' + ');
  const goalLabel = GOAL_LABELS[goal.goalType]?.label ?? goal.goalType;

  const defaultUltimateGoal = `Đạt mục tiêu "${measurableGoal.targetLabel}" (${measurableGoal.currentValue} -> ${measurableGoal.targetValue} ${measurableGoal.unit}) trong ${goal.durationWeeks} tuần qua nhóm môn ${sportNames} (${goalLabel}), xây dựng kỷ luật thực hiện đều ${profile.daysPerWeek} buổi/tuần.`;

  const defaultCurrentPosition = `${feasibility.baselineSummary} ${
    safety.cautiousMode
      ? `Chế độ thận trọng đang kích hoạt (${safety.cautionReasons[0] ?? 'ưu tiên an toàn tải tập'}).`
      : 'Thể trạng ổn định cho lộ trình tăng tiến chuẩn.'
  }`;

  const todayInfo = resolveTodayScheduledDay(schedule, undefined, referenceDate);
  const defaultTodayDirective = todayInfo.day
    ? todayInfo.day.isRestDay
      ? `Hôm nay (${todayInfo.day.dayLabel}, ${todayInfo.todayDateKey}) là ngày phục hồi chủ động: ${todayInfo.day.title} (${todayInfo.day.estimatedMinutes} phút) để tái tạo cơ bắp và giữ chuỗi kỷ luật.`
      : `Hôm nay (${todayInfo.day.dayLabel}, ${todayInfo.todayDateKey}) thực hiện "${todayInfo.day.title}" trong khung giờ ${calendarContext.timeWindowLabel} (${todayInfo.day.estimatedMinutes} phút, cường độ ${todayInfo.day.intensity}) rồi check-in ngay sau buổi.`
    : `Hoàn thành cam kết kỷ luật hôm nay trong khung giờ ${calendarContext.timeWindowLabel}.`;

  const reassessmentWeek = Math.min(2, goal.durationWeeks);
  const reassessmentDate = addDaysToDateKey(prefs.startDateKey, reassessmentWeek * 7);
  const defaultReassessmentSchedule = `Đánh giá lại sau Tuần ${reassessmentWeek} (dự kiến ${reassessmentDate}) và cuối mỗi giai đoạn (${phases.map((p) => `Tuần ${p.weekEnd}`).join(', ')}).`;

  const defaultAdjustmentSignals = [
    'Tỷ lệ check-in buổi tập thực tế theo tuần (nếu < 60% trong 2 tuần liên tiếp -> giảm số buổi hoặc thu gọn thời lượng mỗi buổi).',
    'Mức độ gắng sức cảm nhận (RPE 1–10) và nhịp tim khi vận động (nếu RPE >= 8 liên tục -> giữ nguyên hoặc giảm tải 15%).',
    'Tín hiệu phục hồi: chất lượng giấc ngủ, độ đau nhức cơ/khớp sau 24–48 giờ.',
    'Tỷ lệ hoàn thành cam kết mục tiêu nhỏ hằng ngày và tiến triển chỉ số đo lường thực tế.',
  ];

  const defaultStopCriteria: string[] = [
    'Dừng tập ngay lập tức nếu xuất hiện đau nhói khớp, tức ngực, chóng mặt, buồn nôn, khó thở bất thường hoặc tê bì cột sống.',
    'Chuyển sang chế độ phục hồi nhẹ (Deload) 3–5 ngày nếu mệt mỏi kéo dài, đau cơ không giảm sau 72 giờ hoặc mất ngủ liên tiếp.',
  ];
  if (safety.isMinor) {
    defaultStopCriteria.push(
      'Người dưới 18 tuổi bắt buộc có sự theo dõi của phụ huynh hoặc người giám hộ; dừng ngay nếu kỹ thuật bị sai lệch hoặc mệt quá sức.'
    );
  }
  if (safety.requiresMedicalClearance || safety.cautiousMode) {
    defaultStopCriteria.push(
      'Tham khảo bác sĩ hoặc chuyên gia vật lý trị liệu trước khi tăng khối lượng tập nếu có triệu chứng tái phát từ giới hạn sức khỏe.'
    );
  }

  const pickNonEmpty = (candidate: string | undefined, fallback: string) =>
    typeof candidate === 'string' && candidate.trim().length >= 15 ? candidate.trim() : fallback;

  const pickNonEmptyList = (candidate: string[] | undefined, fallback: string[]) => {
    const cleaned = Array.isArray(candidate)
      ? candidate.map((s) => String(s).trim()).filter((s) => s.length >= 8)
      : [];
    return cleaned.length >= 2 ? cleaned.slice(0, 6) : fallback;
  };

  // Ensure stop criteria ALWAYS retain mandatory minor/medical safety escalation even when AI provides narrative text
  const mergedStopCriteria = pickNonEmptyList(
    aiNarrativeOverrides?.stopAndEscalateCriteria,
    defaultStopCriteria
  );
  if (
    safety.isMinor &&
    !mergedStopCriteria.some((line) => /(phụ huynh|giám hộ|guardian|parent)/i.test(line))
  ) {
    mergedStopCriteria.push(
      'Người dưới 18 tuổi bắt buộc dừng tập và trao đổi với phụ huynh / người giám hộ nếu cảm thấy quá sức hoặc đau khớp.'
    );
  }
  if (
    safety.requiresMedicalClearance &&
    !mergedStopCriteria.some((line) => /(bác sĩ|chuyên gia y tế|vật lý trị liệu|doctor)/i.test(line))
  ) {
    mergedStopCriteria.push(
      'Hồ sơ có yếu tố cần đánh giá chuyên môn: bắt buộc tham khảo bác sĩ hoặc chuyên gia y tế trước khi tiếp tục hoặc tăng tải.'
    );
  }

  return {
    engineVersion: '2.0',
    sports,
    measurableGoal,
    feasibility,
    ultimateGoal: pickNonEmpty(aiNarrativeOverrides?.ultimateGoal, defaultUltimateGoal),
    currentPosition: pickNonEmpty(aiNarrativeOverrides?.currentPosition, defaultCurrentPosition),
    phases,
    milestones,
    volumeAllocation,
    todayDirective: pickNonEmpty(aiNarrativeOverrides?.todayDirective, defaultTodayDirective),
    reassessmentSchedule: pickNonEmpty(
      aiNarrativeOverrides?.reassessmentSchedule,
      defaultReassessmentSchedule
    ),
    adjustmentSignals: pickNonEmptyList(
      aiNarrativeOverrides?.adjustmentSignals,
      defaultAdjustmentSignals
    ),
    stopAndEscalateCriteria: mergedStopCriteria,
    calendarContext,
    dailyCommitments,
  };
}

export function buildDefaultGoalForSprint2(
  base?: Partial<GoalData>,
  fitnessLevel: FitnessLevel = 'beginner',
  timezone = 'Asia/Ho_Chi_Minh'
): GoalData {
  const primarySport: SportOption = base?.sport ?? 'home_workout';
  const sports = normalizeSportsList(primarySport, base?.sports);
  const goalType: GoalType = base?.goalType ?? 'weight_loss';
  const durationWeeks = base?.durationWeeks ?? 8;

  return {
    sport: sports[0],
    sports,
    goalType,
    durationWeeks,
    measurableGoal:
      base?.measurableGoal ?? getDefaultMeasurableGoal(sports[0], goalType, fitnessLevel),
    schedulePreferences: normalizeSchedulePreferences({
      timezone,
      ...base?.schedulePreferences,
    }),
    updatedAt: base?.updatedAt,
  };
}
