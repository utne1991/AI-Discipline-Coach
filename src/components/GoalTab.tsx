import { Check, Sparkles, AlertCircle, ShieldAlert } from 'lucide-react';
import {
  CONSENT_POLICY_VERSION,
  GOAL_LABELS,
  SPORT_LABELS,
  evaluateSafetyProfile,
  type ConsentRecord,
  type GoalData,
  type GoalType,
  type ProfileData,
  type SportOption,
} from '../shared/types.ts';

interface GoalTabProps {
  form: GoalData;
  profile: ProfileData | null;
  onChange: (next: GoalData) => void;
  onSaveGoal: () => Promise<void>;
  onSaveAndGeneratePlan: () => Promise<void>;
  isSavingGoal: boolean;
  isGeneratingPlan: boolean;
  hasProfileSaved: boolean;
  consent: ConsentRecord;
  isSavingConsent: boolean;
  onUpdateConsent: (patch: Partial<ConsentRecord>) => Promise<void>;
  onGoToProfile: () => void;
  hasUnsavedChanges: boolean;
  lastSavedAt?: string;
}

const DURATION_PRESETS = [4, 6, 8, 12];

export function GoalTab({
  form,
  profile,
  onChange,
  onSaveGoal,
  onSaveAndGeneratePlan,
  isSavingGoal,
  isGeneratingPlan,
  hasProfileSaved,
  consent,
  isSavingConsent,
  onUpdateConsent,
  onGoToProfile,
  hasUnsavedChanges,
  lastSavedAt,
}: GoalTabProps) {
  const safetyProfile = profile
    ? evaluateSafetyProfile({
        age: profile.age,
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        fitnessLevel: profile.fitnessLevel,
        daysPerWeek: profile.daysPerWeek,
        healthLimitations: profile.healthLimitations,
        healthNotes: profile.healthNotes,
      })
    : null;

  const requiresGuardian = Boolean(safetyProfile?.isMinor);
  const requiresMedical = Boolean(safetyProfile?.requiresMedicalClearance);

  const allRequiredConsentsMet =
    consent.aiHealthDataConsent &&
    (!requiresGuardian || consent.guardianConsentConfirmed) &&
    (!requiresMedical || consent.medicalClearanceAcknowledged);

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

        <div className="mt-6 pt-5 border-t border-slate-100 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Quản lý sự đồng ý & Tối giản dữ liệu AI
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Họ tên và email không bao giờ được gửi sang AI. Hệ thống chỉ gửi nhóm tuổi, chỉ số thể chất cơ bản và nhóm giới hạn sức khỏe đã tối giản (phiên bản {consent.policyVersion || CONSENT_POLICY_VERSION}).
              </p>
            </div>
            {isSavingConsent && (
              <span className="text-xs text-slate-500 whitespace-nowrap">Đang lưu...</span>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consent.aiHealthDataConsent}
              disabled={isSavingConsent}
              onChange={(e) => {
                void onUpdateConsent({ aiHealthDataConsent: e.target.checked });
              }}
              className="mt-1 h-5 w-5 rounded border-slate-300 accent-teal-700 shrink-0 cursor-pointer"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              Tôi đồng ý chia sẻ thông tin thể chất và nhóm giới hạn sức khỏe đã tối giản (không bao gồm họ tên) để hệ thống AI lập lịch tập Tuần 1. Tôi có thể bỏ chọn bất kỳ lúc nào để rút lại sự đồng ý.
            </span>
          </label>

          {requiresGuardian && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-xs font-semibold text-amber-950">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>Quy tắc an toàn dành cho người chưa thành niên (&lt; 18 tuổi)</span>
              </div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consent.guardianConsentConfirmed}
                  disabled={isSavingConsent}
                  onChange={(e) => {
                    void onUpdateConsent({ guardianConsentConfirmed: e.target.checked });
                  }}
                  className="mt-0.5 h-5 w-5 rounded border-amber-400 accent-teal-700 shrink-0 cursor-pointer"
                />
                <span className="text-xs text-amber-950 leading-relaxed">
                  Tôi xác nhận đã có sự đồng ý và giám sát của phụ huynh hoặc người giám hộ hợp pháp trước khi sử dụng lịch tập.
                </span>
              </label>
            </div>
          )}

          {requiresMedical && (
            <div className="rounded-xl border border-rose-300 bg-rose-50/80 p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-xs font-semibold text-rose-950">
                <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>Khuyến nghị đánh giá sức khỏe chuyên môn</span>
              </div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consent.medicalClearanceAcknowledged}
                  disabled={isSavingConsent}
                  onChange={(e) => {
                    void onUpdateConsent({ medicalClearanceAcknowledged: e.target.checked });
                  }}
                  className="mt-0.5 h-5 w-5 rounded border-rose-400 accent-teal-700 shrink-0 cursor-pointer"
                />
                <span className="text-xs text-rose-950 leading-relaxed">
                  Tôi hiểu hồ sơ có yếu tố sức khỏe cần thận trọng đặc biệt, AI không thay thế bác sĩ, và tôi cần tham khảo ý kiến bác sĩ / chuyên gia y tế trước khi tập luyện.
                </span>
              </label>
            </div>
          )}
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
          disabled={isSavingGoal || isGeneratingPlan || !hasProfileSaved || !allRequiredConsentsMet}
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
