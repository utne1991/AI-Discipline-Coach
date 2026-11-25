import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeeklyProgress, calculateWeeklySummary } from '../src/components/PlanTab.tsx';
import type { WorkoutDay } from '../src/shared/types.ts';

test('calculateWeeklyProgress computes checked-in days percentage across the week and clamps bounds', () => {
  assert.equal(calculateWeeklyProgress(0, 7), 0);
  assert.equal(calculateWeeklyProgress(1, 7), 14);
  assert.equal(calculateWeeklyProgress(3, 7), 43);
  assert.equal(calculateWeeklyProgress(5, 7), 71);
  assert.equal(calculateWeeklyProgress(7, 7), 100);
  assert.equal(calculateWeeklyProgress(9, 7), 100);
  assert.equal(calculateWeeklyProgress(-1, 7), 0);
  assert.equal(calculateWeeklyProgress(0, 0), 0);
});

test('calculateWeeklySummary explicitly reports day-checkin-only granularity and never claims exercise-level completion', () => {
  const unsortedDays: WorkoutDay[] = [
    {
      dayIndex: 3,
      dayLabel: 'Thứ 4',
      title: 'Tập tim mạch',
      focusArea: 'Sức bền',
      isRestDay: false,
      estimatedMinutes: 30,
      intensity: 'Trung bình',
      warmup: '5 phút',
      cooldown: '5 phút',
      safetyNote: 'An toàn',
      exercises: [
        {
          name: 'Đi bộ nhanh',
          sets: '1 hiệp',
          repsOrDuration: '20 phút',
          restSeconds: 60,
          note: 'Giữ nhịp thở đều',
        },
      ],
    },
    {
      dayIndex: 1,
      dayLabel: 'Thứ 2',
      title: 'Tập toàn thân A',
      focusArea: 'Sức mạnh cơ bản',
      isRestDay: false,
      estimatedMinutes: 45,
      intensity: 'Trung bình',
      warmup: '5 phút',
      cooldown: '5 phút',
      safetyNote: 'An toàn',
      exercises: [
        {
          name: 'Squat cơ bản',
          sets: '3 hiệp',
          repsOrDuration: '12 lần',
          restSeconds: 60,
          note: 'Giữ lưng thẳng',
        },
      ],
    },
    {
      dayIndex: 2,
      dayLabel: 'Thứ 3',
      title: 'Nghỉ phục hồi',
      focusArea: 'Phục hồi',
      isRestDay: true,
      estimatedMinutes: 15,
      intensity: 'Nhẹ',
      warmup: 'Không',
      cooldown: 'Không',
      safetyNote: 'Nghỉ ngơi',
      exercises: [],
    },
  ];

  const noneDone = calculateWeeklySummary(unsortedDays, []);
  assert.equal(noneDone.trackingGranularity, 'day_checkin_only');
  assert.equal(noneDone.exerciseCompletionTracked, false);
  assert.equal(noneDone.estimatedCheckedInMinutes, 0);
  assert.equal(noneDone.totalExerciseMinutes, 0);
  assert.equal(noneDone.plannedExerciseMinutes, 75);
  assert.equal(noneDone.checkedInWorkoutDays, 0);
  assert.equal(noneDone.completedSessions, 0);
  assert.equal(noneDone.totalSessions, 2);
  assert.equal(noneDone.checkedInDaysCount, 0);
  assert.equal(noneDone.totalDaysCount, 3);
  // Output dailyData must be sorted by dayIndex ascending
  assert.deepEqual(
    noneDone.dailyData.map((d) => d.dayIndex),
    [1, 2, 3]
  );

  // Marking day 1 (workout) and day 2 (rest day) checked-in: only workout day counts toward workout check-ins
  const partialDone = calculateWeeklySummary(unsortedDays, [1, 2]);
  assert.equal(partialDone.trackingGranularity, 'day_checkin_only');
  assert.equal(partialDone.exerciseCompletionTracked, false);
  assert.equal(partialDone.checkedInDaysCount, 2);
  assert.equal(partialDone.checkedInWorkoutDays, 1);
  assert.equal(partialDone.estimatedCheckedInMinutes, 45);
  assert.equal(partialDone.totalExerciseMinutes, 45);
  assert.equal(partialDone.completedSessions, 1);
  assert.equal(partialDone.totalSessions, 2);
  assert.equal(partialDone.dailyData[0].completedMinutes, 45);
  assert.equal(partialDone.dailyData[0].remainingMinutes, 0);
  assert.equal(partialDone.dailyData[1].completedMinutes, 0);
  assert.equal(partialDone.dailyData[1].remainingMinutes, 0);
  assert.equal(partialDone.dailyData[2].completedMinutes, 0);
  assert.equal(partialDone.dailyData[2].remainingMinutes, 30);

  const allWorkoutsCheckedIn = calculateWeeklySummary(unsortedDays, [1, 3]);
  assert.equal(allWorkoutsCheckedIn.estimatedCheckedInMinutes, 75);
  assert.equal(allWorkoutsCheckedIn.checkedInWorkoutDays, 2);
  assert.equal(allWorkoutsCheckedIn.exerciseCompletionTracked, false);
});
