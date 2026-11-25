import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeeklyExerciseProgress } from '../src/components/ProgressBar.tsx';

test('calculateWeeklyExerciseProgress computes exercise completion percentage and clamps bounds', () => {
  assert.equal(calculateWeeklyExerciseProgress(0, 12, 0, 3), 0);
  assert.equal(calculateWeeklyExerciseProgress(4, 12, 1, 3), 33);
  assert.equal(calculateWeeklyExerciseProgress(8, 12, 2, 3), 67);
  assert.equal(calculateWeeklyExerciseProgress(12, 12, 3, 3), 100);
  assert.equal(calculateWeeklyExerciseProgress(15, 12, 3, 3), 100);
  assert.equal(calculateWeeklyExerciseProgress(0, 0, 2, 4), 50);
  assert.equal(calculateWeeklyExerciseProgress(0, 0, 0, 0), 0);
});
