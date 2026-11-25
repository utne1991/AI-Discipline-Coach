import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, type AppRepository } from '../src/server/createApp.ts';
import { StrategyValidationError } from '../src/services/aiStrategy.ts';
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

function createInMemoryRepo(): AppRepository & { simulateDbError: boolean } {
  let nextUserId = 1;
  let nextPlanId = 1;
  const usersByUid = new Map<string, { id: number; uid: string; email: string; displayName: string }>();
  const profilesByUserId = new Map<number, any>();
  const goalsByUserId = new Map<number, any>();
  const plansById = new Map<number, any>();

  const repo: AppRepository & { simulateDbError: boolean } = {
    simulateDbError: false,
    async getOrCreateUser(uid, email, displayName) {
      if (repo.simulateDbError) {
        throw new Error('Không thể đồng bộ tài khoản lúc này. Vui lòng thử lại sau.');
      }
      const existing = usersByUid.get(uid);
      if (existing) return existing;
      const created = { id: nextUserId++, uid, email, displayName };
      usersByUid.set(uid, created);
      return created;
    },
    async getUserBootstrapData(userId) {
      if (repo.simulateDbError) {
        throw new Error('Không thể tải dữ liệu người dùng lúc này. Vui lòng thử lại sau.');
      }
      const userPlans = Array.from(plansById.values())
        .filter((p) => p.userId === userId)
        .sort((a, b) => b.id - a.id);
      return {
        profile: profilesByUserId.get(userId) ?? null,
        goal: goalsByUserId.get(userId) ?? null,
        latestPlan: userPlans[0] ?? null,
        planCount: userPlans.length,
      };
    },
    async upsertUserProfile(userId, input) {
      if (repo.simulateDbError) {
        throw new Error('Không thể lưu hồ sơ người dùng. Vui lòng thử lại sau.');
      }
      const record = { id: userId, userId, ...input, updatedAt: new Date().toISOString() };
      profilesByUserId.set(userId, record);
      return record;
    },
    async upsertUserGoal(userId, input) {
      if (repo.simulateDbError) {
        throw new Error('Không thể lưu mục tiêu tập luyện. Vui lòng thử lại sau.');
      }
      const record = { id: userId, userId, ...input, updatedAt: new Date().toISOString() };
      goalsByUserId.set(userId, record);
      return record;
    },
    async createWorkoutPlan(userId, input) {
      if (repo.simulateDbError) {
        throw new Error('Không thể lưu lịch tập tuần vào hệ thống. Vui lòng thử lại sau.');
      }
      const record = {
        id: nextPlanId++,
        userId,
        ...input,
        completedDays: [],
        createdAt: new Date().toISOString(),
      };
      plansById.set(record.id, record);
      return record;
    },
    async getWorkoutPlanById(userId, planId) {
      const plan = plansById.get(planId);
      if (!plan || plan.userId !== userId) return null;
      return plan;
    },
    async toggleWorkoutDayCompletion(userId, planId, dayIndex) {
      const plan = plansById.get(planId);
      if (!plan || plan.userId !== userId) return null;
      const current: number[] = plan.completedDays ?? [];
      const next = current.includes(dayIndex)
        ? current.filter((d) => d !== dayIndex)
        : [...current, dayIndex].sort((a, b) => a - b);
      plan.completedDays = next;
      return { ...plan };
    },
  };

  return repo;
}

async function startTestServer(options?: {
  strategyMode?: 'ok' | 'ai_error' | 'invalid_plan';
}) {
  const repo = createInMemoryRepo();
  const mode = options?.strategyMode ?? 'ok';

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
    generateStrategy: async (profile) => {
      if (mode === 'ai_error') {
        throw new Error('Không thể tạo lịch tập bằng AI lúc này: Upstream timeout');
      }
      if (mode === 'invalid_plan') {
        throw new StrategyValidationError('Giáo án AI tạo ra chưa đạt chuẩn kiểm định an toàn.', [
          'Ngày 1 có cường độ "Cao", vi phạm giới hạn an toàn của Chế độ thận trọng.',
        ]);
      }
      return {
        cautiousMode: profile.age > 60 || profile.age < 16 || profile.healthLimitations.length > 0,
        cautionReasons: profile.age > 60 ? ['Độ tuổi trên 60'] : [],
        safetyAlert: 'Tuân thủ khởi động kỹ và dừng ngay nếu đau nhói khớp.',
        strategySummary: 'Chiến lược Tuần 1 xây nền kỷ luật.',
        coachPrinciples: ['Đều đặn 3 buổi', 'Ngủ đủ giấc', 'Thở đúng nhịp'],
        schedule: makeSchedule(profile.daysPerWeek, profile.age > 60),
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

test('full M01 -> M02 -> M03 -> check-in -> reload flow and cross-user isolation', async () => {
  const srv = await startTestServer({ strategyMode: 'ok' });
  try {
    const headersA = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-a',
    };
    const headersB = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-user-b',
    };

    // 1. User A saves profile
    const profRes = await fetch(`${srv.baseUrl}/api/profile`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        fullName: 'Nguyễn Văn An',
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

    // 4. Generate Week 1 plan with aiConsent: true
    const genRes = await fetch(`${srv.baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ aiConsent: true }),
    });
    assert.equal(genRes.status, 201);
    const genData = (await genRes.json()) as { plan: { id: number; cautiousMode: boolean } };
    assert.equal(genData.plan.cautiousMode, true);
    const planId = genData.plan.id;

    // 5. Toggle Day 1 completion
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
    assert.equal(bootAData.profile.fullName, 'Nguyễn Văn An');
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
