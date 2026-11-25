import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntimeConfig } from '../src/config/env.ts';
import { buildMinimizedAiPayload, stripDirectIdentifiers } from '../src/services/aiPayload.ts';
import {
  buildGeminiPrompt,
  generateMockWeekOneStrategy,
  generateWeekOneStrategy,
} from '../src/services/aiStrategy.ts';

test('buildMinimizedAiPayload and buildGeminiPrompt completely omit fullName and strip direct identifiers', () => {
  const secretName = 'Nguyễn Trần Bảo Ngọc';
  const secretEmail = 'baongoc.private@example.com';
  const secretPhone = '0912345678';
  const secretUrl = 'https://private-clinic.example.vn/record/12345';

  const profileWithPii = {
    fullName: secretName,
    age: 34,
    weightKg: 70,
    heightCm: 170,
    fitnessLevel: 'beginner' as const,
    daysPerWeek: 3,
    equipment: 'home' as const,
    healthLimitations: ['Đau khớp gối'],
    healthNotes: `Tôi là ${secretName}, liên hệ ${secretEmail} hoặc ${secretPhone}, hồ sơ tại ${secretUrl}, có bị đau ngực nhẹ và thoát vị nhẹ.`,
  };

  const goal = {
    sport: 'home_workout' as const,
    goalType: 'weight_loss' as const,
    durationWeeks: 8,
  };

  const minimized = buildMinimizedAiPayload(profileWithPii, goal);
  const serializedPayload = JSON.stringify(minimized);
  const prompt = buildGeminiPrompt(profileWithPii, goal);

  assert.equal('fullName' in (minimized as unknown as Record<string, unknown>), false);
  assert.equal(serializedPayload.includes(secretName), false);
  assert.equal(serializedPayload.includes(secretEmail), false);
  assert.equal(serializedPayload.includes(secretPhone), false);
  assert.equal(serializedPayload.includes(secretUrl), false);

  assert.equal(prompt.includes(secretName), false);
  assert.equal(prompt.includes(secretEmail), false);
  assert.equal(prompt.includes(secretPhone), false);
  assert.equal(prompt.includes(secretUrl), false);

  // Clinical risk tags preserved for safe training decisions
  assert.ok(minimized.clinicalRiskFlags.includes('cardiopulmonary_warning'));
  assert.ok(minimized.clinicalRiskFlags.includes('spine_disc_precaution'));
  assert.equal(minimized.ageBracket, '30-39');

  const stripped = stripDirectIdentifiers(`Email ${secretEmail}, phone ${secretPhone}, link ${secretUrl}`);
  assert.equal(stripped.includes(secretEmail), false);
  assert.equal(stripped.includes(secretPhone), false);
  assert.equal(stripped.includes(secretUrl), false);
});

test('resolveRuntimeConfig enforces strict environment & provider separation and forbids mock AI in production', () => {
  const devDefault = resolveRuntimeConfig({ APP_ENV: 'development' });
  assert.equal(devDefault.appEnv, 'development');
  assert.equal(devDefault.dataProvider, 'firestore');
  assert.equal(devDefault.aiProvider, 'gemini');

  const devMock = resolveRuntimeConfig({
    APP_ENV: 'development',
    DATA_PROVIDER: 'postgres',
    AI_PROVIDER: 'mock',
  });
  assert.equal(devMock.dataProvider, 'postgres');
  assert.equal(devMock.aiProvider, 'mock');

  const prodValid = resolveRuntimeConfig({
    APP_ENV: 'production',
    DATA_PROVIDER: 'postgres',
    AI_PROVIDER: 'gemini',
  });
  assert.equal(prodValid.appEnv, 'production');
  assert.equal(prodValid.dataProvider, 'postgres');
  assert.equal(prodValid.aiProvider, 'gemini');

  assert.throws(
    () =>
      resolveRuntimeConfig({
        APP_ENV: 'production',
        DATA_PROVIDER: 'postgres',
        AI_PROVIDER: 'mock',
      }),
    /Mock AI is strictly forbidden in production/i
  );

  assert.throws(
    () =>
      resolveRuntimeConfig({
        APP_ENV: 'development',
        DATA_PROVIDER: 'dual_write',
      }),
    /Invalid DATA_PROVIDER/i
  );
});

test('generateMockWeekOneStrategy passes safety validator and explicitly flags isSimulated: true', () => {
  const result = generateMockWeekOneStrategy(
    {
      age: 15,
      weightKg: 50,
      heightCm: 160,
      fitnessLevel: 'beginner',
      daysPerWeek: 3,
      equipment: 'none',
      healthLimitations: [],
      healthNotes: '',
    },
    {
      sport: 'home_workout',
      goalType: 'endurance',
      durationWeeks: 6,
    }
  );

  assert.equal(result.aiProvider, 'mock');
  assert.equal(result.isSimulated, true);
  assert.equal(result.cautiousMode, true);
  assert.equal(result.schedule.length, 7);
  assert.match(result.safetyAlert, /phụ huynh|giám hộ/i);
});

test('generateWeekOneStrategy with provider=gemini NEVER silently falls back to mock when GEMINI_API_KEY is missing', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      () =>
        generateWeekOneStrategy(
          {
            age: 28,
            weightKg: 65,
            heightCm: 170,
            fitnessLevel: 'beginner',
            daysPerWeek: 3,
            equipment: 'none',
            healthLimitations: [],
            healthNotes: '',
          },
          {
            sport: 'home_workout',
            goalType: 'weight_loss',
            durationWeeks: 8,
          },
          { provider: 'gemini' }
        ),
      /GEMINI|Gemini API/i
    );
  } finally {
    if (prevKey !== undefined) {
      process.env.GEMINI_API_KEY = prevKey;
    }
  }
});
