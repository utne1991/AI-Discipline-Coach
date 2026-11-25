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

/**
 * PostgreSQL / Drizzle adapter implementing AppRepository.
 * Used when DATA_PROVIDER=postgres (local PostgreSQL or Cloud SQL in Staging/Production).
 */
export const postgresRepository: AppRepository = {
  providerName: 'postgres',
  getOrCreateUser,
  getUserBootstrapData,
  upsertUserProfile,
  upsertUserGoal,
  createWorkoutPlan,
  getWorkoutPlanById,
  toggleWorkoutDayCompletion,
};
