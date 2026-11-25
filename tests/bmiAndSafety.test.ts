import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAgeGroup,
  evaluateBmi,
  evaluateCautionStatus,
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

test('evaluateCautionStatus triggers cautious mode for youth, senior, missing data, extreme BMI, or health limitations', () => {
  assert.equal(evaluateCautionStatus(28, [], '', 65, 170).cautiousMode, false);

  const youth = evaluateCautionStatus(15, [], '', 50, 160);
  assert.equal(youth.cautiousMode, true);
  assert.ok(youth.cautionReasons.some((r) => r.includes('dưới 16')));

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
