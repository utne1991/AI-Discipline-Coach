import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNextReminderDate,
  formatTimeRemaining,
  getCurrentHHMM,
  getLocalMinuteKey,
  isValidReminderTime,
  sanitizeReminderSettings,
} from '../src/lib/browserReminder.ts';

test('isValidReminderTime validates 24-hour HH:mm strings strictly', () => {
  assert.equal(isValidReminderTime('00:00'), true);
  assert.equal(isValidReminderTime('07:30'), true);
  assert.equal(isValidReminderTime('23:59'), true);
  assert.equal(isValidReminderTime('7:30'), false);
  assert.equal(isValidReminderTime('24:00'), false);
  assert.equal(isValidReminderTime('12:60'), false);
  assert.equal(isValidReminderTime('invalid'), false);
});

test('computeNextReminderDate picks today if future and tomorrow if past', () => {
  const morning = new Date(2026, 10, 25, 6, 30, 0, 0);
  const laterToday = computeNextReminderDate('07:00', morning);
  assert.ok(laterToday);
  assert.equal(laterToday.getDate(), 25);
  assert.equal(laterToday.getHours(), 7);
  assert.equal(laterToday.getMinutes(), 0);
  assert.equal(formatTimeRemaining(laterToday, morning), 'Còn 30 phút nữa');

  const evening = new Date(2026, 10, 25, 20, 0, 0, 0);
  const tomorrow = computeNextReminderDate('07:00', evening);
  assert.ok(tomorrow);
  assert.equal(tomorrow.getDate(), 26);
  assert.equal(tomorrow.getHours(), 7);
  assert.equal(formatTimeRemaining(tomorrow, evening), 'Còn 11 giờ nữa');

  assert.equal(getCurrentHHMM(morning), '06:30');
  assert.equal(getLocalMinuteKey(morning), '2026-11-25T06:30');
});

test('sanitizeReminderSettings enforces blueprint field constraints', () => {
  const valid = sanitizeReminderSettings('user_123-abc', {
    reminderEnabled: true,
    reminderTime: ' 18:45 ',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.deepEqual(valid, {
    uid: 'user_123-abc',
    reminderEnabled: true,
    reminderTime: '18:45',
    timezone: 'Asia/Ho_Chi_Minh',
  });

  assert.throws(() =>
    sanitizeReminderSettings('bad/uid', {
      reminderEnabled: true,
      reminderTime: '18:45',
      timezone: 'UTC',
    })
  );

  assert.throws(() =>
    sanitizeReminderSettings('user_123', {
      reminderEnabled: true,
      reminderTime: '25:00',
      timezone: 'UTC',
    })
  );
});
