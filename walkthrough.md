# Security Summary

**Reviewed Files**: 14
**Issues Resolved**: 4

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Unvalidated AI Plan Persistence | `src/services/aiStrategy.ts` | 251 | AI responses were normalized silently without rejecting unsafe intensities, banned exercises, or duplicate/missing days. | High | Fixed | Added independent deterministic `validateWorkoutStrategy` in `src/services/strategyValidator.ts`, retry feedback loop, and strict `422` rejection before DB save. |
| Health Data Consent Before External AI | `src/server/createApp.ts` | 275 | User health limitations and notes could be transmitted to Gemini without explicit consent confirmation in the request payload. | Medium | Fixed | Added explicit consent checkbox in `src/components/GoalTab.tsx` and enforced `aiConsent === true` in `POST /api/plans/generate`. |
| Pediatric BMI Misclassification | `src/shared/types.ts` | 180 | Adult BMI weight categories were applied to users under 18 years old. | Medium | Fixed | Replaced with age-group-aware `evaluateBmi` separating youth/teen (`<18`) with WHO/CDC percentile guidance and defaulting missing data to Cautious Mode. |
| API Hardening & Error Isolation | `src/server/createApp.ts` | 175 | Malformed JSON bodies and unknown `/api/*` paths fell through to default HTML responses; no plan-by-id endpoint existed. | Low | Fixed | Added `X-Content-Type-Options: nosniff`, `Referrer-Policy`, disabled `x-powered-by`, added JSON `400`/`404`/`500` handlers and user-scoped `GET /api/plans/:planId`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `src/services/aiStrategy.ts` | `GEMINI_API_KEY` is read strictly from server-side `process.env` and never bundled or sent to the browser. |
| Database Queries | `src/db/repository.ts` | All reads and writes use Drizzle ORM parameterized queries bound to `user.id` resolved from the verified Firebase token. |
| Authentication & Access Control | `src/server/createApp.ts`, `src/middleware/auth.ts` | Protected `/api/*` routes require a verified Firebase Bearer ID token (`401` if missing/invalid) and filter all plan queries by `userId` (`404` on cross-user access). |
| Dependency Audit | `bun.lock` | Ran `bun audit`; 3 transitive advisories exist in upstream Firebase gRPC and dev build tooling (`esbuild`), with zero hardcoded secrets found. |

## PoC Verification

### 1. Cross-User Plan Access & Missing Auth Guard
#### Summary
| Field | Value |
|---|---|
| Issue Type | Broken Access Control / Missing Auth |
| Impact | High |
| Affected File | `src/server/createApp.ts:323` |
| Test Scenario | User B sends `GET /api/plans/1` and `PATCH /api/plans/1/days/1/toggle` for User A's plan, and unauthenticated requests hit all `/api/*` endpoints. |

#### How It Was Fixed
Every `/api/*` route passes through `requireAuthenticated` (verifying the Bearer token) and resolves `user.id` strictly from the verified `uid`. Repository queries filter `workout_plans` by both `id` and `userId`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Unauthenticated request hits `/api/bootstrap` or `/api/plans/1` | Blocked at `requireAuthenticated` (`401`) |
| 2 | User B sends valid token for `uid-b` requesting User A's `planId = 1` | `resolveCurrentUser` resolves `user.id = 2` |
| 3 | `repo.getWorkoutPlanById(2, 1)` / `repo.toggleWorkoutDayCompletion(2, 1, 1)` queries with `userId = 2 AND id = 1` | Returns `null` -> HTTP `404` |

#### Conclusion
**Fix Verified** - Cross-user data reads and mutations are blocked at both authentication and ownership query boundaries (`tests/apiSecurityAndFlow.test.ts`).

### 2. Unsafe AI Workout Plan Rejection
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsafe AI Output Acceptance |
| Impact | High |
| Affected File | `src/services/strategyValidator.ts:132` |
| Test Scenario | Senior user (`age = 65`, knee pain & heart limitation) receives AI output containing `"Cao"` intensity, `"Burpee"`, or short rest `< 45s`. |

#### How It Was Fixed
`validateWorkoutStrategy` deterministically inspects all 7 days, intensity labels, exercise keywords against age/medical rules, equipment compatibility, sets, and rest seconds before any database write.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `generateWeekOneStrategy` receives candidate JSON from Gemini | Passed to `validateWorkoutStrategy` |
| 2 | Validator checks `cautiousMode` rules (`intensity !== 'Cao'`, `restSeconds >= 45`, banned term scan) | Flags violation and rejects (`valid: false`) |
| 3 | After retry exhaustion, `StrategyValidationError` propagates to `POST /api/plans/generate` | Returns `422` JSON; no plan persisted |

#### Conclusion
**Fix Verified** - Unsafe or structurally invalid AI schedules are deterministically rejected before persistence (`tests/strategyValidator.test.ts`, `tests/apiSecurityAndFlow.test.ts`).
