import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ProgressBar } from './ProgressBar.tsx';
import {
  GOAL_LABELS,
  SPORT_LABELS,
  type GoalData,
  type ProfileData,
  type WorkoutDay,
  type WorkoutPlanData,
} from '../shared/types.ts';

interface PlanTabProps {
  plan: WorkoutPlanData | null;
  profile: ProfileData | null;
  goal: GoalData | null;
  isGenerating: boolean;
  togglingDayIndex: number | null;
  aiConsent: boolean;
  onGeneratePlan: () => Promise<void>;
  onToggleDayComplete: (planId: number, dayIndex: number) => Promise<void>;
  onGoToProfile: () => void;
  onGoToGoal: () => void;
}

const SHORT_DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function PlanTab({
  plan,
  profile,
  goal,
  isGenerating,
  togglingDayIndex,
  aiConsent,
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
    );
  }

  const days: WorkoutDay[] = Array.isArray(plan.scheduleJson) ? plan.scheduleJson : [];
  const activeDay = days.find((d) => d.dayIndex === selectedDayIndex) ?? days[0];
  const completedDays = Array.isArray(plan.completedDays) ? plan.completedDays : [];
  const workoutDays = days.filter((d) => !d.isRestDay);
  const workoutDaysCount = workoutDays.length;
  const completedWorkoutsCount = workoutDays.filter((d) =>
    completedDays.includes(d.dayIndex)
  ).length;
  const totalExercisesCount = workoutDays.reduce(
    (sum, day) => sum + (Array.isArray(day.exercises) ? day.exercises.length : 0),
    0
  );
  const completedExercisesCount = workoutDays
    .filter((d) => completedDays.includes(d.dayIndex))
    .reduce((sum, day) => sum + (Array.isArray(day.exercises) ? day.exercises.length : 0), 0);

  return (
    <div className="space-y-4">
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
              <p className="text-xs text-slate-500">Tiến độ buổi tập</p>
              <p className="text-sm font-mono-num font-bold text-teal-700">
                {completedWorkoutsCount}/{workoutDaysCount} buổi
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
          completedExercises={completedExercisesCount}
          totalExercises={totalExercisesCount}
          completedSessions={completedWorkoutsCount}
          totalSessions={workoutDaysCount}
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
                  <span>Đã hoàn thành</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4" />
                  <span>Đánh dấu hoàn thành</span>
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
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {activeDay.isRestDay ? 'Hoạt động phục hồi gợi ý' : 'Danh sách bài tập'}
            </h3>

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
    </div>
  );
}
