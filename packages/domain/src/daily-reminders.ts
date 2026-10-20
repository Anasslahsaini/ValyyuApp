/**
 * Local daily reminders, pure planning part (no native module here, so it is testable).
 * Rules: at most ONE notification per weekday. A session reminder on the planned training days
 * (18:00), "your outfit is ready" every morning (07:30). On a training day with both turned on,
 * they become one morning message.
 */

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ReminderKind = 'session' | 'outfit' | 'both';
export type Reminder = { weekday: IsoWeekday; hour: number; minute: number; kind: ReminderKind };
export type ReminderTime = { hour: number; minute: number };

export const SESSION_TIME: ReminderTime = { hour: 18, minute: 0 };
export const OUTFIT_TIME: ReminderTime = { hour: 7, minute: 30 };

/** Training days spread over the week (rest days in between where possible). */
const SPREAD: Record<number, IsoWeekday[]> = {
  1: [3],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

export function trainingDays(sessionsPerWeek: number | undefined): IsoWeekday[] {
  const n = Math.max(0, Math.min(7, Math.round(sessionsPerWeek ?? 0)));
  return SPREAD[n] ? [...SPREAD[n]] : [];
}

export type ReminderSettings = {
  sessions: boolean;
  outfit: boolean;
  /** From the first-launch answers; `trainingPlace: 'none'` means no session reminders. */
  sessionsPerWeek?: number;
  trainingPlace?: 'home' | 'gym' | 'none';
  sessionTime?: ReminderTime;
  outfitTime?: ReminderTime;
};

export function planReminders(s: ReminderSettings): Reminder[] {
  const st = s.sessionTime ?? SESSION_TIME;
  const ot = s.outfitTime ?? OUTFIT_TIME;
  const train = new Set(s.sessions && s.trainingPlace !== 'none' ? trainingDays(s.sessionsPerWeek ?? 3) : []);
  const out: Reminder[] = [];
  for (let d = 1; d <= 7; d++) {
    const weekday = d as IsoWeekday;
    const session = train.has(weekday);
    if (session && s.outfit) out.push({ weekday, ...ot, kind: 'both' });
    else if (session) out.push({ weekday, ...st, kind: 'session' });
    else if (s.outfit) out.push({ weekday, ...ot, kind: 'outfit' });
  }
  return out;
}

/** expo-notifications weekly triggers count 1 = Sunday … 7 = Saturday. */
export const expoWeekday = (iso: IsoWeekday): number => (iso % 7) + 1;

/** Stable key: reschedule only when something that changes the plan or its text changes. */
export const reminderKey = (plan: readonly Reminder[], lang: string) =>
  `${lang}|${plan.map((r) => `${r.weekday}${r.kind[0]}${r.hour}:${r.minute}`).join(',')}`;
