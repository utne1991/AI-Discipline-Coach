import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  calculateDisciplineStreak,
  formatDailyGoalDateLabel,
  getTodayDateKey,
  type DailyGoalData,
} from '../lib/dailyGoal.ts';
import { calculateOverallDisciplineProgress } from '../lib/overallProgress.ts';
import {
  resolveTodayScheduledDay,
} from '../services/strategyEngineV2.ts';
import {
  GOAL_LABELS,
  SPORT_LABELS,
  TIME_SLOT_LABELS,
  type GoalData,
  type ProfileData,
  type WorkoutPlanData,
} from '../shared/types.ts';
import { DailyGoalTracker } from './PlanTab.tsx';

interface TodayTabProps {
  uid: string;
  plan: WorkoutPlanData | null;
  planHistory: WorkoutPlanData[];
  profile: ProfileData | null;
  goal: GoalData | null;
  aiConsent: boolean;
  isGenerating: boolean;
  togglingDayIndex: number | null;
  dailyGoal: DailyGoalData | null;
  monthlyDailyGoals: DailyGoalData[];
  allDailyGoals: DailyGoalData[];
  isSavingDailyGoal: boolean;
  isTogglingDailyGoal: boolean;
  onSaveDailyGoal: (title: string) => Promise<boolean>;
  onToggleDailyGoal: () => Promise<void>;
  onGeneratePlan: () => Promise<void>;
  onToggleDayComplete: (planId: number, dayIndex: number) => Promise<void>;
  onGoToPlan: () => void;
  onGoToGoal: () => void;
  onGoToProfile: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  training: 'Tập luyện',
  recovery: 'Phục hồi',
  discipline: 'Kỷ luật',
  measurement: 'Đo lường',
};

export function TodayTab({
  uid,
  plan,
  planHistory,
  profile,
  goal,
  aiConsent,
  isGenerating,
  togglingDayIndex,
  dailyGoal,
  monthlyDailyGoals,
  allDailyGoals,
  isSavingDailyGoal,
  isTogglingDailyGoal,
  onSaveDailyGoal,
  onToggleDailyGoal,
  onGeneratePlan,
  onToggleDayComplete,
  onGoToPlan,
  onGoToGoal,
  onGoToProfile,
}: TodayTabProps) {
  const todayDateKey = getTodayDateKey();
  const todayLabel = formatDailyGoalDateLabel(todayDateKey);
  const streak = useMemo(() => calculateDisciplineStreak(monthlyDailyGoals), [monthlyDailyGoals]);
  const overallMetrics = useMemo(
    () =>
      calculateOverallDisciplineProgress({
        plans: planHistory,
        allDailyGoals,
        goalDurationWeeks: goal?.durationWeeks ?? plan?.durationWeeks ?? 8,
      }),
    [planHistory, allDailyGoals, goal?.durationWeeks, plan?.durationWeeks]
  );

  const commitmentStorageKey = `adc_daily_commitments_${uid}_${plan?.id ?? 'none'}_${todayDateKey}`;
  const [checkedTaskIds, setCheckedTaskIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(commitmentStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setCheckedTaskIds(parsed.filter((id): id is string => typeof id === 'string'));
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }
    setCheckedTaskIds([]);
  }, [commitmentStorageKey]);

  const toggleCommitmentTask = (taskId: string) => {
    setCheckedTaskIds((prev) => {
      const next = prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      try {
        window.localStorage.setItem(commitmentStorageKey, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  if (!plan) {
    const canGenerate = Boolean(profile && goal && aiConsent);
    return (
      <div className="space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span>Bảng điều khiển trung tâm</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">Hôm nay {todayLabel}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Khởi động hệ thống kỷ luật của bạn
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {canGenerate
              ? 'Hồ sơ và mục tiêu của bạn đã sẵn sàng. Tạo chiến lược toàn thời hạn để nhận nhiệm vụ hằng ngày, khối lượng theo môn và lịch thực tế hôm nay.'
              : 'AI Discipline Coach biến mục tiêu cá nhân thành lộ trình nhiều giai đoạn và cam kết rõ ràng mỗi ngày. Hãy hoàn tất hồ sơ và mục tiêu để bắt đầu.'}
          </p>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            {canGenerate ? (
              <button
                type="button"
                onClick={onGeneratePlan}
                disabled={isGenerating}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isGenerating
                    ? 'Đang xây dựng chiến lược v2...'
                    : 'Tạo chiến lược & Nhiệm vụ hôm nay'}
                </span>
              </button>
            ) : (
              <>
                {!profile && (
                  <button
                    type="button"
                    onClick={onGoToProfile}
                    className="min-h-[48px] px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold cursor-pointer"
                  >
                    1. Điền Hồ sơ thể chất
                  </button>
                )}
                <button
                  type="button"
                  onClick={onGoToGoal}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold cursor-pointer"
                >
                  {profile ? 'Thiết lập Mục tiêu & Tạo chiến lược' : '2. Thiết lập Mục tiêu'}
                </button>
              </>
            )}
          </div>
        </section>

        <DailyGoalTracker
          dailyGoal={dailyGoal}
          isSaving={isSavingDailyGoal}
          isToggling={isTogglingDailyGoal}
          onSave={onSaveDailyGoal}
          onToggle={onToggleDailyGoal}
        />
      </div>
    );
  }

  const resolvedToday = resolveTodayScheduledDay(plan.scheduleJson, plan.strategyV2);
  const todayWorkout = resolvedToday.day;
  const scheduledMeta = resolvedToday.scheduledDay;
  const completedDays = Array.isArray(plan.completedDays) ? plan.completedDays : [];
  const isTodayCheckedIn = todayWorkout ? completedDays.includes(todayWorkout.dayIndex) : false;

  const workoutDays = plan.scheduleJson.filter((d) => !d.isRestDay);
  const checkedInWorkouts = workoutDays.filter((d) => completedDays.includes(d.dayIndex)).length;
  const strategy = plan.strategyV2;
  const activePhase = strategy?.phases[0] ?? null;
  const activeSports =
    Array.isArray(plan.sports) && plan.sports.length > 0 ? plan.sports : [plan.sport];
  const sportsLabel = activeSports.map((s) => SPORT_LABELS[s]?.label ?? s).join(' + ');
  const timeWindow =
    scheduledMeta?.timeWindow ??
    (strategy
      ? TIME_SLOT_LABELS[strategy.calendarContext.preferredTimeSlot]?.window
      : '18:00–20:00');
  const timezone = strategy?.calendarContext.timezone ?? 'Asia/Ho_Chi_Minh';
  const commitments =
    resolvedToday.tasks.length > 0
      ? resolvedToday.tasks
      : (strategy?.dailyCommitments ?? []).slice(0, 4);
  const completedCommitmentsCount = commitments.filter((t) => checkedTaskIds.includes(t.id)).length;

  return (
    <div className="space-y-4">
      {(plan.isSimulated || plan.aiProvider === 'mock') && (
        <section
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 leading-relaxed"
        >
          <span className="font-bold">Chế độ AI mô phỏng (DEV): </span>
          Kế hoạch hiện tại được tạo từ Mock AI cho kiểm thử môi trường phát triển, không phải kết quả gọi Gemini production.
        </section>
      )}

      {/* Central Header + Discipline KPIs */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-mono-num font-semibold text-teal-700">Hôm nay {todayLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{timezone}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">Kế hoạch v{plan.versionNumber ?? 1}</span>
              {activePhase && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Giai đoạn {activePhase.phaseNumber}/{strategy?.phases.length ?? 1}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
              {profile?.fullName
                ? `Trọng tâm kỷ luật hôm nay, ${profile.fullName}`
                : 'Trọng tâm kỷ luật hôm nay'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {sportsLabel} · {GOAL_LABELS[plan.goalType]?.label ?? plan.goalType} ({plan.durationWeeks}{' '}
              tuần)
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToPlan}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CalendarDays className="w-4 h-4 text-teal-700" />
            <span>Mở toàn bộ lộ trình</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="py-2 sm:py-0 sm:pr-4">
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-teal-700" />
              <span>Chuỗi kỷ luật</span>
            </p>
            <p className="mt-1 text-lg sm:text-xl font-mono-num font-bold text-teal-700">
              {streak.currentStreakDays} ngày
            </p>
          </div>

          <div className="py-2 sm:py-0 pl-4 sm:px-4 border-l sm:border-l-0 border-slate-100">
            <p className="text-xs text-slate-500">Check-in tuần này</p>
            <p className="mt-1 text-lg sm:text-xl font-mono-num font-bold text-slate-900">
              {checkedInWorkouts}/{workoutDays.length} buổi
            </p>
          </div>

          <div className="py-2 sm:py-0 sm:px-4 pt-3 sm:pt-0">
            <p className="text-xs text-slate-500">Tuần duy trì kỷ luật</p>
            <p className="mt-1 text-lg sm:text-xl font-mono-num font-bold text-slate-900">
              {overallMetrics.disciplinedWeeksCount} tuần
            </p>
          </div>

          <div className="py-2 sm:py-0 pl-4 pt-3 sm:pt-0 border-l sm:border-l-0 border-slate-100">
            <p className="text-xs text-slate-500">Chế độ an toàn</p>
            <p
              className={`mt-1 text-sm sm:text-base font-bold ${
                plan.cautiousMode ? 'text-rose-700' : 'text-teal-700'
              }`}
            >
              {plan.cautiousMode ? 'Thận trọng' : 'Tiêu chuẩn'}
            </p>
          </div>
        </div>
      </section>

      {/* Today's Workout Mission Card */}
      {todayWorkout && (
        <section
          aria-label="Buổi tập trọng tâm hôm nay"
          className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{todayWorkout.dayLabel}</span>
                {scheduledMeta?.dateKey && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      {formatDailyGoalDateLabel(scheduledMeta.dateKey)}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono-num inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Khung {timeWindow}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{todayWorkout.estimatedMinutes} phút</span>
                <span aria-hidden="true">·</span>
                <span>Cường độ {todayWorkout.intensity}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                {todayWorkout.title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Trọng tâm: {todayWorkout.focusArea}</p>
            </div>

            <button
              type="button"
              disabled={togglingDayIndex === todayWorkout.dayIndex}
              onClick={() => onToggleDayComplete(plan.id, todayWorkout.dayIndex)}
              className={`min-h-[48px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-60 ${
                isTodayCheckedIn
                  ? 'bg-teal-50 text-teal-800 border border-teal-300'
                  : 'bg-teal-700 text-white hover:bg-teal-800'
              }`}
            >
              {isTodayCheckedIn ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>Đã check-in hôm nay</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4" />
                  <span>Check-in ngày hôm nay</span>
                </>
              )}
            </button>
          </div>

          {strategy?.todayDirective && (
            <p className="text-sm text-slate-700 leading-relaxed">{strategy.todayDirective}</p>
          )}

          {todayWorkout.isRestDay ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
              Hôm nay là ngày phục hồi chủ động trong chiến lược. Tập trung ngủ đủ giấc, uống đủ nước và giãn cơ nhẹ để cơ thể sẵn sàng cho buổi tập kế tiếp.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-800">
                  Nội dung chính ({todayWorkout.exercises.length} bài tập)
                </span>
                <button
                  type="button"
                  onClick={onGoToPlan}
                  className="text-teal-700 hover:text-teal-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Xem chi tiết khởi động & kỹ thuật</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                {todayWorkout.exercises.slice(0, 4).map((ex, idx) => (
                  <div
                    key={`${ex.name}-${idx}`}
                    className="px-3.5 py-2.5 bg-white flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <span className="font-medium text-slate-900 truncate">
                      <span className="font-mono-num text-teal-700 mr-1.5">0{idx + 1}.</span>
                      {ex.name}
                    </span>
                    <span className="font-mono-num text-xs text-slate-600 shrink-0">
                      {ex.sets} · {ex.repsOrDuration}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 px-4 py-3 text-xs text-amber-950 leading-relaxed flex items-start gap-2">
            {plan.cautiousMode ? (
              <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            )}
            <span>
              <strong className="font-semibold">An toàn hôm nay: </strong>
              {todayWorkout.safetyNote}
            </span>
          </div>
        </section>
      )}

      {/* Strategy-generated Daily Commitments Checklist */}
      {commitments.length > 0 && (
        <section
          aria-label="Nhiệm vụ hằng ngày từ chiến lược"
          className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-teal-700 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Cam kết hành động hôm nay từ chiến lược
                </h2>
                <p className="text-xs text-slate-500">
                  Sinh tự động từ chiến lược đa giai đoạn & quy tắc an toàn của bạn
                </p>
              </div>
            </div>
            <span className="text-xs font-mono-num font-semibold text-teal-700">
              {completedCommitmentsCount}/{commitments.length} hoàn thành
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {commitments.map((task) => {
              const checked = checkedTaskIds.includes(task.id);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleCommitmentTask(task.id)}
                  className="w-full py-3 flex items-start gap-3 text-left transition-colors hover:bg-slate-50/70 rounded-xl px-2 -mx-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700"
                >
                  {checked ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          checked ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="text-[11px] font-mono-num text-slate-500 shrink-0">
                        {CATEGORY_LABELS[task.category] ?? task.category} · {task.estimatedMinutes}p
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{task.detail}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Personal Micro Daily Goal Tracker synced to Firestore */}
      <DailyGoalTracker
        dailyGoal={dailyGoal}
        isSaving={isSavingDailyGoal}
        isToggling={isTogglingDailyGoal}
        onSave={onSaveDailyGoal}
        onToggle={onToggleDailyGoal}
      />

      {/* Strategic Compass Footer Card */}
      {strategy && (
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">
                La bàn chiến lược & Đánh giá định kỳ
              </h2>
            </div>
            <button
              type="button"
              onClick={onGoToGoal}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
            >
              Điều chỉnh mục tiêu
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
            <div>
              <p className="font-semibold text-slate-800">Mục tiêu cuối cùng</p>
              <p className="text-slate-600 mt-0.5">{strategy.ultimateGoal}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Lịch đánh giá lại</p>
              <p className="text-slate-600 mt-0.5">{strategy.reassessmentSchedule}</p>
            </div>
          </div>

          {strategy.stopAndEscalateCriteria[0] && (
            <p className="text-xs text-rose-900 bg-rose-50/70 border border-rose-200 rounded-xl px-3.5 py-2.5">
              <strong className="font-semibold">Ngưỡng dừng an toàn: </strong>
              {strategy.stopAndEscalateCriteria[0]}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
