import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  History,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DAILY_GOAL_MAX_LENGTH,
  DAILY_GOAL_SUGGESTIONS,
  formatDailyGoalDateLabel,
  getTodayDateKey,
  type DailyGoalData,
} from '../lib/dailyGoal.ts';
import {
  GOAL_LABELS,
  SPORT_LABELS,
  type GoalData,
  type ProfileData,
  type SportOption,
  type WorkoutDay,
  type WorkoutPlanData,
} from '../shared/types.ts';

interface PlanTabProps {
  plan: WorkoutPlanData | null;
  planHistory: WorkoutPlanData[];
  profile: ProfileData | null;
  goal: GoalData | null;
  isGenerating: boolean;
  togglingDayIndex: number | null;
  aiConsent: boolean;
  dailyGoal: DailyGoalData | null;
  isSavingDailyGoal: boolean;
  isTogglingDailyGoal: boolean;
  onSaveDailyGoal: (title: string) => Promise<boolean>;
  onToggleDailyGoal: () => Promise<void>;
  onGeneratePlan: () => Promise<void>;
  onToggleDayComplete: (planId: number, dayIndex: number) => Promise<void>;
  onGoToProfile: () => void;
  onGoToGoal: () => void;
}

const SHORT_DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

interface ProgressBarProps {
  completedDaysCount: number;
  totalDaysCount: number;
  completedWorkoutsCount: number;
  workoutDaysCount: number;
}

export function calculateWeeklyProgress(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((completedCount / totalCount) * 100)));
}

export function ProgressBar({
  completedDaysCount,
  totalDaysCount,
  completedWorkoutsCount,
  workoutDaysCount,
}: ProgressBarProps) {
  const percentage = calculateWeeklyProgress(completedDaysCount, totalDaysCount);

  let disciplineStatus = 'Chưa có ngày nào được check-in trong tuần này';
  if (percentage === 100) {
    disciplineStatus = 'Đã check-in đủ tất cả các ngày trong tuần này';
  } else if (percentage >= 60) {
    disciplineStatus = 'Đang duy trì nhịp check-in kỷ luật rất ổn định';
  } else if (percentage > 0) {
    disciplineStatus = 'Đã khởi động chuỗi check-in theo ngày';
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800">
            Tỷ lệ check-in ngày trong tuần
          </p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{disciplineStatus}</p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-lg font-mono-num font-bold text-teal-600">
            {percentage}%
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Tỷ lệ phần trăm số ngày đã check-in trong tuần"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden"
      >
        <div
          className="h-full w-full origin-left rounded-full bg-teal-600 transition-transform duration-200 ease-out"
          style={{ transform: `scaleX(${percentage / 100})` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="font-mono-num font-medium text-slate-700">
          {completedDaysCount}/{totalDaysCount} ngày đã check-in
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-num">
          {completedWorkoutsCount}/{workoutDaysCount} ngày tập chính đã check-in
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Ghi nhận theo ngày (check-in ngày), không tự động coi toàn bộ từng bài tập hoặc số hiệp trong ngày đã hoàn thành.
      </p>
    </div>
  );
}

export interface WeeklyDayChartDatum {
  dayIndex: number;
  shortLabel: string;
  dayLabel: string;
  isRestDay: boolean;
  isCompleted: boolean;
  completedMinutes: number;
  remainingMinutes: number;
}

export interface WeeklySummaryMetrics {
  /** Tracking granularity: strictly day-level check-in (never exercise-level verified completion). */
  trackingGranularity: 'day_checkin_only';
  /** Explicit flag indicating individual exercise/set completion is NOT tracked by day check-in. */
  exerciseCompletionTracked: false;
  /** Estimated planned exercise minutes for workout days that have been checked in. */
  estimatedCheckedInMinutes: number;
  /** Alias preserved for chart compatibility; represents estimated planned minutes of checked-in workout days. */
  totalExerciseMinutes: number;
  plannedExerciseMinutes: number;
  /** Number of workout days with a day-level check-in. */
  checkedInWorkoutDays: number;
  /** Alias preserved for existing callers; equals checkedInWorkoutDays. */
  completedSessions: number;
  totalSessions: number;
  checkedInDaysCount: number;
  totalDaysCount: number;
  dailyData: WeeklyDayChartDatum[];
}

export function calculateWeeklySummary(
  days: WorkoutDay[],
  completedDays: number[]
): WeeklySummaryMetrics {
  let estimatedCheckedInMinutes = 0;
  let plannedExerciseMinutes = 0;
  let checkedInWorkoutDays = 0;
  let totalSessions = 0;
  let checkedInDaysCount = 0;

  const sortedDays = [...days].sort((a, b) => a.dayIndex - b.dayIndex);

  const dailyData: WeeklyDayChartDatum[] = sortedDays.map((day, idx) => {
    const shortLabel = SHORT_DAY_LABELS[idx] ?? `N${day.dayIndex}`;
    const isCompleted = completedDays.includes(day.dayIndex);
    if (isCompleted) {
      checkedInDaysCount += 1;
    }
    const rawMinutes = Number.isFinite(day.estimatedMinutes) ? Math.max(0, day.estimatedMinutes) : 0;
    const exerciseMinutes = day.isRestDay ? 0 : rawMinutes;

    if (!day.isRestDay) {
      totalSessions += 1;
      plannedExerciseMinutes += exerciseMinutes;
      if (isCompleted) {
        checkedInWorkoutDays += 1;
        estimatedCheckedInMinutes += exerciseMinutes;
      }
    }

    return {
      dayIndex: day.dayIndex,
      shortLabel,
      dayLabel: day.dayLabel,
      isRestDay: day.isRestDay,
      isCompleted,
      completedMinutes: !day.isRestDay && isCompleted ? exerciseMinutes : 0,
      remainingMinutes: !day.isRestDay && !isCompleted ? exerciseMinutes : 0,
    };
  });

  return {
    trackingGranularity: 'day_checkin_only',
    exerciseCompletionTracked: false,
    estimatedCheckedInMinutes,
    totalExerciseMinutes: estimatedCheckedInMinutes,
    plannedExerciseMinutes,
    checkedInWorkoutDays,
    completedSessions: checkedInWorkoutDays,
    totalSessions,
    checkedInDaysCount,
    totalDaysCount: sortedDays.length,
    dailyData,
  };
}

function WeeklyChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: WeeklyDayChartDatum }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const datum = payload[0]?.payload;
  if (!datum) {
    return null;
  }

  const minutes = datum.completedMinutes + datum.remainingMinutes;
  const statusText = datum.isRestDay
    ? 'Ngày nghỉ phục hồi'
    : datum.isCompleted
      ? 'Đã check-in ngày tập'
      : 'Chưa check-in';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-900">{datum.dayLabel}</p>
      <p className="text-slate-500 mt-0.5">{statusText}</p>
      {!datum.isRestDay && (
        <p className="font-mono-num font-semibold text-teal-600 mt-1">
          Ước tính kế hoạch: {minutes} phút
        </p>
      )}
    </div>
  );
}

export function WeeklyProgressSummary({
  days,
  completedDays,
}: {
  days: WorkoutDay[];
  completedDays: number[];
}) {
  const summary = calculateWeeklySummary(days, completedDays);
  const sessionRate = calculateWeeklyProgress(
    summary.checkedInWorkoutDays,
    summary.totalSessions
  );

  return (
    <section
      aria-label="Weekly Progress Summary"
      className="bg-white rounded-2xl border border-slate-200/90 p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-500">Weekly Check-in Summary</p>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Tổng kết check-in tuần
          </h2>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" aria-hidden="true" />
            <span>Đã check-in ngày</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" aria-hidden="true" />
            <span>Chưa check-in</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-100 py-4 border-b border-slate-100">
        <div className="pr-3">
          <p className="text-xs text-slate-500">Thời lượng dự kiến ngày đã check-in</p>
          <p className="mt-1 text-xl sm:text-2xl font-mono-num font-bold text-teal-600">
            {summary.estimatedCheckedInMinutes} phút
          </p>
          <p className="mt-0.5 text-xs font-mono-num text-slate-500">
            Ước tính từ lịch · Kế hoạch tuần: {summary.plannedExerciseMinutes} phút
          </p>
        </div>

        <div className="pl-4">
          <p className="text-xs text-slate-500">Số ngày tập đã check-in</p>
          <p className="mt-1 text-xl sm:text-2xl font-mono-num font-bold text-slate-900">
            {summary.checkedInWorkoutDays}/{summary.totalSessions} ngày tập
          </p>
          <p className="mt-0.5 text-xs font-mono-num text-slate-500">
            Check-in {sessionRate}% ngày tập chính
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-600 mb-2">
          Phân bổ thời lượng dự kiến theo ngày check-in (phút)
        </p>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height={180} minWidth={0}>
            <BarChart
              data={summary.dailyData}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              barSize={22}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                unit="p"
              />
              <Tooltip
                content={<WeeklyChartTooltip />}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar
                dataKey="completedMinutes"
                name="Đã check-in ngày"
                stackId="minutes"
                fill="#0d9488"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="remainingMinutes"
                name="Chưa check-in"
                stackId="minutes"
                fill="#e2e8f0"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
          Lưu ý đo lường: Số liệu chỉ phản ánh các ngày bạn đã check-in, không xác nhận bạn đã hoàn thành 100% từng bài tập hay thời gian thực đo bằng đồng hồ.
        </p>
      </div>
    </section>
  );
}

interface DailyGoalTrackerProps {
  dailyGoal: DailyGoalData | null;
  isSaving: boolean;
  isToggling: boolean;
  onSave: (title: string) => Promise<boolean>;
  onToggle: () => Promise<void>;
}

export function DailyGoalTracker({
  dailyGoal,
  isSaving,
  isToggling,
  onSave,
  onToggle,
}: DailyGoalTrackerProps) {
  const todayKey = dailyGoal?.dateKey ?? getTodayDateKey();
  const todayLabel = formatDailyGoalDateLabel(todayKey);

  const [isEditing, setIsEditing] = useState<boolean>(() => !dailyGoal);
  const [draftTitle, setDraftTitle] = useState<string>(() => dailyGoal?.title ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (dailyGoal) {
      setDraftTitle(dailyGoal.title);
      setIsEditing(false);
    } else {
      setDraftTitle('');
      setIsEditing(true);
    }
    setLocalError(null);
  }, [dailyGoal?.dateKey, dailyGoal?.title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftTitle.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      setLocalError('Vui lòng nhập mục tiêu nhỏ cụ thể cho hôm nay.');
      return;
    }
    setLocalError(null);
    const ok = await onSave(cleaned);
    if (ok) {
      setIsEditing(false);
    }
  };

  return (
    <section
      aria-label="Daily Goal Tracker"
      className="bg-white rounded-2xl border border-slate-200/90 p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span>Daily Goal Tracker</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">Hôm nay {todayLabel}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Mục tiêu nhỏ hôm nay
            </h2>
          </div>
        </div>

        {dailyGoal && !isEditing && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`font-semibold ${
                dailyGoal.completed ? 'text-teal-700' : 'text-slate-500'
              }`}
            >
              {dailyGoal.completed ? 'Đã hoàn thành hôm nay' : 'Đang thực hiện'}
            </span>
          </div>
        )}
      </div>

      {dailyGoal && !isEditing ? (
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p
              className={`text-sm sm:text-base font-semibold leading-snug break-words ${
                dailyGoal.completed ? 'line-through text-slate-400' : 'text-slate-900'
              }`}
            >
              {dailyGoal.title}
            </p>
            <p className="text-xs text-slate-500">
              Đã lưu vào Firebase · Duy trì cam kết nhỏ mỗi ngày để giữ nhịp kỷ luật.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isToggling}
              onClick={onToggle}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-60 ${
                dailyGoal.completed
                  ? 'bg-teal-50 text-teal-800 border border-teal-300 hover:bg-teal-100/70'
                  : 'bg-teal-700 text-white hover:bg-teal-800'
              }`}
            >
              {dailyGoal.completed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>{isToggling ? 'Đang cập nhật...' : 'Đã hoàn thành'}</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4" />
                  <span>{isToggling ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setDraftTitle(dailyGoal.title);
                setLocalError(null);
                setIsEditing(true);
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Đổi mục tiêu</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="pt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="daily-goal-input"
                className="text-xs font-semibold text-slate-700"
              >
                Cam kết nhỏ cho ngày {todayLabel}
              </label>
              <span className="text-[11px] font-mono-num text-slate-400">
                {draftTitle.length}/{DAILY_GOAL_MAX_LENGTH}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="daily-goal-input"
                type="text"
                maxLength={DAILY_GOAL_MAX_LENGTH}
                value={draftTitle}
                onChange={(e) => {
                  setDraftTitle(e.target.value);
                  if (localError) setLocalError(null);
                }}
                placeholder="Ví dụ: Uống đủ 2L nước"
                className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu mục tiêu hôm nay'}
                </button>

                {dailyGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTitle(dailyGoal.title);
                      setLocalError(null);
                      setIsEditing(false);
                    }}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </div>

            {localError && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-rose-700">
                {localError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-slate-500">Gợi ý nhanh:</p>
            <div className="flex flex-wrap gap-2">
              {DAILY_GOAL_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setDraftTitle(suggestion);
                    if (localError) setLocalError(null);
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

export interface WorkoutHistoryEntry {
  key: string;
  planId: number;
  weekNumber: number;
  sport: SportOption;
  sportLabel: string;
  planCreatedAt: string;
  dayIndex: number;
  dayLabel: string;
  title: string;
  focusArea: string;
  isRestDay: boolean;
  estimatedMinutes: number;
  intensity: WorkoutDay['intensity'];
}

export function formatShortVietnameseDate(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function buildWorkoutHistoryEntries(plans: WorkoutPlanData[]): WorkoutHistoryEntry[] {
  const sortedPlans = [...plans].sort((a, b) => {
    const timeDiff = b.createdAt.localeCompare(a.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return b.id - a.id;
  });

  const entries: WorkoutHistoryEntry[] = [];
  const seen = new Set<string>();

  for (const planItem of sortedPlans) {
    const days = Array.isArray(planItem.scheduleJson) ? planItem.scheduleJson : [];
    const completed = Array.isArray(planItem.completedDays) ? planItem.completedDays : [];
    const completedDays = days
      .filter((day) => completed.includes(day.dayIndex))
      .sort((a, b) => b.dayIndex - a.dayIndex);

    for (const day of completedDays) {
      const key = `${planItem.id}-${day.dayIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const rawMinutes = Number.isFinite(day.estimatedMinutes)
        ? Math.max(0, day.estimatedMinutes)
        : 0;

      entries.push({
        key,
        planId: planItem.id,
        weekNumber: planItem.weekNumber || 1,
        sport: planItem.sport,
        sportLabel: SPORT_LABELS[planItem.sport]?.label ?? planItem.sport,
        planCreatedAt: planItem.createdAt,
        dayIndex: day.dayIndex,
        dayLabel: day.dayLabel,
        title: day.title,
        focusArea: day.focusArea,
        isRestDay: day.isRestDay,
        estimatedMinutes: day.isRestDay ? 0 : rawMinutes,
        intensity: day.intensity,
      });
    }
  }

  return entries;
}

const HISTORY_COLLAPSED_LIMIT = 10;

export function WorkoutHistoryTable({ plans }: { plans: WorkoutPlanData[] }) {
  const [showAll, setShowAll] = useState(false);
  const entries = buildWorkoutHistoryEntries(plans);
  const totalMinutes = entries.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const visibleEntries = showAll ? entries : entries.slice(0, HISTORY_COLLAPSED_LIMIT);
  const hasMore = entries.length > HISTORY_COLLAPSED_LIMIT;

  return (
    <section
      aria-label="Nhật ký lịch sử tập luyện"
      className="bg-white rounded-2xl border border-slate-200/90 p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
            <History className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Workout History Log</p>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Nhật ký lịch sử tập luyện
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="font-mono-num font-semibold text-teal-700">
            {entries.length} ngày đã check-in
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">Ước tính {totalMinutes} phút kế hoạch</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="pt-4 text-sm text-slate-600 leading-relaxed">
          Chưa có ngày nào được check-in. Khi bạn bấm &ldquo;Check-in ngày này&rdquo; ở một ngày
          trong lịch tập tuần, nhật ký theo ngày sẽ tự động lưu lại tại đây để bạn đối chiếu.
        </p>
      ) : (
        <div className="pt-4 space-y-3">
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600">
                  <th scope="col" className="py-2.5 px-3 font-semibold whitespace-nowrap">
                    Lịch tuần
                  </th>
                  <th scope="col" className="py-2.5 px-3 font-semibold whitespace-nowrap">
                    Ngày
                  </th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">
                    Buổi tập đã check-in (theo ngày)
                  </th>
                  <th scope="col" className="py-2.5 px-3 font-semibold whitespace-nowrap">
                    Thời lượng dự kiến
                  </th>
                  <th scope="col" className="py-2.5 px-3 font-semibold whitespace-nowrap">
                    Cường độ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleEntries.map((entry) => (
                  <tr key={entry.key} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap align-top">
                      <p className="font-mono-num font-semibold text-slate-800">
                        Tuần {entry.weekNumber}
                      </p>
                      <p className="text-[11px] font-mono-num text-slate-500 mt-0.5">
                        {formatShortVietnameseDate(entry.planCreatedAt)}
                      </p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap align-top">
                      <p className="font-semibold text-slate-900">{entry.dayLabel}</p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          entry.isRestDay ? 'text-slate-400' : 'text-teal-700 font-medium'
                        }`}
                      >
                        {entry.isRestDay ? 'Phục hồi' : 'Ngày tập'}
                      </p>
                    </td>
                    <td className="py-3 px-3 align-top min-w-[200px]">
                      <p className="font-semibold text-slate-900 leading-snug">{entry.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {entry.sportLabel} · {entry.focusArea}
                      </p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap align-top font-mono-num font-semibold text-slate-800">
                      {entry.isRestDay ? 'Nghỉ' : `${entry.estimatedMinutes} phút`}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap align-top text-slate-700">
                      {entry.intensity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                {showAll
                  ? 'Thu gọn nhật ký'
                  : `Xem tất cả (${entries.length} ngày đã hoàn thành)`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function PlanTab({
  plan,
  planHistory,
  profile,
  goal,
  isGenerating,
  togglingDayIndex,
  aiConsent,
  dailyGoal,
  isSavingDailyGoal,
  isTogglingDailyGoal,
  onSaveDailyGoal,
  onToggleDailyGoal,
  onGeneratePlan,
  onToggleDayComplete,
  onGoToProfile,
  onGoToGoal,
}: PlanTabProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);

  useEffect(() => {
    setSelectedDayIndex(1);
  }, [plan?.id]);

  if (!plan) {
    const canGenerate = Boolean(profile && goal && aiConsent);
    return (
      <div className="space-y-4">
        <DailyGoalTracker
          dailyGoal={dailyGoal}
          isSaving={isSavingDailyGoal}
          isToggling={isTogglingDailyGoal}
          onSave={onSaveDailyGoal}
          onToggle={onToggleDailyGoal}
        />

        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Chưa có lịch tập Tuần 1
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            {canGenerate
              ? 'Hồ sơ và mục tiêu của bạn đã sẵn sàng. Nhấn nút dưới đây để AI Strategy Engine tạo lịch tập Tuần 1 phù hợp và lưu vào hệ thống.'
              : 'Hãy lưu Hồ sơ người dùng (M01), Thiết lập mục tiêu (M02) và xác nhận đồng ý xử lý dữ liệu sức khỏe trước khi AI xây dựng lịch tập Tuần 1.'}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {canGenerate ? (
              <button
                type="button"
                onClick={onGeneratePlan}
                disabled={isGenerating}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isGenerating ? 'Đang phân tích & tạo lịch...' : 'Tạo lịch tập Tuần 1 bằng AI'}
                </span>
              </button>
            ) : (
              <>
                {!profile && (
                  <button
                    type="button"
                    onClick={onGoToProfile}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 text-white font-semibold text-sm cursor-pointer"
                  >
                    Điền Hồ sơ (M01)
                  </button>
                )}
                {(!goal || !aiConsent) && (
                  <button
                    type="button"
                    onClick={onGoToGoal}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold text-sm cursor-pointer"
                  >
                    Mở Mục tiêu & Xác nhận (M02)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const days: WorkoutDay[] = Array.isArray(plan.scheduleJson) ? plan.scheduleJson : [];
  const activeDay = days.find((d) => d.dayIndex === selectedDayIndex) ?? days[0];
  const completedDays = Array.isArray(plan.completedDays) ? plan.completedDays : [];
  const completedDaysCount = days.filter((d) => completedDays.includes(d.dayIndex)).length;
  const totalDaysCount = days.length;
  const workoutDays = days.filter((d) => !d.isRestDay);
  const workoutDaysCount = workoutDays.length;
  const completedWorkoutsCount = workoutDays.filter((d) =>
    completedDays.includes(d.dayIndex)
  ).length;

  return (
    <div className="space-y-4">
      {(plan.isSimulated || plan.aiProvider === 'mock') && (
        <section
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs sm:text-sm text-amber-950 leading-relaxed"
        >
          <p className="font-bold">Chế độ AI mô phỏng (DEV — không phải Gemini thật)</p>
          <p className="mt-0.5 text-amber-900">
            Lịch tập này được tạo bởi Mock AI dùng cho kiểm thử môi trường phát triển, vẫn đi qua đầy đủ bộ kiểm định an toàn nhưng không phải kết quả từ Gemini API production.
          </p>
        </section>
      )}

      <WeeklyProgressSummary days={days} completedDays={completedDays} />

      <DailyGoalTracker
        dailyGoal={dailyGoal}
        isSaving={isSavingDailyGoal}
        isToggling={isTogglingDailyGoal}
        onSave={onSaveDailyGoal}
        onToggle={onToggleDailyGoal}
      />

      {plan.cautiousMode ? (
        <section
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 p-4 sm:p-5 text-rose-950"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="font-bold text-rose-950 text-sm sm:text-base">
                  Cảnh báo an toàn · Chế độ thận trọng đang bật
                </h2>
              </div>
              <p className="text-rose-900">{plan.safetyAlert}</p>
              {Array.isArray(plan.cautionReasons) && plan.cautionReasons.length > 0 && (
                <ul className="space-y-1 list-disc list-inside text-xs text-rose-800 pt-1 border-t border-rose-200/80">
                  {plan.cautionReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">Lưu ý an toàn Tuần 1: </span>
            {plan.safetyAlert}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-slate-200/90 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span>Tuần 1 / {plan.durationWeeks} tuần</span>
              <span aria-hidden="true">·</span>
              <span>{SPORT_LABELS[plan.sport]?.label ?? plan.sport}</span>
              <span aria-hidden="true">·</span>
              <span>{GOAL_LABELS[plan.goalType]?.label ?? plan.goalType}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-1">
              Chiến lược & Lịch tập Tuần 1
            </h1>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <div className="text-left sm:text-right">
              <p className="text-xs text-slate-500">Check-in ngày tập</p>
              <p className="text-sm font-mono-num font-bold text-teal-700">
                {completedWorkoutsCount}/{workoutDaysCount} ngày tập
              </p>
            </div>
            <button
              type="button"
              onClick={aiConsent ? onGeneratePlan : onGoToGoal}
              disabled={isGenerating}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Đang tạo...' : 'Tạo lại'}</span>
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-700 leading-relaxed">{plan.strategySummary}</p>

        <ProgressBar
          completedDaysCount={completedDaysCount}
          totalDaysCount={totalDaysCount}
          completedWorkoutsCount={completedWorkoutsCount}
          workoutDaysCount={workoutDaysCount}
        />

        {Array.isArray(plan.coachPrinciples) && plan.coachPrinciples.length > 0 && (
          <ul className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            {plan.coachPrinciples.map((principle, idx) => (
              <li key={principle} className="flex items-start gap-2">
                <span className="font-mono-num font-semibold text-teal-700 shrink-0">
                  0{idx + 1}.
                </span>
                <span>{principle}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        role="tablist"
        aria-label="Chọn ngày trong tuần"
        className="grid grid-cols-7 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200/90"
      >
        {days.map((day, idx) => {
          const isSelected = activeDay?.dayIndex === day.dayIndex;
          const isDone = completedDays.includes(day.dayIndex);
          const shortLabel = SHORT_DAY_LABELS[idx] ?? `N${day.dayIndex}`;
          return (
            <button
              key={day.dayIndex}
              role="tab"
              aria-selected={isSelected}
              type="button"
              onClick={() => setSelectedDayIndex(day.dayIndex)}
              className={`min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                isSelected
                  ? 'bg-teal-700 text-white'
                  : 'bg-transparent text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{shortLabel}</span>
              <span
                className={`text-[10px] font-medium ${
                  isSelected
                    ? 'text-teal-100'
                    : isDone
                      ? 'text-teal-700'
                      : day.isRestDay
                        ? 'text-slate-400'
                        : 'text-slate-500'
                }`}
              >
                {isDone ? 'Xong' : day.isRestDay ? 'Nghỉ' : 'Tập'}
              </span>
            </button>
          );
        })}
      </div>

      {activeDay && (
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{activeDay.dayLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{activeDay.isRestDay ? 'Ngày nghỉ phục hồi' : 'Ngày tập chính'}</span>
                <span aria-hidden="true">·</span>
                <span>Cường độ {activeDay.intensity}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono-num">
                  <Clock className="w-3.5 h-3.5" />
                  {activeDay.estimatedMinutes} phút
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{activeDay.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Trọng tâm: {activeDay.focusArea}</p>
            </div>

            <button
              type="button"
              disabled={togglingDayIndex === activeDay.dayIndex}
              onClick={() => onToggleDayComplete(plan.id, activeDay.dayIndex)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer disabled:opacity-60 ${
                completedDays.includes(activeDay.dayIndex)
                  ? 'bg-teal-50 text-teal-800 border border-teal-300'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {completedDays.includes(activeDay.dayIndex) ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>Đã check-in ngày này</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4" />
                  <span>Check-in ngày này</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
              <p className="font-semibold text-slate-900">Khởi động</p>
              <p className="text-slate-600 mt-1">{activeDay.warmup}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
              <p className="font-semibold text-slate-900">Giãn cơ cuối buổi</p>
              <p className="text-slate-600 mt-1">{activeDay.cooldown}</p>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {activeDay.isRestDay ? 'Hoạt động phục hồi gợi ý' : 'Danh sách bài tập tham khảo'}
              </h3>
              {!activeDay.isRestDay && (
                <span className="text-[11px] text-slate-500">
                  Check-in hiện áp dụng theo ngày (chưa theo dõi hoàn thành từng bài riêng lẻ)
                </span>
              )}
            </div>

            {activeDay.exercises.length === 0 ? (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 border border-slate-100">
                Ngày nghỉ hoàn toàn để cơ bắp và hệ thần kinh phục hồi. Hãy ngủ đủ giấc và uống đủ nước.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                {activeDay.exercises.map((ex, idx) => (
                  <div key={`${ex.name}-${idx}`} className="p-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          <span className="font-mono-num text-teal-700 mr-1.5">
                            0{idx + 1}.
                          </span>
                          {ex.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0 font-mono-num text-xs font-semibold text-slate-800">
                        <span>{ex.sets}</span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span>{ex.repsOrDuration}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {ex.restSeconds > 0 && (
                        <span className="font-mono-num">Nghỉ {ex.restSeconds} giây</span>
                      )}
                      {ex.restSeconds > 0 && <span aria-hidden="true">·</span>}
                      <span className="text-slate-600">{ex.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 px-4 py-3 text-xs text-amber-950 leading-relaxed">
            <span className="font-semibold">Ghi chú an toàn buổi tập: </span>
            {activeDay.safetyNote}
          </div>
        </section>
      )}

      <WorkoutHistoryTable plans={planHistory} />
    </div>
  );
}
