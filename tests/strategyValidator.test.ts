import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRepsOrDuration,
  validateWorkoutStrategy,
  type ValidatorGoalContext,
  type ValidatorProfileContext,
} from '../src/services/strategyValidator.ts';

function buildValid7DayPlan(
  workoutDayIndices: number[],
  options?: { cautious?: boolean; minor?: boolean; medical?: boolean }
) {
  const cautious = Boolean(options?.cautious);
  const minor = Boolean(options?.minor);
  const medical = Boolean(options?.medical);

  const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  let safetyAlert = 'Khởi động kỹ trước buổi tập và giữ đúng kỹ thuật ở mọi hiệp tập.';
  if (minor) {
    safetyAlert =
      'Người dưới 18 tuổi cần có sự đồng ý và giám sát của phụ huynh / người giám hộ. Ưu tiên kỹ thuật thể trọng chuẩn và dừng ngay nếu mệt.';
  } else if (medical || cautious) {
    safetyAlert =
      'Chế độ thận trọng đang bật: chỉ tập động tác tác động thấp, dừng ngay nếu đau nhói khớp hoặc chóng mặt và tham khảo ý kiến bác sĩ chuyên môn.';
  }

  return {
    strategySummary:
      'Chiến lược Tuần 1 tập trung xây dựng thói quen kỷ luật với cường độ phù hợp và kiểm soát kỹ thuật chuẩn.',
    safetyAlert,
    coachPrinciples: [
      'Hoàn thành đúng lịch trước khi tăng độ khó.',
      'Ngủ đủ giấc và uống đủ nước mỗi ngày.',
      'Ưu tiên kỹ thuật chuẩn hơn tốc độ.',
    ],
    days: labels.map((dayLabel, idx) => {
      const dayIndex = idx + 1;
      const isWorkout = workoutDayIndices.includes(dayIndex);
      if (!isWorkout) {
        return {
          dayIndex,
          dayLabel,
          isRestDay: true,
          title: 'Nghỉ phục hồi chủ động',
          focusArea: 'Thư giãn khớp & hít thở',
          estimatedMinutes: 15,
          intensity: 'Nhẹ',
          warmup: 'Đi lại nhẹ nhàng trong nhà 5 phút.',
          cooldown: 'Hít thở sâu thư giãn 5 phút.',
          safetyNote: 'Không tập nặng trong ngày nghỉ để cơ thể phục hồi.',
          exercises: [
            {
              name: 'Giãn cơ toàn thân nhẹ',
              sets: '1 hiệp',
              repsOrDuration: '10 phút',
              restSeconds: 0,
              note: 'Kéo giãn nhẹ nhàng không gây đau.',
            },
          ],
        };
      }
      return {
        dayIndex,
        dayLabel,
        isRestDay: false,
        title: 'Buổi tập nền tảng cơ bản',
        focusArea: 'Toàn thân kiểm soát',
        estimatedMinutes: 35,
        intensity: cautious || minor || medical ? 'Nhẹ' : 'Trung bình',
        warmup: 'Xoay khớp cổ tay, vai, hông và đi bộ tại chỗ 8 phút.',
        cooldown: 'Giãn cơ nhẹ kết hợp thở chậm 5 phút.',
        safetyNote: 'Giữ lưng thẳng, dừng ngay nếu thấy khó chịu ở khớp.',
        exercises: [
          {
            name: 'Đứng lên ngồi xuống ghế chậm (Chair Squat)',
            sets: '3 hiệp',
            repsOrDuration: '10 lần',
            restSeconds: 60,
            note: 'Hạ chậm trong 3 giây, gối không vượt mũi chân.',
          },
          {
            name: 'Chống đẩy tường (Wall Push-up)',
            sets: '3 hiệp',
            repsOrDuration: '12 lần',
            restSeconds: 60,
            note: 'Siết nhẹ cơ bụng và thở đều khi đẩy.',
          },
        ],
      };
    }),
  };
}

const standardProfile: ValidatorProfileContext = {
  age: 28,
  weightKg: 66,
  heightCm: 170,
  fitnessLevel: 'beginner',
  daysPerWeek: 3,
  equipment: 'none',
  healthLimitations: [],
  healthNotes: '',
};

const defaultGoal: ValidatorGoalContext = {
  sport: 'home_workout',
  goalType: 'weight_loss',
  durationWeeks: 8,
};

test('parseRepsOrDuration extracts reps and duration units accurately', () => {
  assert.deepEqual(parseRepsOrDuration('10-12 lần'), { kind: 'reps', maxValue: 12 });
  assert.deepEqual(parseRepsOrDuration('45 giây'), { kind: 'seconds', maxValue: 45 });
  assert.deepEqual(parseRepsOrDuration('20 phút'), { kind: 'minutes', maxValue: 20 });
  assert.deepEqual(parseRepsOrDuration('15 reps'), { kind: 'reps', maxValue: 15 });
});

test('accepts a valid 7-day plan matching daysPerWeek and equipment', () => {
  const plan = buildValid7DayPlan([1, 3, 5]);
  const res = validateWorkoutStrategy(plan, standardProfile, defaultGoal);
  assert.equal(res.valid, true, `Unexpected errors: ${res.errors.join('; ')}`);
  assert.equal(res.normalizedDays.length, 7);
});

test('rejects invalid JSON shape, missing days, or duplicate dayIndex', () => {
  const notObject = validateWorkoutStrategy('invalid', standardProfile, defaultGoal);
  assert.equal(notObject.valid, false);

  const missingDay = buildValid7DayPlan([1, 3, 5]);
  missingDay.days.pop();
  assert.equal(validateWorkoutStrategy(missingDay, standardProfile, defaultGoal).valid, false);

  const dupDay = buildValid7DayPlan([1, 3, 5]);
  dupDay.days[6].dayIndex = 1;
  const dupRes = validateWorkoutStrategy(dupDay, standardProfile, defaultGoal);
  assert.equal(dupRes.valid, false);
  assert.ok(dupRes.errors.some((e) => e.includes('Trùng lặp') || e.includes('Thiếu ngày')));
});

test('rejects mismatched workout day count vs profile.daysPerWeek', () => {
  const plan = buildValid7DayPlan([1, 2, 3, 4]); // 4 workout days instead of 3
  const res = validateWorkoutStrategy(plan, standardProfile, defaultGoal);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('không khớp')));
});

test('sorts days by dayIndex BEFORE evaluating consecutive workout day limits', () => {
  const cautiousProfile: ValidatorProfileContext = {
    ...standardProfile,
    age: 63,
    daysPerWeek: 3,
  };
  // Workout days are 1, 2, 3 (3 consecutive days — violates cautious max 2),
  // but AI returns the array out of order so adjacent items in raw JSON are not consecutive.
  const consecutivePlan = buildValid7DayPlan([1, 2, 3], { cautious: true });
  consecutivePlan.days = [
    consecutivePlan.days[0], // day 1 (workout)
    consecutivePlan.days[4], // day 5 (rest)
    consecutivePlan.days[1], // day 2 (workout)
    consecutivePlan.days[5], // day 6 (rest)
    consecutivePlan.days[2], // day 3 (workout)
    consecutivePlan.days[3], // day 4 (rest)
    consecutivePlan.days[6], // day 7 (rest)
  ];

  const res = validateWorkoutStrategy(consecutivePlan, cautiousProfile, defaultGoal);
  assert.equal(res.valid, false);
  assert.ok(
    res.errors.some((e) => e.includes('liên tiếp')),
    `Expected consecutive-day error even with unsorted days, got: ${res.errors.join('; ')}`
  );
  // Also confirm normalizedDays is sorted chronologically 1..7
  assert.deepEqual(
    res.normalizedDays.map((d) => d.dayIndex),
    [1, 2, 3, 4, 5, 6, 7]
  );
});

test('rejects High intensity, short rest, or unsafe exercises in Cautious Mode', () => {
  const cautiousProfile: ValidatorProfileContext = {
    ...standardProfile,
    age: 65,
    healthLimitations: ['Đau khớp gối', 'Tim mạch / Huyết áp'],
  };

  const highIntensityPlan = buildValid7DayPlan([1, 3, 5], { cautious: true, medical: true });
  highIntensityPlan.days[0].intensity = 'Cao';
  const highRes = validateWorkoutStrategy(highIntensityPlan, cautiousProfile, defaultGoal);
  assert.equal(highRes.valid, false);
  assert.ok(highRes.errors.some((e) => e.includes('Chế độ thận trọng') || e.includes('giới hạn')));

  const burpeePlan = buildValid7DayPlan([1, 3, 5], { cautious: true, medical: true });
  burpeePlan.days[0].exercises[0].name = 'Burpee bật nhảy nhanh';
  const burpeeRes = validateWorkoutStrategy(burpeePlan, cautiousProfile, defaultGoal);
  assert.equal(burpeeRes.valid, false);
  assert.ok(burpeeRes.errors.some((e) => e.includes('tác động mạnh')));

  const shortRestPlan = buildValid7DayPlan([1, 3, 5], { cautious: true, medical: true });
  shortRestPlan.days[0].exercises[0].restSeconds = 15;
  const restRes = validateWorkoutStrategy(shortRestPlan, cautiousProfile, defaultGoal);
  assert.equal(restRes.valid, false);
  assert.ok(restRes.errors.some((e) => e.includes('thời gian nghỉ')));
});

test('enforces rep limits, per-exercise duration, daily sets, and weekly training load caps', () => {
  const excessRepsPlan = buildValid7DayPlan([1, 3, 5]);
  excessRepsPlan.days[0].exercises[0].repsOrDuration = '120 lần';
  const repsRes = validateWorkoutStrategy(excessRepsPlan, standardProfile, defaultGoal);
  assert.equal(repsRes.valid, false);
  assert.ok(repsRes.errors.some((e) => e.includes('số lần')));

  const excessExerciseDurationPlan = buildValid7DayPlan([1, 3, 5]);
  excessExerciseDurationPlan.days[0].exercises[0].repsOrDuration = '95 phút';
  const durRes = validateWorkoutStrategy(excessExerciseDurationPlan, standardProfile, defaultGoal);
  assert.equal(durRes.valid, false);
  assert.ok(durRes.errors.some((e) => e.includes('thời lượng bài')));

  const excessDailySetsPlan = buildValid7DayPlan([1, 3, 5]);
  excessDailySetsPlan.days[0].exercises = [
    { name: 'Squat', sets: '5 hiệp', repsOrDuration: '10 lần', restSeconds: 60, note: 'OK' },
    { name: 'Push-up', sets: '5 hiệp', repsOrDuration: '10 lần', restSeconds: 60, note: 'OK' },
    { name: 'Lunge', sets: '5 hiệp', repsOrDuration: '10 lần', restSeconds: 60, note: 'OK' },
    { name: 'Plank', sets: '5 hiệp', repsOrDuration: '30 giây', restSeconds: 60, note: 'OK' },
  ]; // 20 sets in one day > beginner cap (16)
  const dailySetsRes = validateWorkoutStrategy(excessDailySetsPlan, standardProfile, defaultGoal);
  assert.equal(dailySetsRes.valid, false);
  assert.ok(dailySetsRes.errors.some((e) => e.includes('tổng khối lượng')));
});

test('enforces dedicated safety rules for youth (<16), teen (16-17), and medical clearance profiles', () => {
  const youthProfile: ValidatorProfileContext = {
    ...standardProfile,
    age: 14,
    equipment: 'gym',
  };
  const barbellPlan = buildValid7DayPlan([1, 3, 5], { cautious: true, minor: true });
  barbellPlan.days[0].exercises[0].name = 'Deadlift với tạ đòn';
  const youthRes = validateWorkoutStrategy(barbellPlan, youthProfile, defaultGoal);
  assert.equal(youthRes.valid, false);
  assert.ok(youthRes.errors.some((e) => e.includes('dưới 16 tuổi')));

  const teenProfile: ValidatorProfileContext = {
    ...standardProfile,
    age: 17,
    fitnessLevel: 'intermediate',
    equipment: 'gym',
  };
  const teen1RmPlan = buildValid7DayPlan([1, 3, 5], { cautious: true, minor: true });
  teen1RmPlan.days[0].exercises[0].name = 'Thử sức 1RM Bench Press';
  const teenRes = validateWorkoutStrategy(teen1RmPlan, teenProfile, defaultGoal);
  assert.equal(teenRes.valid, false);
  assert.ok(teenRes.errors.some((e) => e.includes('vị thành niên')));

  const teenMissingGuardianAlert = buildValid7DayPlan([1, 3, 5], { cautious: true, minor: false });
  const teenAlertRes = validateWorkoutStrategy(teenMissingGuardianAlert, teenProfile, defaultGoal);
  assert.equal(teenAlertRes.valid, false);
  assert.ok(teenAlertRes.errors.some((e) => e.includes('phụ huynh') || e.includes('giám hộ')));

  const medicalProfile: ValidatorProfileContext = {
    ...standardProfile,
    age: 45,
    healthLimitations: ['Tim mạch / Huyết áp'],
  };
  const missingDoctorAlert = buildValid7DayPlan([1, 3, 5], { cautious: true, medical: false });
  missingDoctorAlert.safetyAlert = 'Tập nhẹ nhàng và hít thở đều trong suốt buổi tập.';
  const medRes = validateWorkoutStrategy(missingDoctorAlert, medicalProfile, defaultGoal);
  assert.equal(medRes.valid, false);
  assert.ok(medRes.errors.some((e) => e.includes('bác sĩ') || e.includes('y tế')));

  const noneEquipPlan = buildValid7DayPlan([1, 3, 5]);
  noneEquipPlan.days[0].exercises[0].name = 'Leg Press trên máy';
  const eqRes = validateWorkoutStrategy(noneEquipPlan, standardProfile, defaultGoal);
  assert.equal(eqRes.valid, false);
  assert.ok(eqRes.errors.some((e) => e.includes('Không dụng cụ')));
});
