# Firestore Security Specification

## 1. Data Invariants
1. All documents under `/users/{userId}` (including `appData/profile`, `appData/goal`, `appData/consent`, `plans/{planId}`, and `dailyGoals/{dateKey}`) can only be read, created, or updated by the authenticated, email-verified owner where `request.auth.uid == userId`.
2. `uid` must strictly equal `request.auth.uid` and `userId`, and remain immutable after creation.
3. `reminderEnabled` must be a boolean, `reminderTime` must match `^([01][0-9]|2[0-3]):[0-5][0-9]$` (5 chars), and `timezone` must be a non-empty string up to 64 chars.
4. For `/users/{userId}/appData/consent`, `policyVersion` must be a non-empty string up to 32 chars, and `aiHealthDataConsent`, `guardianConsentConfirmed`, and `medicalClearanceAcknowledged` must all be booleans.
5. For `/users/{userId}/plans/{planId}`, optional `aiProvider` (if present) must be `'gemini'` or `'mock'`, and optional `isSimulated` (if present) must be a boolean.
6. For `/users/{userId}/dailyGoals/{dateKey}`, `dateKey` must match `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` and equal the `{dateKey}` path segment (immutable), `title` must be a non-empty string up to 120 chars, and `completed` must be a boolean.
7. `createdAt` and `updatedAt` must equal `request.time` on create; `createdAt` is immutable on update and `updatedAt` must equal `request.time` on update.
8. `allow list` on `/users/{userId}`, `appData/*`, and `dailyGoals/{dateKey}`, and `allow delete` across all user documents are denied.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/userA`, `/users/userA/appData/consent`, or `/users/userA/dailyGoals/2026-11-25`.
2. Cross-account read/write: User A reading or updating User B's `/users/userB/appData/profile`, `/users/userB/appData/consent`, or `/users/userB/plans/plan_1`.
3. Unverified email user (`email_verified == false`) attempting to write `/users/userA/appData/consent`.
4. Creating `/users/userA/appData/consent` with spoofed `uid: "userB"` or oversized `policyVersion` (>32 chars).
5. Creating `/users/userA/appData/consent` with a shadow field `isAdmin: true` or `role: "admin"`.
6. Creating `/users/userA/dailyGoals/invalid-date` with non-date document ID.
7. Creating `/users/userA/plans/plan_1` with invalid `aiProvider: "untrusted-llm"` or non-boolean `isSimulated: "false"`.
8. Creating `/users/userA/dailyGoals/2026-11-25` with empty `title: ""` or oversized `title` (>120 chars).
9. Creating `/users/userA` with invalid `reminderTime: "25:99"` or `"7:00"`.
10. Creating any document with client-forged `createdAt` instead of `serverTimestamp()`.
11. Updating `/users/userA/appData/consent` attempting to mutate immutable `uid` or `createdAt`.
12. Listing `/users`, `/users/userA/appData`, or `/users/userA/dailyGoals` (`allow list` must be denied).
