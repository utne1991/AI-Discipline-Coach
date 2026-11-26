import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOverallDisciplineProgress,
  getIsoWeekKey,
} from '../src/lib/overallProgress.ts';
import type { DailyGoalData } from '../src/lib/dailyGoal.ts';
import type { WorkoutPlanData } from '../src/shared/types.ts';

function makePlan(params: {
  id: number;
  createdAt: string;
  workoutDayIndices: number[];
  completedDays: number[];
}): WorkoutPlanData {
  const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  return {
    id: params.id,
    weekNumber: 1,
    sport: 'home_workout',
    goalType: 'endurance',
    durationWeeks: 8,
    cautiousMode: false,
    cautionReasons: [],
    safetyAlert: 'Khởi động kỹ.',
    strategySummary: 'Tập đều đặn.',
    coachPrinciples: ['Giữ kỷ luật'],
    completedDays: params.completedDays,
    createdAt: params.createdAt,
    scheduleJson: labels.map((dayLabel, idx) => {
      const dayIndex = idx + 1;
      const isRestDay = !params.workoutDayIndices.includes(dayIndex);
      return {
        dayIndex,
        dayLabel,
        isRestDay,
        title: isRestDay ? 'Nghỉ phục hồi' : `Buổi tập ${dayIndex}`,
        focusArea: 'Toàn thân',
        estimatedMinutes: isRestDay ? 15 : 35,
        intensity: isRestDay ? 'Nhẹ' : 'Trung bình',
        warmup: 'Xoay khớp 5 phút',
        cooldown: 'Giãn cơ 5 phút',
        safetyNote: 'Giữ kỹ thuật chuẩn',
        exercises: [],
      };
    }),
  };
}

test('calculateOverallDisciplineProgress computes disciplined weeks, consecutive weeks, and average workout completion rate', () => {
  // Reference date: Wednesday Nov 25, 2026 (ISO week 2026-W48)
  const refDate = new Date(2026, 10, 25, 9, 0, 0);
  assert.equal(getIsoWeekKey(refDate), '2026-W48');

  const plans: WorkoutPlanData[] = [
    // Week 47 (Nov 16, 2026): 3 workout days, 3 checked in -> 100%
    makePlan({
      id: 1,
      createdAt: '2026-11-16T08:00:00.000Z',
      workoutDayIndices: [1, 3, 5],
      completedDays: [1, 3, 5],
    }),
    // Week 48 (Nov 23, 2026): 4 workout days, 2 checked in (plus rest day 2 ignored for workout rate) -> 50%
    makePlan({
      id: 2,
      createdAt: '2026-11-23T08:00:00.000Z',
      workoutDayIndices: [1, 3, 5, 6],
      completedDays: [1, 2, 3],
    }),
  ];

  const goals: DailyGoalData[] = [
    // Week 46 (Nov 10, 2026): completed micro-goal -> adds a 3rd disciplined week
    { dateKey: '2026-11-10', title: 'Uống 2L nước', completed: true },
    // Week 48 (Nov 24, 25): 2 completed, 1 pending
    { dateKey: '2026-11-24', title: 'Đi bộ 15 phút', completed: true },
    { dateKey: '2026-11-25', title: 'Ngủ trước 23:00', completed: true },
    { dateKey: '2026-11-23', title: 'Đọc sách', completed: false },
  ];

  const metrics = calculateOverallDisciplineProgress({
    plans,
    allDailyGoals: goals,
    goalDurationWeeks: 8,
    referenceDate: refDate,
  });

  assert.equal(metrics.targetWeeks, 8);
  assert.equal(metrics.disciplinedWeeksCount, 3); // W46, W47, W48
  assert.equal(metrics.consecutiveDisciplinedWeeks, 3); // W48 -> W47 -> W46
  assert.equal(metrics.goalWeekProgressPercent, 38); // Math.round(3/8 * 100)
  assert.equal(metrics.averageWorkoutCompletionRate, 75); // avg(100%, 50%) = 75%
  assert.equal(metrics.totalCheckedInWorkoutDays, 5); // 3 + 2
  assert.equal(metrics.totalPlannedWorkoutDays, 7); // 3 + 4
  assert.equal(metrics.completedDailyGoalsCount, 3);
  assert.equal(metrics.totalDailyGoalsCount, 4);
  assert.equal(metrics.dailyGoalCompletionRate, 75);
  assert.equal(metrics.currentDailyStreak, 2); // Nov 24, 25
  assert.equal(metrics.planTrend.length, 2);
  assert.equal(metrics.planTrend[0].completionRate, 100);
  assert.equal(metrics.planTrend[1].completionRate, 50);
  assert.equal(metrics.hasAnyActivity, true);
});

test('calculateOverallDisciplineProgress handles empty state cleanly with zeroed metrics', () => {
  const refDate = new Date(2026, 10, 25, 9, 0, 0);
  const metrics = calculateOverallDisciplineProgress({
    plans: [],
    allDailyGoals: [],
    goalDurationWeeks: 6,
    referenceDate: refDate,
  });

  assert.equal(metrics.targetWeeks, 6);
  assert.equal(metrics.disciplinedWeeksCount, 0);
  assert.equal(metrics.consecutiveDisciplinedWeeks, 0);
  assert.equal(metrics.goalWeekProgressPercent, 0);
  assert.equal(metrics.averageWorkoutCompletionRate, 0);
  assert.equal(metrics.completedDailyGoalsCount, 0);
  assert.equal(metrics.planTrend.length, 0);
  assert.equal(metrics.hasAnyActivity, false);
});
