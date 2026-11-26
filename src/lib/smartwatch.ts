import { SPORT_LABELS, type WorkoutPlanData } from '../shared/types.ts';

export type SmartwatchPlatform =
  | 'ble_heart_rate'
  | 'apple_watch_ics'
  | 'wear_os_ics'
  | 'garmin_ics';

export const SMARTWATCH_PLATFORM_LABELS: Record<
  SmartwatchPlatform,
  { label: string; description: string }
> = {
  ble_heart_rate: {
    label: 'Bluetooth HR (BLE)',
    description: 'Kết nối trực tiếp cảm biến nhịp tim Bluetooth (Garmin, Polar, Coros, Wahoo, Mi Band...)',
  },
  apple_watch_ics: {
    label: 'Apple Watch (Lịch .ics)',
    description: 'Xuất lịch tập tuần vào Apple Calendar để nhận nhắc trên Apple Watch',
  },
  wear_os_ics: {
    label: 'Wear OS / Galaxy Watch (.ics)',
    description: 'Xuất lịch tập tuần vào Google Calendar để đồng bộ xuống đồng hồ Wear OS',
  },
  garmin_ics: {
    label: 'Garmin Watch (Lịch .ics)',
    description: 'Đồng bộ lịch tập tuần qua lịch hệ thống hoặc kết nối nhịp tim BLE khi tập',
  },
};

export interface SmartwatchConnectionData {
  deviceName: string;
  platform: SmartwatchPlatform;
  autoSyncCalendar: boolean;
  lastConnectedAt: string;
  lastHeartRateBpm: number;
  lastBatteryPercent: number;
  totalSyncedSessions: number;
  updatedAt?: string;
}

export const DEFAULT_SMARTWATCH_CONNECTION: SmartwatchConnectionData = {
  deviceName: 'Đồng hồ thông minh cá nhân',
  platform: 'ble_heart_rate',
  autoSyncCalendar: true,
  lastConnectedAt: '',
  lastHeartRateBpm: 0,
  lastBatteryPercent: -1,
  totalSyncedSessions: 0,
};

export const SMARTWATCH_DEVICE_NAME_MAX = 80;
export const SMARTWATCH_PLATFORMS: SmartwatchPlatform[] = [
  'ble_heart_rate',
  'apple_watch_ics',
  'wear_os_ics',
  'garmin_ics',
];

export function sanitizeSmartwatchConnection(
  input: Partial<SmartwatchConnectionData>
): SmartwatchConnectionData {
  const rawName = typeof input.deviceName === 'string' ? input.deviceName.replace(/\s+/g, ' ').trim() : '';
  const deviceName = (rawName || DEFAULT_SMARTWATCH_CONNECTION.deviceName).slice(
    0,
    SMARTWATCH_DEVICE_NAME_MAX
  );

  const platform: SmartwatchPlatform = SMARTWATCH_PLATFORMS.includes(
    input.platform as SmartwatchPlatform
  )
    ? (input.platform as SmartwatchPlatform)
    : 'ble_heart_rate';

  const autoSyncCalendar =
    typeof input.autoSyncCalendar === 'boolean' ? input.autoSyncCalendar : true;

  const lastConnectedAt =
    typeof input.lastConnectedAt === 'string' ? input.lastConnectedAt.trim().slice(0, 40) : '';

  const rawHr = Number(input.lastHeartRateBpm);
  const roundedHr = Number.isFinite(rawHr) ? Math.round(rawHr) : 0;
  const lastHeartRateBpm =
    roundedHr >= 30 && roundedHr <= 240 ? roundedHr : 0;

  const rawBattery = Number(input.lastBatteryPercent);
  const roundedBattery = Number.isFinite(rawBattery) ? Math.round(rawBattery) : -1;
  const lastBatteryPercent =
    roundedBattery >= 0 && roundedBattery <= 100 ? roundedBattery : -1;

  const rawSessions = Number(input.totalSyncedSessions);
  const roundedSessions = Number.isFinite(rawSessions) ? Math.round(rawSessions) : 0;
  const totalSyncedSessions = Math.min(10000, Math.max(0, roundedSessions));

  return {
    deviceName,
    platform,
    autoSyncCalendar,
    lastConnectedAt,
    lastHeartRateBpm,
    lastBatteryPercent,
    totalSyncedSessions,
    updatedAt: input.updatedAt,
  };
}

/**
 * Parses a standard Bluetooth SIG Heart Rate Measurement characteristic (UUID 0x2A37).
 * Bit 0 of flags byte: 0 => UINT8 heart rate at byte 1; 1 => UINT16 LE at bytes 1..2.
 */
export function parseHeartRateMeasurement(value: DataView): number | null {
  if (!value || value.byteLength < 2) {
    return null;
  }
  const flags = value.getUint8(0);
  const isUint16 = (flags & 0x01) === 1;
  if (isUint16 && value.byteLength < 3) {
    return null;
  }
  const bpm = isUint16 ? value.getUint16(1, true) : value.getUint8(1);
  if (!Number.isFinite(bpm) || bpm < 30 || bpm > 240) {
    return null;
  }
  return bpm;
}

export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { bluetooth?: unknown }).bluetooth !== 'undefined'
  );
}

interface WebBluetoothCharacteristicLike {
  startNotifications: () => Promise<WebBluetoothCharacteristicLike>;
  stopNotifications?: () => Promise<WebBluetoothCharacteristicLike>;
  readValue: () => Promise<DataView>;
  value?: DataView;
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
}

interface WebBluetoothServiceLike {
  getCharacteristic: (uuid: string | number) => Promise<WebBluetoothCharacteristicLike>;
}

interface WebBluetoothGattServerLike {
  connected: boolean;
  connect: () => Promise<WebBluetoothGattServerLike>;
  disconnect: () => void;
  getPrimaryService: (uuid: string | number) => Promise<WebBluetoothServiceLike>;
}

interface WebBluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: WebBluetoothGattServerLike;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface WebBluetoothNavigatorLike {
  requestDevice: (options: {
    filters: Array<{ services: Array<string | number> }>;
    optionalServices?: Array<string | number>;
  }) => Promise<WebBluetoothDeviceLike>;
}

export interface LiveBluetoothWatchHandle {
  deviceName: string;
  batteryPercent: number | null;
  disconnect: () => void;
}

export async function connectBluetoothHeartRateWatch(callbacks: {
  onHeartRate: (bpm: number) => void;
  onDisconnected: () => void;
}): Promise<LiveBluetoothWatchHandle> {
  if (!isWebBluetoothSupported()) {
    throw new Error(
      'Trình duyệt hiện tại không hỗ trợ Web Bluetooth. Hãy dùng Chrome/Edge trên máy tính hoặc Android, hoặc xuất lịch .ics để đồng bộ lên đồng hồ.'
    );
  }

  const bt = (navigator as Navigator & { bluetooth: WebBluetoothNavigatorLike }).bluetooth;
  let device: WebBluetoothDeviceLike;
  try {
    device = await bt.requestDevice({
      filters: [{ services: ['heart_rate'] }],
      optionalServices: ['battery_service'],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      throw new Error('Bạn đã hủy chọn thiết bị Bluetooth.');
    }
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new Error(
        'Môi trường khung xem trước hiện tại đang chặn Web Bluetooth. Hãy mở ứng dụng trong tab riêng của Chrome/Edge hoặc dùng nút đồng bộ lịch (.ics) sang đồng hồ.'
      );
    }
    throw new Error(
      error instanceof Error
        ? `Không thể kết nối Bluetooth: ${error.message}`
        : 'Không thể kết nối với đồng hồ Bluetooth lúc này.'
    );
  }

  if (!device.gatt) {
    throw new Error('Thiết bị đã chọn không hỗ trợ kết nối GATT Bluetooth.');
  }

  const server = await device.gatt.connect();
  const hrService = await server.getPrimaryService('heart_rate');
  const hrChar = await hrService.getCharacteristic('heart_rate_measurement');

  const handleHrChanged = (event: Event) => {
    const target = event.target as unknown as WebBluetoothCharacteristicLike | null;
    if (!target?.value) return;
    const bpm = parseHeartRateMeasurement(target.value);
    if (bpm !== null) {
      callbacks.onHeartRate(bpm);
    }
  };

  hrChar.addEventListener('characteristicvaluechanged', handleHrChanged);
  await hrChar.startNotifications();

  let batteryPercent: number | null = null;
  try {
    const batteryService = await server.getPrimaryService('battery_service');
    const batteryChar = await batteryService.getCharacteristic('battery_level');
    const batteryView = await batteryChar.readValue();
    if (batteryView.byteLength >= 1) {
      const level = batteryView.getUint8(0);
      if (level >= 0 && level <= 100) {
        batteryPercent = level;
      }
    }
  } catch {
    // Optional service: many heart-rate wearables omit battery_service
    batteryPercent = null;
  }

  const handleDisconnected = () => {
    hrChar.removeEventListener('characteristicvaluechanged', handleHrChanged);
    device.removeEventListener('gattserverdisconnected', handleDisconnected);
    callbacks.onDisconnected();
  };
  device.addEventListener('gattserverdisconnected', handleDisconnected);

  const deviceName = (device.name || 'Đồng hồ Bluetooth HR')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SMARTWATCH_DEVICE_NAME_MAX);

  return {
    deviceName,
    batteryPercent,
    disconnect: () => {
      hrChar.removeEventListener('characteristicvaluechanged', handleHrChanged);
      if (hrChar.stopNotifications) {
        void hrChar.stopNotifications().catch(() => {});
      }
      if (server.connected) {
        server.disconnect();
      }
    },
  };
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsLocalDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

function formatIcsUtcStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

/**
 * Generates an RFC 5545 iCalendar (.ics) file for the user's 7-day weekly workout plan.
 * Importing this file into Apple Calendar, Google Calendar, or Garmin Calendar automatically
 * syncs sessions & wrist reminder alerts onto Apple Watch, Wear OS, and Garmin smartwatches.
 */
export function buildWorkoutPlanIcs(
  plan: WorkoutPlanData,
  options?: {
    startDate?: Date;
    reminderTime?: string;
    includeAlarm?: boolean;
  }
): string {
  const now = options?.startDate ? new Date(options.startDate) : new Date();
  const startBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reminderTime =
    options?.reminderTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(options.reminderTime)
      ? options.reminderTime
      : '07:00';
  const [hourStr, minuteStr] = reminderTime.split(':');
  const startHour = Number(hourStr);
  const startMinute = Number(minuteStr);
  const includeAlarm = options?.includeAlarm !== false;

  const sportLabel = SPORT_LABELS[plan.sport]?.label ?? plan.sport;
  const days = [...(Array.isArray(plan.scheduleJson) ? plan.scheduleJson : [])].sort(
    (a, b) => a.dayIndex - b.dayIndex
  );
  const dtStamp = formatIcsUtcStamp(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Discipline Coach//Smartwatch Workout Sync//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`AI Discipline Coach - Tuần ${plan.weekNumber}`)}`,
  ];

  for (let idx = 0; idx < days.length; idx += 1) {
    const day = days[idx];
    const eventStart = new Date(
      startBase.getFullYear(),
      startBase.getMonth(),
      startBase.getDate() + idx,
      startHour,
      startMinute,
      0
    );
    const durationMinutes =
      Number.isFinite(day.estimatedMinutes) && day.estimatedMinutes > 0
        ? Math.round(day.estimatedMinutes)
        : 20;
    const eventEnd = new Date(eventStart.getTime() + durationMinutes * 60 * 1000);

    const exerciseLines = (Array.isArray(day.exercises) ? day.exercises : []).map(
      (ex, exIdx) => `${exIdx + 1}. ${ex.name} (${ex.sets} · ${ex.repsOrDuration})`
    );
    const descriptionParts = [
      `Môn: ${sportLabel} | Trọng tâm: ${day.focusArea} | Cường độ: ${day.intensity}`,
      `Khởi động: ${day.warmup}`,
      ...(exerciseLines.length > 0 ? ['Bài tập:', ...exerciseLines] : ['Ngày nghỉ phục hồi chủ động.']),
      `Giãn cơ: ${day.cooldown}`,
      `Lưu ý an toàn: ${day.safetyNote}`,
    ];

    const summaryPrefix = day.isRestDay ? '[Nghỉ phục hồi]' : '[Tập luyện]';
    const uid = `adc-plan-${plan.id}-day-${day.dayIndex}@aidisciplinecoach.local`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${formatIcsLocalDateTime(eventStart)}`);
    lines.push(`DTEND:${formatIcsLocalDateTime(eventEnd)}`);
    lines.push(
      `SUMMARY:${escapeIcsText(`${summaryPrefix} ${day.dayLabel}: ${day.title}`)}`
    );
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`);
    if (includeAlarm) {
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT15M');
      lines.push('ACTION:DISPLAY');
      lines.push(
        `DESCRIPTION:${escapeIcsText(`Chuẩn bị cho buổi tập: ${day.title} (${durationMinutes} phút)`)}`
      );
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function formatElapsedDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
