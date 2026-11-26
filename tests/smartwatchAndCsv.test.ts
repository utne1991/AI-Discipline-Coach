import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UTF8_BOM,
  buildCombinedDisciplineCsv,
  buildDailyGoalsCsv,
  buildWorkoutHistoryCsv,
  escapeCsvCell,
} from '../src/lib/csvExport.ts';
import {
  buildWorkoutPlanIcs,
  formatElapsedDuration,
  parseHeartRateMeasurement,
  sanitizeSmartwatchConnection,
} from '../src/lib/smartwatch.ts';
import type { DailyGoalData } from '../src/lib/dailyGoal.ts';
import type { WorkoutHistoryEntry } from '../src/components/PlanTab.tsx';
import type { WorkoutPlanData } from '../src/shared/types.ts';

test('parseHeartRateMeasurement decodes both UINT8 and UINT16 BLE Heart Rate packets and rejects out-of-range values', () => {
  // UINT8 format (flags bit 0 = 0): 142 BPM
  const u8 = new DataView(new ArrayBuffer(2));
  u8.setUint8(0, 0x00);
  u8.setUint8(1, 142);
  assert.equal(parseHeartRateMeasurement(u8), 142);

  // UINT16 little-endian format (flags bit 0 = 1): 168 BPM
  const u16 = new DataView(new ArrayBuffer(3));
  u16.setUint8(0, 0x01);
  u16.setUint16(1, 168, true);
  assert.equal(parseHeartRateMeasurement(u16), 168);

  // Out-of-range BPM (e.g., 10 or 300) rejected
  const invalidLow = new DataView(new ArrayBuffer(2));
  invalidLow.setUint8(0, 0x00);
  invalidLow.setUint8(1, 10);
  assert.equal(parseHeartRateMeasurement(invalidLow), null);

  // Truncated buffer rejected
  const tooShort = new DataView(new ArrayBuffer(1));
  tooShort.setUint8(0, 0x00);
  assert.equal(parseHeartRateMeasurement(tooShort), null);
});

test('sanitizeSmartwatchConnection clamps numeric ranges and enforces blueprint constraints', () => {
  const sanitized = sanitizeSmartwatchConnection({
    deviceName: '  Garmin   Forerunner 255  ',
    platform: 'garmin_ics',
    autoSyncCalendar: true,
    lastHeartRateBpm: 500, // out of range -> 0
    lastBatteryPercent: 140, // out of range -> -1
    totalSyncedSessions: -5, // clamped to 0
  });
  assert.equal(sanitized.deviceName, 'Garmin Forerunner 255');
  assert.equal(sanitized.platform, 'garmin_ics');
  assert.equal(sanitized.lastHeartRateBpm, 0);
  assert.equal(sanitized.lastBatteryPercent, -1);
  assert.equal(sanitized.totalSyncedSessions, 0);

  const valid = sanitizeSmartwatchConnection({
    deviceName: 'Polar H10',
    platform: 'ble_heart_rate',
    lastHeartRateBpm: 138.4,
    lastBatteryPercent: 85,
    totalSyncedSessions: 12,
  });
  assert.equal(valid.lastHeartRateBpm, 138);
  assert.equal(valid.lastBatteryPercent, 85);
  assert.equal(valid.totalSyncedSessions, 12);
  assert.equal(formatElapsedDuration(125), '02:05');
});

test('buildWorkoutPlanIcs creates valid RFC 5545 calendar events with wrist alarms for smartwatch sync', () => {
  const plan: WorkoutPlanData = {
    id: 42,
    weekNumber: 1,
    sport: 'running',
    goalType: 'endurance',
    durationWeeks: 8,
    cautiousMode: false,
    cautionReasons: [],
    safetyAlert: 'Khởi động kỹ trước khi chạy.',
    strategySummary: 'Tập đều 3 buổi/tuần.',
    coachPrinciples: ['Giữ nhịp thở ổn định'],
    completedDays: [1],
    createdAt: '2026-11-23T00:00:00.000Z',
    scheduleJson: [
      {
        dayIndex: 1,
        dayLabel: 'Thứ 2',
        isRestDay: false,
        title: 'Chạy nền tảng Zone 2',
        focusArea: 'Sức bền hiếu khí',
        estimatedMinutes: 35,
        intensity: 'Trung bình',
        warmup: 'Đi bộ nhanh 5 phút',
        cooldown: 'Giãn cơ chân 5 phút',
        safetyNote: 'Dừng ngay nếu đau gối.',
        exercises: [
          {
            name: 'Chạy chậm đều nhịp',
            sets: '1 hiệp',
            repsOrDuration: '25 phút',
            restSeconds: 0,
            note: 'Nói chuyện được từng câu ngắn.',
          },
        ],
      },
      {
        dayIndex: 2,
        dayLabel: 'Thứ 3',
        isRestDay: true,
        title: 'Nghỉ phục hồi',
        focusArea: 'Phục hồi',
        estimatedMinutes: 15,
        intensity: 'Nhẹ',
        warmup: 'Đi lại nhẹ',
        cooldown: 'Thở sâu',
        safetyNote: 'Ngủ đủ giấc.',
        exercises: [],
      },
    ],
  };

  const ics = buildWorkoutPlanIcs(plan, {
    startDate: new Date(2026, 10, 25),
    reminderTime: '06:30',
    includeAlarm: true,
  });

  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.ok(ics.includes('DTSTART:20261125T063000'));
  assert.ok(ics.includes('DTEND:20261125T070500'));
  assert.ok(ics.includes('TRIGGER:-PT15M'));
  assert.ok(ics.includes('Chạy nền tảng Zone 2'));
});

test('CSV export builders include UTF-8 BOM, escape quotes/commas, and neutralize spreadsheet formula injection', () => {
  assert.equal(escapeCsvCell('Uống nước, 2L "mỗi ngày"'), '"Uống nước, 2L ""mỗi ngày"""');
  assert.equal(escapeCsvCell('=SUM(A1:A5)'), "'=SUM(A1:A5)");
  assert.equal(escapeCsvCell('+1234'), "'+1234");
  assert.equal(escapeCsvCell('@cmd'), "'@cmd");

  const goals: DailyGoalData[] = [
    {
      dateKey: '2026-11-25',
      title: 'Uống đủ 2L nước, không trà sữa',
      completed: true,
      updatedAt: '2026-11-25T08:00:00.000Z',
    },
    {
      dateKey: '2026-11-24',
      title: '=HYPERLINK("https://evil.test")',
      completed: false,
      updatedAt: '2026-11-24T20:00:00.000Z',
    },
  ];

  const entries: WorkoutHistoryEntry[] = [
    {
      key: '1-1',
      planId: 1,
      weekNumber: 1,
      sport: 'home_workout',
      sportLabel: 'Tập tại nhà',
      planCreatedAt: '2026-11-23T08:00:00.000Z',
      dayIndex: 1,
      dayLabel: 'Thứ 2',
      title: 'Toàn thân nền tảng',
      focusArea: 'Thể lực chung',
      isRestDay: false,
      estimatedMinutes: 35,
      intensity: 'Trung bình',
    },
  ];

  const goalsCsv = buildDailyGoalsCsv(goals);
  assert.ok(goalsCsv.startsWith(UTF8_BOM));
  assert.ok(goalsCsv.includes('"Uống đủ 2L nước, không trà sữa"'));
  assert.ok(goalsCsv.includes("'=HYPERLINK("));
  assert.ok(goalsCsv.includes('Đã hoàn thành'));

  const workoutsCsv = buildWorkoutHistoryCsv(entries);
  assert.ok(workoutsCsv.startsWith(UTF8_BOM));
  assert.ok(workoutsCsv.includes('Tuần 1'));
  assert.ok(workoutsCsv.includes('Toàn thân nền tảng'));
  assert.ok(workoutsCsv.includes(',35,Trung bình'));

  const combinedCsv = buildCombinedDisciplineCsv(goals, entries);
  assert.ok(combinedCsv.startsWith(UTF8_BOM));
  assert.ok(combinedCsv.includes('Mục tiêu nhỏ'));
  assert.ok(combinedCsv.includes('Nhật ký tập luyện'));
});
