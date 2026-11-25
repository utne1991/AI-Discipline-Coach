import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  createWorkoutPlan,
  getOrCreateUser,
  getUserBootstrapData,
  toggleWorkoutDayCompletion,
  upsertUserGoal,
  upsertUserProfile,
} from './src/db/repository.ts';
import { generateWeekOneStrategy } from './src/services/aiStrategy.ts';
import type { EquipmentOption, FitnessLevel, GoalType, SportOption } from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_LEVELS: FitnessLevel[] = ['beginner', 'intermediate', 'advanced'];
const VALID_EQUIPMENT: EquipmentOption[] = ['none', 'home', 'gym'];
const VALID_SPORTS: SportOption[] = ['running', 'home_workout', 'gym'];
const VALID_GOALS: GoalType[] = ['weight_loss', 'muscle_gain', 'endurance'];

function validateProfilePayload(body: Record<string, unknown>) {
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const age = Number(body.age);
  const weightKg = Number(body.weightKg);
  const heightCm = Number(body.heightCm);
  const fitnessLevel = body.fitnessLevel as FitnessLevel;
  const daysPerWeek = Number(body.daysPerWeek);
  const equipment = body.equipment as EquipmentOption;
  const healthLimitations = Array.isArray(body.healthLimitations)
    ? body.healthLimitations
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12)
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

function validateGoalPayload(body: Record<string, unknown>) {
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

async function resolveCurrentUser(req: AuthRequest) {
  const uid = req.user?.uid;
  if (!uid) {
    throw new Error('Không xác định được tài khoản người dùng.');
  }
  const email = req.user?.email ?? `${uid}@user.local`;
  const displayName = req.user?.name ?? '';
  return getOrCreateUser(uid, email, displayName);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Bootstrap full persisted state for authenticated user
  app.get('/api/bootstrap', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveCurrentUser(req);
      const data = await getUserBootstrapData(user.id);
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

  // M01 - Save or update user profile
  app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const validated = validateProfilePayload((req.body ?? {}) as Record<string, unknown>);
      if ('error' in validated) {
        return res.status(400).json({ error: validated.error });
      }
      const user = await resolveCurrentUser(req);
      const saved = await upsertUserProfile(user.id, validated.data);
      return res.json({ profile: saved });
    } catch (error) {
      console.error('PUT /api/profile error:', error);
      const message = error instanceof Error ? error.message : 'Không thể lưu hồ sơ.';
      return res.status(500).json({ error: message });
    }
  });

  // M02 - Save or update user goal
  app.put('/api/goal', requireAuth, async (req: AuthRequest, res) => {
    try {
      const validated = validateGoalPayload((req.body ?? {}) as Record<string, unknown>);
      if ('error' in validated) {
        return res.status(400).json({ error: validated.error });
      }
      const user = await resolveCurrentUser(req);
      const saved = await upsertUserGoal(user.id, validated.data);
      return res.json({ goal: saved });
    } catch (error) {
      console.error('PUT /api/goal error:', error);
      const message = error instanceof Error ? error.message : 'Không thể lưu mục tiêu.';
      return res.status(500).json({ error: message });
    }
  });

  // M03 - AI Strategy Engine: analyze persisted profile + goal and save Week 1 plan
  app.post('/api/plans/generate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveCurrentUser(req);
      const state = await getUserBootstrapData(user.id);

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

      const generated = await generateWeekOneStrategy(
        {
          fullName: state.profile.fullName,
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
        },
        {
          sport: state.goal.sport as SportOption,
          goalType: state.goal.goalType as GoalType,
          durationWeeks: state.goal.durationWeeks,
        }
      );

      const savedPlan = await createWorkoutPlan(user.id, {
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

      return res.status(201).json({ plan: savedPlan });
    } catch (error) {
      console.error('POST /api/plans/generate error:', error);
      const message =
        error instanceof Error ? error.message : 'Không thể tạo lịch tập Tuần 1 lúc này.';
      return res.status(500).json({ error: message });
    }
  });

  // Toggle completed day check-in on persisted workout plan
  app.patch('/api/plans/:planId/days/:dayIndex/toggle', requireAuth, async (req: AuthRequest, res) => {
    try {
      const planId = Number(req.params.planId);
      const dayIndex = Number(req.params.dayIndex);

      if (!Number.isInteger(planId) || planId <= 0 || !Number.isInteger(dayIndex) || dayIndex < 1 || dayIndex > 7) {
        return res.status(400).json({ error: 'Thông tin ngày tập không hợp lệ.' });
      }

      const user = await resolveCurrentUser(req);
      const updated = await toggleWorkoutDayCompletion(user.id, planId, dayIndex);
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
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Discipline Coach server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
