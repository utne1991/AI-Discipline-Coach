import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepository } from '../src/repositories/memoryRepository.ts';
import { createPostgresRepository } from '../src/repositories/postgresRepository.ts';
import type { AppRepository } from '../src/repositories/types.ts';
import {
  sanitizeMeasurableGoalForFirestore,
  sanitizeSchedulePreferencesForFirestore,
  sanitizeStrategyV2ForFirestore,
} from '../src/lib/firestoreAppStore.ts';
import {
  buildDefaultGoalForSprint2,
  buildStrategyV2Blueprint,
} from '../src/services/strategyEngineV2.ts';
import type { ProfileData, WorkoutDay } from '../src/shared/types.ts';

function makeSampleSchedule(): WorkoutDay[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dayIndex) => ({
    dayIndex,
    dayLabel: `Thứ ${dayIndex === 7 ? 'CN' : dayIndex + 1}`,
    title: dayIndex % 2 === 1 ? `Buổi tập ${dayIndex}` : 'Ngày nghỉ phục hồi',
    isRestDay: dayIndex % 2 === 0,
    focusArea: dayIndex % 2 === 1 ? 'Nền tảng' : 'Phục hồi',
    estimatedMinutes: dayIndex % 2 === 1 ? 30 : 0,
    intensity: dayIndex % 2 === 1 ? 'Nhẹ' : 'Nhẹ',
    warmup: 'Khởi động khớp 5 phút',
    cooldown: 'Giãn cơ 5 phút',
    safetyNote: 'Dừng tập nếu thấy đau nhói hoặc chóng mặt.',
    exercises:
      dayIndex % 2 === 1
        ? [{ name: 'Đi bộ nhanh', sets: '1 hiệp', repsOrDuration: '20 phút', restSeconds: 0, note: 'Nhịp đều' }]
        : [],
  }));
}

/**
 * Deterministic Postgres adapter contract delegate backed by an in-memory relational store
 * so the PostgreSQL repository adapter contract runs cleanly without production DB credentials.
 */
function createInMemoryPostgresBackedAdapter(): AppRepository {
  const mem = createMemoryRepository();
  return createPostgresRepository({
    getOrCreateUser: (uid, email, displayName) => mem.getOrCreateUser(uid, email, displayName),
    getUserBootstrapData: (userId) => mem.getUserBootstrapData(userId),
    upsertUserProfile: (userId, input) => mem.upsertUserProfile(userId, input),
    upsertUserGoal: (userId, input) => mem.upsertUserGoal(userId, input),
    createWorkoutPlan: (userId, input) => mem.createWorkoutPlan(userId, input),
    getWorkoutPlanById: (userId, planId) => mem.getWorkoutPlanById(userId, planId),
    toggleWorkoutDayCompletion: (userId, planId, dayIndex) =>
      mem.toggleWorkoutDayCompletion(userId, planId, dayIndex),
  });
}

function runAppRepositoryContractSuite(name: string, factory: () => AppRepository) {
  test(`AppRepository contract [${name}]: upsert, cross-user isolation, ordering & toggle`, async () => {
    const repo = factory();

    // 1. Idempotent user upsert
    const userA1 = await repo.getOrCreateUser('uid-contract-a', 'usera@example.test', 'User A');
    const userA2 = await repo.getOrCreateUser('uid-contract-a', 'usera@example.test', 'User A');
    assert.equal(userA1.id, userA2.id);
    const userB = await repo.getOrCreateUser('uid-contract-b', 'userb@example.test', 'User B');
    assert.notEqual(userA1.id, userB.id);

    // 2. Profile & Goal upsert
    const savedProfile = await repo.upsertUserProfile(userA1.id, {
      fullName: 'Nguyen Van A',
      age: 30,
      weightKg: 70,
      heightCm: 172,
      fitnessLevel: 'beginner',
      daysPerWeek: 3,
      equipment: 'home',
      healthLimitations: ['none'],
      healthNotes: '',
    });
    assert.equal(savedProfile.fullName, 'Nguyen Van A');

    const savedGoal = await repo.upsertUserGoal(userA1.id, {
      sport: 'running',
      goalType: 'endurance',
      durationWeeks: 8,
    });
    assert.equal(savedGoal.sport, 'running');
    assert.equal(savedGoal.durationWeeks, 8);

    // Cross-user isolation: userB sees empty bootstrap
    const bootB = await repo.getUserBootstrapData(userB.id);
    assert.equal(bootB.profile, null);
    assert.equal(bootB.goal, null);
    assert.equal(bootB.latestPlan, null);

    // 3. Plan creation, ordering & cross-user isolation
    const plan1 = await repo.createWorkoutPlan(userA1.id, {
      weekNumber: 1,
      sport: 'running',
      goalType: 'endurance',
      durationWeeks: 8,
      cautiousMode: false,
      cautionReasons: [],
      safetyAlert: 'An toàn cơ bản.',
      strategySummary: 'Chiến lược v1',
      coachPrinciples: ['Nguyên tắc 1'],
      scheduleJson: makeSampleSchedule(),
    });

    const plan2 = await repo.createWorkoutPlan(userA1.id, {
      weekNumber: 1,
      sport: 'gym',
      goalType: 'muscle_gain',
      durationWeeks: 10,
      cautiousMode: false,
      cautionReasons: [],
      safetyAlert: 'An toàn v2.',
      strategySummary: 'Chiến lược v2',
      coachPrinciples: ['Nguyên tắc 2'],
      scheduleJson: makeSampleSchedule(),
    });

    const bootA = await repo.getUserBootstrapData(userA1.id);
    assert.equal(bootA.planCount, 2);
    assert.equal(bootA.latestPlan.id, plan2.id);

    // Cross-user isolation on getWorkoutPlanById & toggleWorkoutDayCompletion
    assert.equal(await repo.getWorkoutPlanById(userB.id, plan1.id), null);
    assert.equal(await repo.toggleWorkoutDayCompletion(userB.id, plan1.id, 1), null);

    // Day toggle on and off for owner
    const toggledOn = await repo.toggleWorkoutDayCompletion(userA1.id, plan1.id, 3);
    assert.deepEqual(toggledOn.completedDays, [3]);
    const toggledOff = await repo.toggleWorkoutDayCompletion(userA1.id, plan1.id, 3);
    assert.deepEqual(toggledOff.completedDays, []);
  });
}

runAppRepositoryContractSuite('MemoryRepository', () => createMemoryRepository());
runAppRepositoryContractSuite('PostgresRepository Adapter', () =>
  createInMemoryPostgresBackedAdapter()
);

test('Firestore adapter sanitizers enforce blueprint bounds for Sprint 02 fields', () => {
  const sanitizedGoal = sanitizeMeasurableGoalForFirestore({
    metricKey: 'invalid_key',
    targetLabel: 'X'.repeat(300),
    currentValue: -5,
    targetValue: 999999,
    unit: 'U'.repeat(50),
  });
  assert.ok(sanitizedGoal);
  assert.equal(sanitizedGoal.metricKey, 'weekly_sessions');
  assert.equal(sanitizedGoal.targetLabel.length, 160);
  assert.equal(sanitizedGoal.currentValue, 0);
  assert.equal(sanitizedGoal.targetValue, 10000);
  assert.equal(sanitizedGoal.unit.length, 24);

  const sanitizedSchedule = sanitizeSchedulePreferencesForFirestore({
    startDateKey: 'bad-date',
    timezone: 'Asia/Ho_Chi_Minh',
    preferredTimeSlot: 'morning',
    minutesPerSessionBudget: 999,
  });
  assert.ok(sanitizedSchedule);
  assert.match(sanitizedSchedule.startDateKey, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(sanitizedSchedule.minutesPerSessionBudget >= 20 && sanitizedSchedule.minutesPerSessionBudget <= 90);

  const sampleProfile: ProfileData = {
    fullName: 'Test User',
    age: 29,
    weightKg: 68,
    heightCm: 170,
    fitnessLevel: 'intermediate',
    daysPerWeek: 4,
    equipment: 'gym',
    healthLimitations: ['none'],
    healthNotes: '',
  };
  const goal = buildDefaultGoalForSprint2(
    { sport: 'running', goalType: 'endurance', durationWeeks: 8 },
    sampleProfile.fitnessLevel
  );
  const blueprint = buildStrategyV2Blueprint({
    profile: sampleProfile,
    goal,
    schedule: makeSampleSchedule(),
  });
  const sanitizedBlueprint = sanitizeStrategyV2ForFirestore(blueprint);
  assert.ok(sanitizedBlueprint);
  assert.equal(sanitizedBlueprint.engineVersion, '2.0');
  assert.ok(sanitizedBlueprint.phases.length >= 1 && sanitizedBlueprint.phases.length <= 6);
  assert.ok(
    sanitizedBlueprint.volumeAllocation.length >= 1 &&
      sanitizedBlueprint.volumeAllocation.length <= 3
  );
  assert.ok(
    sanitizedBlueprint.dailyCommitments.length >= 7 &&
      sanitizedBlueprint.dailyCommitments.length <= 21
  );
});
