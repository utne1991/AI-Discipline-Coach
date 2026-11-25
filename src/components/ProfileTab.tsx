import { Check, ShieldAlert, ArrowRight, Bell, Clock } from 'lucide-react';
import {
  computeNextReminderDate,
  formatTimeRemaining,
  type BrowserNotificationPermission,
} from '../lib/browserReminder.ts';
import type { ReminderSettings } from '../lib/firestoreReminder.ts';
import {
  EQUIPMENT_LABELS,
  FITNESS_LEVEL_LABELS,
  HEALTH_LIMITATION_OPTIONS,
  evaluateBmi,
  evaluateCautionStatus,
  type EquipmentOption,
  type FitnessLevel,
  type ProfileData,
} from '../shared/types.ts';

interface ProfileTabProps {
  form: ProfileData;
  onChange: (next: ProfileData) => void;
  onSave: () => Promise<void>;
  onSaveAndContinue: () => Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt?: string;
  reminderForm: ReminderSettings;
  onReminderChange: (next: ReminderSettings) => void;
  onSaveReminder: () => Promise<void>;
  isSavingReminder: boolean;
  hasUnsavedReminder: boolean;
  reminderSyncedAt?: string;
  notificationPermission: BrowserNotificationPermission;
  onRequestNotificationPermission: () => Promise<void>;
  onTestReminder: () => void;
}

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export function ProfileTab({
  form,
  onChange,
  onSave,
  onSaveAndContinue,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  reminderForm,
  onReminderChange,
  onSaveReminder,
  isSavingReminder,
  hasUnsavedReminder,
  reminderSyncedAt,
  notificationPermission,
  onRequestNotificationPermission,
  onTestReminder,
}: ProfileTabProps) {
  const bmiEval = evaluateBmi(form.weightKg, form.heightCm, form.age);
  const caution = evaluateCautionStatus(
    form.age,
    form.healthLimitations,
    form.healthNotes,
    form.weightKg,
    form.heightCm
  );
  const nextReminder = reminderForm.reminderEnabled
    ? computeNextReminderDate(reminderForm.reminderTime)
    : null;

  const permissionLabel =
    notificationPermission === 'granted'
      ? 'Đã cấp quyền thông báo'
      : notificationPermission === 'denied'
        ? 'Trình duyệt đang chặn thông báo'
        : notificationPermission === 'unsupported'
          ? 'Trình duyệt không hỗ trợ Notification API'
          : 'Chưa cấp quyền thông báo trình duyệt';

  const toggleLimitation = (item: string) => {
    const exists = form.healthLimitations.includes(item);
    const nextList = exists
      ? form.healthLimitations.filter((x) => x !== item)
      : [...form.healthLimitations, item];
    onChange({ ...form, healthLimitations: nextList });
  };

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              01. Hồ sơ người dùng
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Dữ liệu thể chất giúp AI tính đúng khối lượng và ngưỡng an toàn.
            </p>
          </div>
          {lastSavedAt && !hasUnsavedChanges && (
            <span className="text-xs text-teal-700 font-medium whitespace-nowrap">
              Đã lưu hồ sơ
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Họ và tên
            </label>
            <input
              id="fullName"
              type="text"
              value={form.fullName}
              onChange={(e) => onChange({ ...form, fullName: e.target.value })}
              placeholder="Ví dụ: Nguyễn Minh Anh"
              maxLength={80}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="age" className="block text-sm font-medium text-slate-700 mb-1.5">
              Độ tuổi
            </label>
            <input
              id="age"
              type="number"
              inputMode="numeric"
              min={10}
              max={100}
              value={form.age || ''}
              onChange={(e) =>
                onChange({ ...form, age: e.target.value === '' ? 0 : Number(e.target.value) })
              }
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono-num text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="weightKg" className="block text-sm font-medium text-slate-700 mb-1.5">
                Cân nặng (kg)
              </label>
              <input
                id="weightKg"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={25}
                max={250}
                value={form.weightKg || ''}
                onChange={(e) =>
                  onChange({
                    ...form,
                    weightKg: e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono-num text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="heightCm" className="block text-sm font-medium text-slate-700 mb-1.5">
                Chiều cao (cm)
              </label>
              <input
                id="heightCm"
                type="number"
                inputMode="decimal"
                step="1"
                min={100}
                max={230}
                value={form.heightCm || ''}
                onChange={(e) =>
                  onChange({
                    ...form,
                    heightCm: e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono-num text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            <span>Chỉ số BMI tham khảo:</span>
            {bmiEval.value !== null ? (
              <span className="font-mono-num font-semibold text-slate-900">{bmiEval.value}</span>
            ) : (
              <span className="font-medium text-amber-700">Chưa đủ dữ liệu</span>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-800">{bmiEval.category}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{bmiEval.guidance}</p>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5">
        <div>
          <span className="block text-sm font-semibold text-slate-900 mb-2.5">
            Trình độ hiện tại
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(Object.keys(FITNESS_LEVEL_LABELS) as FitnessLevel[]).map((levelKey) => {
              const info = FITNESS_LEVEL_LABELS[levelKey];
              const active = form.fitnessLevel === levelKey;
              return (
                <button
                  key={levelKey}
                  type="button"
                  onClick={() => onChange({ ...form, fitnessLevel: levelKey })}
                  className={`min-h-[52px] text-left rounded-xl border px-3.5 py-2.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    active
                      ? 'border-teal-700 bg-teal-50/70 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{info.label}</span>
                    {active && <Check className="w-4 h-4 text-teal-700 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{info.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-slate-900">Số ngày tập mỗi tuần</span>
            <span className="text-xs font-mono-num font-semibold text-teal-700">
              {form.daysPerWeek} buổi / tuần
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {DAYS_OPTIONS.map((dayCount) => {
              const active = form.daysPerWeek === dayCount;
              return (
                <button
                  key={dayCount}
                  type="button"
                  onClick={() => onChange({ ...form, daysPerWeek: dayCount })}
                  className={`min-h-[44px] rounded-xl font-mono-num text-sm font-semibold border transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    active
                      ? 'bg-teal-700 border-teal-700 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {dayCount}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="block text-sm font-semibold text-slate-900 mb-2.5">
            Dụng cụ có sẵn
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(Object.keys(EQUIPMENT_LABELS) as EquipmentOption[]).map((eqKey) => {
              const info = EQUIPMENT_LABELS[eqKey];
              const active = form.equipment === eqKey;
              return (
                <button
                  key={eqKey}
                  type="button"
                  onClick={() => onChange({ ...form, equipment: eqKey })}
                  className={`min-h-[52px] text-left rounded-xl border px-3.5 py-2.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    active
                      ? 'border-teal-700 bg-teal-50/70 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{info.label}</span>
                    {active && <Check className="w-4 h-4 text-teal-700 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{info.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Giới hạn sức khỏe & Chấn thương
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chọn tất cả tình trạng hiện có (nếu không có, hãy để trống).
          </p>
        </div>

        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {HEALTH_LIMITATION_OPTIONS.map((item) => {
            const active = form.healthLimitations.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleLimitation(item)}
                className={`min-h-[44px] flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-left text-sm transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                  active
                    ? 'border-amber-600 bg-amber-50 text-amber-950 font-medium'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="truncate">{item}</span>
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                    active
                      ? 'bg-amber-600 border-amber-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {active && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="healthNotes" className="block text-xs font-medium text-slate-700 mb-1.5">
            Ghi chú sức khỏe bổ sung (tùy chọn)
          </label>
          <textarea
            id="healthNotes"
            rows={2}
            value={form.healthNotes}
            onChange={(e) => onChange({ ...form, healthNotes: e.target.value })}
            maxLength={500}
            placeholder="Ví dụ: Đau nhẹ cổ chân phải khi chạy nhanh, mới mổ dây chằng 6 tháng..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none transition-colors resize-none"
          />
        </div>

        {caution.cautiousMode && (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold text-sm text-amber-950">
                  Chế độ thận trọng sẽ được tự động kích hoạt
                </p>
                <ul className="mt-1.5 space-y-1 list-disc list-inside text-amber-900">
                  {caution.cautionReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Nhắc nhở tập luyện hàng ngày
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Đặt giờ nhắc cố định qua trình duyệt và lưu trực tiếp vào hồ sơ Firebase của bạn.
            </p>
          </div>
          {reminderSyncedAt && !hasUnsavedReminder && (
            <span className="text-xs text-teal-700 font-medium whitespace-nowrap">
              Đã đồng bộ Firebase
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Bật nhắc nhở hàng ngày</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {reminderForm.reminderEnabled
                ? 'Nhắc nhở tự động kích hoạt mỗi ngày khi trình duyệt mở.'
                : 'Đang tắt nhắc nhở hàng ngày.'}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={reminderForm.reminderEnabled}
            aria-label="Bật hoặc tắt nhắc nhở tập luyện hàng ngày"
            onClick={() =>
              onReminderChange({
                ...reminderForm,
                reminderEnabled: !reminderForm.reminderEnabled,
              })
            }
            className={`relative inline-flex min-h-[44px] min-w-[56px] items-center rounded-xl px-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 ${
              reminderForm.reminderEnabled
                ? 'bg-teal-700 justify-end'
                : 'bg-slate-200 justify-start'
            }`}
          >
            <span className="w-6 h-6 rounded-lg bg-white shadow-sm block" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label
              htmlFor="reminderTime"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Thời gian nhắc mỗi ngày
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="reminderTime"
                type="time"
                value={reminderForm.reminderTime}
                onChange={(e) =>
                  onReminderChange({
                    ...reminderForm,
                    reminderTime: e.target.value,
                  })
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm font-mono-num text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-1 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Múi giờ:</span>
              <span className="font-mono-num font-medium text-slate-800">
                {reminderForm.timezone}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Trạng thái quyền:</span>
              <span
                className={`font-medium ${
                  notificationPermission === 'granted'
                    ? 'text-teal-700'
                    : notificationPermission === 'denied'
                      ? 'text-rose-700'
                      : 'text-amber-700'
                }`}
              >
                {permissionLabel}
              </span>
            </div>
            {nextReminder && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Lần nhắc tiếp theo:</span>
                <span className="font-mono-num font-semibold text-slate-800">
                  {reminderForm.reminderTime} · {formatTimeRemaining(nextReminder)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-2">
          {notificationPermission === 'default' && (
            <button
              type="button"
              onClick={onRequestNotificationPermission}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-teal-700 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span>Cấp quyền thông báo trình duyệt</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTestReminder}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span>Gửi thử thông báo</span>
          </button>

          <button
            type="button"
            onClick={onSaveReminder}
            disabled={isSavingReminder}
            className="sm:ml-auto min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60"
          >
            <span>{isSavingReminder ? 'Đang lưu...' : 'Lưu cài đặt nhắc nhở'}</span>
          </button>
        </div>

        {notificationPermission === 'denied' && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Thông báo hệ thống đang bị trình duyệt chặn. Bạn vẫn có thể lưu giờ nhắc vào hồ sơ Firebase và nhận nhắc nhở trực tiếp trên giao diện khi mở ứng dụng.
          </p>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 min-h-[48px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm px-4 py-3 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
        </button>

        <button
          type="button"
          onClick={onSaveAndContinue}
          disabled={isSaving}
          className="flex-1 min-h-[48px] rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-semibold text-sm px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
        >
          <span>Lưu & Thiết lập mục tiêu</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
