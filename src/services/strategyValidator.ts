import {
  evaluateCautionStatus,
  type EquipmentOption,
  type FitnessLevel,
  type GoalType,
  type SportOption,
  type WorkoutDay,
} from '../shared/types.ts';

export interface ValidatorProfileContext {
  age: number;
  weightKg: number;
  heightCm: number;
  fitnessLevel: FitnessLevel;
  daysPerWeek: number;
  equipment: EquipmentOption;
  healthLimitations: string[];
  healthNotes: string;
}

export interface ValidatorGoalContext {
  sport: SportOption;
  goalType: GoalType;
  durationWeeks: number;
}

export interface RawStrategyPayload {
  strategySummary?: unknown;
  safetyAlert?: unknown;
  coachPrinciples?: unknown;
  days?: unknown;
}

export interface StrategyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedDays: WorkoutDay[];
}

const VALID_INTENSITIES = new Set(['Nhẹ', 'Trung bình', 'Cao']);

const CAUTIOUS_BANNED_TERMS = [
  'burpee',
  'box jump',
  'jump squat',
  'jump lunge',
  'plyometric',
  'bật nhảy',
  'nhảy cóc',
  'chạy nước rút',
  'sprint',
  '1rm',
  'tạ tối đa',
  'hiit tối đa',
  'tabata tối đa',
  'clean and jerk',
  'snatch',
  'muscle up',
  'nhảy dây tốc độ cao',
];

const YOUTH_BANNED_TERMS = [
  'tạ đòn',
  'barbell',
  'deadlift',
  '1rm',
  'bench press nặng',
  'back squat tạ',
  'leg press nặng',
  'clean and jerk',
  'snatch',
];

const SENIOR_BANNED_TERMS = [
  'box jump',
  'burpee',
  'bật nhảy',
  'chạy nước rút',
  'sprint',
  'handstand',
  'trồng chuối',
  'jump squat',
];

const LIMITATION_BANNED_RULES: Array<{ match: string; banned: string[]; reason: string }> = [
  {
    match: 'gối',
    banned: [
      'jump squat',
      'jump lunge',
      'box jump',
      'bật nhảy',
      'pistol squat',
      'deep squat nặng',
      'squat tạ nặng',
      'leg extension nặng',
      'chạy xuống dốc',
    ],
    reason: 'giới hạn khớp gối',
  },
  {
    match: 'lưng',
    banned: [
      'deadlift',
      'good morning',
      'barbell row',
      'sit-up',
      'gập bụng gắt',
      'hyperextension nặng',
    ],
    reason: 'giới hạn lưng / cột sống',
  },
  {
    match: 'vai',
    banned: [
      'handstand',
      'trồng chuối',
      'overhead press nặng',
      'dip sâu',
      'chống đẩy bật',
      'burpee',
    ],
    reason: 'giới hạn vai / cổ tay',
  },
  {
    match: 'tim',
    banned: [
      'hiit',
      'tabata',
      'sprint',
      'chạy nước rút',
      'valsalva',
      'nhịn thở',
      'cường độ tối đa',
    ],
    reason: 'giới hạn tim mạch / huyết áp',
  },
  {
    match: 'hô hấp',
    banned: ['sprint', 'chạy nước rút', 'hiit cường độ cao', 'tabata tối đa'],
    reason: 'giới hạn hô hấp / hen suyễn',
  },
];

const NONE_EQUIPMENT_BANNED = [
  'tạ đòn',
  'barbell',
  'tạ đơn',
  'dumbbell',
  'kettlebell',
  'leg press',
  'smith machine',
  'lat pulldown',
  'cable',
  'máy kéo',
  'máy đẩy',
];

const HOME_EQUIPMENT_BANNED = [
  'leg press',
  'smith machine',
  'hack squat',
  'cable crossover',
  'lat pulldown machine',
  'máy kéo cáp phòng gym',
];

function isNonEmptyString(val: unknown, minLen = 1): val is string {
  return typeof val === 'string' && val.trim().length >= minLen;
}

function parseMaxSets(setsText: string): number | null {
  const matches = setsText.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const nums = matches.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function findBannedMatch(haystack: string, terms: string[]): string | null {
  const lower = haystack.toLowerCase();
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}

export function validateWorkoutStrategy(
  rawPlan: unknown,
  profile: ValidatorProfileContext,
  goal: ValidatorGoalContext
): StrategyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedDays: WorkoutDay[] = [];

  if (!rawPlan || typeof rawPlan !== 'object' || Array.isArray(rawPlan)) {
    return {
      valid: false,
      errors: ['Dữ liệu kế hoạch không phải JSON object hợp lệ.'],
      warnings,
      normalizedDays,
    };
  }

  const payload = rawPlan as RawStrategyPayload;

  if (!isNonEmptyString(payload.strategySummary, 10)) {
    errors.push('Thiếu tóm tắt chiến lược hợp lệ (strategySummary).');
  }

  const { cautiousMode } = evaluateCautionStatus(
    profile.age,
    profile.healthLimitations,
    profile.healthNotes,
    profile.weightKg,
    profile.heightCm
  );

  if (!isNonEmptyString(payload.safetyAlert, cautiousMode ? 30 : 12)) {
    errors.push(
      cautiousMode
        ? 'Chế độ thận trọng bắt buộc phải có cảnh báo an toàn (safetyAlert) chi tiết (>= 30 ký tự).'
        : 'Thiếu nội dung lưu ý an toàn (safetyAlert).'
    );
  }

  if (
    !Array.isArray(payload.coachPrinciples) ||
    payload.coachPrinciples.length === 0 ||
    payload.coachPrinciples.some((p) => !isNonEmptyString(p, 5))
  ) {
    errors.push('Danh sách nguyên tắc kỷ luật (coachPrinciples) không hợp lệ hoặc bị trống.');
  }

  if (!Array.isArray(payload.days) || payload.days.length !== 7) {
    errors.push(
      `Lịch tập tuần phải có đúng 7 ngày (nhận được ${Array.isArray(payload.days) ? payload.days.length : 0} ngày).`
    );
    return { valid: false, errors, warnings, normalizedDays };
  }

  const seenDayIndices = new Set<number>();
  let workoutDayCount = 0;
  let consecutiveWorkoutDays = 0;
  let maxConsecutiveWorkoutDays = 0;
  let consecutiveHighIntensityDays = 0;

  const combinedLimitationsText =
    `${profile.healthLimitations.join(' ')} ${profile.healthNotes}`.toLowerCase();

  for (let i = 0; i < payload.days.length; i++) {
    const rawDay = payload.days[i];
    if (!rawDay || typeof rawDay !== 'object' || Array.isArray(rawDay)) {
      errors.push(`Ngày thứ ${i + 1} không phải cấu trúc object hợp lệ.`);
      continue;
    }

    const day = rawDay as Record<string, unknown>;
    const dayIndex = Number(day.dayIndex);

    if (!Number.isInteger(dayIndex) || dayIndex < 1 || dayIndex > 7) {
      errors.push(`dayIndex không hợp lệ (${String(day.dayIndex)}); phải từ 1 đến 7.`);
    } else if (seenDayIndices.has(dayIndex)) {
      errors.push(`Trùng lặp ngày tập dayIndex=${dayIndex}.`);
    } else {
      seenDayIndices.add(dayIndex);
    }

    if (typeof day.isRestDay !== 'boolean') {
      errors.push(`Ngày ${dayIndex || i + 1} thiếu cờ isRestDay kiểu boolean.`);
    }
    const isRestDay = day.isRestDay === true;

    if (!isNonEmptyString(day.dayLabel, 2)) {
      errors.push(`Ngày ${dayIndex || i + 1} thiếu nhãn ngày (dayLabel).`);
    }
    if (!isNonEmptyString(day.title, 2)) {
      errors.push(`Ngày ${dayIndex || i + 1} thiếu tiêu đề buổi tập (title).`);
    }
    if (!isNonEmptyString(day.focusArea, 2)) {
      errors.push(`Ngày ${dayIndex || i + 1} thiếu trọng tâm (focusArea).`);
    }
    if (!isNonEmptyString(day.warmup, 4)) {
      errors.push(`Ngày ${dayIndex || i + 1} thiếu hướng dẫn khởi động (warmup).`);
    }
    if (!isNonEmptyString(day.cooldown, 4)) {
      errors.push(`Ngày ${dayIndex || i + 1} thiếu hướng dẫn giãn cơ (cooldown).`);
    }
    if (!isNonEmptyString(day.safetyNote, 6)) {
      errors.push(`Ngày ${dayIndex || i + 1} thiếu ghi chú an toàn (safetyNote).`);
    }

    const intensity = String(day.intensity ?? '');
    if (!VALID_INTENSITIES.has(intensity)) {
      errors.push(
        `Ngày ${dayIndex || i + 1} có cường độ không hợp lệ ("${intensity}"); chỉ chấp nhận Nhẹ, Trung bình, Cao.`
      );
    }

    if (cautiousMode && intensity === 'Cao') {
      errors.push(
        `Ngày ${dayIndex || i + 1} có cường độ "Cao", vi phạm giới hạn an toàn của Chế độ thận trọng.`
      );
    }
    if (isRestDay && VALID_INTENSITIES.has(intensity) && intensity !== 'Nhẹ') {
      errors.push(`Ngày nghỉ ${dayIndex || i + 1} phải có cường độ "Nhẹ".`);
    }

    const estimatedMinutes = Number(day.estimatedMinutes);
    if (!Number.isFinite(estimatedMinutes) || !Number.isInteger(estimatedMinutes)) {
      errors.push(`Ngày ${dayIndex || i + 1} có thời lượng (estimatedMinutes) không hợp lệ.`);
    } else if (isRestDay) {
      if (estimatedMinutes < 0 || estimatedMinutes > 35) {
        errors.push(
          `Ngày nghỉ ${dayIndex || i + 1} có thời lượng quá dài (${estimatedMinutes} phút; tối đa 35 phút phục hồi nhẹ).`
        );
      }
    } else {
      const maxMinutes = cautiousMode ? 60 : 120;
      if (estimatedMinutes < 15 || estimatedMinutes > maxMinutes) {
        errors.push(
          `Ngày tập ${dayIndex || i + 1} có thời lượng ${estimatedMinutes} phút, vượt ngưỡng an toàn (15–${maxMinutes} phút).`
        );
      }
    }

    if (isRestDay) {
      consecutiveWorkoutDays = 0;
      consecutiveHighIntensityDays = 0;
    } else {
      workoutDayCount += 1;
      consecutiveWorkoutDays += 1;
      maxConsecutiveWorkoutDays = Math.max(maxConsecutiveWorkoutDays, consecutiveWorkoutDays);
      if (intensity === 'Cao') {
        consecutiveHighIntensityDays += 1;
        if (consecutiveHighIntensityDays >= 3) {
          errors.push(
            `Ngày ${dayIndex || i + 1}: có từ 3 ngày liên tiếp cường độ "Cao", thiếu thời gian phục hồi an toàn.`
          );
        }
      } else {
        consecutiveHighIntensityDays = 0;
      }
    }

    if (!Array.isArray(day.exercises)) {
      errors.push(`Ngày ${dayIndex || i + 1} thiếu mảng exercises.`);
      continue;
    }

    if (!isRestDay && (day.exercises.length < 1 || day.exercises.length > 8)) {
      errors.push(
        `Ngày tập ${dayIndex || i + 1} phải có từ 1 đến 8 bài tập (hiện có ${day.exercises.length}).`
      );
    }
    if (isRestDay && day.exercises.length > 2) {
      errors.push(
        `Ngày nghỉ ${dayIndex || i + 1} chỉ được gợi ý tối đa 2 hoạt động phục hồi nhẹ (hiện có ${day.exercises.length}).`
      );
    }

    const validatedExercises = [];
    for (let j = 0; j < day.exercises.length; j++) {
      const rawEx = day.exercises[j];
      if (!rawEx || typeof rawEx !== 'object' || Array.isArray(rawEx)) {
        errors.push(`Ngày ${dayIndex || i + 1}, bài ${j + 1}: cấu trúc bài tập không hợp lệ.`);
        continue;
      }
      const ex = rawEx as Record<string, unknown>;
      const exName = isNonEmptyString(ex.name, 2) ? ex.name.trim() : '';
      const exSets = isNonEmptyString(ex.sets, 1) ? ex.sets.trim() : '';
      const exReps = isNonEmptyString(ex.repsOrDuration, 1) ? ex.repsOrDuration.trim() : '';
      const exNote = isNonEmptyString(ex.note, 3) ? ex.note.trim() : '';
      const restSeconds = Number(ex.restSeconds);

      if (!exName) {
        errors.push(`Ngày ${dayIndex || i + 1}, bài ${j + 1}: thiếu tên bài tập.`);
      }
      if (!exSets) {
        errors.push(`Ngày ${dayIndex || i + 1}, bài ${j + 1}: thiếu số hiệp (sets).`);
      } else {
        const parsedSets = parseMaxSets(exSets);
        const maxAllowedSets = cautiousMode ? 5 : 8;
        if (parsedSets === null || parsedSets < 1 || parsedSets > maxAllowedSets) {
          errors.push(
            `Ngày ${dayIndex || i + 1}, bài "${exName || j + 1}": số hiệp "${exSets}" vượt giới hạn (1–${maxAllowedSets}).`
          );
        }
      }
      if (!exReps) {
        errors.push(
          `Ngày ${dayIndex || i + 1}, bài "${exName || j + 1}": thiếu số lần hoặc thời lượng.`
        );
      }
      if (!Number.isFinite(restSeconds) || !Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 300) {
        errors.push(
          `Ngày ${dayIndex || i + 1}, bài "${exName || j + 1}": thời gian nghỉ (${String(ex.restSeconds)} giây) không hợp lệ (0–300 giây).`
        );
      } else if (!isRestDay && cautiousMode && restSeconds < 45) {
        errors.push(
          `Ngày ${dayIndex || i + 1}, bài "${exName || j + 1}": thời gian nghỉ ${restSeconds} giây quá ngắn cho Chế độ thận trọng (tối thiểu 45 giây).`
        );
      }
      if (!exNote) {
        errors.push(`Ngày ${dayIndex || i + 1}, bài "${exName || j + 1}": thiếu ghi chú kỹ thuật/an toàn.`);
      }

      const textToScan = `${exName} ${exNote} ${String(day.title ?? '')}`;

      if (cautiousMode) {
        const hit = findBannedMatch(textToScan, CAUTIOUS_BANNED_TERMS);
        if (hit) {
          errors.push(
            `Ngày ${dayIndex || i + 1}, bài "${exName}": chứa động tác tác động mạnh ("${hit}") không phù hợp với Chế độ thận trọng.`
          );
        }
      }

      if (Number.isFinite(profile.age) && profile.age > 0 && profile.age < 16) {
        const hit = findBannedMatch(textToScan, YOUTH_BANNED_TERMS);
        if (hit) {
          errors.push(
            `Ngày ${dayIndex || i + 1}, bài "${exName}": chứa bài tập tạ nặng ("${hit}") không an toàn cho người dưới 16 tuổi.`
          );
        }
      }

      if (Number.isFinite(profile.age) && profile.age > 60) {
        const hit = findBannedMatch(textToScan, SENIOR_BANNED_TERMS);
        if (hit) {
          errors.push(
            `Ngày ${dayIndex || i + 1}, bài "${exName}": chứa động tác rủi ro ("${hit}") không an toàn cho người trên 60 tuổi.`
          );
        }
      }

      for (const rule of LIMITATION_BANNED_RULES) {
        if (combinedLimitationsText.includes(rule.match)) {
          const hit = findBannedMatch(textToScan, rule.banned);
          if (hit) {
            errors.push(
              `Ngày ${dayIndex || i + 1}, bài "${exName}": bài tập "${hit}" xung đột với ${rule.reason}.`
            );
          }
        }
      }

      if (profile.equipment === 'none') {
        const hit = findBannedMatch(exName, NONE_EQUIPMENT_BANNED);
        if (hit) {
          errors.push(
            `Ngày ${dayIndex || i + 1}, bài "${exName}": yêu cầu dụng cụ ("${hit}") trong khi người dùng chọn Không dụng cụ.`
          );
        }
      } else if (profile.equipment === 'home') {
        const hit = findBannedMatch(exName, HOME_EQUIPMENT_BANNED);
        if (hit) {
          errors.push(
            `Ngày ${dayIndex || i + 1}, bài "${exName}": yêu cầu máy phòng gym ("${hit}") không phù hợp thiết bị Tại nhà.`
          );
        }
      }

      validatedExercises.push({
        name: exName,
        sets: exSets,
        repsOrDuration: exReps,
        restSeconds: Number.isFinite(restSeconds) ? restSeconds : 60,
        note: exNote,
      });
    }

    normalizedDays.push({
      dayIndex,
      dayLabel: String(day.dayLabel ?? '').trim(),
      isRestDay,
      title: String(day.title ?? '').trim(),
      focusArea: String(day.focusArea ?? '').trim(),
      estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : 0,
      intensity: (VALID_INTENSITIES.has(intensity) ? intensity : 'Nhẹ') as
        | 'Nhẹ'
        | 'Trung bình'
        | 'Cao',
      warmup: String(day.warmup ?? '').trim(),
      cooldown: String(day.cooldown ?? '').trim(),
      safetyNote: String(day.safetyNote ?? '').trim(),
      exercises: validatedExercises,
    });
  }

  for (let d = 1; d <= 7; d++) {
    if (!seenDayIndices.has(d)) {
      errors.push(`Thiếu ngày dayIndex=${d} trong lịch tuần.`);
    }
  }

  if (workoutDayCount !== profile.daysPerWeek) {
    errors.push(
      `Số ngày tập chính (${workoutDayCount}) không khớp với lịch đăng ký (${profile.daysPerWeek} ngày/tuần).`
    );
  }

  if (cautiousMode && profile.daysPerWeek <= 4 && maxConsecutiveWorkoutDays > 2) {
    errors.push(
      `Chế độ thận trọng với <= 4 buổi/tuần không được xếp ${maxConsecutiveWorkoutDays} ngày tập liên tiếp mà không xen kẽ ngày nghỉ phục hồi.`
    );
  }

  if (goal.sport === 'running' && profile.fitnessLevel === 'beginner' && workoutDayCount >= 6) {
    warnings.push(
      'Người mới chạy bộ tập 6–7 ngày/tuần nên giữ phần lớn buổi ở mức đi bộ nhanh hoặc chạy rất chậm để tránh quá tải ống đồng.'
    );
  }

  normalizedDays.sort((a, b) => a.dayIndex - b.dayIndex);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedDays,
  };
}
