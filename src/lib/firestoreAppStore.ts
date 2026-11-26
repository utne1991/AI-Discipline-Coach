import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase.ts';
import { handleFirestoreError, OperationType } from './firestoreReminder.ts';
import {
  DATE_KEY_PATTERN,
  filterGoalsByMonth,
  getCurrentMonthKey,
  getTodayDateKey,
  sanitizeDailyGoalTitle,
  type DailyGoalData,
} from './dailyGoal.ts';
import {
  sanitizeSmartwatchConnection,
  type SmartwatchConnectionData,
} from './smartwatch.ts';
import {
  CONSENT_POLICY_VERSION,
  type AiProviderName,
  type ConsentRecord,
  type EquipmentOption,
  type FitnessLevel,
  type GoalData,
  type GoalType,
  type MeasurableGoalSpec,
  type ProfileData,
  type SchedulePreferences,
  type SportOption,
  type StrategyV2Blueprint,
  type WorkoutDay,
  type WorkoutPlanData,
} from '../shared/types.ts';
import {
  normalizeSchedulePreferences,
  normalizeSportsList,
} from '../services/strategyEngineV2.ts';

const VALID_METRIC_KEYS = new Set([
  'run_distance_km',
  'weight_change_kg',
  'weekly_sessions',
  'strength_reps',
  'endurance_minutes',
]);

export function sanitizeMeasurableGoalForFirestore(
  raw: unknown
): MeasurableGoalSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Record<string, unknown>;
  const metricKey =
    typeof candidate.metricKey === 'string' && VALID_METRIC_KEYS.has(candidate.metricKey)
      ? (candidate.metricKey as MeasurableGoalSpec['metricKey'])
      : 'weekly_sessions';
  const targetLabel =
    typeof candidate.targetLabel === 'string' && candidate.targetLabel.trim().length > 0
      ? candidate.targetLabel.trim().slice(0, 160)
      : 'Hoàn thành mục tiêu tập luyện đo lường được';
  const currentValue = Number.isFinite(Number(candidate.currentValue))
    ? Math.max(0, Math.min(10000, Math.round(Number(candidate.currentValue) * 10) / 10))
    : 0;
  const targetValue = Number.isFinite(Number(candidate.targetValue))
    ? Math.max(0, Math.min(10000, Math.round(Number(candidate.targetValue) * 10) / 10))
    : 1;
  const unit =
    typeof candidate.unit === 'string' && candidate.unit.trim().length > 0
      ? candidate.unit.trim().slice(0, 24)
      : 'đơn vị';

  return {
    metricKey,
    targetLabel,
    currentValue,
    targetValue,
    unit,
  };
}

export function sanitizeSchedulePreferencesForFirestore(
  raw: unknown
): SchedulePreferences | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const normalized = normalizeSchedulePreferences(raw as Partial<SchedulePreferences>);
  return {
    startDateKey: normalized.startDateKey,
    timezone: normalized.timezone.slice(0, 64),
    preferredTimeSlot: normalized.preferredTimeSlot,
    minutesPerSessionBudget: Math.max(20, Math.min(90, Math.round(normalized.minutesPerSessionBudget))),
    ...(normalized.preferredDays && normalized.preferredDays.length > 0
      ? { preferredDays: normalized.preferredDays.slice(0, 7) }
      : {}),
  };
}

export function sanitizeStrategyV2ForFirestore(
  raw: unknown
): StrategyV2Blueprint | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as StrategyV2Blueprint;
  if (src.engineVersion !== '2.0' || !Array.isArray(src.phases) || src.phases.length === 0) {
    return undefined;
  }

  const measurableGoal =
    sanitizeMeasurableGoalForFirestore(src.measurableGoal) ?? {
      metricKey: 'weekly_sessions',
      targetLabel: 'Duy trì nhịp tập luyện kỷ luật mỗi tuần',
      currentValue: 1,
      targetValue: 3,
      unit: 'buổi/tuần',
    };
  const sports = normalizeSportsList(
    (Array.isArray(src.sports) && src.sports[0]) || 'home_workout',
    src.sports
  );

  return {
    engineVersion: '2.0',
    sports,
    measurableGoal,
    feasibility: src.feasibility,
    ultimateGoal: String(src.ultimateGoal || 'Đạt mục tiêu kỷ luật cá nhân').slice(0, 600),
    currentPosition: String(src.currentPosition || 'Đang khởi động lộ trình').slice(0, 600),
    phases: src.phases.slice(0, 6),
    milestones: (Array.isArray(src.milestones) ? src.milestones : []).slice(0, 12),
    volumeAllocation: (Array.isArray(src.volumeAllocation) ? src.volumeAllocation : []).slice(0, 3),
    todayDirective: String(src.todayDirective || 'Hoàn thành nhiệm vụ trọng tâm hôm nay.').slice(0, 600),
    reassessmentSchedule: String(
      src.reassessmentSchedule || 'Đánh giá lại sau mỗi 2 tuần.'
    ).slice(0, 600),
    adjustmentSignals: (Array.isArray(src.adjustmentSignals) && src.adjustmentSignals.length > 0
      ? src.adjustmentSignals
      : ['Tỷ lệ hoàn thành buổi tập hằng tuần']
    )
      .map((s) => String(s).slice(0, 260))
      .slice(0, 8),
    stopAndEscalateCriteria: (Array.isArray(src.stopAndEscalateCriteria) &&
    src.stopAndEscalateCriteria.length > 0
      ? src.stopAndEscalateCriteria
      : ['Dừng tập ngay khi đau nhói khớp, chóng mặt hoặc đau ngực.']
    )
      .map((s) => String(s).slice(0, 280))
      .slice(0, 10),
    calendarContext: src.calendarContext,
    dailyCommitments: (Array.isArray(src.dailyCommitments) ? src.dailyCommitments : []).slice(0, 21),
  };
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function parseProfileDoc(data: Record<string, unknown>): ProfileData {
  return {
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    age: typeof data.age === 'number' ? data.age : 26,
    weightKg: typeof data.weightKg === 'number' ? data.weightKg : 65,
    heightCm: typeof data.heightCm === 'number' ? data.heightCm : 170,
    fitnessLevel: (data.fitnessLevel as FitnessLevel) || 'beginner',
    daysPerWeek: typeof data.daysPerWeek === 'number' ? data.daysPerWeek : 3,
    equipment: (data.equipment as EquipmentOption) || 'none',
    healthLimitations: Array.isArray(data.healthLimitations)
      ? data.healthLimitations.filter((item): item is string => typeof item === 'string')
      : [],
    healthNotes: typeof data.healthNotes === 'string' ? data.healthNotes : '',
    updatedAt: toIsoString(data.updatedAt),
  };
}

function parseGoalDoc(data: Record<string, unknown>): GoalData {
  const primarySport = (data.sport as SportOption) || 'home_workout';
  const sports = Array.isArray(data.sports)
    ? normalizeSportsList(primarySport, data.sports as SportOption[])
    : [primarySport];
  const measurableGoal = sanitizeMeasurableGoalForFirestore(data.measurableGoal);
  const schedulePreferences = sanitizeSchedulePreferencesForFirestore(data.schedulePreferences);

  return {
    sport: primarySport,
    sports,
    goalType: (data.goalType as GoalType) || 'weight_loss',
    durationWeeks: typeof data.durationWeeks === 'number' ? data.durationWeeks : 8,
    ...(measurableGoal ? { measurableGoal } : {}),
    ...(schedulePreferences ? { schedulePreferences } : {}),
    updatedAt: toIsoString(data.updatedAt),
  };
}

function parsePlanDoc(data: Record<string, unknown>): WorkoutPlanData {
  const primarySport = (data.sport as SportOption) || 'home_workout';
  const sports = Array.isArray(data.sports)
    ? normalizeSportsList(primarySport, data.sports as SportOption[])
    : [primarySport];
  const strategyV2 = sanitizeStrategyV2ForFirestore(data.strategyV2);

  return {
    id: typeof data.numericId === 'number' ? data.numericId : Date.now(),
    weekNumber: typeof data.weekNumber === 'number' ? data.weekNumber : 1,
    sport: primarySport,
    sports,
    goalType: (data.goalType as GoalType) || 'weight_loss',
    durationWeeks: typeof data.durationWeeks === 'number' ? data.durationWeeks : 8,
    cautiousMode: Boolean(data.cautiousMode),
    cautionReasons: Array.isArray(data.cautionReasons)
      ? data.cautionReasons.filter((r): r is string => typeof r === 'string')
      : [],
    safetyAlert: typeof data.safetyAlert === 'string' ? data.safetyAlert : '',
    strategySummary: typeof data.strategySummary === 'string' ? data.strategySummary : '',
    coachPrinciples: Array.isArray(data.coachPrinciples)
      ? data.coachPrinciples.filter((p): p is string => typeof p === 'string')
      : [],
    scheduleJson: Array.isArray(data.scheduleJson) ? (data.scheduleJson as WorkoutDay[]) : [],
    completedDays: Array.isArray(data.completedDays)
      ? data.completedDays.filter((d): d is number => typeof d === 'number')
      : [],
    aiProvider:
      data.aiProvider === 'mock' || data.aiProvider === 'gemini'
        ? (data.aiProvider as AiProviderName)
        : undefined,
    isSimulated: typeof data.isSimulated === 'boolean' ? data.isSimulated : undefined,
    versionNumber: typeof data.versionNumber === 'number' ? data.versionNumber : 1,
    parentPlanId: typeof data.parentPlanId === 'number' ? data.parentPlanId : null,
    revisionReason: typeof data.revisionReason === 'string' ? data.revisionReason : '',
    ...(strategyV2 ? { strategyV2 } : {}),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

function parseConsentDoc(data: Record<string, unknown>): ConsentRecord {
  return {
    policyVersion:
      typeof data.policyVersion === 'string' && data.policyVersion.trim()
        ? data.policyVersion
        : CONSENT_POLICY_VERSION,
    aiHealthDataConsent: Boolean(data.aiHealthDataConsent),
    guardianConsentConfirmed: Boolean(data.guardianConsentConfirmed),
    medicalClearanceAcknowledged: Boolean(data.medicalClearanceAcknowledged),
    updatedAt: toIsoString(data.updatedAt),
  };
}

function parseDailyGoalDoc(data: Record<string, unknown>, fallbackDateKey: string): DailyGoalData {
  return {
    dateKey:
      typeof data.dateKey === 'string' && DATE_KEY_PATTERN.test(data.dateKey)
        ? data.dateKey
        : fallbackDateKey,
    title: typeof data.title === 'string' ? data.title : '',
    completed: Boolean(data.completed),
    updatedAt: toIsoString(data.updatedAt),
  };
}

function parseSmartwatchDoc(data: Record<string, unknown>): SmartwatchConnectionData {
  return sanitizeSmartwatchConnection({
    deviceName: typeof data.deviceName === 'string' ? data.deviceName : undefined,
    platform: typeof data.platform === 'string' ? (data.platform as SmartwatchConnectionData['platform']) : undefined,
    autoSyncCalendar: typeof data.autoSyncCalendar === 'boolean' ? data.autoSyncCalendar : undefined,
    lastConnectedAt: typeof data.lastConnectedAt === 'string' ? data.lastConnectedAt : '',
    lastHeartRateBpm: typeof data.lastHeartRateBpm === 'number' ? data.lastHeartRateBpm : 0,
    lastBatteryPercent: typeof data.lastBatteryPercent === 'number' ? data.lastBatteryPercent : -1,
    totalSyncedSessions: typeof data.totalSyncedSessions === 'number' ? data.totalSyncedSessions : 0,
    updatedAt: toIsoString(data.updatedAt),
  });
}

export async function loadTodayDailyGoal(
  uid: string,
  dateKey: string = getTodayDateKey()
): Promise<DailyGoalData | null> {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error('Định dạng ngày mục tiêu không hợp lệ.');
  }
  const path = `users/${uid}/dailyGoals/${dateKey}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'dailyGoals', dateKey));
    if (!snap.exists()) {
      return null;
    }
    return parseDailyGoalDoc(snap.data() as Record<string, unknown>, dateKey);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function loadUserFitnessData(uid: string): Promise<{
  profile: ProfileData | null;
  goal: GoalData | null;
  consent: ConsentRecord | null;
  smartwatchConnection: SmartwatchConnectionData | null;
  latestPlan: WorkoutPlanData | null;
  allPlans: WorkoutPlanData[];
  todayDailyGoal: DailyGoalData | null;
  monthlyDailyGoals: DailyGoalData[];
  allDailyGoals: DailyGoalData[];
}> {
  const todayKey = getTodayDateKey();
  const currentMonthKey = getCurrentMonthKey();
  const profilePath = `users/${uid}/appData/profile`;
  const goalPath = `users/${uid}/appData/goal`;
  const consentPath = `users/${uid}/appData/consent`;
  const smartwatchPath = `users/${uid}/appData/smartwatch`;
  const plansPath = `users/${uid}/plans`;
  const dailyGoalsPath = `users/${uid}/dailyGoals`;

  let profileSnap;
  try {
    profileSnap = await getDoc(doc(db, 'users', uid, 'appData', 'profile'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  let goalSnap;
  try {
    goalSnap = await getDoc(doc(db, 'users', uid, 'appData', 'goal'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, goalPath);
  }

  let consentSnap;
  try {
    consentSnap = await getDoc(doc(db, 'users', uid, 'appData', 'consent'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, consentPath);
  }

  let smartwatchSnap;
  try {
    smartwatchSnap = await getDoc(doc(db, 'users', uid, 'appData', 'smartwatch'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, smartwatchPath);
  }

  let plansSnap;
  try {
    const q = query(collection(db, 'users', uid, 'plans'), where('uid', '==', uid));
    plansSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, plansPath);
  }

  let dailyGoalsSnap;
  try {
    const dailyGoalsQuery = query(
      collection(db, 'users', uid, 'dailyGoals'),
      where('uid', '==', uid)
    );
    dailyGoalsSnap = await getDocs(dailyGoalsQuery);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, dailyGoalsPath);
  }

  const parsedPlans = plansSnap.docs
    .map((d) => parsePlanDoc(d.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const allDailyGoals = dailyGoalsSnap.docs
    .map((d) => parseDailyGoalDoc(d.data() as Record<string, unknown>, d.id))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const monthlyDailyGoals = filterGoalsByMonth(allDailyGoals, currentMonthKey);
  const todayDailyGoal = allDailyGoals.find((g) => g.dateKey === todayKey) ?? null;

  return {
    profile: profileSnap.exists() ? parseProfileDoc(profileSnap.data() as Record<string, unknown>) : null,
    goal: goalSnap.exists() ? parseGoalDoc(goalSnap.data() as Record<string, unknown>) : null,
    consent: consentSnap.exists()
      ? parseConsentDoc(consentSnap.data() as Record<string, unknown>)
      : null,
    smartwatchConnection: smartwatchSnap.exists()
      ? parseSmartwatchDoc(smartwatchSnap.data() as Record<string, unknown>)
      : null,
    latestPlan: parsedPlans[0] ?? null,
    allPlans: parsedPlans,
    todayDailyGoal,
    monthlyDailyGoals,
    allDailyGoals,
  };
}

export async function saveUserProfileToFirestore(
  uid: string,
  input: ProfileData
): Promise<ProfileData> {
  const fullName = input.fullName.trim().slice(0, 80);
  const age = Math.round(Number(input.age));
  const weightKg = Math.round(Number(input.weightKg) * 10) / 10;
  const heightCm = Math.round(Number(input.heightCm) * 10) / 10;
  const daysPerWeek = Math.round(Number(input.daysPerWeek));
  const healthLimitations = Array.from(
    new Set(input.healthLimitations.map((s) => s.trim().slice(0, 80)).filter(Boolean))
  ).slice(0, 12);
  const healthNotes = input.healthNotes.trim().slice(0, 500);

  if (fullName.length < 1) {
    throw new Error('Vui lòng nhập họ tên hợp lệ (1–80 ký tự).');
  }
  if (!Number.isInteger(age) || age < 10 || age > 100) {
    throw new Error('Độ tuổi phải nằm trong khoảng 10 đến 100 tuổi.');
  }
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 250) {
    throw new Error('Cân nặng phải nằm trong khoảng 25 đến 250 kg.');
  }
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 230) {
    throw new Error('Chiều cao phải nằm trong khoảng 100 đến 230 cm.');
  }
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) {
    throw new Error('Số ngày tập mỗi tuần phải từ 1 đến 7 ngày.');
  }

  const path = `users/${uid}/appData/profile`;
  const ref = doc(db, 'users', uid, 'appData', 'profile');

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        uid,
        fullName,
        age,
        weightKg,
        heightCm,
        fitnessLevel: input.fitnessLevel,
        daysPerWeek,
        equipment: input.equipment,
        healthLimitations,
        healthNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        fullName,
        age,
        weightKg,
        heightCm,
        fitnessLevel: input.fitnessLevel,
        daysPerWeek,
        equipment: input.equipment,
        healthLimitations,
        healthNotes,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    fullName,
    age,
    weightKg,
    heightCm,
    fitnessLevel: input.fitnessLevel,
    daysPerWeek,
    equipment: input.equipment,
    healthLimitations,
    healthNotes,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveUserGoalToFirestore(uid: string, input: GoalData): Promise<GoalData> {
  const durationWeeks = Math.round(Number(input.durationWeeks));
  if (!Number.isInteger(durationWeeks) || durationWeeks < 4 || durationWeeks > 12) {
    throw new Error('Thời hạn mục tiêu phải nằm trong khoảng 4 đến 12 tuần.');
  }

  const sports = normalizeSportsList(input.sport, input.sports);
  const primarySport = sports[0];
  const measurableGoal = sanitizeMeasurableGoalForFirestore(input.measurableGoal);
  const schedulePreferences = sanitizeSchedulePreferencesForFirestore(input.schedulePreferences);

  const path = `users/${uid}/appData/goal`;
  const ref = doc(db, 'users', uid, 'appData', 'goal');

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const payloadFields: Record<string, unknown> = {
    sport: primarySport,
    sports,
    goalType: input.goalType,
    durationWeeks,
    ...(measurableGoal ? { measurableGoal } : {}),
    ...(schedulePreferences ? { schedulePreferences } : {}),
  };

  if (!exists) {
    try {
      await setDoc(ref, {
        uid,
        ...payloadFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        ...payloadFields,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    sport: primarySport,
    sports,
    goalType: input.goalType,
    durationWeeks,
    ...(measurableGoal ? { measurableGoal } : {}),
    ...(schedulePreferences ? { schedulePreferences } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveWorkoutPlanToFirestore(
  uid: string,
  plan: Omit<WorkoutPlanData, 'id' | 'createdAt' | 'completedDays'> & {
    id?: number;
    completedDays?: number[];
    createdAt?: string;
  }
): Promise<WorkoutPlanData> {
  const numericId =
    typeof plan.id === 'number' && Number.isInteger(plan.id) && plan.id > 0
      ? plan.id
      : Date.now();
  const docId = `plan_${numericId}`;
  const path = `users/${uid}/plans/${docId}`;
  const ref = doc(db, 'users', uid, 'plans', docId);

  const sports = normalizeSportsList(plan.sport, plan.sports);
  const primarySport = sports[0];
  const cautionReasons = (Array.isArray(plan.cautionReasons) ? plan.cautionReasons : [])
    .map((r) => String(r).slice(0, 240))
    .slice(0, 12);
  const coachPrinciples = (Array.isArray(plan.coachPrinciples) ? plan.coachPrinciples : [])
    .map((p) => String(p).slice(0, 300))
    .slice(0, 10);
  const safetyAlert = String(plan.safetyAlert || '').slice(0, 1500);
  const strategySummary = String(plan.strategySummary || '').slice(0, 3000);
  const scheduleJson = Array.isArray(plan.scheduleJson) ? plan.scheduleJson.slice(0, 7) : [];
  const completedDays = Array.isArray(plan.completedDays)
    ? plan.completedDays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).slice(0, 7)
    : [];

  const aiProvider: AiProviderName = plan.aiProvider === 'mock' ? 'mock' : 'gemini';
  const isSimulated = Boolean(plan.isSimulated || aiProvider === 'mock');
  const versionNumber =
    typeof plan.versionNumber === 'number' &&
    Number.isInteger(plan.versionNumber) &&
    plan.versionNumber >= 1 &&
    plan.versionNumber <= 500
      ? plan.versionNumber
      : 1;
  const parentPlanId =
    typeof plan.parentPlanId === 'number' &&
    Number.isInteger(plan.parentPlanId) &&
    plan.parentPlanId > 0
      ? plan.parentPlanId
      : null;
  const revisionReason =
    typeof plan.revisionReason === 'string' ? plan.revisionReason.trim().slice(0, 240) : '';
  const strategyV2 = sanitizeStrategyV2ForFirestore(plan.strategyV2);

  try {
    await setDoc(ref, {
      uid,
      numericId,
      weekNumber: plan.weekNumber || 1,
      sport: primarySport,
      sports,
      goalType: plan.goalType,
      durationWeeks: plan.durationWeeks,
      cautiousMode: Boolean(plan.cautiousMode),
      cautionReasons,
      safetyAlert,
      strategySummary,
      coachPrinciples,
      scheduleJson,
      completedDays,
      aiProvider,
      isSimulated,
      versionNumber,
      parentPlanId,
      revisionReason,
      ...(strategyV2 ? { strategyV2 } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  const nowIso = new Date().toISOString();
  return {
    id: numericId,
    weekNumber: plan.weekNumber || 1,
    sport: primarySport,
    sports,
    goalType: plan.goalType,
    durationWeeks: plan.durationWeeks,
    cautiousMode: Boolean(plan.cautiousMode),
    cautionReasons,
    safetyAlert,
    strategySummary,
    coachPrinciples,
    scheduleJson,
    completedDays,
    aiProvider,
    isSimulated,
    versionNumber,
    parentPlanId,
    revisionReason,
    ...(strategyV2 ? { strategyV2 } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function saveUserConsentToFirestore(
  uid: string,
  input: ConsentRecord
): Promise<ConsentRecord> {
  const policyVersion =
    typeof input.policyVersion === 'string' && input.policyVersion.trim().length > 0
      ? input.policyVersion.trim().slice(0, 32)
      : CONSENT_POLICY_VERSION;
  const aiHealthDataConsent = Boolean(input.aiHealthDataConsent);
  const guardianConsentConfirmed = Boolean(input.guardianConsentConfirmed);
  const medicalClearanceAcknowledged = Boolean(input.medicalClearanceAcknowledged);

  const path = `users/${uid}/appData/consent`;
  const ref = doc(db, 'users', uid, 'appData', 'consent');

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        uid,
        policyVersion,
        aiHealthDataConsent,
        guardianConsentConfirmed,
        medicalClearanceAcknowledged,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        policyVersion,
        aiHealthDataConsent,
        guardianConsentConfirmed,
        medicalClearanceAcknowledged,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    policyVersion,
    aiHealthDataConsent,
    guardianConsentConfirmed,
    medicalClearanceAcknowledged,
    updatedAt: new Date().toISOString(),
  };
}

export async function togglePlanDayInFirestore(
  uid: string,
  plan: WorkoutPlanData,
  dayIndex: number
): Promise<WorkoutPlanData> {
  const docId = `plan_${plan.id}`;
  const path = `users/${uid}/plans/${docId}`;
  const ref = doc(db, 'users', uid, 'plans', docId);

  const current = Array.isArray(plan.completedDays) ? plan.completedDays : [];
  const nextCompleted = current.includes(dayIndex)
    ? current.filter((d) => d !== dayIndex)
    : [...current, dayIndex].sort((a, b) => a - b);

  try {
    await updateDoc(ref, {
      completedDays: nextCompleted,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return {
    ...plan,
    completedDays: nextCompleted,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveDailyGoalToFirestore(
  uid: string,
  input: {
    dateKey?: string;
    title: string;
    completed: boolean;
  }
): Promise<DailyGoalData> {
  const dateKey = input.dateKey ?? getTodayDateKey();
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error('Định dạng ngày mục tiêu không hợp lệ.');
  }
  const title = sanitizeDailyGoalTitle(input.title);
  const completed = Boolean(input.completed);

  const path = `users/${uid}/dailyGoals/${dateKey}`;
  const ref = doc(db, 'users', uid, 'dailyGoals', dateKey);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        uid,
        dateKey,
        title,
        completed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        title,
        completed,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    dateKey,
    title,
    completed,
    updatedAt: new Date().toISOString(),
  };
}

export async function toggleDailyGoalInFirestore(
  uid: string,
  currentGoal: DailyGoalData
): Promise<DailyGoalData> {
  const dateKey = currentGoal.dateKey || getTodayDateKey();
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error('Định dạng ngày mục tiêu không hợp lệ.');
  }
  const nextCompleted = !currentGoal.completed;
  const path = `users/${uid}/dailyGoals/${dateKey}`;
  const ref = doc(db, 'users', uid, 'dailyGoals', dateKey);

  try {
    await updateDoc(ref, {
      completed: nextCompleted,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return {
    ...currentGoal,
    dateKey,
    completed: nextCompleted,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveSmartwatchConnectionToFirestore(
  uid: string,
  input: Partial<SmartwatchConnectionData>
): Promise<SmartwatchConnectionData> {
  const sanitized = sanitizeSmartwatchConnection(input);
  const path = `users/${uid}/appData/smartwatch`;
  const ref = doc(db, 'users', uid, 'appData', 'smartwatch');

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        uid,
        deviceName: sanitized.deviceName,
        platform: sanitized.platform,
        autoSyncCalendar: sanitized.autoSyncCalendar,
        lastConnectedAt: sanitized.lastConnectedAt,
        lastHeartRateBpm: sanitized.lastHeartRateBpm,
        lastBatteryPercent: sanitized.lastBatteryPercent,
        totalSyncedSessions: sanitized.totalSyncedSessions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        deviceName: sanitized.deviceName,
        platform: sanitized.platform,
        autoSyncCalendar: sanitized.autoSyncCalendar,
        lastConnectedAt: sanitized.lastConnectedAt,
        lastHeartRateBpm: sanitized.lastHeartRateBpm,
        lastBatteryPercent: sanitized.lastBatteryPercent,
        totalSyncedSessions: sanitized.totalSyncedSessions,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    ...sanitized,
    updatedAt: new Date().toISOString(),
  };
}
