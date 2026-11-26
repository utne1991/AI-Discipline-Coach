# Firestore Security Specification

## 1. Data Invariants
1. All documents under `/users/{userId}` (including `appData/profile`, `appData/goal`, `appData/consent`, `appData/smartwatch`, `plans/{planId}`, and `dailyGoals/{dateKey}`) can only be read, created, or updated by the authenticated, email-verified owner where `request.auth.uid == userId`.
2. `uid` must strictly equal `request.auth.uid` and `userId`, and remain immutable after creation.
3. `reminderEnabled` must be a boolean, `reminderTime` must match `^([01][0-9]|2[0-3]):[0-5][0-9]$` (5 chars), and `timezone` must be a non-empty string up to 64 chars.
4. For `/users/{userId}/appData/consent`, `policyVersion` must be a non-empty string up to 32 chars, and `aiHealthDataConsent`, `guardianConsentConfirmed`, and `medicalClearanceAcknowledged` must all be booleans.
5. For `/users/{userId}/appData/goal`, required fields are `uid`, `sport`, `goalType`, `durationWeeks`, `createdAt`, `updatedAt`. Optional Sprint 02 fields:
   - `sports`: list of 1..3 sport strings (`running`, `home_workout`, `gym`).
   - `measurableGoal`: map with strict `hasOnly(['metricKey', 'targetLabel', 'currentValue', 'targetValue', 'unit'])`, bounded string lengths, and finite numeric values (`0..10000`).
   - `schedulePreferences`: map with strict `hasOnly(['startDateKey', 'timezone', 'preferredTimeSlot', 'minutesPerSessionBudget', 'preferredDays'])`, valid `YYYY-MM-DD` date key, timezone up to 64 chars, slot in `['morning', 'noon', 'evening']`, and budget int `20..90`.
6. For `/users/{userId}/plans/{planId}`, required fields remain unchanged. Optional fields:
   - `aiProvider`: `'gemini'` or `'mock'`.
   - `isSimulated`: boolean.
   - `sports`: list of 1..3 sport strings.
   - `versionNumber`: int `1..500`.
   - `parentPlanId`: int `> 0` or `null`.
   - `revisionReason`: string up to 240 chars.
   - `strategyV2`: map with bounded keys (`engineVersion == '2.0'`, `sports`, `measurableGoal`, `feasibility`, `ultimateGoal`, `currentPosition`, `phases`, `milestones`, `volumeAllocation`, `todayDirective`, `reassessmentSchedule`, `adjustmentSignals`, `stopAndEscalateCriteria`, `calendarContext`, `dailyCommitments` up to 21 items) and strict type/size constraints.
   - Updates on `/plans/{planId}` are strictly restricted to `completedDays` and `updatedAt` (plan strategy and version metadata are immutable once saved).
7. For `/users/{userId}/dailyGoals/{dateKey}`, `dateKey` must match `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` and equal the `{dateKey}` path segment (immutable), `title` must be a non-empty string up to 120 chars, and `completed` must be a boolean.
8. `allow list` on `/users/{userId}/plans/{planId}` and `/users/{userId}/dailyGoals/{dateKey}` MUST enforce `isOwner(userId) && existing().uid == request.auth.uid` (no client-delegated security, no `get()` calls inside list rules).
9. For `/users/{userId}/appData/smartwatch`, `deviceName` must be a non-empty string up to 80 chars, `platform` must be one of `['ble_heart_rate', 'apple_watch_ics', 'wear_os_ics', 'garmin_ics']`, `autoSyncCalendar` must be a boolean, `lastConnectedAt` must be a string up to 40 chars, `lastHeartRateBpm` must be an int (`0` or `30..240`), `lastBatteryPercent` must be an int (`-1..100`), and `totalSyncedSessions` must be an int (`0..10000`).
10. `createdAt` and `updatedAt` must equal `request.time` on create; `createdAt` is immutable on update and `updatedAt` must equal `request.time` on update.
11. `allow list` on `/users/{userId}` and `appData/*`, and `allow delete` across all user documents are denied.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/userA`, `/users/userA/appData/goal`, `/users/userA/appData/consent`, `/users/userA/appData/smartwatch`, or `/users/userA/dailyGoals/2026-11-25`.
2. Cross-account read/list/write: User A reading, listing, or updating User B's `/users/userB/appData/profile`, `/users/userB/appData/goal`, `/users/userB/appData/consent`, `/users/userB/appData/smartwatch`, `/users/userB/plans`, or `/users/userB/dailyGoals`.
3. Unverified email user (`email_verified == false`) attempting to write or list `/users/userA/dailyGoals`, `/users/userA/plans`, or `/users/userA/appData/goal`.
4. Creating `/users/userA/appData/consent` or `/users/userA/appData/smartwatch` with spoofed `uid: "userB"` or oversized `deviceName` (>80 chars).
5. Creating `/users/userA/appData/goal`, `/users/userA/plans/plan_1`, or `/users/userA/dailyGoals/2026-11-25` with a shadow field `isAdmin: true` or `role: "admin"`.
6. Creating `/users/userA/appData/goal` with >3 items in `sports`, invalid `preferredTimeSlot: "midnight"`, or invalid `startDateKey: "2026/11/25"`.
7. Creating `/users/userA/plans/plan_1` with invalid `aiProvider: "untrusted-llm"`, negative `versionNumber: 0`, oversized `revisionReason` (>240 chars), or malformed `strategyV2` (`schemaVersion: 99`).
8. Updating `/users/userA/plans/plan_1` attempting to mutate immutable `versionNumber`, `strategyV2`, `numericId`, `uid`, or `createdAt`.
9. Creating `/users/userA/dailyGoals/invalid-date` or with empty `title: ""` or oversized `title` (>120 chars).
10. Creating `/users/userA` with invalid `reminderTime: "25:99"` or client-forged `createdAt` instead of `serverTimestamp()`.
11. Updating `/users/userA/dailyGoals/2026-11-25` or `/users/userA/appData/smartwatch` attempting to mutate immutable `uid`, `dateKey`, or `createdAt`.
12. Listing `/users` or `/users/userA/appData` (`allow list` must be denied), or listing `/users/userA/plans` without matching `where('uid', '==', request.auth.uid)`.
