import type {
  AppRepository,
  CreateWorkoutPlanInput,
  RepositoryUser,
  UpsertGoalInput,
  UpsertProfileInput,
} from './types.ts';

interface StoredProfile extends UpsertProfileInput {
  id: number;
  userId: number;
  updatedAt: string;
}

interface StoredGoal extends UpsertGoalInput {
  id: number;
  userId: number;
  updatedAt: string;
}

interface StoredPlan extends CreateWorkoutPlanInput {
  id: number;
  userId: number;
  completedDays: number[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Deterministic in-memory adapter implementing AppRepository.
 * Strictly for automated integration tests and local non-production verification.
 */
export function createMemoryRepository(): AppRepository {
  let nextUserId = 1;
  let nextPlanId = 1;
  const usersByUid = new Map<string, RepositoryUser>();
  const profilesByUserId = new Map<number, StoredProfile>();
  const goalsByUserId = new Map<number, StoredGoal>();
  const plansById = new Map<number, StoredPlan>();

  return {
    providerName: 'memory',

    async getOrCreateUser(uid, email, displayName) {
      const existing = usersByUid.get(uid);
      if (existing) {
        const updated: RepositoryUser = {
          ...existing,
          email,
          displayName,
        };
        usersByUid.set(uid, updated);
        return updated;
      }

      const created: RepositoryUser = {
        id: nextUserId++,
        uid,
        email,
        displayName,
      };
      usersByUid.set(uid, created);
      return created;
    },

    async getUserBootstrapData(userId) {
      const userPlans = Array.from(plansById.values())
        .filter((plan) => plan.userId === userId)
        .sort((a, b) => b.id - a.id);

      return {
        profile: profilesByUserId.get(userId) ?? null,
        goal: goalsByUserId.get(userId) ?? null,
        latestPlan: userPlans[0] ?? null,
        planCount: userPlans.length,
      };
    },

    async upsertUserProfile(userId, input) {
      const saved: StoredProfile = {
        id: userId,
        userId,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      profilesByUserId.set(userId, saved);
      return saved;
    },

    async upsertUserGoal(userId, input) {
      const saved: StoredGoal = {
        id: userId,
        userId,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      goalsByUserId.set(userId, saved);
      return saved;
    },

    async createWorkoutPlan(userId, input) {
      const now = new Date().toISOString();
      const created: StoredPlan = {
        id: nextPlanId++,
        userId,
        ...input,
        completedDays: [],
        createdAt: now,
        updatedAt: now,
      };
      plansById.set(created.id, created);
      return created;
    },

    async getWorkoutPlanById(userId, planId) {
      const plan = plansById.get(planId);
      if (!plan || plan.userId !== userId) {
        return null;
      }
      return plan;
    },

    async toggleWorkoutDayCompletion(userId, planId, dayIndex) {
      const plan = plansById.get(planId);
      if (!plan || plan.userId !== userId) {
        return null;
      }
      const nextCompleted = plan.completedDays.includes(dayIndex)
        ? plan.completedDays.filter((d) => d !== dayIndex)
        : [...plan.completedDays, dayIndex].sort((a, b) => a - b);

      const updated: StoredPlan = {
        ...plan,
        completedDays: nextCompleted,
        updatedAt: new Date().toISOString(),
      };
      plansById.set(planId, updated);
      return updated;
    },
  };
}
