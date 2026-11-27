import {
  DATE_KEY_PATTERN,
  calculateDisciplineStreak,
  type DailyGoalData,
} from './dailyGoal.ts';
import type { WorkoutPlanData } from '../shared/types.ts';

export interface PlanCompletionPoint {
  label: string;
  planId: number;
  weekNumber: number;
  checkedInWorkoutDays: number;
  totalWorkoutDays: number;
  completionRate: number;
}

export interface OverallDisciplineMetrics {
  targetWeeks: number;
  disciplinedWeeksCount: number;
  consecutiveDisciplinedWeeks: number;
  goalWeekProgressPercent: number;
  averageWorkoutCompletionRate: number;
  totalCheckedInWorkoutDays: number;
  totalPlannedWorkoutDays: number;
  totalPlansCount: number;
  completedDailyGoalsCount: number;
  totalDailyGoalsCount: number;
  dailyGoalCompletionRate: number;
  currentDailyStreak: number;
  planTrend: PlanCompletionPoint[];
  hasAnyActivity: boolean;
}

/**
 * Computes ISO 8601 week key (e.g. "2026-W48") for a local Date.
 */
export function getIsoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7; // Monday = 1 ... Sunday = 7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function parseDateKeyToLocalDate(dateKey: string): Date | null {
  if (!DATE_KEY_PATTERN.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  return new Date(y, m - 1, d);
}

function addDaysLocal(base: Date, deltaDays: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDays);
}

export function calculateOverallDisciplineProgress(params: {
  plans: WorkoutPlanData[];
  allDailyGoals: DailyGoalData[];
  goalDurationWeeks?: number;
  referenceDate?: Date;
}): OverallDisciplineMetrics {
  const {
    plans,
    allDailyGoals,
    goalDurationWeeks = 8,
    referenceDate = new Date(),
  } = params;

  const targetWeeks =
    Number.isFinite(goalDurationWeeks) && goalDurationWeeks >= 1
      ? Math.round(goalDurationWeeks)
      : 8;

  const disciplinedWeekKeys = new Set<string>();

  // Sort plans chronologically (oldest -> newest) for trend chart
  const chronologicalPlans = [...plans].sort((a, b) => {
    const timeDiff = a.createdAt.localeCompare(b.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return a.id - b.id;
  });

  let totalCheckedInWorkoutDays = 0;
  let totalPlannedWorkoutDays = 0;
  let sumPlanRates = 0;
  let plansWithWorkouts = 0;
  const planTrend: PlanCompletionPoint[] = [];

  for (let idx = 0; idx < chronologicalPlans.length; idx += 1) {
    const plan = chronologicalPlans[idx];
    const days = Array.isArray(plan.scheduleJson) ? plan.scheduleJson : [];
    const completed = Array.isArray(plan.completedDays) ? plan.completedDays : [];
    const workoutDays = days.filter((d) => !d.isRestDay);
    const totalWorkoutDays = workoutDays.length;
    const checkedInWorkoutDays = workoutDays.filter((d) =>
      completed.includes(d.dayIndex)
    ).length;

    totalPlannedWorkoutDays += totalWorkoutDays;
    totalCheckedInWorkoutDays += checkedInWorkoutDays;

    const completionRate =
      totalWorkoutDays > 0
        ? Math.min(100, Math.max(0, Math.round((checkedInWorkoutDays / totalWorkoutDays) * 100)))
        : 0;

    if (totalWorkoutDays > 0) {
      sumPlanRates += completionRate;
      plansWithWorkouts += 1;
    }

    if (checkedInWorkoutDays > 0 || completed.length > 0) {
      const createdDate = new Date(plan.createdAt);
      if (!Number.isNaN(createdDate.getTime())) {
        disciplinedWeekKeys.add(getIsoWeekKey(createdDate));
      }
    }

    planTrend.push({
      label: chronologicalPlans.length > 1 ? `Lịch #${idx + 1}` : `Tuần ${plan.weekNumber || 1}`,
      planId: plan.id,
      weekNumber: plan.weekNumber || 1,
      checkedInWorkoutDays,
      totalWorkoutDays,
      completionRate,
    });
  }

  let completedDailyGoalsCount = 0;
  for (const goal of allDailyGoals) {
    if (goal.completed) {
      completedDailyGoalsCount += 1;
      const localDate = parseDateKeyToLocalDate(goal.dateKey);
      if (localDate) {
        disciplinedWeekKeys.add(getIsoWeekKey(localDate));
      }
    }
  }

  const totalDailyGoalsCount = allDailyGoals.length;
  const dailyGoalCompletionRate =
    totalDailyGoalsCount > 0
      ? Math.min(100, Math.max(0, Math.round((completedDailyGoalsCount / totalDailyGoalsCount) * 100)))
      : 0;

  const averageWorkoutCompletionRate =
    plansWithWorkouts > 0
      ? Math.min(100, Math.max(0, Math.round(sumPlanRates / plansWithWorkouts)))
      : 0;

  // Consecutive disciplined ISO weeks ending at current week (or previous week if current week hasn't logged yet)
  const todayLocal = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const currentWeekKey = getIsoWeekKey(todayLocal);
  let cursorDate = disciplinedWeekKeys.has(currentWeekKey)
    ? todayLocal
    : addDaysLocal(todayLocal, -7);

  let consecutiveDisciplinedWeeks = 0;
  for (let i = 0; i < 104; i += 1) {
    const key = getIsoWeekKey(cursorDate);
    if (disciplinedWeekKeys.has(key)) {
      consecutiveDisciplinedWeeks += 1;
      cursorDate = addDaysLocal(cursorDate, -7);
    } else {
      break;
    }
  }

  const disciplinedWeeksCount = disciplinedWeekKeys.size;
  const goalWeekProgressPercent = Math.min(
    100,
    Math.max(0, Math.round((disciplinedWeeksCount / targetWeeks) * 100))
  );

  const streakSummary = calculateDisciplineStreak(allDailyGoals, referenceDate);

  return {
    targetWeeks,
    disciplinedWeeksCount,
    consecutiveDisciplinedWeeks,
    goalWeekProgressPercent,
    averageWorkoutCompletionRate,
    totalCheckedInWorkoutDays,
    totalPlannedWorkoutDays,
    totalPlansCount: plans.length,
    completedDailyGoalsCount,
    totalDailyGoalsCount,
    dailyGoalCompletionRate,
    currentDailyStreak: streakSummary.currentStreakDays,
    planTrend: planTrend.slice(-6),
    hasAnyActivity:
      disciplinedWeeksCount > 0 ||
      totalCheckedInWorkoutDays > 0 ||
      completedDailyGoalsCount > 0,
  };
}

export type WeekdayChartScope = 'latest' | 'all';

export interface WeekdayExercisePoint {
  dayIndex: number;
  shortLabel: string;
  fullLabel: string;
  completedExercises: number;
  plannedExercises: number;
  checkedInSessions: number;
  isRestDay: boolean;
}

export interface WeeklyExerciseSummary {
  days: WeekdayExercisePoint[];
  totalCompletedExercises: number;
  totalPlannedExercises: number;
  peakDay: WeekdayExercisePoint | null;
  planCountIncluded: number;
}

const WEEKDAY_META: ReadonlyArray<{ dayIndex: number; shortLabel: string; fullLabel: string }> = [
  { dayIndex: 1, shortLabel: 'T2', fullLabel: 'Thứ 2' },
  { dayIndex: 2, shortLabel: 'T3', fullLabel: 'Thứ 3' },
  { dayIndex: 3, shortLabel: 'T4', fullLabel: 'Thứ 4' },
  { dayIndex: 4, shortLabel: 'T5', fullLabel: 'Thứ 5' },
  { dayIndex: 5, shortLabel: 'T6', fullLabel: 'Thứ 6' },
  { dayIndex: 6, shortLabel: 'T7', fullLabel: 'Thứ 7' },
  { dayIndex: 7, shortLabel: 'CN', fullLabel: 'Chủ nhật' },
];

/**
 * Aggregates exercise counts from checked-in workout days by day of week (T2 -> CN).
 * Respects day-level check-in granularity: only non-rest days present in `completedDays`
 * contribute to `completedExercises`.
 */
export function calculateCompletedExercisesByWeekday(
  plans: WorkoutPlanData[],
  scope: WeekdayChartScope = 'latest'
): WeeklyExerciseSummary {
  const days: WeekdayExercisePoint[] = WEEKDAY_META.map((meta) => ({
    dayIndex: meta.dayIndex,
    shortLabel: meta.shortLabel,
    fullLabel: meta.fullLabel,
    completedExercises: 0,
    plannedExercises: 0,
    checkedInSessions: 0,
    isRestDay: false,
  }));

  if (!Array.isArray(plans) || plans.length === 0) {
    return {
      days,
      totalCompletedExercises: 0,
      totalPlannedExercises: 0,
      peakDay: null,
      planCountIncluded: 0,
    };
  }

  const newestFirst = [...plans].sort((a, b) => {
    const timeDiff = b.createdAt.localeCompare(a.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return b.id - a.id;
  });

  const targetPlans = scope === 'latest' ? [newestFirst[0]] : newestFirst;

  for (const plan of targetPlans) {
    const schedule = Array.isArray(plan.scheduleJson) ? plan.scheduleJson : [];
    const completedSet = new Set(Array.isArray(plan.completedDays) ? plan.completedDays : []);

    for (const workoutDay of schedule) {
      if (
        !Number.isInteger(workoutDay.dayIndex) ||
        workoutDay.dayIndex < 1 ||
        workoutDay.dayIndex > 7
      ) {
        continue;
      }
      const bucket = days[workoutDay.dayIndex - 1];
      if (!bucket) continue;

      if (scope === 'latest') {
        bucket.isRestDay = Boolean(workoutDay.isRestDay);
      }

      if (workoutDay.isRestDay) {
        continue;
      }

      const exerciseCount = Array.isArray(workoutDay.exercises) ? workoutDay.exercises.length : 0;
      bucket.plannedExercises += exerciseCount;

      if (completedSet.has(workoutDay.dayIndex)) {
        bucket.completedExercises += exerciseCount;
        bucket.checkedInSessions += 1;
      }
    }
  }

  let totalCompletedExercises = 0;
  let totalPlannedExercises = 0;
  let peakDay: WeekdayExercisePoint | null = null;

  for (const point of days) {
    totalCompletedExercises += point.completedExercises;
    totalPlannedExercises += point.plannedExercises;
    if (
      point.completedExercises > 0 &&
      (!peakDay || point.completedExercises > peakDay.completedExercises)
    ) {
      peakDay = point;
    }
  }

  return {
    days,
    totalCompletedExercises,
    totalPlannedExercises,
    peakDay,
    planCountIncluded: targetPlans.length,
  };
}

