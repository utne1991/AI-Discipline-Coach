import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server/createApp.ts';
import { createMemoryRepository } from '../src/repositories/memoryRepository.ts';
import {
  assessGoalFeasibility,
  buildDefaultGoalForSprint2,
  buildMultiPhaseRoadmap,
  buildStrategyV2Blueprint,
  calculateSportVolumeAllocation,
  getDefaultMeasurableGoal,
  resolveTodayScheduledDay,
} from '../src/services/strategyEngineV2.ts';
import { generateWeekOneStrategy } from '../src/services/aiStrategy.ts';
import { validateStrategyV2Blueprint } from '../src/services/strategyValidator.ts';
import {
  CONSENT_POLICY_VERSION,
  evaluateSafetyProfile,
  type GoalData,
  type ProfileData,
  type WorkoutPlanData,
} from '../src/shared/types.ts';

const SIMULATED_PROFILES: Record<string, ProfileData> = {
  adultRunnerBeginner: {
    fullName: 'Le Minh Tuan',
    age: 31,
    weightKg: 74,
    heightCm: 173,
    fitnessLevel: 'beginner',
    daysPerWeek: 4,
    equipment: 'none',
    healthLimitations: ['none'],
    healthNotes: '',
  },
  adultGymIntermediate: {
    fullName: 'Tran Gia Huy',
    age: 28,
    weightKg: 72,
    heightCm: 176,
    fitnessLevel: 'intermediate',
    daysPerWeek: 4,
    equipment: 'gym',
    healthLimitations: ['none'],
    healthNotes: '',
  },
  teenHomeWorkout: {
    fullName: 'Nguyen Hoang Nam',
    age: 16,
    weightKg: 58,
    heightCm: 169,
    fitnessLevel: 'beginner',
    daysPerWeek: 3,
    equipment: 'home',
    healthLimitations: ['none'],
    healthNotes: '',
  },
  youthHomeWorkout: {
    fullName: 'Pham Bao An',
    age: 14,
    weightKg: 48,
    heightCm: 158,
    fitnessLevel: 'beginner',
    daysPerWeek: 3,
    equipment: 'none',
    healthLimitations: ['none'],
    healthNotes: '',
  },
  seniorMedicalCaution: {
    fullName: 'Vu Van Hung',
    age: 64,
    weightKg: 76,
    heightCm: 168,
    fitnessLevel: 'beginner',
    daysPerWeek: 3,
    equipment: 'home',
    healthLimitations: ['cardiovascular', 'knee_pain'],
    healthNotes: 'Huyết áp cao nhẹ, cần kiểm soát nhịp tim.',
  },
};

test('Strategy Engine v2: generates valid full-duration strategies across running, gym, home workout, multi-sport, and age/medical tiers', async () => {
  const prevProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'mock';

  try {
    const scenarios: Array<{ label: string; profile: ProfileData; goal: GoalData }> = [
      {
        label: 'Adult Running Endurance (8w)',
        profile: SIMULATED_PROFILES.adultRunnerBeginner,
        goal: buildDefaultGoalForSprint2(
          {
            sport: 'running',
            goalType: 'endurance',
            durationWeeks: 8,
            schedulePreferences: {
              startDateKey: '2026-11-23',
              timezone: 'Asia/Ho_Chi_Minh',
              preferredTimeSlot: 'morning',
              minutesPerSessionBudget: 40,
            },
          },
          SIMULATED_PROFILES.adultRunnerBeginner.fitnessLevel
        ),
      },
      {
        label: 'Adult Gym + Running Multi-Sport (10w)',
        profile: SIMULATED_PROFILES.adultGymIntermediate,
        goal: {
          sport: 'gym',
          sports: ['gym', 'running'],
          goalType: 'muscle_gain',
          durationWeeks: 10,
          measurableGoal: {
            metricKey: 'weekly_sessions',
            targetLabel: 'Duy trì 4 buổi gym + chạy bền mỗi tuần',
            currentValue: 1,
            targetValue: 4,
            unit: 'buổi/tuần',
          },
          schedulePreferences: {
            startDateKey: '2026-11-23',
            timezone: 'Asia/Ho_Chi_Minh',
            preferredTimeSlot: 'evening',
            minutesPerSessionBudget: 50,
          },
        },
      },
      {
        label: 'Youth (14) Home Workout (6w)',
        profile: SIMULATED_PROFILES.youthHomeWorkout,
        goal: buildDefaultGoalForSprint2(
          { sport: 'home_workout', goalType: 'endurance', durationWeeks: 6 },
          SIMULATED_PROFILES.youthHomeWorkout.fitnessLevel
        ),
      },
      {
        label: 'Teen (16) Home Workout (8w)',
        profile: SIMULATED_PROFILES.teenHomeWorkout,
        goal: buildDefaultGoalForSprint2(
          { sport: 'home_workout', goalType: 'muscle_gain', durationWeeks: 8 },
          SIMULATED_PROFILES.teenHomeWorkout.fitnessLevel
        ),
      },
      {
        label: 'Senior (64) Cardio/Knee Caution Home Workout (8w)',
        profile: SIMULATED_PROFILES.seniorMedicalCaution,
        goal: buildDefaultGoalForSprint2(
          { sport: 'home_workout', goalType: 'weight_loss', durationWeeks: 8 },
          SIMULATED_PROFILES.seniorMedicalCaution.fitnessLevel
        ),
      },
    ];

    for (const scenario of scenarios) {
      const safety = evaluateSafetyProfile(scenario.profile);
      const output = await generateWeekOneStrategy(scenario.profile, scenario.goal);
      assert.equal(output.aiProvider, 'mock', scenario.label);
      assert.equal(output.isSimulated, true, scenario.label);
      assert.ok(output.strategyV2, `${scenario.label}: must produce strategyV2`);

      const bp = output.strategyV2;
      // Verify all 8 mandatory AI Agent strategic answers
      assert.ok(bp.ultimateGoal.length >= 15, `${scenario.label}: Q1 ultimateGoal`);
      assert.ok(bp.currentPosition.length >= 15, `${scenario.label}: Q2 currentPosition`);
      assert.ok(bp.phases.length >= 2, `${scenario.label}: Q3 multi-phase roadmap`);
      assert.equal(bp.phases[0].weekStart, 1);
      assert.equal(bp.phases[bp.phases.length - 1].weekEnd, scenario.goal.durationWeeks);
      assert.ok(bp.milestones.length >= 2, `${scenario.label}: Q3 milestones`);
      assert.ok(bp.volumeAllocation.length >= 1, `${scenario.label}: Q4 volumeAllocation`);
      assert.ok(bp.todayDirective.length >= 12, `${scenario.label}: Q5 todayDirective`);
      assert.ok(bp.dailyCommitments.length >= 7, `${scenario.label}: Q5 dailyCommitments`);
      assert.ok(bp.reassessmentSchedule.length >= 10, `${scenario.label}: Q6 reassessmentSchedule`);
      assert.ok(bp.adjustmentSignals.length >= 2, `${scenario.label}: Q7 adjustmentSignals`);
      assert.ok(bp.stopAndEscalateCriteria.length >= 2, `${scenario.label}: Q8 stopAndEscalateCriteria`);

      // Verify safety volume bounds independently
      const totalWeeklySessions = bp.volumeAllocation.reduce((sum, v) => sum + v.sessionsPerWeek, 0);
      const totalWeeklyMinutes = bp.volumeAllocation.reduce((sum, v) => sum + v.weeklyMinutes, 0);
      assert.equal(totalWeeklySessions, scenario.profile.daysPerWeek, scenario.label);
      assert.ok(
        totalWeeklyMinutes <= safety.loadLimits.maxWeeklyMinutes,
        `${scenario.label}: minutes ${totalWeeklyMinutes} > ${safety.loadLimits.maxWeeklyMinutes}`
      );

      // Independent AI safety rulebook check must PASS
      const validation = validateStrategyV2Blueprint(bp, scenario.profile, scenario.goal);
      assert.equal(
        validation.valid,
        true,
        `${scenario.label} failed independent validation: ${validation.errors.join('; ')}`
      );
    }
  } finally {
    process.env.AI_PROVIDER = prevProvider;
  }
});

test('Feasibility engine flags overly aggressive weight-loss goal and recommends pacing', () => {
  const profile = SIMULATED_PROFILES.adultRunnerBeginner;
  const safety = evaluateSafetyProfile(profile);
  const aggressiveGoal: GoalData = {
    sport: 'running',
    sports: ['running'],
    goalType: 'weight_loss',
    durationWeeks: 4,
    measurableGoal: {
      metricKey: 'weight_change_kg',
      targetLabel: 'Giảm 8 kg trong 4 tuần',
      currentValue: 0,
      targetValue: 8,
      unit: 'kg',
    },
  };

  const result = assessGoalFeasibility(profile, aggressiveGoal, safety);
  assert.equal(result.status, 'ambitious_adjust');
  assert.ok(result.score < 70);
  assert.ok(result.recommendedDurationWeeks > 4);
  assert.ok(result.adjustments.length > 0);
});

test('AI-independent validateStrategyV2Blueprint rejects broken phase contiguity, volume overload, and missing minor/medical escalation rules', () => {
  const minorProfile = SIMULATED_PROFILES.youthHomeWorkout;
  const minorSafety = evaluateSafetyProfile(minorProfile);
  const goal = buildDefaultGoalForSprint2(
    { sport: 'home_workout', goalType: 'endurance', durationWeeks: 8 },
    minorProfile.fitnessLevel
  );
  const measurable = goal.measurableGoal ?? getDefaultMeasurableGoal('home_workout', 'endurance', 'beginner');
  const volumes = calculateSportVolumeAllocation(minorProfile, goal, minorSafety);
  const { phases, milestones } = buildMultiPhaseRoadmap(8, measurable, volumes, minorSafety);

  const validBp = buildStrategyV2Blueprint({
    profile: minorProfile,
    goal,
    schedule: [1, 2, 3, 4, 5, 6, 7].map((dayIndex) => ({
      dayIndex,
      dayLabel: `Ngày ${dayIndex}`,
      title: dayIndex % 2 === 1 ? 'Tập' : 'Nghỉ',
      isRestDay: dayIndex % 2 === 0,
      focusArea: 'Nền tảng',
      estimatedMinutes: dayIndex % 2 === 1 ? 25 : 0,
      intensity: 'Nhẹ',
      warmup: 'Khởi động 5p',
      cooldown: 'Giãn cơ 5p',
      safetyNote: 'An toàn.',
      exercises: [],
    })),
  });
  assert.equal(validateStrategyV2Blueprint(validBp, minorProfile, goal).valid, true);

  // Tamper: gap in phases + excessive volume + stripped guardian escalation
  const tampered = {
    ...validBp,
    phases: [
      { ...phases[0], weekStart: 1, weekEnd: 2 },
      { ...phases[1], weekStart: 5, weekEnd: 8 },
    ],
    milestones,
    volumeAllocation: [
      {
        ...volumes[0],
        sessionsPerWeek: 7,
        weeklyMinutes: 630,
      },
    ],
    stopAndEscalateCriteria: ['Nghỉ ngơi khi mệt.', 'Uống đủ nước mỗi ngày.'],
  };

  const check = validateStrategyV2Blueprint(tampered, minorProfile, goal);
  assert.equal(check.valid, false);
  assert.ok(check.errors.some((e) => e.includes('không liên tục')));
  assert.ok(check.errors.some((e) => e.includes('vượt ngưỡng an toàn')));
  assert.ok(check.errors.some((e) => e.includes('dưới 18 tuổi')));
});

test('resolveTodayScheduledDay maps real calendar dateKey accurately', async () => {
  const prevProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'mock';
  try {
    const profile = SIMULATED_PROFILES.adultRunnerBeginner;
    const goal = buildDefaultGoalForSprint2(
      {
        sport: 'running',
        goalType: 'endurance',
        durationWeeks: 8,
        schedulePreferences: {
          startDateKey: '2026-11-23',
          timezone: 'Asia/Ho_Chi_Minh',
          preferredTimeSlot: 'morning',
          minutesPerSessionBudget: 40,
        },
      },
      profile.fitnessLevel
    );
    const generated = await generateWeekOneStrategy(profile, goal);

    // 2026-11-25T10:00:00+07:00 is Wednesday -> dayIndex 3 of week starting Monday 2026-11-23
    const resolvedDay3 = resolveTodayScheduledDay(
      generated.schedule,
      generated.strategyV2,
      new Date('2026-11-25T03:00:00.000Z')
    );
    assert.equal(resolvedDay3.todayDateKey, '2026-11-25');
    assert.equal(resolvedDay3.day?.dayIndex, 3);
    assert.equal(resolvedDay3.scheduledDay?.dateKey, '2026-11-25');
    assert.ok(resolvedDay3.tasks.length >= 2);
  } finally {
    process.env.AI_PROVIDER = prevProvider;
  }
});

test('HTTP POST /api/plans/generate persists multi-sport Strategy v2 and plan versioning metadata (v1 -> v2)', async () => {
  const prevProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'mock';

  const repo = createMemoryRepository();
  const app = createApp({
    repo,
    verifyIdToken: async (token) => {
      if (token === 'token-v2-user') {
        return { uid: 'uid-v2-user', email: 'v2@example.test', name: 'V2 User' };
      }
      throw new Error('Invalid token');
    },
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const profile = SIMULATED_PROFILES.adultGymIntermediate;
    const goalV1: GoalData = {
      sport: 'gym',
      sports: ['gym', 'running'],
      goalType: 'muscle_gain',
      durationWeeks: 8,
      measurableGoal: {
        metricKey: 'weekly_sessions',
        targetLabel: 'Đạt 4 buổi gym + chạy bộ mỗi tuần',
        currentValue: 1,
        targetValue: 4,
        unit: 'buổi/tuần',
      },
      schedulePreferences: {
        startDateKey: '2026-11-23',
        timezone: 'Asia/Ho_Chi_Minh',
        preferredTimeSlot: 'evening',
        minutesPerSessionBudget: 45,
      },
    };

    const resV1 = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-v2-user',
      },
      body: JSON.stringify({
        aiConsent: true,
        consentPolicyVersion: CONSENT_POLICY_VERSION,
        profile,
        goal: goalV1,
        versionNumber: 1,
        parentPlanId: null,
        revisionReason: 'Khởi tạo chiến lược đa môn v1',
      }),
    });
    assert.equal(resV1.status, 201);
    const bodyV1 = (await resV1.json()) as { plan: WorkoutPlanData };
    assert.equal(bodyV1.plan.versionNumber, 1);
    assert.deepEqual(bodyV1.plan.sports, ['gym', 'running']);
    assert.equal(bodyV1.plan.strategyV2?.engineVersion, '2.0');

    const resV2 = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-v2-user',
      },
      body: JSON.stringify({
        aiConsent: true,
        consentPolicyVersion: CONSENT_POLICY_VERSION,
        profile,
        goal: { ...goalV1, durationWeeks: 12 },
        versionNumber: 2,
        parentPlanId: bodyV1.plan.id,
        revisionReason: 'Mở rộng thời hạn lên 12 tuần để giảm tải',
      }),
    });
    assert.equal(resV2.status, 201);
    const bodyV2 = (await resV2.json()) as { plan: WorkoutPlanData };
    assert.equal(bodyV2.plan.versionNumber, 2);
    assert.equal(bodyV2.plan.parentPlanId, bodyV1.plan.id);
    assert.equal(bodyV2.plan.revisionReason, 'Mở rộng thời hạn lên 12 tuần để giảm tải');
    assert.equal(bodyV2.plan.strategyV2?.phases.at(-1)?.weekEnd, 12);
  } finally {
    process.env.AI_PROVIDER = prevProvider;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
