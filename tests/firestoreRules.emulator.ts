/**
 * Multi-Account Firestore Security Rules Emulator Test Suite
 *
 * Run locally or in CI with Java + Firebase CLI installed:
 *   firebase emulators:exec --only firestore "bun run test:rules:emulator"
 *
 * Uses the Firestore Emulator REST API with unsigned emulator JWTs so no
 * production credentials or extra test dependencies are required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const PROJECT_ID = process.env.FIREBASE_EMULATOR_PROJECT_ID || 'demo-ai-discipline-coach';
const BASE_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function base64UrlEncode(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeEmulatorJwt(uid: string, emailVerified = true): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    aud: PROJECT_ID,
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    sub: uid,
    user_id: uid,
    email: `${uid}@example.test`,
    email_verified: emailVerified,
    iat: now,
    exp: now + 3600,
  });
  return `${header}.${payload}.`;
}

async function clearEmulatorDb(): Promise<void> {
  const res = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  assert.equal(res.status, 200, 'Expected Firestore Emulator reset endpoint to return 200');
}

async function commitDoc(params: {
  docPath: string;
  fields: Record<string, unknown>;
  token?: string;
  setCreatedAt?: boolean;
  setUpdatedAt?: boolean;
  updateMask?: string[];
}): Promise<Response> {
  const fullName = `projects/${PROJECT_ID}/databases/(default)/documents/${params.docPath}`;
  const fieldTransforms: Array<{ fieldPath: string; setToServerValue: 'REQUEST_TIME' }> = [];
  if (params.setCreatedAt) {
    fieldTransforms.push({ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' });
  }
  if (params.setUpdatedAt) {
    fieldTransforms.push({ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' });
  }

  const write: Record<string, unknown> = {
    update: {
      name: fullName,
      fields: params.fields,
    },
    ...(params.updateMask ? { updateMask: { fieldPaths: params.updateMask } } : {}),
    ...(fieldTransforms.length > 0 ? { updateTransforms: fieldTransforms } : {}),
  };

  return fetch(`${BASE_URL}:commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
    },
    body: JSON.stringify({ writes: [write] }),
  });
}

async function getDoc(docPath: string, token?: string): Promise<Response> {
  return fetch(`${BASE_URL}/${docPath}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function runQuery(parentPath: string, collectionId: string, uidFilter: string | null, token?: string): Promise<Response> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
  };
  if (uidFilter) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'uid' },
        op: 'EQUAL',
        value: { stringValue: uidFilter },
      },
    };
  }
  return fetch(`${BASE_URL}/${parentPath}:runQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ structuredQuery }),
  });
}

test('Firestore Emulator multi-account rules: owner CRUD allowed, cross-account, unverified, and shadow fields denied', async () => {
  await clearEmulatorDb();

  const tokenA = makeEmulatorJwt('userA', true);
  const tokenB = makeEmulatorJwt('userB', true);
  const tokenUnverified = makeEmulatorJwt('userA', false);

  // 1. User A creates valid Sprint 02 FitnessGoal
  const createGoalA = await commitDoc({
    docPath: 'users/userA/appData/goal',
    token: tokenA,
    setCreatedAt: true,
    setUpdatedAt: true,
    fields: {
      uid: { stringValue: 'userA' },
      sport: { stringValue: 'running' },
      sports: {
        arrayValue: {
          values: [{ stringValue: 'running' }, { stringValue: 'gym' }],
        },
      },
      goalType: { stringValue: 'endurance' },
      durationWeeks: { integerValue: '8' },
      measurableGoal: {
        mapValue: {
          fields: {
            metricKey: { stringValue: 'run_distance_km' },
            targetLabel: { stringValue: 'Chạy liên tục 5 km sau 8 tuần' },
            currentValue: { doubleValue: 1 },
            targetValue: { doubleValue: 5 },
            unit: { stringValue: 'km' },
          },
        },
      },
      schedulePreferences: {
        mapValue: {
          fields: {
            startDateKey: { stringValue: '2026-11-23' },
            timezone: { stringValue: 'Asia/Ho_Chi_Minh' },
            preferredTimeSlot: { stringValue: 'morning' },
            minutesPerSessionBudget: { integerValue: '40' },
          },
        },
      },
    },
  });
  assert.equal(createGoalA.status, 200, 'Verified owner must be allowed to create Sprint 02 goal');

  // 2. User A can read own goal; User B and unauthenticated cannot
  assert.equal((await getDoc('users/userA/appData/goal', tokenA)).status, 200);
  assert.equal((await getDoc('users/userA/appData/goal', tokenB)).status, 403);
  assert.equal((await getDoc('users/userA/appData/goal')).status, 403);
  assert.equal((await getDoc('users/userA/appData/goal', tokenUnverified)).status, 403);

  // 3. Shadow field injection on goal must be denied
  const shadowGoal = await commitDoc({
    docPath: 'users/userB/appData/goal',
    token: tokenB,
    setCreatedAt: true,
    setUpdatedAt: true,
    fields: {
      uid: { stringValue: 'userB' },
      sport: { stringValue: 'gym' },
      goalType: { stringValue: 'muscle_gain' },
      durationWeeks: { integerValue: '8' },
      isAdmin: { booleanValue: true },
    },
  });
  assert.equal(shadowGoal.status, 403, 'Shadow field isAdmin must be rejected');

  // 4. User A creates daily goal, lists own dailyGoals, User B cannot list User A's dailyGoals
  const createDailyA = await commitDoc({
    docPath: 'users/userA/dailyGoals/2026-11-25',
    token: tokenA,
    setCreatedAt: true,
    setUpdatedAt: true,
    fields: {
      uid: { stringValue: 'userA' },
      dateKey: { stringValue: '2026-11-25' },
      title: { stringValue: 'Uống đủ 2L nước' },
      completed: { booleanValue: false },
    },
  });
  assert.equal(createDailyA.status, 200);

  const listOwn = await runQuery('users/userA', 'dailyGoals', 'userA', tokenA);
  assert.equal(listOwn.status, 200, 'Owner query filtered by uid == request.auth.uid must succeed');

  const listCross = await runQuery('users/userA', 'dailyGoals', 'userA', tokenB);
  assert.equal(listCross.status, 403, 'User B must be blocked from listing User A dailyGoals');

  const listUnfiltered = await runQuery('users/userA', 'dailyGoals', null, tokenA);
  assert.equal(listUnfiltered.status, 403, 'Unfiltered list query without uid filter must be rejected');
});
