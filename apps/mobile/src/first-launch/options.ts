import type { Allergy, Diet, Place } from '@workspace/domain/onboarding';
import type { MainGoal, Sex } from '@workspace/domain/targets';
import { tKey } from '@workspace/i18n';

/** Choices of the first-launch screens, in the design order, with their copy keys. */
export const GOALS: { value: MainGoal; label: string }[] = [
  { value: 'lose', label: tKey('onboarding.goal.lose') },
  { value: 'maintain', label: tKey('onboarding.goal.maintain') },
  { value: 'muscle', label: tKey('onboarding.goal.muscle') },
  { value: 'eatBetter', label: tKey('onboarding.goal.eatBetter') },
  { value: 'style', label: tKey('onboarding.goal.style') },
];
export const SEXES: { value: Sex; label: string }[] = [
  { value: 'female', label: tKey('onboarding.goal.female') },
  { value: 'male', label: tKey('onboarding.goal.male') },
  { value: 'other', label: tKey('onboarding.goal.other') },
];
export type DietChoice = 'all' | Extract<Diet, 'vegetarian' | 'vegan' | 'pescatarian' | 'halal'> | 'noPork';
export const DIET_CHOICES: { value: DietChoice; label: string }[] = [
  { value: 'all', label: tKey('onboarding.meals.dietAll') },
  { value: 'vegetarian', label: tKey('onboarding.meals.vegetarian') },
  { value: 'vegan', label: tKey('onboarding.meals.vegan') },
  { value: 'pescatarian', label: tKey('onboarding.meals.pescatarian') },
  { value: 'halal', label: tKey('onboarding.meals.halal') },
  { value: 'noPork', label: tKey('onboarding.meals.noPork') },
];
export const ALLERGY_CHOICES: { value: Allergy; label: string }[] = [
  { value: 'peanut', label: tKey('onboarding.meals.peanut') },
  { value: 'nuts', label: tKey('onboarding.meals.nuts') },
  { value: 'dairy', label: tKey('onboarding.meals.dairy') },
  { value: 'egg', label: tKey('onboarding.meals.egg') },
  { value: 'gluten', label: tKey('onboarding.meals.gluten') },
  { value: 'fish', label: tKey('onboarding.meals.fish') },
  { value: 'shellfish', label: tKey('onboarding.meals.shellfish') },
  { value: 'soy', label: tKey('onboarding.meals.soy') },
  { value: 'sesame', label: tKey('onboarding.meals.sesame') },
];
export const PLACES: { value: Place; label: string }[] = [
  { value: 'home', label: tKey('onboarding.sport.home') },
  { value: 'gym', label: tKey('onboarding.sport.gym') },
  { value: 'outside', label: tKey('onboarding.sport.outside') },
  { value: 'none', label: tKey('onboarding.sport.none') },
];
