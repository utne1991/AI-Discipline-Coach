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
  getTodayDateKey,
  sanitizeDailyGoalTitle,
  type DailyGoalData,
} from './dailyGoal.ts';
import {
  CONSENT_POLICY_VERSION,
  type AiProviderName,
  type ConsentRecord,
  type EquipmentOption,
  type FitnessLevel,
  type GoalData,
  type GoalType,
  type ProfileData,
  type SportOption,
  type WorkoutDay,
  type WorkoutPlanData,
} from '../shared/types.ts';

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
  return {
    sport: (data.sport as SportOption) || 'home_workout',
    goalType: (data.goalType as GoalType) || 'weight_loss',
    durationWeeks: typeof data.durationWeeks === 'number' ? data.durationWeeks : 8,
    updatedAt: toIsoString(data.updatedAt),
  };
}

function parsePlanDoc(data: Record<string, unknown>): WorkoutPlanData {
  return {
    id: typeof data.numericId === 'number' ? data.numericId : Date.now(),
    weekNumber: typeof data.weekNumber === 'number' ? data.weekNumber : 1,
    sport: (data.sport as SportOption) || 'home_workout',
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
  latestPlan: WorkoutPlanData | null;
  allPlans: WorkoutPlanData[];
  todayDailyGoal: DailyGoalData | null;
}> {
  const todayKey = getTodayDateKey();
  const profilePath = `users/${uid}/appData/profile`;
  const goalPath = `users/${uid}/appData/goal`;
  const consentPath = `users/${uid}/appData/consent`;
  const plansPath = `users/${uid}/plans`;
  const dailyGoalPath = `users/${uid}/dailyGoals/${todayKey}`;

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

  let plansSnap;
  try {
    const q = query(collection(db, 'users', uid, 'plans'), where('uid', '==', uid));
    plansSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, plansPath);
  }

  let dailyGoalSnap;
  try {
    dailyGoalSnap = await getDoc(doc(db, 'users', uid, 'dailyGoals', todayKey));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, dailyGoalPath);
  }

  const parsedPlans = plansSnap.docs
    .map((d) => parsePlanDoc(d.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    profile: profileSnap.exists() ? parseProfileDoc(profileSnap.data() as Record<string, unknown>) : null,
    goal: goalSnap.exists() ? parseGoalDoc(goalSnap.data() as Record<string, unknown>) : null,
    consent: consentSnap.exists()
      ? parseConsentDoc(consentSnap.data() as Record<string, unknown>)
      : null,
    latestPlan: parsedPlans[0] ?? null,
    allPlans: parsedPlans,
    todayDailyGoal: dailyGoalSnap.exists()
      ? parseDailyGoalDoc(dailyGoalSnap.data() as Record<string, unknown>, todayKey)
      : null,
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

  const path = `users/${uid}/appData/goal`;
  const ref = doc(db, 'users', uid, 'appData', 'goal');

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
        sport: input.sport,
        goalType: input.goalType,
        durationWeeks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        sport: input.sport,
        goalType: input.goalType,
        durationWeeks,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    sport: input.sport,
    goalType: input.goalType,
    durationWeeks,
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

  try {
    await setDoc(ref, {
      uid,
      numericId,
      weekNumber: plan.weekNumber || 1,
      sport: plan.sport,
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
    sport: plan.sport,
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
