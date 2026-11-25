import express, { type NextFunction, type Request, type Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { postgresRepository } from '../repositories/postgresRepository.ts';
import type { AppRepository } from '../repositories/types.ts';
import {
  StrategyValidationError,
  generateWeekOneStrategy,
  type GeneratedStrategyResult,
  type StrategyGoalInput,
  type StrategyProfileInput,
} from '../services/aiStrategy.ts';
import {
  evaluateSafetyProfile,
  type EquipmentOption,
  type FitnessLevel,
  type GoalType,
  type SportOption,
} from '../shared/types.ts';

export type { AppRepository };

export interface VerifiedAuthUser {
  uid: string;
  email?: string;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: VerifiedAuthUser;
}

export interface CreateAppDependencies {
  verifyIdToken?: (token: string) => Promise<VerifiedAuthUser>;
  repo?: AppRepository;
  generateStrategy?: (
    profile: StrategyProfileInput,
    goal: StrategyGoalInput
  ) => Promise<GeneratedStrategyResult>;
}

const VALID_LEVELS: FitnessLevel[] = ['beginner', 'intermediate', 'advanced'];
const VALID_EQUIPMENT: EquipmentOption[] = ['none', 'home', 'gym'];
const VALID_SPORTS: SportOption[] = ['running', 'home_workout', 'gym'];
const VALID_GOALS: GoalType[] = ['weight_loss', 'muscle_gain', 'endurance'];

export function validateProfilePayload(body: Record<string, unknown>) {
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const age = Number(body.age);
  const weightKg = Number(body.weightKg);
  const heightCm = Number(body.heightCm);
  const fitnessLevel = body.fitnessLevel as FitnessLevel;
  const daysPerWeek = Number(body.daysPerWeek);
  const equipment = body.equipment as EquipmentOption;
  const healthLimitations = Array.isArray(body.healthLimitations)
    ? Array.from(
        new Set(
          body.healthLimitations
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim().slice(0, 80))
            .filter(Boolean)
        )
      ).slice(0, 12)
    : [];
  const healthNotes =
    typeof body.healthNotes === 'string' ? body.healthNotes.trim().slice(0, 500) : '';

  if (fullName.length < 1 || fullName.length > 80) {
    return { error: 'Vui lòng nhập tên hợp lệ (1–80 ký tự).' };
  }
  if (!Number.isInteger(age) || age < 10 || age > 100) {
    return { error: 'Độ tuổi phải nằm trong khoảng 10 đến 100 tuổi.' };
  }
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 250) {
    return { error: 'Cân nặng phải nằm trong khoảng 25 đến 250 kg.' };
  }
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 230) {
    return { error: 'Chiều cao phải nằm trong khoảng 100 đến 230 cm.' };
  }
  if (!VALID_LEVELS.includes(fitnessLevel)) {
    return { error: 'Trình độ tập luyện không hợp lệ.' };
  }
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) {
    return { error: 'Số ngày tập mỗi tuần phải từ 1 đến 7 ngày.' };
  }
  if (!VALID_EQUIPMENT.includes(equipment)) {
    return { error: 'Lựa chọn dụng cụ tập không hợp lệ.' };
  }

  return {
    data: {
      fullName,
      age,
      weightKg: Math.round(weightKg * 10) / 10,
      heightCm: Math.round(heightCm * 10) / 10,
      fitnessLevel,
      daysPerWeek,
      equipment,
      healthLimitations,
      healthNotes,
    },
  };
}

export function validateGoalPayload(body: Record<string, unknown>) {
  const sport = body.sport as SportOption;
  const goalType = body.goalType as GoalType;
  const durationWeeks = Number(body.durationWeeks);

  if (!VALID_SPORTS.includes(sport)) {
    return { error: 'Môn tập chính không hợp lệ.' };
  }
  if (!VALID_GOALS.includes(goalType)) {
    return { error: 'Mục tiêu tập luyện không hợp lệ.' };
  }
  if (!Number.isInteger(durationWeeks) || durationWeeks < 4 || durationWeeks > 12) {
    return { error: 'Thời hạn mục tiêu phải nằm trong khoảng 4 đến 12 tuần.' };
  }

  return {
    data: {
      sport,
      goalType,
      durationWeeks,
    },
  };
}

export function createApp(deps: CreateAppDependencies = {}) {
  const verifyToken =
    deps.verifyIdToken ??
    (async (token: string): Promise<VerifiedAuthUser> => {
      const decoded = await adminAuth.verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      };
    });

  const repo: AppRepository = deps.repo ?? postgresRepository;

  const runStrategyGenerator = deps.generateStrategy ?? generateWeekOneStrategy;

  const app = express();
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  const requireAuthenticated = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    }
    try {
      req.authUser = await verifyToken(token);
      next();
    } catch {
      return res.status(401).json({ error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' });
    }
  };

  const resolveCurrentUser = async (req: AuthenticatedRequest) => {
    const uid = req.authUser?.uid;
    if (!uid) {
      throw new Error('Không xác định được tài khoản người dùng.');
    }
    const email = req.authUser?.email ?? `${uid}@user.local`;
    const displayName = req.authUser?.name ?? '';
    return repo.getOrCreateUser(uid, email, displayName);
  };

  app.get('/api/bootstrap', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await resolveCurrentUser(req);
      const data = await repo.getUserBootstrapData(user.id);
      return res.json({
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        },
        profile: data.profile,
        goal: data.goal,
        latestPlan: data.latestPlan,
        planCount: data.planCount,
      });
    } catch (error) {
      console.error('GET /api/bootstrap error:', error);
      const message =
        error instanceof Error ? error.message : 'Không thể tải dữ liệu tài khoản.';
      return res.status(500).json({ error: message });
    }
  });

  app.put('/api/profile', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const validated = validateProfilePayload((req.body ?? {}) as Record<string, unknown>);
      if ('error' in validated) {
        return res.status(400).json({ error: validated.error });
      }
      const user = await resolveCurrentUser(req);
      const saved = await repo.upsertUserProfile(user.id, validated.data);
      return res.json({ profile: saved });
    } catch (error) {
      console.error('PUT /api/profile error:', error);
      const message = error instanceof Error ? error.message : 'Không thể lưu hồ sơ.';
      return res.status(500).json({ error: message });
    }
  });

  app.put('/api/goal', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const validated = validateGoalPayload((req.body ?? {}) as Record<string, unknown>);
      if ('error' in validated) {
        return res.status(400).json({ error: validated.error });
      }
      const user = await resolveCurrentUser(req);
      const saved = await repo.upsertUserGoal(user.id, validated.data);
      return res.json({ goal: saved });
    } catch (error) {
      console.error('PUT /api/goal error:', error);
      const message = error instanceof Error ? error.message : 'Không thể lưu mục tiêu.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/plans/generate', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (body.aiConsent !== true) {
        return res.status(400).json({
          error:
            'Vui lòng xác nhận đồng ý gửi thông tin thể chất và giới hạn sức khỏe đã tối giản cho AI trước khi tạo lịch tập.',
        });
      }

      const validateSafetyConsents = (profile: {
        age: number;
        weightKg: number;
        heightCm: number;
        fitnessLevel: FitnessLevel;
        healthLimitations: string[];
        healthNotes: string;
      }): string | null => {
        const safety = evaluateSafetyProfile({
          age: profile.age,
          weightKg: profile.weightKg,
          heightCm: profile.heightCm,
          fitnessLevel: profile.fitnessLevel,
          healthLimitations: profile.healthLimitations,
          healthNotes: profile.healthNotes,
        });
        if (safety.isMinor && body.guardianConsent !== true) {
          return 'Người dùng dưới 18 tuổi bắt buộc có xác nhận đồng ý và giám sát của phụ huynh / người giám hộ trước khi tạo lịch tập.';
        }
        if (safety.requiresMedicalClearance && body.medicalClearanceAcknowledged !== true) {
          return 'Hồ sơ có yếu tố sức khỏe cần đánh giá chuyên môn. Vui lòng xác nhận đã nắm khuyến nghị tham khảo ý kiến bác sĩ trước khi tập luyện.';
        }
        return null;
      };

      if (body.profile && body.goal && typeof body.profile === 'object' && typeof body.goal === 'object') {
        const validatedProfile = validateProfilePayload(body.profile as Record<string, unknown>);
        if ('error' in validatedProfile) {
          return res.status(400).json({ error: validatedProfile.error });
        }
        const validatedGoal = validateGoalPayload(body.goal as Record<string, unknown>);
        if ('error' in validatedGoal) {
          return res.status(400).json({ error: validatedGoal.error });
        }

        const consentError = validateSafetyConsents(validatedProfile.data);
        if (consentError) {
          return res.status(400).json({ error: consentError });
        }

        // Data minimization: omit fullName before invoking AI strategy generator
        const { fullName: _omittedName, ...minimizedProfile } = validatedProfile.data;
        const generated = await runStrategyGenerator(minimizedProfile, validatedGoal.data);

        return res.status(201).json({
          plan: {
            id: Date.now(),
            weekNumber: 1,
            sport: validatedGoal.data.sport,
            goalType: validatedGoal.data.goalType,
            durationWeeks: validatedGoal.data.durationWeeks,
            cautiousMode: generated.cautiousMode,
            cautionReasons: generated.cautionReasons,
            safetyAlert: generated.safetyAlert,
            strategySummary: generated.strategySummary,
            coachPrinciples: generated.coachPrinciples,
            scheduleJson: generated.schedule,
            completedDays: [],
            aiProvider: generated.aiProvider,
            isSimulated: generated.isSimulated,
            createdAt: new Date().toISOString(),
          },
        });
      }

      const user = await resolveCurrentUser(req);
      const state = await repo.getUserBootstrapData(user.id);

      if (!state.profile) {
        return res.status(400).json({
          error: 'Vui lòng hoàn thành và lưu Hồ sơ người dùng (M01) trước khi tạo lịch tập.',
        });
      }
      if (!state.goal) {
        return res.status(400).json({
          error: 'Vui lòng thiết lập và lưu Mục tiêu tập luyện (M02) trước khi tạo lịch tập.',
        });
      }

      const persistedProfileForAi: StrategyProfileInput = {
        age: state.profile.age,
        weightKg: state.profile.weightKg,
        heightCm: state.profile.heightCm,
        fitnessLevel: state.profile.fitnessLevel as FitnessLevel,
        daysPerWeek: state.profile.daysPerWeek,
        equipment: state.profile.equipment as EquipmentOption,
        healthLimitations: Array.isArray(state.profile.healthLimitations)
          ? state.profile.healthLimitations
          : [],
        healthNotes: state.profile.healthNotes ?? '',
      };

      const consentError = validateSafetyConsents(persistedProfileForAi);
      if (consentError) {
        return res.status(400).json({ error: consentError });
      }

      const generated = await runStrategyGenerator(persistedProfileForAi, {
        sport: state.goal.sport as SportOption,
        goalType: state.goal.goalType as GoalType,
        durationWeeks: state.goal.durationWeeks,
      });

      const savedPlan = await repo.createWorkoutPlan(user.id, {
        weekNumber: 1,
        sport: state.goal.sport as SportOption,
        goalType: state.goal.goalType as GoalType,
        durationWeeks: state.goal.durationWeeks,
        cautiousMode: generated.cautiousMode,
        cautionReasons: generated.cautionReasons,
        safetyAlert: generated.safetyAlert,
        strategySummary: generated.strategySummary,
        coachPrinciples: generated.coachPrinciples,
        scheduleJson: generated.schedule,
      });

      return res.status(201).json({
        plan: {
          ...savedPlan,
          aiProvider: generated.aiProvider,
          isSimulated: generated.isSimulated,
        },
      });
    } catch (error) {
      if (error instanceof StrategyValidationError) {
        return res.status(422).json({
          error: error.message,
          validationErrors: error.validationErrors,
        });
      }
      console.error('POST /api/plans/generate error:', error);
      const message =
        error instanceof Error ? error.message : 'Không thể tạo lịch tập Tuần 1 lúc này.';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/plans/:planId', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!Number.isInteger(planId) || planId <= 0) {
        return res.status(400).json({ error: 'Mã lịch tập không hợp lệ.' });
      }
      const user = await resolveCurrentUser(req);
      const plan = await repo.getWorkoutPlanById(user.id, planId);
      if (!plan) {
        return res.status(404).json({ error: 'Không tìm thấy lịch tập.' });
      }
      return res.json({ plan });
    } catch (error) {
      console.error('GET /api/plans/:planId error:', error);
      const message = error instanceof Error ? error.message : 'Không thể tải lịch tập.';
      return res.status(500).json({ error: message });
    }
  });

  app.patch(
    '/api/plans/:planId/days/:dayIndex/toggle',
    requireAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const planId = Number(req.params.planId);
        const dayIndex = Number(req.params.dayIndex);

        if (
          !Number.isInteger(planId) ||
          planId <= 0 ||
          !Number.isInteger(dayIndex) ||
          dayIndex < 1 ||
          dayIndex > 7
        ) {
          return res.status(400).json({ error: 'Thông tin ngày tập không hợp lệ.' });
        }

        const user = await resolveCurrentUser(req);
        const updated = await repo.toggleWorkoutDayCompletion(user.id, planId, dayIndex);
        if (!updated) {
          return res.status(404).json({ error: 'Không tìm thấy lịch tập.' });
        }
        return res.json({ plan: updated });
      } catch (error) {
        console.error('PATCH /api/plans/:planId/days/:dayIndex/toggle error:', error);
        const message =
          error instanceof Error ? error.message : 'Không thể cập nhật tiến độ buổi tập.';
        return res.status(500).json({ error: message });
      }
    }
  );

  // Return JSON 404 for unknown API paths instead of falling through to SPA HTML
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint không tồn tại.' });
  });

  // Malformed JSON / unexpected server error handler (sanitized, no stack traces)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
    }
    console.error('Unhandled server error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.' });
  });

  return app;
}
