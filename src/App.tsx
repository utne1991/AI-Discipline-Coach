import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { Bell, CalendarDays, LogOut, Target, UserRound } from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  getBrowserTimezone,
  getCurrentHHMM,
  getLocalMinuteKey,
  getNotificationPermission,
  requestBrowserNotificationPermission,
  sendBrowserWorkoutNotification,
  type BrowserNotificationPermission,
} from './lib/browserReminder.ts';
import {
  DEFAULT_REMINDER_SETTINGS,
  saveUserReminderSettings,
  subscribeUserReminderSettings,
  type ReminderSettings,
} from './lib/firestoreReminder.ts';
import { firestoreClientRepository } from './repositories/firestoreClientRepository.ts';
import { getTodayDateKey, type DailyGoalData } from './lib/dailyGoal.ts';
import { AuthGate } from './components/AuthGate.tsx';
import { ProfileTab } from './components/ProfileTab.tsx';
import { GoalTab } from './components/GoalTab.tsx';
import { PlanTab } from './components/PlanTab.tsx';
import {
  CONSENT_POLICY_VERSION,
  evaluateSafetyProfile,
  type ConsentRecord,
  type GoalData,
  type ProfileData,
  type WorkoutPlanData,
} from './shared/types.ts';

type AppTab = 'profile' | 'goal' | 'plan';

const HERO_IMAGE_PATH = '/src/assets/images/coach_hero_athlete_1795513970914.jpg';

const DEFAULT_PROFILE: ProfileData = {
  fullName: '',
  age: 26,
  weightKg: 65,
  heightCm: 170,
  fitnessLevel: 'beginner',
  daysPerWeek: 3,
  equipment: 'none',
  healthLimitations: [],
  healthNotes: '',
};

const DEFAULT_GOAL: GoalData = {
  sport: 'home_workout',
  goalType: 'weight_loss',
  durationWeeks: 8,
};

const DEFAULT_CONSENT: ConsentRecord = {
  policyVersion: CONSENT_POLICY_VERSION,
  aiHealthDataConsent: false,
  guardianConsentConfirmed: false,
  medicalClearanceAcknowledged: false,
};

async function apiFetch<T>(url: string, user: User, options: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  const payload = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(payload.error || 'Đã xảy ra lỗi khi kết nối máy chủ.');
  }
  return payload;
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('profile');
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const [savedProfile, setSavedProfile] = useState<ProfileData | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileData>(DEFAULT_PROFILE);

  const [savedGoal, setSavedGoal] = useState<GoalData | null>(null);
  const [goalForm, setGoalForm] = useState<GoalData>(DEFAULT_GOAL);

  const [latestPlan, setLatestPlan] = useState<WorkoutPlanData | null>(null);
  const [planHistory, setPlanHistory] = useState<WorkoutPlanData[]>([]);
  const [consent, setConsent] = useState<ConsentRecord>(DEFAULT_CONSENT);
  const [isSavingConsent, setIsSavingConsent] = useState(false);

  const [dailyGoal, setDailyGoal] = useState<DailyGoalData | null>(null);
  const [isSavingDailyGoal, setIsSavingDailyGoal] = useState(false);
  const [isTogglingDailyGoal, setIsTogglingDailyGoal] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [togglingDayIndex, setTogglingDayIndex] = useState<number | null>(null);

  const [savedReminder, setSavedReminder] = useState<ReminderSettings | null>(null);
  const [reminderForm, setReminderForm] = useState<ReminderSettings>(() => ({
    ...DEFAULT_REMINDER_SETTINGS,
    timezone: getBrowserTimezone(),
  }));
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getNotificationPermission());
  const [activeReminderBanner, setActiveReminderBanner] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof Error)) return fallback;
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      // Not JSON-formatted FirestoreErrorInfo
    }
    return error.message || fallback;
  };

  const loadBootstrap = useCallback(async (user: User) => {
    setIsBootstrapping(true);
    setFeedback(null);
    try {
      const data = await firestoreClientRepository.loadUserFitnessData(user.uid);

      if (data.profile) {
        setSavedProfile(data.profile);
        setProfileForm(data.profile);
      } else {
        setSavedProfile(null);
        setProfileForm({
          ...DEFAULT_PROFILE,
          fullName: user.displayName || '',
        });
      }

      if (data.goal) {
        setSavedGoal(data.goal);
        setGoalForm(data.goal);
      } else {
        setSavedGoal(null);
        setGoalForm(DEFAULT_GOAL);
      }

      setConsent(data.consent ?? DEFAULT_CONSENT);
      setLatestPlan(data.latestPlan ?? null);
      setPlanHistory(data.allPlans ?? []);
      setDailyGoal(data.todayDailyGoal ?? null);

      if (data.latestPlan) {
        setActiveTab('plan');
      } else if (data.profile) {
        setActiveTab('goal');
      } else {
        setActiveTab('profile');
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error, 'Không thể tải dữ liệu đã lưu từ Firebase.'),
      });
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribeReminder: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeReminder) {
        unsubscribeReminder();
        unsubscribeReminder = null;
      }

      setFirebaseUser(user);
      setAuthReady(true);
      setNotificationPermission(getNotificationPermission());

      if (user) {
        void loadBootstrap(user);
        unsubscribeReminder = subscribeUserReminderSettings(
          user.uid,
          (settings) => {
            if (settings) {
              setSavedReminder(settings);
              setReminderForm(settings);
            } else {
              setSavedReminder(null);
              setReminderForm({
                ...DEFAULT_REMINDER_SETTINGS,
                timezone: getBrowserTimezone(),
              });
            }
          },
          (err) => {
            console.error('Failed to sync reminder settings from Firebase:', err);
            setFeedback({
              type: 'error',
              message: 'Không thể đồng bộ cài đặt nhắc nhở từ Firebase lúc này.',
            });
          }
        );
      } else {
        setSavedProfile(null);
        setSavedGoal(null);
        setLatestPlan(null);
        setPlanHistory([]);
        setDailyGoal(null);
        setSavedReminder(null);
        setReminderForm({
          ...DEFAULT_REMINDER_SETTINGS,
          timezone: getBrowserTimezone(),
        });
        setActiveReminderBanner(null);
        setConsent(DEFAULT_CONSENT);
        setActiveTab('profile');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeReminder) {
        unsubscribeReminder();
      }
    };
  }, [loadBootstrap]);

  useEffect(() => {
    if (!firebaseUser || !savedReminder?.reminderEnabled) {
      return;
    }

    const checkAndNotify = () => {
      const now = new Date();
      if (getCurrentHHMM(now) !== savedReminder.reminderTime) {
        return;
      }
      const minuteKey = getLocalMinuteKey(now);
      const storageKey = `adc_reminder_sent_${firebaseUser.uid}`;
      try {
        if (window.localStorage.getItem(storageKey) === minuteKey) {
          return;
        }
        window.localStorage.setItem(storageKey, minuteKey);
      } catch {
        // Ignore storage restrictions in private browsing
      }

      const title = 'AI Discipline Coach — Đã đến giờ tập luyện!';
      const body = `Lịch nhắc hàng ngày lúc ${savedReminder.reminderTime}. Hãy mở kế hoạch Tuần 1 để hoàn thành buổi tập hôm nay.`;
      sendBrowserWorkoutNotification(title, body);
      setActiveReminderBanner(
        `Đã đến giờ tập luyện (${savedReminder.reminderTime})! Hãy kiểm tra Lịch tập tuần và đánh dấu hoàn thành sau buổi tập.`
      );
    };

    checkAndNotify();
    const timerId = window.setInterval(checkAndNotify, 15_000);
    return () => window.clearInterval(timerId);
  }, [firebaseUser, savedReminder]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Không thể đăng nhập bằng Google. Vui lòng thử lại.';
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setFeedback(null);
    setConsent(DEFAULT_CONSENT);
    setActiveTab('profile');
  };

  const hasUnsavedProfile = useMemo(() => {
    if (!savedProfile) return true;
    return (
      savedProfile.fullName !== profileForm.fullName ||
      savedProfile.age !== profileForm.age ||
      savedProfile.weightKg !== profileForm.weightKg ||
      savedProfile.heightCm !== profileForm.heightCm ||
      savedProfile.fitnessLevel !== profileForm.fitnessLevel ||
      savedProfile.daysPerWeek !== profileForm.daysPerWeek ||
      savedProfile.equipment !== profileForm.equipment ||
      savedProfile.healthNotes !== profileForm.healthNotes ||
      JSON.stringify(savedProfile.healthLimitations) !==
        JSON.stringify(profileForm.healthLimitations)
    );
  }, [savedProfile, profileForm]);

  const hasUnsavedGoal = useMemo(() => {
    if (!savedGoal) return true;
    return (
      savedGoal.sport !== goalForm.sport ||
      savedGoal.goalType !== goalForm.goalType ||
      savedGoal.durationWeeks !== goalForm.durationWeeks
    );
  }, [savedGoal, goalForm]);

  const hasUnsavedReminder = useMemo(() => {
    if (!savedReminder) return true;
    return (
      savedReminder.reminderEnabled !== reminderForm.reminderEnabled ||
      savedReminder.reminderTime !== reminderForm.reminderTime ||
      savedReminder.timezone !== reminderForm.timezone
    );
  }, [savedReminder, reminderForm]);

  const handleRequestNotificationPermission = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      setFeedback({
        type: 'success',
        message: 'Đã cấp quyền thông báo trình duyệt cho nhắc nhở hàng ngày.',
      });
    } else if (perm === 'denied') {
      setFeedback({
        type: 'error',
        message: 'Trình duyệt đã từ chối quyền thông báo. Hệ thống sẽ vẫn nhắc trực tiếp trên trang khi mở.',
      });
    }
  };

  const handleSaveReminder = async () => {
    if (!firebaseUser) return;
    setIsSavingReminder(true);
    setFeedback(null);
    try {
      let currentPerm = getNotificationPermission();
      if (reminderForm.reminderEnabled && currentPerm === 'default') {
        currentPerm = await requestBrowserNotificationPermission();
        setNotificationPermission(currentPerm);
      }

      const saved = await saveUserReminderSettings(firebaseUser.uid, {
        ...reminderForm,
        timezone: reminderForm.timezone || getBrowserTimezone(),
      });
      setSavedReminder(saved);
      setReminderForm(saved);
      setFeedback({
        type: 'success',
        message: saved.reminderEnabled
          ? `Đã lưu giờ nhắc hàng ngày (${saved.reminderTime}) vào hồ sơ Firebase.`
          : 'Đã lưu trạng thái tắt nhắc nhở vào hồ sơ Firebase.',
      });
    } catch (error) {
      let message = 'Không thể lưu cài đặt nhắc nhở vào Firebase.';
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message) as { error?: string };
          if (parsed.error) {
            message = `Không thể lưu vào Firebase: ${parsed.error}`;
          }
        } catch {
          message = error.message;
        }
      }
      setFeedback({ type: 'error', message });
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleTestReminder = () => {
    const title = 'AI Discipline Coach — Thông báo thử nghiệm';
    const body = `Nhắc nhở hàng ngày được đặt lúc ${reminderForm.reminderTime}. Kỷ luật tạo nên kết quả!`;
    const sentNative = sendBrowserWorkoutNotification(title, body);
    setActiveReminderBanner(
      sentNative
        ? `Đã gửi thông báo trình duyệt thử nghiệm cho khung giờ ${reminderForm.reminderTime}.`
        : `Nhắc nhở thử nghiệm (${reminderForm.reminderTime}): Đã đến giờ tập luyện!`
    );
  };

  const saveProfileInternal = async (): Promise<ProfileData | null> => {
    if (!firebaseUser) return null;
    setIsSavingProfile(true);
    setFeedback(null);
    try {
      const saved = await firestoreClientRepository.saveUserProfile(firebaseUser.uid, profileForm);
      setSavedProfile(saved);
      setProfileForm(saved);
      setFeedback({ type: 'success', message: 'Đã lưu hồ sơ người dùng vào Firebase.' });
      return saved;
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error, 'Không thể lưu hồ sơ.'),
      });
      return null;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAndContinueProfile = async () => {
    const saved = await saveProfileInternal();
    if (saved) {
      setActiveTab('goal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const saveGoalInternal = async (): Promise<GoalData | null> => {
    if (!firebaseUser) return null;
    setIsSavingGoal(true);
    setFeedback(null);
    try {
      const saved = await firestoreClientRepository.saveUserGoal(firebaseUser.uid, goalForm);
      setSavedGoal(saved);
      setGoalForm(saved);
      setFeedback({ type: 'success', message: 'Đã lưu mục tiêu tập luyện vào Firebase.' });
      return saved;
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error, 'Không thể lưu mục tiêu.'),
      });
      return null;
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleUpdateConsent = async (patch: Partial<ConsentRecord>) => {
    const next: ConsentRecord = {
      ...consent,
      ...patch,
      policyVersion: CONSENT_POLICY_VERSION,
    };
    setConsent(next);
    if (!firebaseUser) return;

    setIsSavingConsent(true);
    try {
      const saved = await firestoreClientRepository.saveUserConsent(firebaseUser.uid, next);
      setConsent(saved);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error, 'Không thể lưu trạng thái đồng ý vào Firebase.'),
      });
    } finally {
      setIsSavingConsent(false);
    }
  };

  const isConsentCompleteForProfile = useMemo(() => {
    if (!consent.aiHealthDataConsent) return false;
    if (!savedProfile) return false;
    const safety = evaluateSafetyProfile({
      age: savedProfile.age,
      weightKg: savedProfile.weightKg,
      heightCm: savedProfile.heightCm,
      fitnessLevel: savedProfile.fitnessLevel,
      daysPerWeek: savedProfile.daysPerWeek,
      healthLimitations: savedProfile.healthLimitations,
      healthNotes: savedProfile.healthNotes,
    });
    if (safety.isMinor && !consent.guardianConsentConfirmed) return false;
    if (safety.requiresMedicalClearance && !consent.medicalClearanceAcknowledged) return false;
    return true;
  }, [consent, savedProfile]);

  const handleGeneratePlan = async () => {
    if (!firebaseUser) return;
    if (!consent.aiHealthDataConsent) {
      setFeedback({
        type: 'error',
        message: 'Vui lòng đánh dấu đồng ý chia sẻ thông tin sức khỏe đã tối giản cho AI ở tab Mục tiêu.',
      });
      setActiveTab('goal');
      return;
    }
    setIsGeneratingPlan(true);
    setFeedback(null);
    try {
      let currentProfile = savedProfile;
      if (hasUnsavedProfile && profileForm.fullName.trim()) {
        currentProfile = await saveProfileInternal();
        if (!currentProfile) return;
      }
      if (!currentProfile) {
        setFeedback({
          type: 'error',
          message: 'Vui lòng hoàn thành và lưu Hồ sơ người dùng (M01) trước khi tạo lịch tập.',
        });
        setActiveTab('profile');
        return;
      }

      const safety = evaluateSafetyProfile({
        age: currentProfile.age,
        weightKg: currentProfile.weightKg,
        heightCm: currentProfile.heightCm,
        fitnessLevel: currentProfile.fitnessLevel,
        daysPerWeek: currentProfile.daysPerWeek,
        healthLimitations: currentProfile.healthLimitations,
        healthNotes: currentProfile.healthNotes,
      });
      if (safety.isMinor && !consent.guardianConsentConfirmed) {
        setFeedback({
          type: 'error',
          message:
            'Người dùng dưới 18 tuổi cần xác nhận có sự đồng ý và giám sát của phụ huynh / người giám hộ ở tab Mục tiêu.',
        });
        setActiveTab('goal');
        return;
      }
      if (safety.requiresMedicalClearance && !consent.medicalClearanceAcknowledged) {
        setFeedback({
          type: 'error',
          message:
            'Hồ sơ có yếu tố sức khỏe cần đánh giá chuyên môn. Vui lòng xác nhận khuyến nghị tham khảo ý kiến bác sĩ ở tab Mục tiêu.',
        });
        setActiveTab('goal');
        return;
      }

      let currentGoal = savedGoal;
      if (hasUnsavedGoal || !currentGoal) {
        currentGoal = await saveGoalInternal();
        if (!currentGoal) return;
      }

      const res = await apiFetch<{ plan: WorkoutPlanData }>('/api/plans/generate', firebaseUser, {
        method: 'POST',
        body: JSON.stringify({
          aiConsent: consent.aiHealthDataConsent,
          guardianConsent: consent.guardianConsentConfirmed,
          medicalClearanceAcknowledged: consent.medicalClearanceAcknowledged,
          consentPolicyVersion: consent.policyVersion || CONSENT_POLICY_VERSION,
          profile: currentProfile,
          goal: currentGoal,
        }),
      });

      const persistedPlan = await firestoreClientRepository.saveWorkoutPlan(
        firebaseUser.uid,
        res.plan
      );
      setLatestPlan(persistedPlan);
      setPlanHistory((prev) => [persistedPlan, ...prev.filter((p) => p.id !== persistedPlan.id)]);
      setActiveTab('plan');
      setFeedback({
        type: 'success',
        message: persistedPlan.cautiousMode
          ? 'Đã tạo lịch tập Tuần 1 theo Chế độ thận trọng và lưu vào Firebase.'
          : 'Đã tạo và lưu lịch tập Tuần 1 vào Firebase thành công.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error, 'Không thể tạo lịch tập Tuần 1.'),
      });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleToggleDayComplete = async (planId: number, dayIndex: number) => {
    if (!firebaseUser || !latestPlan || latestPlan.id !== planId) return;
    setTogglingDayIndex(dayIndex);
    setFeedback(null);
    try {
      const updated = await firestoreClientRepository.togglePlanDay(
        firebaseUser.uid,
        latestPlan,
        dayIndex
      );
      setLatestPlan(updated);
      setPlanHistory((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error, 'Không thể cập nhật tiến độ buổi tập.'),
      });
    } finally {
      setTogglingDayIndex(null);
    }
  };

  const handleSaveDailyGoal = async (title: string): Promise<boolean> => {
    if (!firebaseUser) return false;
    setIsSavingDailyGoal(true);
    setFeedback(null);
    try {
      const todayKey = getTodayDateKey();
      const preserveCompleted =
        dailyGoal && dailyGoal.dateKey === todayKey && dailyGoal.title === title
          ? dailyGoal.completed
          : false;
      const saved = await firestoreClientRepository.saveDailyGoal(firebaseUser.uid, {
        dateKey: todayKey,
        title,
        completed: preserveCompleted,
      });
      setDailyGoal(saved);
      setFeedback({
        type: 'success',
        message: 'Đã lưu mục tiêu nhỏ hôm nay vào Firebase.',
      });
      return true;
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error, 'Không thể lưu mục tiêu hôm nay vào Firebase.'),
      });
      return false;
    } finally {
      setIsSavingDailyGoal(false);
    }
  };

  const handleToggleDailyGoal = async () => {
    if (!firebaseUser || !dailyGoal) return;
    setIsTogglingDailyGoal(true);
    setFeedback(null);
    try {
      const updated = await firestoreClientRepository.toggleDailyGoal(firebaseUser.uid, dailyGoal);
      setDailyGoal(updated);
      setFeedback({
        type: 'success',
        message: updated.completed
          ? 'Tuyệt vời! Bạn đã hoàn thành mục tiêu nhỏ hôm nay.'
          : 'Đã chuyển mục tiêu hôm nay về trạng thái đang thực hiện.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(error, 'Không thể cập nhật trạng thái mục tiêu hôm nay.'),
      });
    } finally {
      setIsTogglingDailyGoal(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F6F7F8] flex items-center justify-center px-4">
        <div className="text-sm text-slate-600 font-medium">Đang khởi tạo ứng dụng...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <AuthGate
        heroImageUrl={HERO_IMAGE_PATH}
        onSignIn={handleSignIn}
        isSigningIn={isSigningIn}
        errorMessage={authError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F8] text-slate-900 pb-24">
      <header className="sticky top-0 z-30 h-13 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            AI Discipline Coach
          </span>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-teal-700 text-teal-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Hồ sơ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('goal')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'goal'
                  ? 'border-teal-700 text-teal-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Mục tiêu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'plan'
                  ? 'border-teal-700 text-teal-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Lịch tập tuần
            </button>
          </nav>

          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-6 space-y-4">
        {activeReminderBanner && (
          <div
            role="status"
            className="rounded-2xl border border-teal-300 bg-teal-50 px-4 py-3 text-xs sm:text-sm font-medium text-teal-950 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Bell className="w-4 h-4 text-teal-700 shrink-0" />
              <span>{activeReminderBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveReminderBanner(null)}
              className="text-xs underline shrink-0 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`rounded-2xl border px-4 py-3 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-teal-50 border-teal-200 text-teal-900'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs underline shrink-0 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {isBootstrapping ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              Đang tải hồ sơ và lịch tập của bạn...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'profile' && (
              <ProfileTab
                form={profileForm}
                onChange={setProfileForm}
                onSave={async () => {
                  await saveProfileInternal();
                }}
                onSaveAndContinue={handleSaveAndContinueProfile}
                isSaving={isSavingProfile}
                hasUnsavedChanges={hasUnsavedProfile}
                lastSavedAt={savedProfile?.updatedAt}
                reminderForm={reminderForm}
                onReminderChange={setReminderForm}
                onSaveReminder={handleSaveReminder}
                isSavingReminder={isSavingReminder}
                hasUnsavedReminder={hasUnsavedReminder}
                reminderSyncedAt={savedReminder?.updatedAt}
                notificationPermission={notificationPermission}
                onRequestNotificationPermission={handleRequestNotificationPermission}
                onTestReminder={handleTestReminder}
              />
            )}

            {activeTab === 'goal' && (
              <GoalTab
                form={goalForm}
                profile={savedProfile}
                onChange={setGoalForm}
                onSaveGoal={async () => {
                  await saveGoalInternal();
                }}
                onSaveAndGeneratePlan={handleGeneratePlan}
                isSavingGoal={isSavingGoal}
                isGeneratingPlan={isGeneratingPlan}
                hasProfileSaved={Boolean(savedProfile)}
                consent={consent}
                isSavingConsent={isSavingConsent}
                onUpdateConsent={handleUpdateConsent}
                onGoToProfile={() => setActiveTab('profile')}
                hasUnsavedChanges={hasUnsavedGoal}
                lastSavedAt={savedGoal?.updatedAt}
              />
            )}

            {activeTab === 'plan' && (
              <PlanTab
                plan={latestPlan}
                planHistory={planHistory}
                profile={savedProfile}
                goal={savedGoal}
                isGenerating={isGeneratingPlan}
                togglingDayIndex={togglingDayIndex}
                aiConsent={isConsentCompleteForProfile}
                dailyGoal={dailyGoal}
                isSavingDailyGoal={isSavingDailyGoal}
                isTogglingDailyGoal={isTogglingDailyGoal}
                onSaveDailyGoal={handleSaveDailyGoal}
                onToggleDailyGoal={handleToggleDailyGoal}
                onGeneratePlan={handleGeneratePlan}
                onToggleDayComplete={handleToggleDayComplete}
                onGoToProfile={() => setActiveTab('profile')}
                onGoToGoal={() => setActiveTab('goal')}
              />
            )}
          </>
        )}
      </main>

      <nav
        aria-label="Điều hướng chính"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="max-w-4xl mx-auto grid grid-cols-3 h-16">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'profile' ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserRound className="w-5 h-5" strokeWidth={activeTab === 'profile' ? 2.4 : 1.8} />
            <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
              Hồ sơ
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goal')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'goal' ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Target className="w-5 h-5" strokeWidth={activeTab === 'goal' ? 2.4 : 1.8} />
            <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
              Mục tiêu
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'plan' ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-5 h-5" strokeWidth={activeTab === 'plan' ? 2.4 : 1.8} />
            <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
              Lịch tập tuần
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
