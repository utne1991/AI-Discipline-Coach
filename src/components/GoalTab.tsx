import { Check, Sparkles, AlertCircle } from 'lucide-react';
import {
  GOAL_LABELS,
  SPORT_LABELS,
  type GoalData,
  type GoalType,
  type SportOption,
} from '../shared/types.ts';

interface GoalTabProps {
  form: GoalData;
  onChange: (next: GoalData) => void;
  onSaveGoal: () => Promise<void>;
  onSaveAndGeneratePlan: () => Promise<void>;
  isSavingGoal: boolean;
  isGeneratingPlan: boolean;
  hasProfileSaved: boolean;
  onGoToProfile: () => void;
  hasUnsavedChanges: boolean;
  lastSavedAt?: string;
}

const DURATION_PRESETS = [4, 6, 8, 12];

export function GoalTab({
  form,
  onChange,
  onSaveGoal,
  onSaveAndGeneratePlan,
  isSavingGoal,
  isGeneratingPlan,
  hasProfileSaved,
  onGoToProfile,
  hasUnsavedChanges,
  lastSavedAt,
}: GoalTabProps) {
  return (
    <div className="space-y-5">
      {!hasProfileSaved && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-amber-950">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-sm">Bạn chưa lưu Hồ sơ người dùng</p>
              <p className="mt-0.5 text-amber-900">
                Hãy hoàn thành và lưu mục Hồ sơ trước để AI thiết kế lịch tập Tuần 1 chính xác và an toàn.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToProfile}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-900 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Nhập hồ sơ
          </button>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              02. Thiết lập mục tiêu
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Chọn bộ môn chính, mục tiêu trọng tâm và thời hạn lộ trình.
            </p>
          </div>
          {lastSavedAt && !hasUnsavedChanges && (
            <span className="text-xs text-teal-700 font-medium whitespace-nowrap">
              Đã lưu mục tiêu
            </span>
          )}
        </div>

        <div className="mt-5">
          <span className="block text-sm font-semibold text-slate-900 mb-2.5">
            Môn tập chính
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(Object.keys(SPORT_LABELS) as SportOption[]).map((sportKey) => {
              const info = SPORT_LABELS[sportKey];
              const active = form.sport === sportKey;
              return (
                <button
                  key={sportKey}
                  type="button"
                  onClick={() => onChange({ ...form, sport: sportKey })}
                  className={`min-h-[68px] text-left rounded-2xl border p-4 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    active
                      ? 'border-teal-700 bg-teal-50/70 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{info.label}</span>
                    {active && <Check className="w-4 h-4 text-teal-700 shrink-0" />}
                  </div>
                  <p className="text-xs text-teal-800/80 font-medium mt-0.5">{info.subtitle}</p>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{info.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <span className="block text-sm font-semibold text-slate-900 mb-2.5">
            Mục tiêu trọng tâm
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(Object.keys(GOAL_LABELS) as GoalType[]).map((goalKey) => {
              const info = GOAL_LABELS[goalKey];
              const active = form.goalType === goalKey;
              return (
                <button
                  key={goalKey}
                  type="button"
                  onClick={() => onChange({ ...form, goalType: goalKey })}
                  className={`min-h-[60px] text-left rounded-2xl border p-4 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    active
                      ? 'border-teal-700 bg-teal-50/70 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{info.label}</span>
                    {active && <Check className="w-4 h-4 text-teal-700 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{info.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="durationWeeks" className="text-sm font-semibold text-slate-900">
              Thời hạn lộ trình
            </label>
            <span className="text-sm font-mono-num font-bold text-teal-700">
              {form.durationWeeks} tuần
            </span>
          </div>

          <input
            id="durationWeeks"
            type="range"
            min={4}
            max={12}
            step={1}
            value={form.durationWeeks}
            onChange={(e) => onChange({ ...form, durationWeeks: Number(e.target.value) })}
            className="w-full accent-teal-700 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />

          <div className="mt-3 grid grid-cols-4 gap-2">
            {DURATION_PRESETS.map((weeks) => {
              const active = form.durationWeeks === weeks;
              return (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => onChange({ ...form, durationWeeks: weeks })}
                  className={`min-h-[44px] rounded-xl text-xs font-mono-num font-semibold border transition-all cursor-pointer ${
                    active
                      ? 'bg-teal-700 border-teal-700 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {weeks} tuần
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={onSaveGoal}
          disabled={isSavingGoal || isGeneratingPlan}
          className="sm:w-1/3 min-h-[48px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm px-4 py-3 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {isSavingGoal ? 'Đang lưu...' : 'Lưu mục tiêu'}
        </button>

        <button
          type="button"
          onClick={onSaveAndGeneratePlan}
          disabled={isSavingGoal || isGeneratingPlan || !hasProfileSaved}
          className="sm:w-2/3 min-h-[48px] rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-semibold text-sm px-5 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>
            {isGeneratingPlan
              ? 'AI đang phân tích & tạo lịch Tuần 1...'
              : 'Lưu & Tạo lịch Tuần 1 bằng AI'}
          </span>
        </button>
      </div>
    </div>
  );
}
