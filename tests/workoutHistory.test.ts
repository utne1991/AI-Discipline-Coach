import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutHistoryEntries,
  formatShortVietnameseDate,
} from '../src/components/PlanTab.tsx';
import type { WorkoutPlanData } from '../src/shared/types.ts';

function makePlan(overrides: Partial<WorkoutPlanData>): WorkoutPlanData {
  return {
    id: 1,
    weekNumber: 1,
    sport: 'home_workout',
    goalType: 'weight_loss',
    durationWeeks: 8,
    cautiousMode: false,
    cautionReasons: [],
    safetyAlert: 'An toàn',
    strategySummary: 'Tóm tắt',
    coachPrinciples: [],
    completedDays: [],
    createdAt: '2026-11-20T08:00:00.000Z',
    scheduleJson: [
      {
        dayIndex: 1,
        dayLabel: 'Thứ 2',
        isRestDay: false,
        title: 'Thân trên cơ bản',
        focusArea: 'Ngực & Lưng',
        estimatedMinutes: 35,
        intensity: 'Trung bình',
        warmup: '5 phút',
        cooldown: '5 phút',
        safetyNote: 'Giữ lưng thẳng',
        exercises: [],
      },
      {
        dayIndex: 2,
        dayLabel: 'Thứ 3',
        isRestDay: true,
        title: 'Nghỉ phục hồi',
        focusArea: 'Phục hồi',
        estimatedMinutes: 15,
        intensity: 'Nhẹ',
        warmup: 'Không',
        cooldown: 'Không',
        safetyNote: 'Uống đủ nước',
        exercises: [],
      },
      {
        dayIndex: 3,
        dayLabel: 'Thứ 4',
        isRestDay: false,
        title: 'Thân dưới & Core',
        focusArea: 'Chân & Bụng',
        estimatedMinutes: 40,
        intensity: 'Trung bình',
        warmup: '5 phút',
        cooldown: '5 phút',
        safetyNote: 'Kiểm soát gối',
        exercises: [],
      },
    ],
    ...overrides,
  };
}

test('formatShortVietnameseDate formats valid ISO dates as DD/MM/YYYY and falls back cleanly', () => {
  assert.equal(formatShortVietnameseDate('2026-11-25T10:00:00.000Z').length, 10);
  assert.equal(formatShortVietnameseDate('not-a-date'), '—');
});

test('buildWorkoutHistoryEntries extracts completed days across past and current plans in reverse chronological order', () => {
  const olderPlan = makePlan({
    id: 101,
    weekNumber: 1,
    sport: 'running',
    createdAt: '2026-11-10T08:00:00.000Z',
    completedDays: [1, 2],
  });
  const newerPlan = makePlan({
    id: 202,
    weekNumber: 2,
    sport: 'gym',
    createdAt: '2026-11-24T08:00:00.000Z',
    completedDays: [1, 3],
  });

  const entries = buildWorkoutHistoryEntries([olderPlan, newerPlan]);

  assert.equal(entries.length, 4);
  assert.equal(entries[0].planId, 202);
  assert.equal(entries[0].dayIndex, 3);
  assert.equal(entries[0].sportLabel, 'Gym');
  assert.equal(entries[0].estimatedMinutes, 40);

  assert.equal(entries[1].planId, 202);
  assert.equal(entries[1].dayIndex, 1);

  assert.equal(entries[2].planId, 101);
  assert.equal(entries[2].dayIndex, 2);
  assert.equal(entries[2].isRestDay, true);
  assert.equal(entries[2].estimatedMinutes, 0);

  assert.equal(entries[3].planId, 101);
  assert.equal(entries[3].dayIndex, 1);
  assert.equal(entries[3].sportLabel, 'Chạy bộ');
});

test('buildWorkoutHistoryEntries returns empty array when no days are completed', () => {
  const emptyPlan = makePlan({ id: 303, completedDays: [] });
  assert.deepEqual(buildWorkoutHistoryEntries([emptyPlan]), []);
  assert.deepEqual(buildWorkoutHistoryEntries([]), []);
});
