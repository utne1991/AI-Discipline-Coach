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
