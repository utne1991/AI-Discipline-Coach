import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const BLUEPRINT_PATH = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces global default-deny, email-verified ownership, and strict cross-account isolation', () => {
  const rules = fs.readFileSync(RULES_PATH, 'utf8');

  // 1. Global default-deny safety net
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);

  // 2. Email-verified owner guard
  assert.match(rules, /request\.auth != null && request\.auth\.token\.email_verified == true/);
  assert.match(rules, /function isOwner\(userId\)\s*\{\s*return isSignedIn\(\) && request\.auth\.uid == userId;/);

  // 3. Every user-scoped resource path exists and requires isOwner(userId)
  const requiredMatches = [
    'match /users/{userId}',
    'match /appData/profile',
    'match /appData/goal',
    'match /appData/consent',
    'match /appData/smartwatch',
    'match /plans/{planId}',
    'match /dailyGoals/{dateKey}',
  ];
  for (const matcher of requiredMatches) {
    assert.ok(rules.includes(matcher), `Missing Firestore rule block: ${matcher}`);
  }

  // 4. Consent document validation enforces strict schema & immutable ownership
  assert.ok(rules.includes('function isValidAiConsentRecord(data, userId)'));
  assert.ok(rules.includes("'aiHealthDataConsent'"));
  assert.ok(rules.includes("'guardianConsentConfirmed'"));
  assert.ok(rules.includes("'medicalClearanceAcknowledged'"));
  assert.ok(rules.includes('function isUpdateAiConsentAction()'));

  // 5. Secure list queries on plans and dailyGoals strictly enforce existing().uid == request.auth.uid
  const secureListMatches =
    rules.match(/allow list:\s*if\s+isOwner\(userId\)\s*&&\s*existing\(\)\.uid == request\.auth\.uid;/g) ??
    [];
  assert.ok(
    secureListMatches.length >= 2,
    'Both plans and dailyGoals list rules must enforce owner-scoped existing().uid == request.auth.uid'
  );

  // 6. No unrestricted allow true or blanket deletes
  assert.equal(/allow\s+(read|write|get|list|create|update|delete)\s*:\s*if\s+true\b/.test(rules), false);
  const deleteMatches = rules.match(/allow delete:\s*if\s+false;/g) ?? [];
  assert.ok(deleteMatches.length >= 6, 'All user-scoped paths must explicitly deny client delete');

  // 7. Server timestamp enforcement on create/update
  assert.ok(rules.includes('incoming().createdAt == request.time'));
  assert.ok(rules.includes('incoming().updatedAt == request.time'));
  assert.ok(rules.includes('incoming().createdAt == existing().createdAt'));
  assert.ok(rules.includes('incoming().uid == existing().uid'));

  // 8. Sprint 02 optional field validators (multi-sport, measurable goal, schedule preferences, strategyV2, versioning)
  assert.ok(rules.includes('function isValidSportsList(sports)'));
  assert.ok(rules.includes('function isValidMeasurableGoal(goal)'));
  assert.ok(rules.includes('function isValidSchedulePreferences(pref)'));
  assert.ok(rules.includes('function isValidStrategyV2(strategy)'));
  assert.ok(rules.includes("'versionNumber'"));
  assert.ok(rules.includes("'strategyV2'"));
});

test('firebase-blueprint.json stays synchronized with firestore.rules entities and paths', () => {
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8')) as {
    entities: Record<string, { properties?: Record<string, unknown> }>;
    firestore: Record<string, unknown>;
  };

  assert.ok(blueprint.entities.UserProfile);
  assert.ok(blueprint.entities.FitnessProfile);
  assert.ok(blueprint.entities.FitnessGoal);
  assert.ok(blueprint.entities.AiConsentRecord);
  assert.ok(blueprint.entities.SmartwatchConnection);
  assert.ok(blueprint.entities.WorkoutPlan);
  assert.ok(blueprint.entities.DailyGoal);

  // Sprint 02 optional fields present in blueprint
  assert.ok(blueprint.entities.FitnessGoal.properties?.sports);
  assert.ok(blueprint.entities.FitnessGoal.properties?.measurableGoal);
  assert.ok(blueprint.entities.FitnessGoal.properties?.schedulePreferences);
  assert.ok(blueprint.entities.WorkoutPlan.properties?.sports);
  assert.ok(blueprint.entities.WorkoutPlan.properties?.versionNumber);
  assert.ok(blueprint.entities.WorkoutPlan.properties?.parentPlanId);
  assert.ok(blueprint.entities.WorkoutPlan.properties?.revisionReason);
  assert.ok(blueprint.entities.WorkoutPlan.properties?.strategyV2);

  assert.ok(blueprint.firestore['/users/{userId}']);
  assert.ok(blueprint.firestore['/users/{userId}/appData/profile']);
  assert.ok(blueprint.firestore['/users/{userId}/appData/goal']);
  assert.ok(blueprint.firestore['/users/{userId}/appData/consent']);
  assert.ok(blueprint.firestore['/users/{userId}/appData/smartwatch']);
  assert.ok(blueprint.firestore['/users/{userId}/plans/{planId}']);
  assert.ok(blueprint.firestore['/users/{userId}/dailyGoals/{dateKey}']);
});
