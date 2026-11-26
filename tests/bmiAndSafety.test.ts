import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAgeGroup,
  evaluateBmi,
  evaluateCautionStatus,
  evaluateSafetyProfile,
} from '../src/shared/types.ts';

test('classifyAgeGroup separates youth, teen, adult, senior, and unknown', () => {
  assert.equal(classifyAgeGroup(0), 'unknown');
  assert.equal(classifyAgeGroup(-5), 'unknown');
  assert.equal(classifyAgeGroup(13), 'youth');
  assert.equal(classifyAgeGroup(16), 'teen');
  assert.equal(classifyAgeGroup(17), 'teen');
  assert.equal(classifyAgeGroup(18), 'adult');
  assert.equal(classifyAgeGroup(60), 'adult');
  assert.equal(classifyAgeGroup(61), 'senior');
});

test('evaluateBmi does NOT apply adult BMI classification to children/teens (<18)', () => {
  const youthBmi = evaluateBmi(52, 160, 14);
  assert.equal(youthBmi.status, 'pediatric_notice');
  assert.equal(youthBmi.isAdultClassification, false);
  assert.equal(youthBmi.ageGroup, 'youth');
  assert.match(youthBmi.category, /WHO\/CDC/i);
  assert.doesNotMatch(youthBmi.category, /Thừa cân|Cân đối|Thiếu cân/);

  const teenBmi = evaluateBmi(68, 165, 17);
  assert.equal(teenBmi.status, 'pediatric_notice');
  assert.equal(teenBmi.isAdultClassification, false);
  assert.equal(teenBmi.ageGroup, 'teen');
});

test('evaluateBmi classifies adults (>=18) accurately and handles missing data safely', () => {
  const adultNormal = evaluateBmi(62, 170, 28);
  assert.equal(adultNormal.status, 'adult_classified');
  assert.equal(adultNormal.isAdultClassification, true);
  assert.equal(adultNormal.category, 'Cân đối');

  const adultHigh = evaluateBmi(95, 170, 35);
  assert.equal(adultHigh.status, 'adult_classified');
  assert.match(adultHigh.category, /thận trọng/i);

  const missing = evaluateBmi(0, 170, 25);
  assert.equal(missing.status, 'missing_data');
  assert.equal(missing.value, null);
  assert.equal(missing.isAdultClassification, false);
});

test('evaluateCautionStatus triggers cautious mode for minors, senior, missing data, extreme BMI, or health limitations', () => {
  assert.equal(evaluateCautionStatus(28, [], '', 65, 170).cautiousMode, false);

  const youth = evaluateCautionStatus(15, [], '', 50, 160);
  assert.equal(youth.cautiousMode, true);
  assert.ok(youth.cautionReasons.some((r) => r.includes('dưới 16')));

  const teen = evaluateCautionStatus(17, [], '', 62, 170);
  assert.equal(teen.cautiousMode, true);
  assert.ok(teen.cautionReasons.some((r) => r.includes('vị thành niên')));

  const senior = evaluateCautionStatus(64, [], '', 65, 168);
  assert.equal(senior.cautiousMode, true);
  assert.ok(senior.cautionReasons.some((r) => r.includes('trên 60')));

  const missing = evaluateCautionStatus(0, [], '', 0, 170);
  assert.equal(missing.cautiousMode, true);

  const kneePain = evaluateCautionStatus(30, ['Đau khớp gối'], '', 65, 170);
  assert.equal(kneePain.cautiousMode, true);

  const extremeBmi = evaluateCautionStatus(30, [], '', 98, 170);
  assert.equal(extremeBmi.cautiousMode, true);
});

test('evaluateSafetyProfile enforces minor guardian rules, medical clearance triggers, and load limits', () => {
  const youth = evaluateSafetyProfile({
    age: 14,
    weightKg: 48,
    heightCm: 158,
    fitnessLevel: 'beginner',
    daysPerWeek: 3,
    healthLimitations: [],
    healthNotes: '',
  });
  assert.equal(youth.isMinor, true);
  assert.equal(youth.requiresGuardianSupervision, true);
  assert.equal(youth.cautiousMode, true);
  assert.equal(youth.loadLimits.allowHighIntensity, false);
  assert.ok(youth.loadLimits.maxSessionMinutes <= 45);
  assert.ok(youth.loadLimits.maxSetsPerExercise <= 4);

  const teen = evaluateSafetyProfile({
    age: 16,
    weightKg: 60,
    heightCm: 168,
    fitnessLevel: 'intermediate',
    daysPerWeek: 4,
    healthLimitations: [],
    healthNotes: '',
  });
  assert.equal(teen.isMinor, true);
  assert.equal(teen.requiresGuardianSupervision, true);
  assert.equal(teen.loadLimits.allowHighIntensity, false);
  assert.ok(teen.loadLimits.maxSessionMinutes <= 60);

  const cardioRisk = evaluateSafetyProfile({
    age: 42,
    weightKg: 72,
    heightCm: 170,
    fitnessLevel: 'intermediate',
    daysPerWeek: 3,
    healthLimitations: ['Tim mạch / Huyết áp'],
    healthNotes: '',
  });
  assert.equal(cardioRisk.requiresMedicalClearance, true);
  assert.equal(cardioRisk.cautiousMode, true);
  assert.ok(cardioRisk.medicalClearanceReasons.length >= 1);
  assert.ok(cardioRisk.loadLimits.maxSessionMinutes <= 45);
  assert.ok(cardioRisk.loadLimits.minRestSeconds >= 60);

  const noteKeywordRisk = evaluateSafetyProfile({
    age: 34,
    weightKg: 66,
    heightCm: 170,
    fitnessLevel: 'beginner',
    daysPerWeek: 3,
    healthLimitations: [],
    healthNotes: 'Thi thoảng bị đau ngực và chóng mặt khi leo cầu thang',
  });
  assert.equal(noteKeywordRisk.requiresMedicalClearance, true);
  assert.ok(noteKeywordRisk.medicalClearanceReasons.some((r) => r.includes('đau ngực')));

  const severeBmiRisk = evaluateSafetyProfile({
    age: 35,
    weightKg: 112,
    heightCm: 170,
    fitnessLevel: 'beginner',
    daysPerWeek: 3,
    healthLimitations: [],
    healthNotes: '',
  });
  assert.equal(severeBmiRisk.requiresMedicalClearance, true);
});
