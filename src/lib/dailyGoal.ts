export const DAILY_GOAL_MAX_LENGTH = 120;
export const DATE_KEY_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

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

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
