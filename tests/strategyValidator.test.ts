import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkoutStrategy,
  type ValidatorGoalContext,
  type ValidatorProfileContext,
} from '../src/services/strategyValidator.ts';

function buildValid7DayPlan(workoutDayIndices: number[], cautious = false) {
  const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  return {
    strategySummary:
      'Chiến lược Tuần 1 tập trung xây dựng thói quen kỷ luật với cường độ phù hợp và kiểm soát kỹ thuật chuẩn.',
    safetyAlert: cautious
      ? 'Chế độ thận trọng đang bật: chỉ tập động tác tác động thấp, dừng ngay nếu đau nhói khớp hoặc chóng mặt và tham khảo ý kiến bác sĩ.'
      : 'Khởi động kỹ trước buổi tập và giữ đúng kỹ thuật ở mọi hiệp tập.',
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
        intensity: cautious ? 'Nhẹ' : 'Trung bình',
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

test('accepts a valid 7-day plan matching daysPerWeek and equipment', () => {
  const plan = buildValid7DayPlan([1, 3, 5], false);
  const res = validateWorkoutStrategy(plan, standardProfile, defaultGoal);
  assert.equal(res.valid, true, `Unexpected errors: ${res.errors.join('; ')}`);
  assert.equal(res.normalizedDays.length, 7);
});

test('rejects invalid JSON shape, missing days, or duplicate dayIndex', () => {
  const notObject = validateWorkoutStrategy('invalid', standardProfile, defaultGoal);
  assert.equal(notObject.valid, false);

  const missingDay = buildValid7DayPlan([1, 3, 5], false);
  missingDay.days.pop();
  assert.equal(validateWorkoutStrategy(missingDay, standardProfile, defaultGoal).valid, false);

  const dupDay = buildValid7DayPlan([1, 3, 5], false);
  dupDay.days[6].dayIndex = 1;
  const dupRes = validateWorkoutStrategy(dupDay, standardProfile, defaultGoal);
  assert.equal(dupRes.valid, false);
  assert.ok(dupRes.errors.some((e) => e.includes('Trùng lặp') || e.includes('Thiếu ngày')));
});

test('rejects mismatched workout day count vs profile.daysPerWeek', () => {
  const plan = buildValid7DayPlan([1, 2, 3, 4], false); // 4 workout days instead of 3
  const res = validateWorkoutStrategy(plan, standardProfile, defaultGoal);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('không khớp')));
});

test('rejects High intensity, short rest, or unsafe exercises in Cautious Mode', () => {
  const cautiousProfile: ValidatorProfileContext = {
    ...standardProfile,
    age: 65,
    healthLimitations: ['Đau khớp gối', 'Tim mạch / Huyết áp'],
  };

  const highIntensityPlan = buildValid7DayPlan([1, 3, 5], true);
  highIntensityPlan.days[0].intensity = 'Cao';
  const highRes = validateWorkoutStrategy(highIntensityPlan, cautiousProfile, defaultGoal);
  assert.equal(highRes.valid, false);
  assert.ok(highRes.errors.some((e) => e.includes('Chế độ thận trọng')));

  const burpeePlan = buildValid7DayPlan([1, 3, 5], true);
  burpeePlan.days[0].exercises[0].name = 'Burpee bật nhảy nhanh';
  const burpeeRes = validateWorkoutStrategy(burpeePlan, cautiousProfile, defaultGoal);
  assert.equal(burpeeRes.valid, false);
  assert.ok(burpeeRes.errors.some((e) => e.includes('tác động mạnh')));

  const shortRestPlan = buildValid7DayPlan([1, 3, 5], true);
  shortRestPlan.days[0].exercises[0].restSeconds = 15;
  const restRes = validateWorkoutStrategy(shortRestPlan, cautiousProfile, defaultGoal);
  assert.equal(restRes.valid, false);
  assert.ok(restRes.errors.some((e) => e.includes('thời gian nghỉ')));
});

test('rejects heavy barbell exercises for youth (<16) and gym machines when equipment=none', () => {
  const youthProfile: ValidatorProfileContext = {
    ...standardProfile,
    age: 14,
    equipment: 'gym',
  };
  const barbellPlan = buildValid7DayPlan([1, 3, 5], true);
  barbellPlan.days[0].exercises[0].name = 'Deadlift với tạ đòn';
  const youthRes = validateWorkoutStrategy(barbellPlan, youthProfile, defaultGoal);
  assert.equal(youthRes.valid, false);
  assert.ok(youthRes.errors.some((e) => e.includes('dưới 16 tuổi')));

  const noneEquipPlan = buildValid7DayPlan([1, 3, 5], false);
  noneEquipPlan.days[0].exercises[0].name = 'Leg Press trên máy';
  const eqRes = validateWorkoutStrategy(noneEquipPlan, standardProfile, defaultGoal);
  assert.equal(eqRes.valid, false);
  assert.ok(eqRes.errors.some((e) => e.includes('Không dụng cụ')));
});

test('rejects invalid sets (>8 or 0) and consecutive workout overload in cautious mode', () => {
  const cautiousProfile: ValidatorProfileContext = {
    ...standardProfile,
    age: 63,
    daysPerWeek: 3,
  };
  const consecutivePlan = buildValid7DayPlan([1, 2, 3], true); // 3 consecutive days without rest
  const consRes = validateWorkoutStrategy(consecutivePlan, cautiousProfile, defaultGoal);
  assert.equal(consRes.valid, false);
  assert.ok(consRes.errors.some((e) => e.includes('liên tiếp')));

  const badSetsPlan = buildValid7DayPlan([1, 3, 5], false);
  badSetsPlan.days[0].exercises[0].sets = '15 hiệp';
  const setsRes = validateWorkoutStrategy(badSetsPlan, standardProfile, defaultGoal);
  assert.equal(setsRes.valid, false);
  assert.ok(setsRes.errors.some((e) => e.includes('số hiệp')));
});
