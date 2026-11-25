import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_GOAL_MAX_LENGTH,
  DATE_KEY_PATTERN,
  formatDailyGoalDateLabel,
  getTodayDateKey,
  sanitizeDailyGoalTitle,
} from '../src/lib/dailyGoal.ts';

test('getTodayDateKey returns YYYY-MM-DD in local time and matches DATE_KEY_PATTERN', () => {
  const sampleDate = new Date(2026, 10, 5, 14, 30, 0); // Nov 5, 2026
  const key = getTodayDateKey(sampleDate);
  assert.equal(key, '2026-11-05');
  assert.equal(DATE_KEY_PATTERN.test(key), true);
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
