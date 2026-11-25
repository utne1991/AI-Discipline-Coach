import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createMemoryRepository } from '../src/repositories/memoryRepository.ts';
import { createApp, type AppRepository } from '../src/server/createApp.ts';
import {
  StrategyValidationError,
  generateWeekOneStrategy,
  type StrategyProfileInput,
} from '../src/services/aiStrategy.ts';
import type { WorkoutDay } from '../src/shared/types.ts';

function makeSchedule(daysPerWeek = 3, cautious = false): WorkoutDay[] {
  const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const activeSet = new Set([1, 3, 5].slice(0, daysPerWeek));
  return labels.map((dayLabel, idx) => {
    const dayIndex = idx + 1;
    const isRestDay = !activeSet.has(dayIndex);
    return {
      dayIndex,
      dayLabel,
      isRestDay,
      title: isRestDay ? 'Nghỉ phục hồi' : 'Buổi tập nền tảng',
      focusArea: isRestDay ? 'Phục hồi' : 'Toàn thân',
      estimatedMinutes: isRestDay ? 15 : 35,
      intensity: cautious || isRestDay ? 'Nhẹ' : 'Trung bình',
      warmup: 'Xoay khớp 8 phút.',
      cooldown: 'Giãn cơ 5 phút.',
      safetyNote: 'Giữ kỹ thuật chuẩn.',
      exercises: isRestDay
        ? []
        : [
            {
              name: 'Squat cơ bản',
              sets: '3 hiệp',
              repsOrDuration: '12 lần',
              restSeconds: 60,
              note: 'Thở đều.',
            },
          ],
    };
  });
}

function createFaultInjectableRepo(): AppRepository & { simulateDbError: boolean } {
  const base = createMemoryRepository();
  const repo: AppRepository & { simulateDbError: boolean } = {
    providerName: 'memory',
    simulateDbError: false,
    async getOrCreateUser(uid, email, displayName) {
      if (repo.simulateDbError) {
        throw new Error('Không thể đồng bộ tài khoản lúc này. Vui lòng thử lại sau.');
      }
      return base.getOrCreateUser(uid, email, displayName);
    },
    async getUserBootstrapData(userId) {
      if (repo.simulateDbError) {
        throw new Error('Không thể tải dữ liệu người dùng lúc này. Vui lòng thử lại sau.');
      }
      return base.getUserBootstrapData(userId);
    },
    async upsertUserProfile(userId, input) {
      if (repo.simulateDbError) {
        throw new Error('Không thể lưu hồ sơ người dùng. Vui lòng thử lại sau.');
      }
      return base.upsertUserProfile(userId, input);
    },
    async upsertUserGoal(userId, input) {
      if (repo.simulateDbError) {
        throw new Error('Không thể lưu mục tiêu tập luyện. Vui lòng thử lại sau.');
      }
      return base.upsertUserGoal(userId, input);
    },
    async createWorkoutPlan(userId, input) {
      if (repo.simulateDbError) {
        throw new Error('Không thể lưu lịch tập tuần vào hệ thống. Vui lòng thử lại sau.');
      }
      return base.createWorkoutPlan(userId, input);
    },
    async getWorkoutPlanById(userId, planId) {
      return base.getWorkoutPlanById(userId, planId);
    },
    async toggleWorkoutDayCompletion(userId, planId, dayIndex) {
      return base.toggleWorkoutDayCompletion(userId, planId, dayIndex);
    },
  };
  return repo;
}

async function startTestServer(options?: {
  strategyMode?: 'ok' | 'mock_engine' | 'ai_error' | 'invalid_plan';
}) {
  const repo = createFaultInjectableRepo();
  const mode = options?.strategyMode ?? 'ok';
  const capturedStrategyProfiles: StrategyProfileInput[] = [];

  const app = createApp({
    repo,
    verifyIdToken: async (token: string) => {
      if (token === 'token-user-a') {
        return { uid: 'uid-a', email: 'usera@example.com', name: 'User A' };
      }
      if (token === 'token-user-b') {
        return { uid: 'uid-b', email: 'userb@example.com', name: 'User B' };
      }
      throw new Error('Invalid token');
    },
    generateStrategy: async (profile, goal) => {
      capturedStrategyProfiles.push(profile);
      if (mode === 'mock_engine') {
        return generateWeekOneStrategy(profile, goal, { provider: 'mock' });
      }
      if (mode === 'ai_error') {
        throw new Error('Không thể tạo lịch tập bằng AI lúc này: Upstream timeout');
      }
      if (mode === 'invalid_plan') {
        throw new StrategyValidationError('Giáo án AI tạo ra chưa đạt chuẩn kiểm định an toàn.', [
          'Ngày 1 có cường độ "Cao", vi phạm giới hạn an toàn của Chế độ thận trọng.',
        ]);
      }
      return {
        cautiousMode: profile.age > 60 || profile.age < 18 || profile.healthLimitations.length > 0,
        cautionReasons: profile.age > 60 ? ['Độ tuổi trên 60'] : [],
        safetyAlert: 'Tuân thủ khởi động kỹ và dừng ngay nếu đau nhói khớp.',
        strategySummary: 'Chiến lược Tuần 1 xây nền kỷ luật.',
        coachPrinciples: ['Đều đặn 3 buổi', 'Ngủ đủ giấc', 'Thở đúng nhịp'],
        schedule: makeSchedule(profile.daysPerWeek, profile.age > 60 || profile.age < 18),
        aiProvider: 'mock',
        isSimulated: true,
      };
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    repo,
    capturedStrategyProfiles,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test('unauthenticated and invalid token requests are rejected with 401', async () => {
  const srv = await startTestServer();
  try {
    const routes = [
      { method: 'GET', path: '/api/bootstrap' },
      { method: 'PUT', path: '/api/profile' },
      { method: 'PUT', path: '/api/goal' },
      { method: 'POST', path: '/api/plans/generate' },
      { method: 'GET', path: '/api/plans/1' },
      { method: 'PATCH', path: '/api/plans/1/days/1/toggle' },
    ];

    for (const r of routes) {
      const noAuth = await fetch(`${srv.baseUrl}${r.path}`, { method: r.method });
      assert.equal(noAuth.status, 401, `${r.method} ${r.path} without auth must return 401`);

      const badAuth = await fetch(`${srv.baseUrl}${r.path}`, {
        method: r.method,
        headers: { Authorization: 'Bearer invalid-token' },
      });
      assert.equal(badAuth.status, 401, `${r.method} ${r.path} with bad token must return 401`);
    }
  } finally {
    await srv.close();
  }
});

test('DEV end-to-end M01 -> M02 -> M03 (Mock AI + Safety Validator) -> check-in -> reload and cross-user isolation', async () => {
  const srv = await startTestServer({ strategyMode: 'mock_engine' });
  try {
    const headersA = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-a',
    };
    const headersB = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-b',
    };

    // 1. User A saves profile (synthetic DEV fixture — no real customer data)
    const profRes = await fetch(`${srv.baseUrl}/api/profile`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        fullName: 'Dev Synthetic User A',
        age: 64,
        weightKg: 68,
        heightCm: 168,
        fitnessLevel: 'beginner',
        daysPerWeek: 3,
        equipment: 'none',
        healthLimitations: ['Đau khớp gối'],
        healthNotes: '',
      }),
    });
    assert.equal(profRes.status, 200);
    assert.equal(profRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(profRes.headers.get('x-powered-by'), null);

    // 2. User A saves goal
    const goalRes = await fetch(`${srv.baseUrl}/api/goal`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        sport: 'home_workout',
        goalType: 'endurance',
        durationWeeks: 8,
      }),
    });
    assert.equal(goalRes.status, 200);

    // 3. Attempting generate without aiConsent fails with 400
    const noConsentRes = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({}),
    });
    assert.equal(noConsentRes.status, 400);

    // 4. Generate Week 1 plan via real Mock AI + Strategy Validator
    const genRes = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ aiConsent: true }),
    });
    assert.equal(genRes.status, 201);
    const genData = (await genRes.json()) as {
      plan: {
        id: number;
        cautiousMode: boolean;
        aiProvider: string;
        isSimulated: boolean;
        scheduleJson: WorkoutDay[];
      };
    };
    assert.equal(genData.plan.cautiousMode, true);
    assert.equal(genData.plan.aiProvider, 'mock');
    assert.equal(genData.plan.isSimulated, true);
    assert.equal(genData.plan.scheduleJson.length, 7);
    const planId = genData.plan.id;

    // Confirm fullName was NEVER passed into generateStrategy
    assert.equal(srv.capturedStrategyProfiles.length, 1);
    assert.equal(srv.capturedStrategyProfiles[0].fullName, undefined);

    // 5. Toggle Day 1 check-in
    const toggleRes = await fetch(`${srv.baseUrl}/api/plans/${planId}/days/1/toggle`, {
      method: 'PATCH',
      headers: headersA,
    });
    assert.equal(toggleRes.status, 200);
    const toggled = (await toggleRes.json()) as { plan: { completedDays: number[] } };
    assert.deepEqual(toggled.plan.completedDays, [1]);

    // 6. Reload bootstrap for User A -> all data persists
    const bootA = await fetch(`${srv.baseUrl}/api/bootstrap`, { headers: headersA });
    assert.equal(bootA.status, 200);
    const bootAData = (await bootA.json()) as {
      profile: { fullName: string };
      goal: { durationWeeks: number };
      latestPlan: { id: number; completedDays: number[] };
    };
    assert.equal(bootAData.profile.fullName, 'Dev Synthetic User A');
    assert.equal(bootAData.goal.durationWeeks, 8);
    assert.equal(bootAData.latestPlan.id, planId);
    assert.deepEqual(bootAData.latestPlan.completedDays, [1]);

    // 7. Cross-user isolation: User B cannot view or modify User A's data
    const bootB = await fetch(`${srv.baseUrl}/api/bootstrap`, { headers: headersB });
    assert.equal(bootB.status, 200);
    const bootBData = (await bootB.json()) as {
      profile: unknown;
      goal: unknown;
      latestPlan: unknown;
    };
    assert.equal(bootBData.profile, null);
    assert.equal(bootBData.goal, null);
    assert.equal(bootBData.latestPlan, null);

    const getPlanB = await fetch(`${srv.baseUrl}/api/plans/${planId}`, { headers: headersB });
    assert.equal(getPlanB.status, 404);

    const togglePlanB = await fetch(`${srv.baseUrl}/api/plans/${planId}/days/1/toggle`, {
      method: 'PATCH',
      headers: headersB,
    });
    assert.equal(togglePlanB.status, 404);
  } finally {
    await srv.close();
  }
});

test('enforces guardianConsent for minors (<18) and medicalClearanceAcknowledged for clinical risk profiles', async () => {
  const srv = await startTestServer({ strategyMode: 'mock_engine' });
  try {
    const headersA = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-a',
    };

    const minorProfile = {
      fullName: 'Dev Minor Fixture',
      age: 16,
      weightKg: 58,
      heightCm: 166,
      fitnessLevel: 'beginner',
      daysPerWeek: 3,
      equipment: 'none',
      healthLimitations: [],
      healthNotes: '',
    };
    const defaultGoal = {
      sport: 'home_workout',
      goalType: 'endurance',
      durationWeeks: 6,
    };

    // Minor without guardianConsent -> 400
    const minorDenied = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        aiConsent: true,
        profile: minorProfile,
        goal: defaultGoal,
      }),
    });
    assert.equal(minorDenied.status, 400);
    const minorDeniedBody = (await minorDenied.json()) as { error: string };
    assert.match(minorDeniedBody.error, /phụ huynh|giám hộ/i);

    // Minor with guardianConsent -> 201 and fullName stripped
    const minorAllowed = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        aiConsent: true,
        guardianConsent: true,
        profile: minorProfile,
        goal: defaultGoal,
      }),
    });
    assert.equal(minorAllowed.status, 201);
    assert.equal(srv.capturedStrategyProfiles[0].fullName, undefined);

    // Medical clearance profile without acknowledgment -> 400
    const cardioProfile = {
      fullName: 'Dev Cardio Fixture',
      age: 48,
      weightKg: 74,
      heightCm: 170,
      fitnessLevel: 'beginner',
      daysPerWeek: 3,
      equipment: 'none',
      healthLimitations: ['Tim mạch / Huyết áp'],
      healthNotes: '',
    };
    const medDenied = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        aiConsent: true,
        profile: cardioProfile,
        goal: defaultGoal,
      }),
    });
    assert.equal(medDenied.status, 400);
    const medDeniedBody = (await medDenied.json()) as { error: string };
    assert.match(medDeniedBody.error, /bác sĩ|chuyên môn/i);

    // Medical clearance profile with acknowledgment -> 201
    const medAllowed = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        aiConsent: true,
        medicalClearanceAcknowledged: true,
        profile: cardioProfile,
        goal: defaultGoal,
      }),
    });
    assert.equal(medAllowed.status, 201);
  } finally {
    await srv.close();
  }
});

test('missing/invalid inputs, malformed JSON, and unknown API routes return clean JSON errors', async () => {
  const srv = await startTestServer();
  try {
    const headersA = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-a',
    };

    const badProfile = await fetch(`${srv.baseUrl}/api/profile`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ fullName: '', age: 5, weightKg: 10, heightCm: 50 }),
    });
    assert.equal(badProfile.status, 400);

    const badGoal = await fetch(`${srv.baseUrl}/api/goal`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ sport: 'boxing', goalType: 'invalid', durationWeeks: 20 }),
    });
    assert.equal(badGoal.status, 400);

    const malformedJson = await fetch(`${srv.baseUrl}/api/profile`, {
      method: 'PUT',
      headers: headersA,
      body: '{bad-json',
    });
    assert.equal(malformedJson.status, 400);
    const malformedBody = (await malformedJson.json()) as { error: string };
    assert.match(malformedBody.error, /JSON/i);

    const notFoundApi = await fetch(`${srv.baseUrl}/api/does-not-exist`, {
      headers: headersA,
    });
    assert.equal(notFoundApi.status, 404);
    const nfBody = (await notFoundApi.json()) as { error: string };
    assert.ok(nfBody.error);
  } finally {
    await srv.close();
  }
});

test('AI validation rejection returns 422 and AI/DB failures return sanitized 500 without saving bad data', async () => {
  const invalidSrv = await startTestServer({ strategyMode: 'invalid_plan' });
  try {
    const headersA = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-a',
    };

    await fetch(`${invalidSrv.baseUrl}/api/profile`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        fullName: 'Test User',
        age: 65,
        weightKg: 65,
        heightCm: 170,
        fitnessLevel: 'beginner',
        daysPerWeek: 3,
        equipment: 'none',
        healthLimitations: [],
        healthNotes: '',
      }),
    });
    await fetch(`${invalidSrv.baseUrl}/api/goal`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        sport: 'home_workout',
        goalType: 'endurance',
        durationWeeks: 6,
      }),
    });

    const rejectedRes = await fetch(`${invalidSrv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ aiConsent: true }),
    });
    assert.equal(rejectedRes.status, 422);
    const rejectedBody = (await rejectedRes.json()) as { validationErrors: string[] };
    assert.ok(rejectedBody.validationErrors.length > 0);

    // Ensure unsafe plan was NOT saved
    const bootAfterReject = await fetch(`${invalidSrv.baseUrl}/api/bootstrap`, {
      headers: headersA,
    });
    const bootData = (await bootAfterReject.json()) as { latestPlan: unknown };
    assert.equal(bootData.latestPlan, null);

    // Simulate DB error -> clean 500 without SQL leak
    invalidSrv.repo.simulateDbError = true;
    const dbErrRes = await fetch(`${invalidSrv.baseUrl}/api/bootstrap`, { headers: headersA });
    assert.equal(dbErrRes.status, 500);
    const dbErrBody = (await dbErrRes.json()) as { error: string };
    assert.doesNotMatch(dbErrBody.error, /SELECT|INSERT|postgres|password/i);
  } finally {
    await invalidSrv.close();
  }
});

test('AI upstream failure returns clean 500 error', async () => {
  const aiErrSrv = await startTestServer({ strategyMode: 'ai_error' });
  try {
    const headersA = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-a',
    };
    await fetch(`${aiErrSrv.baseUrl}/api/profile`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        fullName: 'Test AI Error',
        age: 26,
        weightKg: 65,
        heightCm: 170,
        fitnessLevel: 'beginner',
        daysPerWeek: 3,
        equipment: 'none',
        healthLimitations: [],
        healthNotes: '',
      }),
    });
    await fetch(`${aiErrSrv.baseUrl}/api/goal`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        sport: 'running',
        goalType: 'endurance',
        durationWeeks: 8,
      }),
    });
    const errRes = await fetch(`${aiErrSrv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ aiConsent: true }),
    });
    assert.equal(errRes.status, 500);
    const body = (await errRes.json()) as { error: string };
    assert.match(body.error, /Không thể tạo lịch tập/);
  } finally {
    await aiErrSrv.close();
  }
});

test('stateless POST /api/plans/generate works when profile and goal are supplied without SQL access', async () => {
  const srv = await startTestServer({ strategyMode: 'ok' });
  try {
    srv.repo.simulateDbError = true;
    const headersA = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-a',
    };

    const okRes = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        aiConsent: true,
        profile: {
          fullName: 'Dev Stateless Fixture',
          age: 28,
          weightKg: 62,
          heightCm: 168,
          fitnessLevel: 'beginner',
          daysPerWeek: 3,
          equipment: 'home',
          healthLimitations: [],
          healthNotes: '',
        },
        goal: {
          sport: 'home_workout',
          goalType: 'endurance',
          durationWeeks: 8,
        },
      }),
    });
    assert.equal(okRes.status, 201);
    const okData = (await okRes.json()) as {
      plan: { weekNumber: number; scheduleJson: unknown[]; aiProvider: string; isSimulated: boolean };
    };
    assert.equal(okData.plan.weekNumber, 1);
    assert.equal(okData.plan.scheduleJson.length, 7);
    assert.equal(okData.plan.aiProvider, 'mock');
    assert.equal(okData.plan.isSimulated, true);

    const badRes = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        aiConsent: true,
        profile: { fullName: '', age: 5 },
        goal: { sport: 'running', goalType: 'endurance', durationWeeks: 8 },
      }),
    });
    assert.equal(badRes.status, 400);
  } finally {
    await srv.close();
  }
});
