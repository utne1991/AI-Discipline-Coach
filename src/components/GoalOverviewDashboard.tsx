import { ArrowRight, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyGoalData } from '../lib/dailyGoal.ts';
import {
  calculateOverallDisciplineProgress,
  type PlanCompletionPoint,
} from '../lib/overallProgress.ts';
import type { WorkoutPlanData } from '../shared/types.ts';

interface GoalOverviewDashboardProps {
  planHistory: WorkoutPlanData[];
  allDailyGoals: DailyGoalData[];
  goalDurationWeeks: number;
  onGoToPlan?: () => void;
}

function PlanTrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: PlanCompletionPoint }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-900">{point.label}</p>
      <p className="font-mono-num font-semibold text-teal-600 mt-1">
        Hoàn thành: {point.completionRate}%
      </p>
      <p className="font-mono-num text-slate-500 mt-0.5">
        {point.checkedInWorkoutDays}/{point.totalWorkoutDays} ngày tập chính đã check-in
      </p>
    </div>
  );
}

export function GoalOverviewDashboard({
  planHistory,
  allDailyGoals,
  goalDurationWeeks,
  onGoToPlan,
}: GoalOverviewDashboardProps) {
  const metrics = calculateOverallDisciplineProgress({
    plans: planHistory,
    allDailyGoals,
    goalDurationWeeks,
  });

  let disciplineSummaryText =
    'Bắt đầu tuần kỷ luật đầu tiên bằng cách tạo lịch tập tuần hoặc hoàn thành một mục tiêu nhỏ hằng ngày.';
  if (metrics.disciplinedWeeksCount >= metrics.targetWeeks) {
    disciplineSummaryText =
      'Bạn đã hoàn thành đủ số tuần duy trì kỷ luật của lộ trình mục tiêu! Hãy đặt mục tiêu tiếp theo để tiếp tục nâng cấp bản thân.';
  } else if (metrics.averageWorkoutCompletionRate >= 75 && metrics.disciplinedWeeksCount > 0) {
    disciplineSummaryText =
      'Độ ổn định rất tốt! Tỷ lệ duy trì lịch tập trung bình đang ở mức cao, tiếp tục giữ nhịp qua từng tuần.';
  } else if (metrics.hasAnyActivity) {
    disciplineSummaryText =
      'Bạn đang xây dựng nền tảng kỷ luật cá nhân. Duy trì check-in đều đặn mỗi tuần để thấy rõ sự tiến bộ dài hạn.';
  }

  return (
    <section
      aria-label="Bảng điều khiển tiến độ kỷ luật tổng thể"
      className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span>Tổng quan phát triển cá nhân</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">Lộ trình {metrics.targetWeeks} tuần</span>
              {metrics.totalPlansCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{metrics.totalPlansCount} lịch tuần</span>
                </>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Tiến độ kỷ luật tổng thể
            </h2>
          </div>
        </div>

        {onGoToPlan && metrics.totalPlansCount > 0 && (
          <button
            type="button"
            onClick={onGoToPlan}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <span>Mở lịch tập tuần</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 py-4 border-b border-slate-100 gap-3 sm:gap-0">
        <div className="sm:pr-4">
          <p className="text-xs text-slate-500">Số tuần đã duy trì kỷ luật</p>
          <p className="mt-1 text-xl sm:text-2xl font-mono-num font-bold text-teal-600">
            {metrics.disciplinedWeeksCount}/{metrics.targetWeeks} tuần
          </p>
          <p className="mt-0.5 text-xs font-mono-num text-slate-500">
            Chuỗi {metrics.consecutiveDisciplinedWeeks} tuần liên tiếp · Đạt {metrics.goalWeekProgressPercent}%
          </p>
        </div>

        <div className="pt-3 sm:pt-0 sm:px-4">
          <p className="text-xs text-slate-500">Tỷ lệ hoàn thành bài tập trung bình</p>
          <p className="mt-1 text-xl sm:text-2xl font-mono-num font-bold text-slate-900">
            {metrics.averageWorkoutCompletionRate}%
          </p>
          <p className="mt-0.5 text-xs font-mono-num text-slate-500">
            {metrics.totalCheckedInWorkoutDays}/{metrics.totalPlannedWorkoutDays} ngày tập chính đã check-in
          </p>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4">
          <p className="text-xs text-slate-500">Mục tiêu nhỏ đã hoàn thành</p>
          <p className="mt-1 text-xl sm:text-2xl font-mono-num font-bold text-slate-900">
            {metrics.completedDailyGoalsCount} mục tiêu
          </p>
          <p className="mt-0.5 text-xs font-mono-num text-slate-500">
            {metrics.dailyGoalCompletionRate}% mục tiêu đã đặt · Chuỗi {metrics.currentDailyStreak} ngày
          </p>
        </div>
      </div>

      <div className="pt-4 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700">
              Tiến độ hoàn thành lộ trình {metrics.targetWeeks} tuần
            </span>
            <span className="font-mono-num font-semibold text-teal-700">
              {metrics.goalWeekProgressPercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Tỷ lệ số tuần đã duy trì kỷ luật so với lộ trình mục tiêu"
            aria-valuenow={metrics.goalWeekProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-teal-600 transition-transform duration-200 ease-out"
              style={{ transform: `scaleX(${metrics.goalWeekProgressPercent / 100})` }}
            />
          </div>
        </div>

        {metrics.planTrend.length > 0 ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium text-slate-600">
                Tỷ lệ check-in ngày tập chính qua các lịch tuần (%)
              </p>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" aria-hidden="true" />
                <span>Tỷ lệ check-in (%)</span>
              </span>
            </div>
            <div className="h-[156px] w-full">
              <ResponsiveContainer width="100%" height={156} minWidth={0}>
                <BarChart
                  data={metrics.planTrend}
                  margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  barSize={28}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip content={<PlanTrendTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar
                    dataKey="completionRate"
                    name="Tỷ lệ check-in"
                    fill="#0d9488"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-4 py-3 text-xs text-slate-600 leading-relaxed">
            Chưa có dữ liệu lịch tập tuần nào. Hãy hoàn tất thiết lập mục tiêu bên dưới và tạo lịch Tuần 1 để bắt đầu theo dõi biểu đồ tiến bộ kỷ luật của bạn.
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 space-y-1">
          <p className="text-xs text-slate-700 leading-relaxed">{disciplineSummaryText}</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Lưu ý đo lường: Tỷ lệ hoàn thành tập trung bình được tính từ số ngày tập chính đã check-in trên từng lịch tuần (ghi nhận theo ngày, không tự động xác nhận từng bài tập riêng lẻ).
          </p>
        </div>
      </div>
    </section>
  );
}
