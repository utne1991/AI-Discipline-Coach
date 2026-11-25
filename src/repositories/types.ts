import type { DailyGoalData } from '../lib/dailyGoal.ts';
import type {
  ConsentRecord,
  GoalData,
  ProfileData,
  WorkoutPlanData,
} from '../shared/types.ts';
import type {
  CreateWorkoutPlanInput,
  UpsertGoalInput,
  UpsertProfileInput,
} from '../db/repository.ts';

export type { CreateWorkoutPlanInput, UpsertGoalInput, UpsertProfileInput };

export interface RepositoryUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
}

export interface RepositoryBootstrapData {
  profile: any;
  goal: any;
  latestPlan: any;
  planCount: number;
}

/**
 * Server-side Repository Interface decoupling Express business routes
 * from the underlying relational/in-memory storage adapter.
 */
export interface AppRepository {
  readonly providerName: 'postgres' | 'memory';
  getOrCreateUser: (
    uid: string,
    email: string,
    displayName: string
  ) => Promise<RepositoryUser>;
  getUserBootstrapData: (userId: number) => Promise<RepositoryBootstrapData>;
  upsertUserProfile: (userId: number, input: UpsertProfileInput) => Promise<any>;
  upsertUserGoal: (userId: number, input: UpsertGoalInput) => Promise<any>;
  createWorkoutPlan: (userId: number, input: CreateWorkoutPlanInput) => Promise<any>;
  getWorkoutPlanById: (userId: number, planId: number) => Promise<any>;
  toggleWorkoutDayCompletion: (
    userId: number,
    planId: number,
    dayIndex: number
  ) => Promise<any>;
}

export interface ClientBootstrapData {
  profile: ProfileData | null;
  goal: GoalData | null;
  consent: ConsentRecord | null;
  latestPlan: WorkoutPlanData | null;
  allPlans: WorkoutPlanData[];
  todayDailyGoal: DailyGoalData | null;
}

/**
 * Client-side Repository Interface for Firestore primary storage in DEV/MVP.
 */
export interface ClientDataRepository {
  readonly providerName: 'firestore';
  loadUserFitnessData: (uid: string) => Promise<ClientBootstrapData>;
  saveUserProfile: (uid: string, input: ProfileData) => Promise<ProfileData>;
  saveUserGoal: (uid: string, input: GoalData) => Promise<GoalData>;
  saveUserConsent: (uid: string, input: ConsentRecord) => Promise<ConsentRecord>;
  saveWorkoutPlan: (
    uid: string,
    plan: Omit<WorkoutPlanData, 'id' | 'createdAt' | 'completedDays'> & {
      id?: number;
      completedDays?: number[];
      createdAt?: string;
    }
  ) => Promise<WorkoutPlanData>;
  togglePlanDay: (
    uid: string,
    plan: WorkoutPlanData,
    dayIndex: number
  ) => Promise<WorkoutPlanData>;
  saveDailyGoal: (
    uid: string,
    input: { dateKey?: string; title: string; completed: boolean }
  ) => Promise<DailyGoalData>;
  toggleDailyGoal: (uid: string, currentGoal: DailyGoalData) => Promise<DailyGoalData>;
}
