import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { CalendarDays, LogOut, Target, UserRound } from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { AuthGate } from './components/AuthGate.tsx';
import { ProfileTab } from './components/ProfileTab.tsx';
import { GoalTab } from './components/GoalTab.tsx';
import { PlanTab } from './components/PlanTab.tsx';
import type {
  BootstrapResponse,
  GoalData,
  ProfileData,
  WorkoutPlanData,
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

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [togglingDayIndex, setTogglingDayIndex] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadBootstrap = useCallback(async (user: User) => {
    setIsBootstrapping(true);
    setFeedback(null);
    try {
      const data = await apiFetch<BootstrapResponse>('/api/bootstrap', user);

      if (data.profile) {
        const normalizedProfile: ProfileData = {
          id: data.profile.id,
          fullName: data.profile.fullName,
          age: data.profile.age,
          weightKg: data.profile.weightKg,
          heightCm: data.profile.heightCm,
          fitnessLevel: data.profile.fitnessLevel,
          daysPerWeek: data.profile.daysPerWeek,
          equipment: data.profile.equipment,
          healthLimitations: Array.isArray(data.profile.healthLimitations)
            ? data.profile.healthLimitations
            : [],
          healthNotes: data.profile.healthNotes ?? '',
          updatedAt: data.profile.updatedAt,
        };
        setSavedProfile(normalizedProfile);
        setProfileForm(normalizedProfile);
      } else {
        setSavedProfile(null);
        setProfileForm({
          ...DEFAULT_PROFILE,
          fullName: user.displayName || '',
        });
      }

      if (data.goal) {
        const normalizedGoal: GoalData = {
          id: data.goal.id,
          sport: data.goal.sport,
          goalType: data.goal.goalType,
          durationWeeks: data.goal.durationWeeks,
          updatedAt: data.goal.updatedAt,
        };
        setSavedGoal(normalizedGoal);
        setGoalForm(normalizedGoal);
      } else {
        setSavedGoal(null);
        setGoalForm(DEFAULT_GOAL);
      }

      setLatestPlan(data.latestPlan ?? null);

      if (data.latestPlan) {
        setActiveTab('plan');
      } else if (data.profile) {
        setActiveTab('goal');
      } else {
        setActiveTab('profile');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không thể tải dữ liệu đã lưu từ máy chủ.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        void loadBootstrap(user);
      } else {
        setSavedProfile(null);
        setSavedGoal(null);
        setLatestPlan(null);
      }
    });
    return () => unsubscribe();
  }, [loadBootstrap]);

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

  const saveProfileInternal = async (): Promise<boolean> => {
    if (!firebaseUser) return false;
    setIsSavingProfile(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ profile: ProfileData }>('/api/profile', firebaseUser, {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      setSavedProfile(res.profile);
      setProfileForm(res.profile);
      setFeedback({ type: 'success', message: 'Đã lưu hồ sơ người dùng vào cơ sở dữ liệu.' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu hồ sơ.';
      setFeedback({ type: 'error', message });
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAndContinueProfile = async () => {
    const ok = await saveProfileInternal();
    if (ok) {
      setActiveTab('goal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const saveGoalInternal = async (): Promise<boolean> => {
    if (!firebaseUser) return false;
    setIsSavingGoal(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ goal: GoalData }>('/api/goal', firebaseUser, {
        method: 'PUT',
        body: JSON.stringify(goalForm),
      });
      setSavedGoal(res.goal);
      setGoalForm(res.goal);
      setFeedback({ type: 'success', message: 'Đã lưu mục tiêu tập luyện.' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu mục tiêu.';
      setFeedback({ type: 'error', message });
      return false;
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!firebaseUser) return;
    setIsGeneratingPlan(true);
    setFeedback(null);
    try {
      if (hasUnsavedProfile && profileForm.fullName.trim()) {
        const profileOk = await saveProfileInternal();
        if (!profileOk) return;
      }
      if (hasUnsavedGoal) {
        const goalOk = await saveGoalInternal();
        if (!goalOk) return;
      }
      const res = await apiFetch<{ plan: WorkoutPlanData }>('/api/plans/generate', firebaseUser, {
        method: 'POST',
      });
      setLatestPlan(res.plan);
      setActiveTab('plan');
      setFeedback({
        type: 'success',
        message: res.plan.cautiousMode
          ? 'Đã tạo lịch tập Tuần 1 theo Chế độ thận trọng và lưu vào hệ thống.'
          : 'Đã tạo và lưu lịch tập Tuần 1 thành công.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không thể tạo lịch tập Tuần 1.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleToggleDayComplete = async (planId: number, dayIndex: number) => {
    if (!firebaseUser) return;
    setTogglingDayIndex(dayIndex);
    setFeedback(null);
    try {
      const res = await apiFetch<{ plan: WorkoutPlanData }>(
        `/api/plans/${planId}/days/${dayIndex}/toggle`,
        firebaseUser,
        { method: 'PATCH' }
      );
      setLatestPlan(res.plan);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không thể cập nhật tiến độ buổi tập.';
      setFeedback({ type: 'error', message });
    } finally {
      setTogglingDayIndex(null);
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
              />
            )}

            {activeTab === 'goal' && (
              <GoalTab
                form={goalForm}
                onChange={setGoalForm}
                onSaveGoal={async () => {
                  await saveGoalInternal();
                }}
                onSaveAndGeneratePlan={handleGeneratePlan}
                isSavingGoal={isSavingGoal}
                isGeneratingPlan={isGeneratingPlan}
                hasProfileSaved={Boolean(savedProfile)}
                onGoToProfile={() => setActiveTab('profile')}
                hasUnsavedChanges={hasUnsavedGoal}
                lastSavedAt={savedGoal?.updatedAt}
              />
            )}

            {activeTab === 'plan' && (
              <PlanTab
                plan={latestPlan}
                profile={savedProfile}
                goal={savedGoal}
                isGenerating={isGeneratingPlan}
                togglingDayIndex={togglingDayIndex}
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
