import { exerciseLibrary } from '@workspace/domain/exercises';
import { EQUIPMENT_FOR } from '@workspace/domain/onboarding';
import { generateToday, type Split } from '@workspace/domain/training/generate';
import type { TrainingSettings } from '@workspace/domain/training/types';
import { tKey } from '@workspace/i18n';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLife } from '../data/LifeProvider';

export const SPLIT_KEY: Record<Split, ReturnType<typeof tKey>> = {
  push: tKey('sport.split.push'),
  pull: tKey('sport.split.pull'),
  legs: tKey('sport.split.legs'),
  full: tKey('sport.split.full'),
  fresh: tKey('sport.split.fresh'),
};

/** Today's generated session for the person's equipment and history. `variant` asks for another one. */
export function useTodayWorkout(variant: number, minutes?: number) {
  const { t } = useTranslation();
  const { state } = useLife();
  const s = state.settings;
  const settings: TrainingSettings = useMemo(
    () => ({
      goal: s.goal ?? (s.mainGoal === 'muscle' ? 'muscle' : 'general'),
      ...(s.repRange ? { repRange: s.repRange } : {}),
      ...(s.barKg !== undefined ? { barKg: s.barKg } : {}),
      ...(s.plates ? { plates: s.plates } : {}),
      ...(s.minutes ? { minutes: s.minutes } : {}),
    }),
    [s.goal, s.mainGoal, s.repRange, s.barKg, s.plates, s.minutes],
  );
  // A string key: the array is rebuilt on every save, its content is what matters.
  const equipmentKey = (s.equipment.length ? s.equipment : EQUIPMENT_FOR[s.trainingPlace ?? 'home']).join(
    ',',
  );
  const workout = useMemo(
    () =>
      generateToday({
        equipment: equipmentKey.split(','),
        sessions: state.sessions,
        settings,
        catalogue: exerciseLibrary,
        variant,
        ...(minutes ? { minutes } : {}),
        names: {
          push: t(SPLIT_KEY.push),
          pull: t(SPLIT_KEY.pull),
          legs: t(SPLIT_KEY.legs),
          full: t(SPLIT_KEY.full),
          fresh: t(SPLIT_KEY.fresh),
        },
      }),
    [equipmentKey, state.sessions, settings, variant, minutes, t],
  );
  return { workout, settings };
}
