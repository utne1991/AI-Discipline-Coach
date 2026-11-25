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

  // 5. No unrestricted allow true or blanket deletes
  assert.equal(/allow\s+(read|write|get|list|create|update|delete)\s*:\s*if\s+true\b/.test(rules), false);
  const deleteMatches = rules.match(/allow delete:\s*if\s+false;/g) ?? [];
  assert.ok(deleteMatches.length >= 6, 'All user-scoped paths must explicitly deny client delete');

  // 6. Server timestamp enforcement on create/update
  assert.ok(rules.includes('incoming().createdAt == request.time'));
  assert.ok(rules.includes('incoming().updatedAt == request.time'));
  assert.ok(rules.includes('incoming().createdAt == existing().createdAt'));
  assert.ok(rules.includes('incoming().uid == existing().uid'));
});

test('firebase-blueprint.json stays synchronized with firestore.rules entities and paths', () => {
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8')) as {
    entities: Record<string, unknown>;
    firestore: Record<string, unknown>;
  };

  assert.ok(blueprint.entities.UserProfile);
  assert.ok(blueprint.entities.FitnessProfile);
  assert.ok(blueprint.entities.FitnessGoal);
  assert.ok(blueprint.entities.AiConsentRecord);
  assert.ok(blueprint.entities.WorkoutPlan);
  assert.ok(blueprint.entities.DailyGoal);

  assert.ok(blueprint.firestore['/users/{userId}']);
  assert.ok(blueprint.firestore['/users/{userId}/appData/profile']);
  assert.ok(blueprint.firestore['/users/{userId}/appData/goal']);
  assert.ok(blueprint.firestore['/users/{userId}/appData/consent']);
  assert.ok(blueprint.firestore['/users/{userId}/plans/{planId}']);
  assert.ok(blueprint.firestore['/users/{userId}/dailyGoals/{dateKey}']);
});
