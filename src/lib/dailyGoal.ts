export const DAILY_GOAL_MAX_LENGTH = 120;
export const DATE_KEY_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export const MONTH_KEY_PATTERN = /^[0-9]{4}-[0-9]{2}$/;

export const DAILY_GOAL_SUGGESTIONS: string[] = [
  'Uống đủ 2L nước',
  'Đi bộ thêm 15 phút',
  'Ngủ trước 23:00',
  'Giãn cơ 10 phút cuối ngày',
];

export interface DailyGoalData {
  dateKey: string;
  title: string;
  completed: boolean;
  updatedAt?: string;
}

export type MonthlyDayCellStatus = 'completed' | 'pending' | 'empty' | 'future';

export interface MonthlyDayGoalCell {
  dayNumber: number;
  dateKey: string;
  status: MonthlyDayCellStatus;
  title?: string;
}

export interface MonthlyWeeklyGoalBucket {
  weekIndex: number;
  label: string;
  rangeLabel: string;
  completedCount: number;
  pendingCount: number;
  recordedCount: number;
  totalDays: number;
}

export interface MonthlyDailyGoalSummary {
  monthKey: string;
  monthLabel: string;
  completedCount: number;
  recordedCount: number;
  daysInMonth: number;
  elapsedDaysInMonth: number;
  completionRateOfMonth: number;
  completionRateOfRecorded: number;
  currentStreakDays: number;
  dayCells: MonthlyDayGoalCell[];
  weeklyBreakdown: MonthlyWeeklyGoalBucket[];
}

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getDaysInMonth(monthKey: string): number {
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    return 30;
  }
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 30;
  }
  return new Date(year, month, 0).getDate();
}

export function formatMonthLabel(monthKey: string): string {
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    return monthKey;
  }
  const [year, month] = monthKey.split('-');
  return `Tháng ${Number(month)}/${year}`;
}

export function formatDailyGoalDateLabel(dateKey: string): string {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    return dateKey;
  }
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

export function sanitizeDailyGoalTitle(rawTitle: string): string {
  const normalized = rawTitle.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new Error('Vui lòng nhập mục tiêu nhỏ cụ thể cho hôm nay (ví dụ: Uống đủ 2L nước).');
  }
  if (normalized.length > DAILY_GOAL_MAX_LENGTH) {
    return normalized.slice(0, DAILY_GOAL_MAX_LENGTH).trim();
  }
  return normalized;
}

export function filterGoalsByMonth(
  goals: DailyGoalData[],
  monthKey: string
): DailyGoalData[] {
  const prefix = `${monthKey}-`;
  const byDate = new Map<string, DailyGoalData>();
  for (const goal of goals) {
    if (DATE_KEY_PATTERN.test(goal.dateKey) && goal.dateKey.startsWith(prefix)) {
      byDate.set(goal.dateKey, goal);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function calculateMonthlyDailyGoalStats(
  goals: DailyGoalData[],
  referenceDate: Date = new Date()
): MonthlyDailyGoalSummary {
  const monthKey = getCurrentMonthKey(referenceDate);
  const daysInMonth = getDaysInMonth(monthKey);
  const todayDayNumber = Math.min(daysInMonth, Math.max(1, referenceDate.getDate()));

  const monthGoals = filterGoalsByMonth(goals, monthKey);
  const goalMap = new Map<string, DailyGoalData>();
  for (const goal of monthGoals) {
    goalMap.set(goal.dateKey, goal);
  }

  let completedCount = 0;
  let recordedCount = 0;
  const dayCells: MonthlyDayGoalCell[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    const goal = goalMap.get(dateKey);
    if (goal) {
      recordedCount += 1;
      if (goal.completed) {
        completedCount += 1;
      }
      dayCells.push({
        dayNumber: day,
        dateKey,
        status: goal.completed ? 'completed' : 'pending',
        title: goal.title,
      });
    } else {
      dayCells.push({
        dayNumber: day,
        dateKey,
        status: day > todayDayNumber ? 'future' : 'empty',
      });
    }
  }

  const weeklyBreakdown: MonthlyWeeklyGoalBucket[] = [];
  for (let startDay = 1; startDay <= daysInMonth; startDay += 7) {
    const endDay = Math.min(daysInMonth, startDay + 6);
    const weekIndex = Math.floor((startDay - 1) / 7) + 1;
    let weekCompleted = 0;
    let weekPending = 0;
    for (let day = startDay; day <= endDay; day += 1) {
      const status = dayCells[day - 1]?.status;
      if (status === 'completed') {
        weekCompleted += 1;
      } else if (status === 'pending') {
        weekPending += 1;
      }
    }
    weeklyBreakdown.push({
      weekIndex,
      label: `Tuần ${weekIndex}`,
      rangeLabel: startDay === endDay ? `Ngày ${startDay}` : `Ngày ${startDay}–${endDay}`,
      completedCount: weekCompleted,
      pendingCount: weekPending,
      recordedCount: weekCompleted + weekPending,
      totalDays: endDay - startDay + 1,
    });
  }

  // Consecutive completed days ending at today (or yesterday if today isn't completed yet)
  let currentStreakDays = 0;
  const startDay =
    dayCells[todayDayNumber - 1]?.status === 'completed'
      ? todayDayNumber
      : todayDayNumber - 1;
  for (let day = startDay; day >= 1; day -= 1) {
    if (dayCells[day - 1]?.status === 'completed') {
      currentStreakDays += 1;
    } else {
      break;
    }
  }

  const completionRateOfMonth = Math.min(
    100,
    Math.max(0, Math.round((completedCount / daysInMonth) * 100))
  );
  const completionRateOfRecorded =
    recordedCount > 0
      ? Math.min(100, Math.max(0, Math.round((completedCount / recordedCount) * 100)))
      : 0;

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    completedCount,
    recordedCount,
    daysInMonth,
    elapsedDaysInMonth: todayDayNumber,
    completionRateOfMonth,
    completionRateOfRecorded,
    currentStreakDays,
    dayCells,
    weeklyBreakdown,
  };
}

export interface StreakRecentDay {
  dateKey: string;
  shortLabel: string;
  dayNumber: number;
  completed: boolean;
  isToday: boolean;
}

export interface DisciplineStreakSummary {
  currentStreakDays: number;
  longestStreakDays: number;
  completedToday: boolean;
  streakAtRisk: boolean;
  recentDays: StreakRecentDay[];
}

const VIETNAMESE_WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function parseDateKeyLocal(dateKey: string): Date | null {
  if (!DATE_KEY_PATTERN.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  return new Date(y, m - 1, d);
}

function addDaysLocal(base: Date, deltaDays: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDays);
}

export function calculateDisciplineStreak(
  goals: DailyGoalData[],
  referenceDate: Date = new Date()
): DisciplineStreakSummary {
  const todayDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const todayKey = getTodayDateKey(todayDate);

  const completedDateKeys = new Set<string>();
  for (const goal of goals) {
    if (goal.completed && DATE_KEY_PATTERN.test(goal.dateKey) && goal.dateKey <= todayKey) {
      completedDateKeys.add(goal.dateKey);
    }
  }

  const completedToday = completedDateKeys.has(todayKey);

  // Current streak: consecutive days ending today (or yesterday if today is not yet completed)
  let currentStreakDays = 0;
  let cursor = completedToday ? todayDate : addDaysLocal(todayDate, -1);
  while (completedDateKeys.has(getTodayDateKey(cursor))) {
    currentStreakDays += 1;
    cursor = addDaysLocal(cursor, -1);
  }

  // Longest streak among all completed goals provided
  const sortedDates = Array.from(completedDateKeys)
    .map((key) => ({ key, date: parseDateKeyLocal(key) }))
    .filter((entry): entry is { key: string; date: Date } => entry.date !== null)
    .sort((a, b) => a.key.localeCompare(b.key));

  let longestStreakDays = 0;
  let running = 0;
  let prevKey: string | null = null;
  for (const entry of sortedDates) {
    if (prevKey) {
      const prevDate = parseDateKeyLocal(prevKey);
      const expectedNextKey = prevDate ? getTodayDateKey(addDaysLocal(prevDate, 1)) : '';
      if (entry.key === expectedNextKey) {
        running += 1;
      } else {
        running = 1;
      }
    } else {
      running = 1;
    }
    if (running > longestStreakDays) {
      longestStreakDays = running;
    }
    prevKey = entry.key;
  }

  // Last 7 calendar days ending today
  const recentDays: StreakRecentDay[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const dayDate = addDaysLocal(todayDate, offset);
    const dateKey = getTodayDateKey(dayDate);
    recentDays.push({
      dateKey,
      shortLabel: VIETNAMESE_WEEKDAY_SHORT[dayDate.getDay()] ?? 'N',
      dayNumber: dayDate.getDate(),
      completed: completedDateKeys.has(dateKey),
      isToday: offset === 0,
    });
  }

  return {
    currentStreakDays,
    longestStreakDays,
    completedToday,
    streakAtRisk: currentStreakDays > 0 && !completedToday,
    recentDays,
  };
}
