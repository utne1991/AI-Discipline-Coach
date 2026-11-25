import {
  loadUserFitnessData,
  saveDailyGoalToFirestore,
  saveUserConsentToFirestore,
  saveUserGoalToFirestore,
  saveUserProfileToFirestore,
  saveWorkoutPlanToFirestore,
  toggleDailyGoalInFirestore,
  togglePlanDayInFirestore,
} from '../lib/firestoreAppStore.ts';
import type { ClientDataRepository } from './types.ts';

/**
 * Firestore client repository adapter implementing ClientDataRepository.
 * Primary storage adapter when DATA_PROVIDER=firestore in DEV/MVP.
 */
export const firestoreClientRepository: ClientDataRepository = {
  providerName: 'firestore',
  loadUserFitnessData,
  saveUserProfile: saveUserProfileToFirestore,
  saveUserGoal: saveUserGoalToFirestore,
  saveUserConsent: saveUserConsentToFirestore,
  saveWorkoutPlan: saveWorkoutPlanToFirestore,
  togglePlanDay: togglePlanDayInFirestore,
  saveDailyGoal: saveDailyGoalToFirestore,
  toggleDailyGoal: toggleDailyGoalInFirestore,
};
