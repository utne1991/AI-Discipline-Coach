import {
  Activity,
  CalendarRange,
  CheckCircle2,
  Compass,
  Flag,
  GitBranch,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  SPORT_LABELS,
  TIME_SLOT_LABELS,
  type FeasibilityStatus,
  type StrategyV2Blueprint,
  type WorkoutPlanData,
} from '../shared/types.ts';

interface StrategyV2RoadmapPanelProps {
  plan: WorkoutPlanData;
  planHistory: WorkoutPlanData[];
  inspectedPlanId: number;
  onSelectVersion: (planId: number) => void;
}

const FEASIBILITY_META: Record<
  FeasibilityStatus,
  { label: string; textClass: string; boxClass: string }
> = {
  feasible: {
    label: 'Khả thi tốt',
    textClass: 'text-teal-800',
    boxClass: 'bg-teal-50/70 border-teal-200',
  },
  ambitious_adjust: {
    label: 'Tham vọng · Cần giãn tiến độ',
    textClass: 'text-amber-900',
    boxClass: 'bg-amber-50/80 border-amber-200',
  },
  caution_required: {
    label: 'Ưu tiên Chế độ thận trọng',
    textClass: 'text-rose-900',
    boxClass: 'bg-rose-50/80 border-rose-200',
  },
};

function formatDateShort(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  const d = String(parsed.getDate()).padStart(2, '0');
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const y = parsed.getFullYear();
  return `${d}/${m}/${y}`;
}

export function StrategyV2RoadmapPanel({
  plan,
  planHistory,
  inspectedPlanId,
  onSelectVersion,
}: StrategyV2RoadmapPanelProps) {
  const strategy: StrategyV2Blueprint | undefined = plan.strategyV2;
  const activeSports =
    Array.isArray(plan.sports) && plan.sports.length > 0 ? plan.sports : [plan.sport];
  const sportsText = activeSports.map((s) => SPORT_LABELS[s]?.label ?? s).join(' + ');

  if (!strategy) {
    return (
      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Compass className="w-4 h-4 text-teal-700" />
          <h2>Chiến lược phiên bản cũ (Sprint 01)</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Kế hoạch này được tạo trước khi nâng cấp Strategy Engine v2. Hãy nhấn &ldquo;Tạo phiên bản mới&rdquo; hoặc cập nhật mục tiêu ở tab Mục tiêu để sinh lộ trình đa giai đoạn, khối lượng theo từng môn và nhiệm vụ hằng ngày.
        </p>
      </section>
    );
  }

  const feasibilityMeta =
    FEASIBILITY_META[strategy.feasibility.status] ?? FEASIBILITY_META.feasible;

  return (
    <div className="space-y-4">
      {planHistory.length > 0 && (
        <section
          aria-label="Quản lý phiên bản kế hoạch"
          className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-teal-700 shrink-0" />
              <h2 className="text-sm font-bold text-slate-900">
                Phiên bản kế hoạch & Lịch sử điều chỉnh
              </h2>
            </div>
            <span className="text-xs font-mono-num text-slate-500">
              {planHistory.length} phiên bản đã lưu
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {planHistory.slice(0, 6).map((item, idx) => {
              const versionNum = item.versionNumber ?? planHistory.length - idx;
              const isSelected = item.id === inspectedPlanId;
              const isLatest = idx === 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectVersion(item.id)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    isSelected
                      ? 'border-teal-700 bg-teal-50/80 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-mono-num font-bold">
                    <span>v{versionNum}</span>
                    {isLatest && (
                      <span className="text-[11px] font-sans font-semibold text-teal-700">
                        · Hiện hành
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono-num mt-0.5">
                    {formatDateShort(item.createdAt)}
                  </p>
                </button>
              );
            })}
          </div>

          {plan.revisionReason && (
            <p className="text-xs text-slate-600 leading-relaxed pt-1 border-t border-slate-100">
              <span className="font-semibold text-slate-800">
                Lý do phiên bản v{plan.versionNumber ?? 1}:{' '}
              </span>
              {plan.revisionReason}
            </p>
          )}
        </section>
      )}

      <section
        aria-label="Chiến lược tổng thể Strategy Engine v2"
        className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span>Strategy Engine v2</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">v{plan.versionNumber ?? 1}</span>
              <span aria-hidden="true">·</span>
              <span>{sportsText}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">
                {TIME_SLOT_LABELS[strategy.calendarContext.preferredTimeSlot]?.window ?? '18:00–20:00'} (
                {strategy.calendarContext.timezone})
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-1">
              Bản đồ chiến lược toàn thời hạn ({plan.durationWeeks} tuần)
            </h2>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <p className="text-[11px] text-slate-500">Điểm khả thi mục tiêu</p>
            <p className={`text-sm font-mono-num font-bold ${feasibilityMeta.textClass}`}>
              {strategy.feasibility.score}/100 · {feasibilityMeta.label}
            </p>
          </div>
        </div>

        {/* Q1 & Q2: Ultimate Goal & Current Position */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
              01. Mục tiêu cuối cùng
            </p>
            <p className="text-sm text-slate-900 font-medium leading-relaxed">
              {strategy.ultimateGoal}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              02. Bạn đang ở đâu hiện tại
            </p>
            <p className="text-sm text-slate-800 leading-relaxed">{strategy.currentPosition}</p>
          </div>
        </div>

        <div className={`rounded-xl border p-3.5 text-xs leading-relaxed ${feasibilityMeta.boxClass}`}>
          <p className={`font-semibold ${feasibilityMeta.textClass}`}>
            Đánh giá khả thi ({strategy.feasibility.weeklyDeltaRequired})
          </p>
          <p className="mt-1 text-slate-800">{strategy.feasibility.rationale}</p>
          {strategy.feasibility.adjustments.length > 0 && (
            <ul className="mt-2 space-y-1 list-disc list-inside text-slate-700">
              {strategy.feasibility.adjustments.map((adj) => (
                <li key={adj}>{adj}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Q3: Multi-phase roadmap + milestones */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-teal-700 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900">
              03. Lộ trình từng giai đoạn & Cột mốc đo lường
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {strategy.phases.map((phase) => (
              <div
                key={phase.phaseNumber}
                className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono-num font-bold text-teal-700">
                    Giai đoạn {phase.phaseNumber}
                  </span>
                  <span className="font-mono-num text-slate-500">
                    Tuần {phase.weekStart}–{phase.weekEnd}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">{phase.name}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{phase.objective}</p>
                <p className="text-[11px] font-mono-num font-medium text-slate-700 pt-1.5 border-t border-slate-100">
                  Khối lượng: {phase.weeklyVolumeTarget}
                </p>
                <p className="text-[11px] text-slate-500">Cột mốc: {phase.milestone}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
            {strategy.milestones.map((ms) => (
              <div
                key={`${ms.weekNumber}-${ms.title}`}
                className="p-3.5 bg-slate-50/50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <Flag className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      <span className="font-mono-num text-teal-700 mr-1.5">Tuần {ms.weekNumber}</span>
                      {ms.title}
                    </p>
                    <p className="text-slate-600 mt-0.5">{ms.measurableCheck}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tiêu chí đạt: {ms.passCriteria}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Q4: Volume allocation per sport */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-700 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900">
              04. Phân bổ khối lượng tập luyện theo từng môn
            </h3>
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600">
                  <th scope="col" className="py-2.5 px-3 font-semibold">
                    Bộ môn
                  </th>
                  <th scope="col" className="py-2.5 px-3 font-semibold whitespace-nowrap">
                    Tần suất
                  </th>
                  <th scope="col" className="py-2.5 px-3 font-semibold whitespace-nowrap">
                    Khối lượng tuần
                  </th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">
                    Phân bổ cường độ & Lý giải
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {strategy.volumeAllocation.map((vol) => (
                  <tr key={vol.sport}>
                    <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap align-top">
                      {vol.sportLabel}
                    </td>
                    <td className="py-3 px-3 font-mono-num font-semibold text-teal-700 whitespace-nowrap align-top">
                      {vol.sessionsPerWeek} buổi/tuần
                    </td>
                    <td className="py-3 px-3 font-mono-num text-slate-800 whitespace-nowrap align-top">
                      <p className="font-semibold">{vol.volumeMetricLabel}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{vol.weeklyMinutes} phút/tuần</p>
                    </td>
                    <td className="py-3 px-3 text-slate-600 align-top">
                      <p className="font-medium text-slate-800">{vol.intensityDistribution}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{vol.rationale}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Q5: Today's directive & daily commitments */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900">
              05. Nhiệm vụ hôm nay & Cam kết hằng ngày từ chiến lược
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {strategy.todayDirective}
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {strategy.dailyCommitments.slice(0, 6).map((task) => (
              <li
                key={task.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{task.title}</span>
                  <span className="font-mono-num text-[11px] text-teal-700 shrink-0">
                    {task.estimatedMinutes}p
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">{task.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Q6 & Q7: Reassessment & Adjustment signals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
              <span>06. Khi nào cần đánh giá lại?</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {strategy.reassessmentSchedule}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4 space-y-1.5">
            <p className="text-xs font-bold text-slate-900">
              07. Dữ liệu cần theo dõi để điều chỉnh
            </p>
            <ul className="space-y-1 list-disc list-inside text-xs text-slate-700 leading-relaxed">
              {strategy.adjustmentSignals.map((sig) => (
                <li key={sig}>{sig}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Q8: Stop, recover, or consult a specialist */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-950">
            <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
            <span>08. Khi nào cần dừng tập, phục hồi hoặc tham khảo chuyên gia?</span>
          </div>
          <ul className="space-y-1 list-disc list-inside text-xs text-rose-900 leading-relaxed">
            {strategy.stopAndEscalateCriteria.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
