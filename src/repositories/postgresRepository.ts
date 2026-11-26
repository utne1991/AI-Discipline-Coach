import {
  createWorkoutPlan,
  getOrCreateUser,
  getUserBootstrapData,
  getWorkoutPlanById,
  toggleWorkoutDayCompletion,
  upsertUserGoal,
  upsertUserProfile,
} from '../db/repository.ts';
import type { AppRepository } from './types.ts';

export type PostgresRepositoryDeps = Pick<
  AppRepository,
  | 'getOrCreateUser'
  | 'getUserBootstrapData'
  | 'upsertUserProfile'
  | 'upsertUserGoal'
  | 'createWorkoutPlan'
  | 'getWorkoutPlanById'
  | 'toggleWorkoutDayCompletion'
>;

/**
 * Factory for the PostgreSQL / Drizzle repository adapter.
 * Accepts optional query-layer overrides for deterministic contract testing without production DB credentials.
 */
export function createPostgresRepository(
  deps: Partial<PostgresRepositoryDeps> = {}
): AppRepository {
  return {
    providerName: 'postgres',
    getOrCreateUser: deps.getOrCreateUser ?? getOrCreateUser,
    getUserBootstrapData: deps.getUserBootstrapData ?? getUserBootstrapData,
    upsertUserProfile: deps.upsertUserProfile ?? upsertUserProfile,
    upsertUserGoal: deps.upsertUserGoal ?? upsertUserGoal,
    createWorkoutPlan: deps.createWorkoutPlan ?? createWorkoutPlan,
    getWorkoutPlanById: deps.getWorkoutPlanById ?? getWorkoutPlanById,
    toggleWorkoutDayCompletion: deps.toggleWorkoutDayCompletion ?? toggleWorkoutDayCompletion,
  };
}

/**
 * PostgreSQL / Drizzle adapter implementing AppRepository.
 * Used when DATA_PROVIDER=postgres (local PostgreSQL or Cloud SQL in Staging/Production).
 */
export const postgresRepository: AppRepository = createPostgresRepository();
