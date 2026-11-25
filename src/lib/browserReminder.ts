export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidReminderTime(value: string): boolean {
  return REMINDER_TIME_PATTERN.test(value.trim());
}

export function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length <= 64 ? tz : 'Asia/Ho_Chi_Minh';
  } catch {
    return 'Asia/Ho_Chi_Minh';
  }
}

export function getNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function computeNextReminderDate(reminderTime: string, now: Date = new Date()): Date | null {
  if (!isValidReminderTime(reminderTime)) {
    return null;
  }
  const [hourStr, minuteStr] = reminderTime.split(':');
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);

  const next = new Date(now.getTime());
  next.setSeconds(0, 0);
  next.setHours(hours, minutes, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function formatTimeRemaining(target: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalMinutes = Math.ceil(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `Còn ${minutes} phút nữa`;
  }
  if (minutes === 0) {
    return `Còn ${hours} giờ nữa`;
  }
  return `Còn ${hours} giờ ${minutes} phút nữa`;
}

export function getLocalMinuteKey(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function getCurrentHHMM(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

export function sendBrowserWorkoutNotification(title: string, body: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }
  try {
    new window.Notification(title, {
      body,
      tag: 'ai-discipline-coach-daily-reminder',
    });
    return true;
  } catch {
    return false;
  }
}

export interface ReminderSettings {
  reminderEnabled: boolean;
  reminderTime: string;
  timezone: string;
  updatedAt?: string;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  reminderEnabled: false,
  reminderTime: '07:00',
  timezone: getBrowserTimezone(),
};

// Synchronized verbatim with firebase-blueprint.json
const UID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_UID_LENGTH = 128;
const MAX_TIMEZONE_LENGTH = 64;

export function sanitizeReminderSettings(
  uid: string,
  input: ReminderSettings
): { uid: string; reminderEnabled: boolean; reminderTime: string; timezone: string } {
  const cleanUid = uid.trim();
  if (!cleanUid || cleanUid.length > MAX_UID_LENGTH || !UID_PATTERN.test(cleanUid)) {
    throw new Error('Mã người dùng Firebase không hợp lệ.');
  }

  const cleanTime = input.reminderTime.trim();
  if (!REMINDER_TIME_PATTERN.test(cleanTime)) {
    throw new Error('Thời gian nhắc nhở phải đúng định dạng 24 giờ (HH:mm).');
  }

  const rawTimezone = (input.timezone || getBrowserTimezone()).trim();
  const cleanTimezone = (rawTimezone || 'Asia/Ho_Chi_Minh').slice(0, MAX_TIMEZONE_LENGTH);

  return {
    uid: cleanUid,
    reminderEnabled: Boolean(input.reminderEnabled),
    reminderTime: cleanTime,
    timezone: cleanTimezone,
  };
}
