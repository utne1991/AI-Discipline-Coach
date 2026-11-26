import { useMemo } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Check,
  Gauge,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  CONSENT_POLICY_VERSION,
  GOAL_LABELS,
  SPORT_LABELS,
  TIME_SLOT_LABELS,
  evaluateSafetyProfile,
  type ConsentRecord,
  type GoalData,
  type GoalType,
  type MeasurableGoalSpec,
  type PreferredTimeSlot,
  type ProfileData,
  type SchedulePreferences,
  type SportOption,
  type WorkoutPlanData,
} from '../shared/types.ts';
import {
  assessGoalFeasibility,
  getDefaultMeasurableGoal,
  normalizeSchedulePreferences,
  normalizeSportsList,
} from '../services/strategyEngineV2.ts';
import type { DailyGoalData } from '../lib/dailyGoal.ts';
import { GoalOverviewDashboard } from './GoalOverviewDashboard.tsx';

interface GoalTabProps {
  form: GoalData;
  profile: ProfileData | null;
  planHistory: WorkoutPlanData[];
  allDailyGoals: DailyGoalData[];
  revisionReason: string;
  onRevisionReasonChange: (value: string) => void;
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
  onGoToPlan: () => void;
  hasUnsavedChanges: boolean;
  lastSavedAt?: string;
}

const DURATION_PRESETS = [4, 6, 8, 12];
const TIME_SLOTS: PreferredTimeSlot[] = ['morning', 'noon', 'evening'];

export function GoalTab({
  form,
  profile,
  planHistory,
  allDailyGoals,
  revisionReason,
  onRevisionReasonChange,
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
  onGoToPlan,
  hasUnsavedChanges,
  lastSavedAt,
}: GoalTabProps) {
  const selectedSports = useMemo(
    () => normalizeSportsList(form.sport, form.sports),
    [form.sport, form.sports]
  );

  const effectiveMeasurableGoal: MeasurableGoalSpec = useMemo(
    () =>
      form.measurableGoal ??
      getDefaultMeasurableGoal(form.sport, form.goalType, profile?.fitnessLevel ?? 'beginner'),
    [form.measurableGoal, form.sport, form.goalType, profile?.fitnessLevel]
  );

  const effectiveSchedulePrefs: SchedulePreferences = useMemo(
    () => normalizeSchedulePreferences(form.schedulePreferences),
    [form.schedulePreferences]
  );

  const safetyProfile = useMemo(
    () =>
      profile
        ? evaluateSafetyProfile({
            age: profile.age,
            weightKg: profile.weightKg,
            heightCm: profile.heightCm,
            fitnessLevel: profile.fitnessLevel,
            daysPerWeek: profile.daysPerWeek,
            healthLimitations: profile.healthLimitations,
            healthNotes: profile.healthNotes,
          })
        : null,
    [profile]
  );

  const feasibility = useMemo(() => {
    if (!profile || !safetyProfile) return null;
    return assessGoalFeasibility(
      profile,
      {
        ...form,
        sport: selectedSports[0],
        sports: selectedSports,
        measurableGoal: effectiveMeasurableGoal,
        schedulePreferences: effectiveSchedulePrefs,
      },
      safetyProfile
    );
  }, [profile, safetyProfile, form, selectedSports, effectiveMeasurableGoal, effectiveSchedulePrefs]);

  const requiresGuardian = Boolean(safetyProfile?.isMinor);
  const requiresMedical = Boolean(safetyProfile?.requiresMedicalClearance);

  const allRequiredConsentsMet =
    consent.aiHealthDataConsent &&
    (!requiresGuardian || consent.guardianConsentConfirmed) &&
    (!requiresMedical || consent.medicalClearanceAcknowledged);

  const handleToggleSport = (sportKey: SportOption) => {
    const exists = selectedSports.includes(sportKey);
    let nextSports: SportOption[];
    if (exists) {
      if (selectedSports.length === 1) {
        return; // Always keep at least 1 sport
      }
      nextSports = selectedSports.filter((s) => s !== sportKey);
    } else {
      nextSports = [...selectedSports, sportKey].slice(0, 3);
    }
    const nextPrimary = nextSports[0];
    onChange({
      ...form,
      sport: nextPrimary,
      sports: nextSports,
      measurableGoal:
        nextPrimary !== form.sport
          ? getDefaultMeasurableGoal(nextPrimary, form.goalType, profile?.fitnessLevel ?? 'beginner')
          : effectiveMeasurableGoal,
      schedulePreferences: effectiveSchedulePrefs,
    });
  };

  const handleGoalTypeChange = (goalKey: GoalType) => {
    onChange({
      ...form,
      sport: selectedSports[0],
      sports: selectedSports,
      goalType: goalKey,
      measurableGoal: getDefaultMeasurableGoal(
        selectedSports[0],
        goalKey,
        profile?.fitnessLevel ?? 'beginner'
      ),
      schedulePreferences: effectiveSchedulePrefs,
    });
  };

  const handleDurationChange = (weeks: number) => {
    onChange({
      ...form,
      sport: selectedSports[0],
      sports: selectedSports,
      durationWeeks: weeks,
      measurableGoal: effectiveMeasurableGoal,
      schedulePreferences: effectiveSchedulePrefs,
    });
  };

  const updateMeasurable = (patch: Partial<MeasurableGoalSpec>) => {
    onChange({
      ...form,
      sport: selectedSports[0],
      sports: selectedSports,
      measurableGoal: {
        ...effectiveMeasurableGoal,
        ...patch,
      },
      schedulePreferences: effectiveSchedulePrefs,
    });
  };

  const updateSchedulePrefs = (patch: Partial<SchedulePreferences>) => {
    onChange({
      ...form,
      sport: selectedSports[0],
      sports: selectedSports,
      measurableGoal: effectiveMeasurableGoal,
      schedulePreferences: {
        ...effectiveSchedulePrefs,
        ...patch,
      },
    });
  };

  const feasibilityTone =
    feasibility?.status === 'caution_required'
      ? 'border-rose-200 bg-rose-50/70 text-rose-950'
      : feasibility?.status === 'ambitious_adjust'
        ? 'border-amber-200 bg-amber-50/80 text-amber-950'
        : 'border-teal-200 bg-teal-50/60 text-teal-950';

  return (
    <div className="space-y-5">
      <GoalOverviewDashboard
        planHistory={planHistory}
        allDailyGoals={allDailyGoals}
        goalDurationWeeks={form.durationWeeks}
        onGoToPlan={onGoToPlan}
      />

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
                Hãy hoàn thành và lưu mục Hồ sơ trước để hệ thống đánh giá năng lực, tính khả thi và xây dựng chiến lược an toàn.
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
              02. Thiết lập mục tiêu & Chiến lược v2
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Chọn một hoặc nhiều bộ môn, chỉ số mục tiêu đo lường được và lịch thực tế theo múi giờ của bạn.
            </p>
          </div>
          {lastSavedAt && !hasUnsavedChanges && (
            <span className="text-xs text-teal-700 font-medium whitespace-nowrap">
              Đã lưu mục tiêu
            </span>
          )}
        </div>

        {/* Multi-sport selection */}
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
            <span className="text-sm font-semibold text-slate-900">
              Bộ môn tập luyện (có thể chọn nhiều môn)
            </span>
            <span className="text-xs text-slate-500 font-mono-num">
              Đã chọn {selectedSports.length}/3 · Môn chính:{' '}
              {SPORT_LABELS[selectedSports[0]]?.label}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(Object.keys(SPORT_LABELS) as SportOption[]).map((sportKey) => {
              const info = SPORT_LABELS[sportKey];
              const active = selectedSports.includes(sportKey);
              const isPrimary = selectedSports[0] === sportKey;
              return (
                <button
                  key={sportKey}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleToggleSport(sportKey)}
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
                  <p className="text-xs text-teal-800/80 font-medium mt-0.5">
                    {isPrimary ? `${info.subtitle} · Chính` : info.subtitle}
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{info.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Goal Type */}
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
                  onClick={() => handleGoalTypeChange(goalKey)}
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

        {/* Duration */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="durationWeeks" className="text-sm font-semibold text-slate-900">
              Thời hạn lộ trình toàn chiến lược
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
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            className="w-full accent-teal-700 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />

          <div className="mt-3 grid grid-cols-4 gap-2">
            {DURATION_PRESETS.map((weeks) => {
              const active = form.durationWeeks === weeks;
              return (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => handleDurationChange(weeks)}
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

        {/* Measurable Personal Goal */}
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-700 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Mục tiêu cá nhân đo lường được
                </h2>
                <p className="text-xs text-slate-500">
                  Xác định rõ điểm xuất phát hiện tại và con số đích để hệ thống kiểm tra tính khả thi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                updateMeasurable(
                  getDefaultMeasurableGoal(
                    selectedSports[0],
                    form.goalType,
                    profile?.fitnessLevel ?? 'beginner'
                  )
                )
              }
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
            >
              Khôi phục gợi ý
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="measurableTargetLabel"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mô tả mục tiêu cụ thể
              </label>
              <input
                id="measurableTargetLabel"
                type="text"
                maxLength={160}
                value={effectiveMeasurableGoal.targetLabel}
                onChange={(e) => updateMeasurable({ targetLabel: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <div>
                <label
                  htmlFor="measurableCurrent"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Hiện tại
                </label>
                <input
                  id="measurableCurrent"
                  type="number"
                  min={0}
                  max={10000}
                  step="0.5"
                  value={effectiveMeasurableGoal.currentValue}
                  onChange={(e) =>
                    updateMeasurable({ currentValue: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
              </div>

              <div>
                <label
                  htmlFor="measurableTarget"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Đích muốn đạt
                </label>
                <input
                  id="measurableTarget"
                  type="number"
                  min={0}
                  max={10000}
                  step="0.5"
                  value={effectiveMeasurableGoal.targetValue}
                  onChange={(e) =>
                    updateMeasurable({ targetValue: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
              </div>

              <div>
                <label
                  htmlFor="measurableUnit"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Đơn vị
                </label>
                <input
                  id="measurableUnit"
                  type="text"
                  maxLength={24}
                  value={effectiveMeasurableGoal.unit}
                  onChange={(e) => updateMeasurable({ unit: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
              </div>
            </div>
          </div>

          {feasibility && (
            <div className={`rounded-xl border p-4 space-y-2 text-xs leading-relaxed ${feasibilityTone}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <Gauge className="w-4 h-4 shrink-0" />
                  <span>Đánh giá năng lực & Tính khả thi (độc lập với AI)</span>
                </div>
                <span className="font-mono-num font-bold">{feasibility.score}/100</span>
              </div>
              <p className="font-medium">{feasibility.weeklyDeltaRequired}</p>
              <p>{feasibility.rationale}</p>
              {feasibility.adjustments.length > 0 && (
                <ul className="list-disc list-inside space-y-1 pt-1 border-t border-current/15">
                  {feasibility.adjustments.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Real-Calendar Schedule Preferences */}
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-3.5">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-teal-700 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Lịch thực tế, múi giờ & Quỹ thời gian rảnh
              </h2>
              <p className="text-xs text-slate-500">
                Gắn ngày dương lịch thực tế và khung giờ tập ưu tiên cho màn hình Hôm nay.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="scheduleStartDate"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Ngày bắt đầu tuần 1
              </label>
              <input
                id="scheduleStartDate"
                type="date"
                value={effectiveSchedulePrefs.startDateKey}
                onChange={(e) => {
                  if (e.target.value) {
                    updateSchedulePrefs({ startDateKey: e.target.value });
                  }
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label
                htmlFor="scheduleTimezone"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Múi giờ
              </label>
              <input
                id="scheduleTimezone"
                type="text"
                maxLength={64}
                value={effectiveSchedulePrefs.timezone}
                onChange={(e) => updateSchedulePrefs({ timezone: e.target.value })}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label
                htmlFor="sessionBudget"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Thời lượng rảnh / buổi (phút)
              </label>
              <input
                id="sessionBudget"
                type="number"
                min={20}
                max={90}
                step={5}
                value={effectiveSchedulePrefs.minutesPerSessionBudget}
                onChange={(e) =>
                  updateSchedulePrefs({
                    minutesPerSessionBudget: Math.max(
                      20,
                      Math.min(90, Number(e.target.value) || 40)
                    ),
                  })
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {TIME_SLOTS.map((slot) => {
              const info = TIME_SLOT_LABELS[slot];
              const active = effectiveSchedulePrefs.preferredTimeSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => updateSchedulePrefs({ preferredTimeSlot: slot })}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-teal-700 bg-teal-50/80 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold">{info.label}</p>
                  <p className="text-[11px] font-mono-num text-slate-500 mt-0.5">{info.window}</p>
                </button>
              );
            })}
          </div>

          {planHistory.length > 0 && (
            <div>
              <label
                htmlFor="revisionReason"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Lý do tạo phiên bản kế hoạch v{planHistory.length + 1} (tùy chọn)
              </label>
              <input
                id="revisionReason"
                type="text"
                maxLength={240}
                value={revisionReason}
                onChange={(e) => onRevisionReasonChange(e.target.value)}
                placeholder="Ví dụ: Bổ sung chạy bộ kết hợp gym, đổi lịch sang buổi sáng"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          )}
        </div>

        {/* Consent & Privacy */}
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
              Tôi đồng ý chia sẻ thông tin thể chất và nhóm giới hạn sức khỏe đã tối giản (không bao gồm họ tên) để hệ thống AI lập chiến lược và lịch tập. Tôi có thể bỏ chọn bất kỳ lúc nào để rút lại sự đồng ý.
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
              ? 'AI đang xây dựng chiến lược v2...'
              : planHistory.length > 0
                ? `Lưu & Tạo phiên bản v${planHistory.length + 1}`
                : 'Lưu & Xây dựng Chiến lược v2 bằng AI'}
          </span>
        </button>
      </div>
    </div>
  );
}
