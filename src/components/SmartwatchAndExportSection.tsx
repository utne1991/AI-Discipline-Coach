import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BatteryCharging,
  Bluetooth,
  BluetoothConnected,
  CalendarPlus,
  Download,
  FileSpreadsheet,
  HeartPulse,
  Play,
  Save,
  Square,
  Watch,
} from 'lucide-react';
import { getTodayDateKey, type DailyGoalData } from '../lib/dailyGoal.ts';
import {
  buildCombinedDisciplineCsv,
  buildDailyGoalsCsv,
  buildWorkoutHistoryCsv,
  downloadTextFile,
} from '../lib/csvExport.ts';
import {
  DEFAULT_SMARTWATCH_CONNECTION,
  SMARTWATCH_DEVICE_NAME_MAX,
  SMARTWATCH_PLATFORMS,
  SMARTWATCH_PLATFORM_LABELS,
  buildWorkoutPlanIcs,
  connectBluetoothHeartRateWatch,
  formatElapsedDuration,
  isWebBluetoothSupported,
  type LiveBluetoothWatchHandle,
  type SmartwatchConnectionData,
  type SmartwatchPlatform,
} from '../lib/smartwatch.ts';
import type { WorkoutPlanData } from '../shared/types.ts';
import { buildWorkoutHistoryEntries, formatShortVietnameseDate } from './PlanTab.tsx';

interface SmartwatchSyncPanelProps {
  plan: WorkoutPlanData | null;
  reminderTime?: string;
  connection: SmartwatchConnectionData | null;
  isSaving: boolean;
  onSaveConnection: (input: Partial<SmartwatchConnectionData>) => Promise<boolean>;
}

export function SmartwatchSyncPanel({
  plan,
  reminderTime,
  connection,
  isSaving,
  onSaveConnection,
}: SmartwatchSyncPanelProps) {
  const effectiveConfig = connection ?? DEFAULT_SMARTWATCH_CONNECTION;
  const [deviceName, setDeviceName] = useState<string>(effectiveConfig.deviceName);
  const [platform, setPlatform] = useState<SmartwatchPlatform>(effectiveConfig.platform);
  const [autoSyncCalendar, setAutoSyncCalendar] = useState<boolean>(
    effectiveConfig.autoSyncCalendar
  );

  const [isConnectingBle, setIsConnectingBle] = useState(false);
  const [bleConnectedName, setBleConnectedName] = useState<string | null>(null);
  const [liveHeartRate, setLiveHeartRate] = useState<number | null>(null);
  const [liveBattery, setLiveBattery] = useState<number | null>(
    effectiveConfig.lastBatteryPercent >= 0 ? effectiveConfig.lastBatteryPercent : null
  );
  const [isTrackingSession, setIsTrackingSession] = useState(false);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);
  const [sessionHeartRates, setSessionHeartRates] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  const bleHandleRef = useRef<LiveBluetoothWatchHandle | null>(null);
  const isTrackingRef = useRef(false);
  const bleSupported = useMemo(() => isWebBluetoothSupported(), []);

  useEffect(() => {
    isTrackingRef.current = isTrackingSession;
  }, [isTrackingSession]);

  useEffect(() => {
    if (connection) {
      setDeviceName(connection.deviceName);
      setPlatform(connection.platform);
      setAutoSyncCalendar(connection.autoSyncCalendar);
      if (connection.lastBatteryPercent >= 0 && bleConnectedName === null) {
        setLiveBattery(connection.lastBatteryPercent);
      }
    }
  }, [
    connection?.deviceName,
    connection?.platform,
    connection?.autoSyncCalendar,
    connection?.lastBatteryPercent,
    bleConnectedName,
  ]);

  useEffect(() => {
    if (!isTrackingSession) return undefined;
    const timer = window.setInterval(() => {
      setSessionElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTrackingSession]);

  useEffect(() => {
    return () => {
      if (bleHandleRef.current) {
        bleHandleRef.current.disconnect();
        bleHandleRef.current = null;
      }
    };
  }, []);

  const sessionAvgBpm = useMemo(() => {
    if (sessionHeartRates.length === 0) return null;
    const sum = sessionHeartRates.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / sessionHeartRates.length);
  }, [sessionHeartRates]);

  const sessionMaxBpm = useMemo(() => {
    if (sessionHeartRates.length === 0) return null;
    return Math.max(...sessionHeartRates);
  }, [sessionHeartRates]);

  const handleConnectBle = async () => {
    setIsConnectingBle(true);
    setStatusMessage(null);
    try {
      const handle = await connectBluetoothHeartRateWatch({
        onHeartRate: (bpm) => {
          setLiveHeartRate(bpm);
          if (isTrackingRef.current) {
            setSessionHeartRates((prev) => [...prev.slice(-719), bpm]);
          }
        },
        onDisconnected: () => {
          bleHandleRef.current = null;
          setBleConnectedName(null);
          setIsTrackingSession(false);
          setStatusMessage({
            type: 'info',
            text: 'Đồng hồ Bluetooth đã ngắt kết nối.',
          });
        },
      });

      bleHandleRef.current = handle;
      setBleConnectedName(handle.deviceName);
      setDeviceName(handle.deviceName);
      setPlatform('ble_heart_rate');
      if (handle.batteryPercent !== null) {
        setLiveBattery(handle.batteryPercent);
      }

      await onSaveConnection({
        deviceName: handle.deviceName,
        platform: 'ble_heart_rate',
        autoSyncCalendar,
        lastConnectedAt: new Date().toISOString(),
        lastHeartRateBpm: effectiveConfig.lastHeartRateBpm,
        lastBatteryPercent:
          handle.batteryPercent !== null ? handle.batteryPercent : effectiveConfig.lastBatteryPercent,
        totalSyncedSessions: effectiveConfig.totalSyncedSessions,
      });

      setStatusMessage({
        type: 'success',
        text: `Đã kết nối trực tiếp với ${handle.deviceName}. Đang chờ tín hiệu nhịp tim trực tiếp từ đồng hồ.`,
      });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Không thể kết nối Bluetooth với đồng hồ lúc này.',
      });
    } finally {
      setIsConnectingBle(false);
    }
  };

  const handleDisconnectBle = () => {
    if (bleHandleRef.current) {
      bleHandleRef.current.disconnect();
      bleHandleRef.current = null;
    }
    setBleConnectedName(null);
    setIsTrackingSession(false);
    setStatusMessage({
      type: 'info',
      text: 'Đã ngắt kết nối Bluetooth với đồng hồ.',
    });
  };

  const handleStartLiveTracking = () => {
    setSessionElapsedSeconds(0);
    setSessionHeartRates(liveHeartRate ? [liveHeartRate] : []);
    setIsTrackingSession(true);
    setStatusMessage({
      type: 'info',
      text: 'Đang theo dõi phiên tập trực tiếp từ đồng hồ của bạn.',
    });
  };

  const handleStopAndSaveSession = async () => {
    setIsTrackingSession(false);
    const recordedBpm = sessionAvgBpm ?? liveHeartRate ?? effectiveConfig.lastHeartRateBpm;
    const nextSessions = effectiveConfig.totalSyncedSessions + 1;
    const ok = await onSaveConnection({
      deviceName: bleConnectedName || deviceName,
      platform,
      autoSyncCalendar,
      lastConnectedAt: new Date().toISOString(),
      lastHeartRateBpm: recordedBpm,
      lastBatteryPercent: liveBattery !== null ? liveBattery : effectiveConfig.lastBatteryPercent,
      totalSyncedSessions: nextSessions,
    });
    if (ok) {
      const hrSummary = recordedBpm > 0 ? ` · Nhịp tim TB ${recordedBpm} BPM` : '';
      setStatusMessage({
        type: 'success',
        text: `Đã lưu phiên theo dõi (${formatElapsedDuration(sessionElapsedSeconds)}${hrSummary}) vào hồ sơ Firebase.`,
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const ok = await onSaveConnection({
      deviceName,
      platform,
      autoSyncCalendar,
      lastConnectedAt: effectiveConfig.lastConnectedAt || new Date().toISOString(),
      lastHeartRateBpm: liveHeartRate ?? effectiveConfig.lastHeartRateBpm,
      lastBatteryPercent: liveBattery !== null ? liveBattery : effectiveConfig.lastBatteryPercent,
      totalSyncedSessions: effectiveConfig.totalSyncedSessions,
    });
    if (ok) {
      setStatusMessage({
        type: 'success',
        text: 'Đã lưu cấu hình kết nối đồng hồ thông minh vào Firebase.',
      });
    }
  };

  const handleDownloadIcsSchedule = async () => {
    if (!plan) {
      setStatusMessage({
        type: 'error',
        text: 'Bạn cần tạo lịch tập Tuần 1 trước khi đồng bộ sang lịch đồng hồ (.ics).',
      });
      return;
    }
    const icsContent = buildWorkoutPlanIcs(plan, {
      reminderTime: reminderTime || '07:00',
      includeAlarm: autoSyncCalendar,
    });
    const todayKey = getTodayDateKey();
    const filename = `ai-discipline-coach-tuan-${plan.weekNumber}-${todayKey}.ics`;
    downloadTextFile(icsContent, filename, 'text/calendar;charset=utf-8');

    const nextSessions = effectiveConfig.totalSyncedSessions + 1;
    await onSaveConnection({
      deviceName,
      platform,
      autoSyncCalendar,
      lastConnectedAt: new Date().toISOString(),
      lastHeartRateBpm: liveHeartRate ?? effectiveConfig.lastHeartRateBpm,
      lastBatteryPercent: liveBattery !== null ? liveBattery : effectiveConfig.lastBatteryPercent,
      totalSyncedSessions: nextSessions,
    });

    setStatusMessage({
      type: 'success',
      text: `Đã xuất tệp lịch ${filename}. Mở tệp này trên iPhone/Android (Apple Calendar hoặc Google Calendar) để đồng bộ lịch tập và nhắc nhở xuống đồng hồ.`,
    });
  };

  const connectionStatusText = bleConnectedName
    ? `Đang kết nối trực tiếp · ${bleConnectedName}`
    : connection
      ? `Đã lưu · ${connection.deviceName}`
      : 'Chưa kết nối thiết bị';

  return (
    <section
      aria-label="Kết nối đồng hồ thông minh"
      className="bg-white rounded-2xl border border-slate-200/90 p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              bleConnectedName
                ? 'bg-teal-600 text-white'
                : 'bg-teal-50 text-teal-700'
            }`}
          >
            <Watch className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">
              Smartwatch Sync · Bluetooth BLE & Lịch đồng hồ (.ics)
            </p>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Kết nối đồng hồ thông minh theo dõi lịch tập
            </h2>
          </div>
        </div>

        <p
          className={`text-xs font-semibold ${
            bleConnectedName ? 'text-teal-700' : 'text-slate-600'
          }`}
        >
          {connectionStatusText}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 py-4 border-b border-slate-100 gap-3 sm:gap-0">
        <div className="sm:pr-4">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-teal-700" />
            <span>Nhịp tim đo từ đồng hồ</span>
          </p>
          <p className="mt-1 text-xl font-mono-num font-bold text-slate-900">
            {liveHeartRate !== null
              ? `${liveHeartRate} BPM`
              : effectiveConfig.lastHeartRateBpm > 0
                ? `${effectiveConfig.lastHeartRateBpm} BPM`
                : 'Chưa đo'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {liveHeartRate !== null
              ? 'Tín hiệu trực tiếp qua Bluetooth BLE'
              : effectiveConfig.lastHeartRateBpm > 0
                ? 'Ghi nhận gần nhất từ đồng hồ'
                : 'Kết nối đồng hồ BLE HR để đo thực tế'}
          </p>
        </div>

        <div className="pt-3 sm:pt-0 sm:px-4">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-slate-600" />
            <span>Pin thiết bị</span>
          </p>
          <p className="mt-1 text-xl font-mono-num font-bold text-slate-900">
            {liveBattery !== null ? `${liveBattery}%` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {liveBattery !== null
              ? 'Đọc từ dịch vụ pin Bluetooth'
              : 'Hiển thị khi thiết bị hỗ trợ'}
          </p>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-teal-700" />
            <span>Số lần đồng bộ lịch / phiên tập</span>
          </p>
          <p className="mt-1 text-xl font-mono-num font-bold text-teal-600">
            {effectiveConfig.totalSyncedSessions} lần
          </p>
          <p className="mt-0.5 text-[11px] font-mono-num text-slate-500">
            {effectiveConfig.lastConnectedAt
              ? `Gần nhất: ${formatShortVietnameseDate(effectiveConfig.lastConnectedAt)}`
              : 'Chưa có lần đồng bộ nào'}
          </p>
        </div>
      </div>

      <div className="pt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {bleConnectedName ? (
            <>
              {!isTrackingSession ? (
                <button
                  type="button"
                  onClick={handleStartLiveTracking}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Bắt đầu theo dõi buổi tập</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleStopAndSaveSession}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  <span>
                    Kết thúc & lưu phiên ({formatElapsedDuration(sessionElapsedSeconds)})
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDisconnectBle}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
              >
                <BluetoothConnected className="w-4 h-4 text-teal-700" />
                <span>Ngắt kết nối</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isConnectingBle}
              onClick={handleConnectBle}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Bluetooth className="w-4 h-4" />
              <span>
                {isConnectingBle ? 'Đang tìm đồng hồ Bluetooth...' : 'Kết nối đồng hồ (Bluetooth BLE)'}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={!plan || isSaving}
            onClick={handleDownloadIcsSchedule}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Đồng bộ lịch tập sang đồng hồ (.ics)</span>
          </button>
        </div>

        {isTrackingSession && (
          <div className="rounded-xl bg-teal-50/70 border border-teal-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-teal-950">
            <div>
              <p className="font-semibold">Đang ghi nhận buổi tập trực tiếp từ {bleConnectedName}</p>
              <p className="text-teal-800 mt-0.5 font-mono-num">
                Thời gian: {formatElapsedDuration(sessionElapsedSeconds)}
                {sessionAvgBpm !== null ? ` · TB: ${sessionAvgBpm} BPM` : ''}
                {sessionMaxBpm !== null ? ` · Cao nhất: ${sessionMaxBpm} BPM` : ''}
              </p>
            </div>
          </div>
        )}

        {!bleSupported && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Trình duyệt hiện tại không bật Web Bluetooth API. Bạn vẫn có thể dùng nút{' '}
            <span className="font-semibold text-slate-700">Đồng bộ lịch tập sang đồng hồ (.ics)</span>{' '}
            để đưa toàn bộ 7 ngày tập vào Apple Watch, Galaxy Watch / Wear OS hoặc Garmin Calendar.
          </p>
        )}

        <form onSubmit={handleSaveSettings} className="pt-3 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="smartwatch-platform-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Loại đồng hồ / phương thức đồng bộ
              </label>
              <select
                id="smartwatch-platform-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SmartwatchPlatform)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              >
                {SMARTWATCH_PLATFORMS.map((key) => (
                  <option key={key} value={key}>
                    {SMARTWATCH_PLATFORM_LABELS[key].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="smartwatch-device-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tên thiết bị đồng hồ
              </label>
              <input
                id="smartwatch-device-name"
                type="text"
                maxLength={SMARTWATCH_DEVICE_NAME_MAX}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Ví dụ: Garmin Forerunner 255 / Apple Watch"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <label className="inline-flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none min-h-[36px]">
              <input
                type="checkbox"
                checked={autoSyncCalendar}
                onChange={(e) => setAutoSyncCalendar(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>
                Kèm nhắc nhở trước 15 phút trên cổ tay khi xuất lịch tập (giờ tập mặc định{' '}
                <span className="font-mono-num font-semibold">{reminderTime || '07:00'}</span>)
              </span>
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu thiết bị vào Firebase'}</span>
            </button>
          </div>
        </form>

        {statusMessage && (
          <p
            role={statusMessage.type === 'error' ? 'alert' : 'status'}
            className={`text-xs leading-relaxed rounded-xl px-3.5 py-2.5 border ${
              statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : statusMessage.type === 'success'
                  ? 'bg-teal-50 border-teal-200 text-teal-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {statusMessage.text}
          </p>
        )}
      </div>
    </section>
  );
}

interface PersonalArchiveExportPanelProps {
  allDailyGoals: DailyGoalData[];
  planHistory: WorkoutPlanData[];
}

export function PersonalArchiveExportPanel({
  allDailyGoals,
  planHistory,
}: PersonalArchiveExportPanelProps) {
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const workoutEntries = useMemo(() => buildWorkoutHistoryEntries(planHistory), [planHistory]);

  const totalRecords = allDailyGoals.length + workoutEntries.length;

  const handleExportGoalsCsv = () => {
    const todayKey = getTodayDateKey();
    const filename = `ai-discipline-coach-muc-tieu-nho-${todayKey}.csv`;
    const csv = buildDailyGoalsCsv(allDailyGoals);
    downloadTextFile(csv, filename, 'text/csv;charset=utf-8');
    setExportNotice(
      `Đã tải xuống ${filename} (${allDailyGoals.length} bản ghi mục tiêu nhỏ, chuẩn UTF-8 hỗ trợ tiếng Việt trên Excel/Google Sheets).`
    );
  };

  const handleExportWorkoutsCsv = () => {
    const todayKey = getTodayDateKey();
    const filename = `ai-discipline-coach-nhat-ky-tap-luyen-${todayKey}.csv`;
    const csv = buildWorkoutHistoryCsv(workoutEntries);
    downloadTextFile(csv, filename, 'text/csv;charset=utf-8');
    setExportNotice(
      `Đã tải xuống ${filename} (${workoutEntries.length} ngày tập đã check-in, chuẩn UTF-8).`
    );
  };

  const handleExportCombinedCsv = () => {
    const todayKey = getTodayDateKey();
    const filename = `ai-discipline-coach-luu-tru-ca-nhan-${todayKey}.csv`;
    const csv = buildCombinedDisciplineCsv(allDailyGoals, workoutEntries);
    downloadTextFile(csv, filename, 'text/csv;charset=utf-8');
    setExportNotice(
      `Đã tải xuống ${filename} (tổng hợp ${allDailyGoals.length} mục tiêu nhỏ và ${workoutEntries.length} ngày tập đã check-in).`
    );
  };

  return (
    <section
      aria-label="Xuất dữ liệu lưu trữ cá nhân ra tệp CSV"
      className="bg-white rounded-2xl border border-slate-200/90 p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Lưu trữ cá nhân · CSV UTF-8 (Excel / Google Sheets)</p>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Xuất dữ liệu mục tiêu nhỏ & nhật ký tập luyện
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="font-mono-num font-semibold text-teal-700">
            {allDailyGoals.length} mục tiêu nhỏ
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num font-semibold text-slate-700">
            {workoutEntries.length} ngày tập đã check-in
          </span>
        </div>
      </div>

      <div className="pt-4 space-y-3">
        <p className="text-xs text-slate-600 leading-relaxed">
          Tải về bản sao lưu cá nhân toàn bộ mục tiêu kỷ luật hằng ngày và lịch sử check-in tập luyện dưới định dạng CSV chuẩn UTF-8 để lưu trữ hoặc phân tích trên bảng tính.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={totalRecords === 0}
            onClick={handleExportCombinedCsv}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất CSV tổng hợp ({totalRecords})</span>
          </button>

          <button
            type="button"
            disabled={allDailyGoals.length === 0}
            onClick={handleExportGoalsCsv}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV mục tiêu nhỏ ({allDailyGoals.length})</span>
          </button>

          <button
            type="button"
            disabled={workoutEntries.length === 0}
            onClick={handleExportWorkoutsCsv}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV nhật ký tập luyện ({workoutEntries.length})</span>
          </button>
        </div>

        {totalRecords === 0 && (
          <p className="text-xs text-slate-500">
            Chưa có dữ liệu mục tiêu nhỏ hoặc ngày tập đã check-in để xuất. Hãy thêm mục tiêu hôm nay hoặc check-in một ngày tập trước.
          </p>
        )}

        {exportNotice && (
          <p
            role="status"
            className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-xl px-3.5 py-2.5 leading-relaxed"
          >
            {exportNotice}
          </p>
        )}
      </div>
    </section>
  );
}
