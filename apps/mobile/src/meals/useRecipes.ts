import { catalogueToPlanRecipes, fromUserRecipes } from '@workspace/domain/mealplan';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLife } from '../data/LifeProvider';
import { useCatalogue } from './useCatalogue';

/** Catalogue + the person's own recipes as planner recipes (names in the app language), with a lookup by id. */
export function useRecipes() {
  const { i18n } = useTranslation();
  const { state } = useLife();
  const catalogue = useCatalogue();
  const all = useMemo(
    () =>
      catalogue.data
        ? [...catalogueToPlanRecipes(catalogue.data, i18n.language), ...fromUserRecipes(state.recipes)]
        : [],
    [catalogue.data, i18n.language, state.recipes],
  );
  const byId = useMemo(() => new Map(all.map((r) => [r.id, r])), [all]);
  return { ...catalogue, all, byId };
}
