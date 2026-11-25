import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface WorkoutExercise {
  name: string;
  sets: string;
  repsOrDuration: string;
  restSeconds: number;
  note: string;
}

export interface WorkoutDay {
  dayIndex: number; // 1 = Thứ 2 ... 7 = Chủ nhật
  dayLabel: string;
  isRestDay: boolean;
  title: string;
  focusArea: string;
  estimatedMinutes: number;
  intensity: 'Nhẹ' | 'Trung bình' | 'Cao';
  warmup: string;
  cooldown: string;
  safetyNote: string;
  exercises: WorkoutExercise[];
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  fullName: text('full_name').notNull(),
  age: integer('age').notNull(),
  weightKg: real('weight_kg').notNull(),
  heightCm: real('height_cm').notNull(),
  fitnessLevel: text('fitness_level').notNull(), // 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek: integer('days_per_week').notNull(),
  equipment: text('equipment').notNull(), // 'none' | 'home' | 'gym'
  healthLimitations: jsonb('health_limitations').$type<string[]>().notNull().default([]),
  healthNotes: text('health_notes').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userGoals = pgTable('user_goals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  sport: text('sport').notNull(), // 'running' | 'home_workout' | 'gym'
  goalType: text('goal_type').notNull(), // 'weight_loss' | 'muscle_gain' | 'endurance'
  durationWeeks: integer('duration_weeks').notNull(), // 4..12
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workoutPlans = pgTable('workout_plans', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  weekNumber: integer('week_number').notNull().default(1),
  sport: text('sport').notNull(),
  goalType: text('goal_type').notNull(),
  durationWeeks: integer('duration_weeks').notNull(),
  cautiousMode: boolean('cautious_mode').notNull().default(false),
  cautionReasons: jsonb('caution_reasons').$type<string[]>().notNull().default([]),
  safetyAlert: text('safety_alert').notNull().default(''),
  strategySummary: text('strategy_summary').notNull(),
  coachPrinciples: jsonb('coach_principles').$type<string[]>().notNull().default([]),
  scheduleJson: jsonb('schedule_json').$type<WorkoutDay[]>().notNull(),
  completedDays: jsonb('completed_days').$type<number[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  goal: one(userGoals, {
    fields: [users.id],
    references: [userGoals.userId],
  }),
  plans: many(workoutPlans),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const userGoalsRelations = relations(userGoals, ({ one }) => ({
  user: one(users, {
    fields: [userGoals.userId],
    references: [users.id],
  }),
}));

export const workoutPlansRelations = relations(workoutPlans, ({ one }) => ({
  user: one(users, {
    fields: [workoutPlans.userId],
    references: [users.id],
  }),
}));
