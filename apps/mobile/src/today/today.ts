import { exerciseLibrary } from '@workspace/domain/exercises';
import type { LifeState, PlannedMeal } from '@workspace/domain/life';
import { isPlannedMealDone, mealForToday } from '@workspace/domain/mealplan';
import { suggestOutfit } from '@workspace/domain/outfit-engine';
import { generateToday, type TodayWorkout } from '@workspace/domain/training/generate';

export type TodayView = {
  meal: { planned: PlannedMeal; done: boolean } | null;
  workout: { today: TodayWorkout; done: boolean } | null;
  outfit: { itemIds: string[]; names: string } | null;
  /** True for a new person: nothing planned yet (design A1). */
  empty: boolean;
};

const localDay = (d: Date) =>
  `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The three ready decisions of the day (design A2/A3), from the first app's engines. */
export function todayView(state: LifeState, now: Date = new Date()): TodayView {
  const day = localDay(now);
  const planned =
    mealForToday(state.plannedMeals, now) ?? state.plannedMeals.find((m) => m.date.startsWith(day)) ?? null;
  const meal = planned ? { planned, done: isPlannedMealDone(state.meals, planned) } : null;

  const sports = state.settings.trainingPlace !== 'none' && (state.settings.sessionsPerWeek ?? 0) > 0;
  const workout = sports
    ? {
        today: generateToday({
          equipment: state.settings.equipment,
          sessions: state.sessions,
          catalogue: exerciseLibrary,
          now: now.getTime(),
          ...(state.settings.minutes ? { minutes: state.settings.minutes } : {}),
        }),
        done: state.sessions.some((s) => s.date.startsWith(day)),
      }
    : null;

  let outfit: TodayView['outfit'] = null;
  if (state.wardrobe.length >= 2) {
    const suggestion = suggestOutfit({ wardrobe: state.wardrobe, outfits: state.outfits, date: day });
    if (suggestion.itemIds.length) {
      const names = suggestion.itemIds
        .map((id) => state.wardrobe.find((w) => w.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      outfit = { itemIds: suggestion.itemIds, names };
    }
  }
  return {
    meal,
    workout,
    outfit,
    empty: !meal && state.sessions.length === 0 && state.wardrobe.length === 0,
  };
}
