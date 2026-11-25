import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { userGoals, userProfiles, users, workoutPlans, type WorkoutDay } from './schema.ts';
import type { EquipmentOption, FitnessLevel, GoalType, SportOption } from '../shared/types.ts';

export async function getOrCreateUser(uid: string, email: string, displayName: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Không thể đồng bộ tài khoản lúc này. Vui lòng thử lại sau.', { cause: error });
  }
}

export async function getUserBootstrapData(userId: number) {
  try {
    const [profileRows, goalRows, planRows] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
      db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1),
      db
        .select()
        .from(workoutPlans)
        .where(eq(workoutPlans.userId, userId))
        .orderBy(desc(workoutPlans.createdAt)),
    ]);

    return {
      profile: profileRows[0] ?? null,
      goal: goalRows[0] ?? null,
      latestPlan: planRows[0] ?? null,
      planCount: planRows.length,
    };
  } catch (error) {
    console.error('Database query failed in getUserBootstrapData:', error);
    throw new Error('Không thể tải dữ liệu người dùng lúc này. Vui lòng thử lại sau.', {
      cause: error,
    });
  }
}

export interface UpsertProfileInput {
  fullName: string;
  age: number;
  weightKg: number;
  heightCm: number;
  fitnessLevel: FitnessLevel;
  daysPerWeek: number;
  equipment: EquipmentOption;
  healthLimitations: string[];
  healthNotes: string;
}

export async function upsertUserProfile(userId: number, input: UpsertProfileInput) {
  try {
    const result = await db
      .insert(userProfiles)
      .values({
        userId,
        fullName: input.fullName,
        age: input.age,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        fitnessLevel: input.fitnessLevel,
        daysPerWeek: input.daysPerWeek,
        equipment: input.equipment,
        healthLimitations: input.healthLimitations,
        healthNotes: input.healthNotes,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          fullName: input.fullName,
          age: input.age,
          weightKg: input.weightKg,
          heightCm: input.heightCm,
          fitnessLevel: input.fitnessLevel,
          daysPerWeek: input.daysPerWeek,
          equipment: input.equipment,
          healthLimitations: input.healthLimitations,
          healthNotes: input.healthNotes,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in upsertUserProfile:', error);
    throw new Error('Không thể lưu hồ sơ người dùng. Vui lòng thử lại sau.', { cause: error });
  }
}

export interface UpsertGoalInput {
  sport: SportOption;
  goalType: GoalType;
  durationWeeks: number;
}

export async function upsertUserGoal(userId: number, input: UpsertGoalInput) {
  try {
    const result = await db
      .insert(userGoals)
      .values({
        userId,
        sport: input.sport,
        goalType: input.goalType,
        durationWeeks: input.durationWeeks,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userGoals.userId,
        set: {
          sport: input.sport,
          goalType: input.goalType,
          durationWeeks: input.durationWeeks,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in upsertUserGoal:', error);
    throw new Error('Không thể lưu mục tiêu tập luyện. Vui lòng thử lại sau.', { cause: error });
  }
}

export interface CreateWorkoutPlanInput {
  weekNumber: number;
  sport: SportOption;
  goalType: GoalType;
  durationWeeks: number;
  cautiousMode: boolean;
  cautionReasons: string[];
  safetyAlert: string;
  strategySummary: string;
  coachPrinciples: string[];
  scheduleJson: WorkoutDay[];
}

export async function createWorkoutPlan(userId: number, input: CreateWorkoutPlanInput) {
  try {
    const result = await db
      .insert(workoutPlans)
      .values({
        userId,
        weekNumber: input.weekNumber,
        sport: input.sport,
        goalType: input.goalType,
        durationWeeks: input.durationWeeks,
        cautiousMode: input.cautiousMode,
        cautionReasons: input.cautionReasons,
        safetyAlert: input.safetyAlert,
        strategySummary: input.strategySummary,
        coachPrinciples: input.coachPrinciples,
        scheduleJson: input.scheduleJson,
        completedDays: [],
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in createWorkoutPlan:', error);
    throw new Error('Không thể lưu lịch tập tuần vào hệ thống. Vui lòng thử lại sau.', {
      cause: error,
    });
  }
}

export async function getWorkoutPlanById(userId: number, planId: number) {
  try {
    const rows = await db
      .select()
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
      .limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getWorkoutPlanById:', error);
    throw new Error('Không thể tải chi tiết lịch tập. Vui lòng thử lại sau.', { cause: error });
  }
}

export async function toggleWorkoutDayCompletion(
  userId: number,
  planId: number,
  dayIndex: number
) {
  try {
    const rows = await db
      .select()
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
      .limit(1);

    const plan = rows[0];
    if (!plan) {
      return null;
    }

    const current = Array.isArray(plan.completedDays) ? plan.completedDays : [];
    const nextCompleted = current.includes(dayIndex)
      ? current.filter((d) => d !== dayIndex)
      : [...current, dayIndex].sort((a, b) => a - b);

    const updated = await db
      .update(workoutPlans)
      .set({ completedDays: nextCompleted })
      .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
      .returning();

    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in toggleWorkoutDayCompletion:', error);
    throw new Error('Không thể cập nhật tiến độ buổi tập. Vui lòng thử lại sau.', {
      cause: error,
    });
  }
}
