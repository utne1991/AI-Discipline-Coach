import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_GOAL_MAX_LENGTH,
  DATE_KEY_PATTERN,
  calculateDisciplineStreak,
  calculateMonthlyDailyGoalStats,
  filterGoalsByMonth,
  formatDailyGoalDateLabel,
  formatMonthLabel,
  getCurrentMonthKey,
  getDaysInMonth,
  getTodayDateKey,
  sanitizeDailyGoalTitle,
  type DailyGoalData,
} from '../src/lib/dailyGoal.ts';

test('getTodayDateKey returns YYYY-MM-DD in local time and matches DATE_KEY_PATTERN', () => {
  const sampleDate = new Date(2026, 10, 5, 14, 30, 0); // Nov 5, 2026
  const key = getTodayDateKey(sampleDate);
  assert.equal(key, '2026-11-05');
  assert.equal(DATE_KEY_PATTERN.test(key), true);
  assert.equal(getCurrentMonthKey(sampleDate), '2026-11');
  assert.equal(getDaysInMonth('2026-11'), 30);
  assert.equal(getDaysInMonth('2024-02'), 29);
  assert.equal(formatMonthLabel('2026-11'), 'Tháng 11/2026');
});

test('formatDailyGoalDateLabel formats YYYY-MM-DD into DD/MM/YYYY', () => {
  assert.equal(formatDailyGoalDateLabel('2026-11-25'), '25/11/2026');
  assert.equal(formatDailyGoalDateLabel('invalid'), 'invalid');
});

test('sanitizeDailyGoalTitle normalizes whitespace, enforces max length, and rejects blank goals', () => {
  assert.equal(sanitizeDailyGoalTitle('  Uống   đủ 2L  nước  '), 'Uống đủ 2L nước');

  const overlong = 'A'.repeat(DAILY_GOAL_MAX_LENGTH + 25);
  assert.equal(sanitizeDailyGoalTitle(overlong).length, DAILY_GOAL_MAX_LENGTH);

  assert.throws(() => sanitizeDailyGoalTitle('   '), {
    message: /Vui lòng nhập mục tiêu nhỏ cụ thể cho hôm nay/,
  });
});

test('calculateMonthlyDailyGoalStats counts only current month completed goals, streak, and day cells', () => {
  const refDate = new Date(2026, 10, 25, 10, 0, 0); // Nov 25, 2026 (30 days)
  const sampleGoals: DailyGoalData[] = [
    // Previous month -> must be excluded
    { dateKey: '2026-10-31', title: 'Uống 2L nước', completed: true },
    // Current month completed goals
    { dateKey: '2026-11-02', title: 'Đi bộ 15 phút', completed: true },
    { dateKey: '2026-11-23', title: 'Ngủ trước 23:00', completed: true },
    { dateKey: '2026-11-24', title: 'Giãn cơ 10 phút', completed: true },
    { dateKey: '2026-11-25', title: 'Uống đủ 2L nước', completed: true },
    // Current month pending (not completed)
    { dateKey: '2026-11-10', title: 'Đọc 10 trang sách', completed: false },
  ];

  const filtered = filterGoalsByMonth(sampleGoals, '2026-11');
  assert.equal(filtered.length, 5);

  const stats = calculateMonthlyDailyGoalStats(sampleGoals, refDate);
  assert.equal(stats.monthKey, '2026-11');
  assert.equal(stats.monthLabel, 'Tháng 11/2026');
  assert.equal(stats.daysInMonth, 30);
  assert.equal(stats.elapsedDaysInMonth, 25);
  assert.equal(stats.completedCount, 4);
  assert.equal(stats.recordedCount, 5);
  assert.equal(stats.completionRateOfMonth, 13); // Math.round(4/30 * 100)
  assert.equal(stats.completionRateOfRecorded, 80); // 4/5 = 80%
  assert.equal(stats.currentStreakDays, 3); // Nov 23, 24, 25
  assert.equal(stats.dayCells.length, 30);
  assert.equal(stats.dayCells[1].status, 'completed'); // Nov 2
  assert.equal(stats.dayCells[9].status, 'pending'); // Nov 10
  assert.equal(stats.dayCells[0].status, 'empty'); // Nov 1
  assert.equal(stats.dayCells[26].status, 'future'); // Nov 27

  // Weekly breakdown across 30-day month (5 buckets: 1-7, 8-14, 15-21, 22-28, 29-30)
  assert.equal(stats.weeklyBreakdown.length, 5);
  assert.equal(stats.weeklyBreakdown[0].label, 'Tuần 1');
  assert.equal(stats.weeklyBreakdown[0].completedCount, 1); // Nov 2
  assert.equal(stats.weeklyBreakdown[0].pendingCount, 0);
  assert.equal(stats.weeklyBreakdown[1].completedCount, 0);
  assert.equal(stats.weeklyBreakdown[1].pendingCount, 1); // Nov 10
  assert.equal(stats.weeklyBreakdown[3].completedCount, 3); // Nov 23, 24, 25
  assert.equal(stats.weeklyBreakdown[4].totalDays, 2); // Nov 29-30
});

test('calculateDisciplineStreak computes active, at-risk, longest streak, and 7-day window accurately', () => {
  const refDate = new Date(2026, 10, 25, 10, 0, 0); // Nov 25, 2026

  // 1. Active streak completed today (Nov 23, 24, 25 = 3 days) with an earlier 4-day best streak (Nov 1-4)
  const activeGoals: DailyGoalData[] = [
    { dateKey: '2026-11-01', title: 'Mục tiêu 1', completed: true },
    { dateKey: '2026-11-02', title: 'Mục tiêu 2', completed: true },
    { dateKey: '2026-11-03', title: 'Mục tiêu 3', completed: true },
    { dateKey: '2026-11-04', title: 'Mục tiêu 4', completed: true },
    { dateKey: '2026-11-22', title: 'Chưa xong', completed: false },
    { dateKey: '2026-11-23', title: 'Uống 2L nước', completed: true },
    { dateKey: '2026-11-24', title: 'Đi bộ 15 phút', completed: true },
    { dateKey: '2026-11-25', title: 'Ngủ trước 23:00', completed: true },
  ];
  const active = calculateDisciplineStreak(activeGoals, refDate);
  assert.equal(active.currentStreakDays, 3);
  assert.equal(active.longestStreakDays, 4);
  assert.equal(active.completedToday, true);
  assert.equal(active.streakAtRisk, false);
  assert.equal(active.recentDays.length, 7);
  assert.equal(active.recentDays[6].isToday, true);
  assert.equal(active.recentDays[6].completed, true);

  // 2. At-risk streak: completed Nov 23 & 24, pending today (Nov 25)
  const atRiskGoals: DailyGoalData[] = [
    { dateKey: '2026-11-23', title: 'Uống 2L nước', completed: true },
    { dateKey: '2026-11-24', title: 'Đi bộ 15 phút', completed: true },
    { dateKey: '2026-11-25', title: 'Ngủ trước 23:00', completed: false },
  ];
  const atRisk = calculateDisciplineStreak(atRiskGoals, refDate);
  assert.equal(atRisk.currentStreakDays, 2);
  assert.equal(atRisk.longestStreakDays, 2);
  assert.equal(atRisk.completedToday, false);
  assert.equal(atRisk.streakAtRisk, true);

  // 3. Broken streak (gap > 1 day) -> currentStreakDays resets to 0, longestStreakDays preserved
  const brokenGoals: DailyGoalData[] = [
    { dateKey: '2026-11-10', title: 'A', completed: true },
    { dateKey: '2026-11-11', title: 'B', completed: true },
  ];
  const broken = calculateDisciplineStreak(brokenGoals, refDate);
  assert.equal(broken.currentStreakDays, 0);
  assert.equal(broken.longestStreakDays, 2);
  assert.equal(broken.completedToday, false);
  assert.equal(broken.streakAtRisk, false);

  // 4. Empty goals
  const empty = calculateDisciplineStreak([], refDate);
  assert.equal(empty.currentStreakDays, 0);
  assert.equal(empty.longestStreakDays, 0);
  assert.equal(empty.recentDays.length, 7);
});
