import { formatDailyGoalDateLabel, type DailyGoalData } from './dailyGoal.ts';
import type { WorkoutHistoryEntry } from '../components/PlanTab.tsx';

export const UTF8_BOM = '\uFEFF';

const FORMULA_INJECTION_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escapes a single CSV field according to RFC 4180 and neutralizes spreadsheet
 * formula injection (leading =, +, -, @, tab, CR) so exported files are safe in Excel/Sheets.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = FORMULA_INJECTION_PREFIX.test(raw) ? `'${raw}` : raw;
  const needsQuotes = /[",\r\n]/.test(safe);
  const escaped = safe.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function formatCsvRows(headers: string[], rows: Array<Array<string | number | boolean>>): string {
  const headerLine = headers.map((h) => escapeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
  return `${UTF8_BOM}${[headerLine, ...dataLines].join('\r\n')}\r\n`;
}

function formatIsoDateShort(isoString?: string): string {
  if (!isoString) return '';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function buildDailyGoalsCsv(goals: DailyGoalData[]): string {
  const sorted = [...goals].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const headers = [
    'Ngày (YYYY-MM-DD)',
    'Ngày hiển thị',
    'Mục tiêu nhỏ',
    'Trạng thái',
    'Cập nhật gần nhất',
  ];
  const rows = sorted.map((goal) => [
    goal.dateKey,
    formatDailyGoalDateLabel(goal.dateKey),
    goal.title,
    goal.completed ? 'Đã hoàn thành' : 'Chưa hoàn thành',
    goal.updatedAt ? formatIsoDateShort(goal.updatedAt) : '',
  ]);
  return formatCsvRows(headers, rows);
}

export function buildWorkoutHistoryCsv(entries: WorkoutHistoryEntry[]): string {
  const headers = [
    'Tuần',
    'Ngày tạo lịch',
    'Ngày trong tuần',
    'Loại ngày',
    'Môn tập',
    'Tiêu đề buổi tập',
    'Trọng tâm',
    'Thời lượng dự kiến (phút)',
    'Cường độ',
  ];
  const rows = entries.map((entry) => [
    `Tuần ${entry.weekNumber}`,
    formatIsoDateShort(entry.planCreatedAt),
    entry.dayLabel,
    entry.isRestDay ? 'Ngày nghỉ phục hồi' : 'Ngày tập chính',
    entry.sportLabel,
    entry.title,
    entry.focusArea,
    entry.estimatedMinutes,
    entry.intensity,
  ]);
  return formatCsvRows(headers, rows);
}

export function buildCombinedDisciplineCsv(
  goals: DailyGoalData[],
  entries: WorkoutHistoryEntry[]
): string {
  const headers = [
    'Phân loại',
    'Ngày / Lịch tuần',
    'Nội dung',
    'Chi tiết',
    'Trạng thái / Cường độ',
    'Thời lượng dự kiến (phút)',
  ];

  const sortedGoals = [...goals].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const goalRows = sortedGoals.map((goal) => [
    'Mục tiêu nhỏ',
    `${goal.dateKey} (${formatDailyGoalDateLabel(goal.dateKey)})`,
    goal.title,
    'Cam kết kỷ luật hằng ngày',
    goal.completed ? 'Đã hoàn thành' : 'Chưa hoàn thành',
    '',
  ]);

  const workoutRows = entries.map((entry) => [
    'Nhật ký tập luyện',
    `Tuần ${entry.weekNumber} · ${formatIsoDateShort(entry.planCreatedAt)} · ${entry.dayLabel}`,
    entry.title,
    `${entry.sportLabel} · ${entry.focusArea}`,
    `Đã check-in ngày · ${entry.intensity}`,
    entry.estimatedMinutes,
  ]);

  return formatCsvRows(headers, [...goalRows, ...workoutRows]);
}

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
