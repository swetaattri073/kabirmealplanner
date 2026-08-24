/**
 * Visual tokens aligned with the existing LittleBowl web app (style.css + brand).
 *
 * Anything used as text or as a fill behind white text meets WCAG AA (4.5:1)
 * against all three app backgrounds. The vivid brand hues are kept for large
 * fills, icons and progress bars, where the 3:1 non-text threshold applies —
 * hence the separate *Text variants below.
 */
export const colors = {
  primary: '#4f46e5',
  primaryLight: '#818cf8',
  primaryDark: '#4338ca',
  secondary: '#c2410c',
  secondaryLight: '#fb923c',
  accent: '#ec4899',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#c81e1e',
  info: '#3b82f6',

  // Legible equivalents of the status hues, for use as text.
  successText: '#15803d',
  warningText: '#8a5300',

  // Vivid originals, for fills and charts only — never for text.
  successFill: '#22c55e',
  warningFill: '#eab308',
  dangerFill: '#ef4444',
  primaryFill: '#6366f1',
  secondaryFill: '#f97316',

  brandGreen: '#4d6b28',
  brandLittle: '#4d6b28',
  brandBowl: '#c2410c',
  bg: '#faf5ff',
  bgCard: '#ffffff',
  bgTertiary: '#f3e8ff',
  text: '#1e1b4b',
  textSecondary: '#4b5563',
  textMuted: '#5b6270',
  border: '#e9d5ff',
  white: '#ffffff',
  storyBg: '#0f1222',
};

/**
 * Minimums for users with reduced fine-motor control or low vision.
 * 48dp is the Material/Android touch target floor; WCAG 2.2 AA asks 24px and
 * AAA 44px, so 48 clears all three.
 */
export const a11y = {
  minTouchTarget: 48,
  minFontSize: 14,
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const MEAL_ORDER = [
  'breakfast',
  'mid_morning_snack',
  'lunch',
  'evening_snack',
  'dinner',
] as const;

export const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  mid_morning_snack: 'Mid-morning snack',
  lunch: 'Lunch',
  evening_snack: 'Evening snack',
  dinner: 'Dinner',
};

export const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🥣',
  mid_morning_snack: '🍌',
  lunch: '🍲',
  evening_snack: '🍎',
  dinner: '🥗',
};

export const DEFAULT_REMINDER_TIMES: Record<string, string> = {
  breakfast: '08:00',
  mid_morning_snack: '10:30',
  lunch: '12:30',
  evening_snack: '16:00',
  dinner: '19:00',
};

export const REACTIONS = [
  { id: 'loved', label: 'Loved', emoji: '😍' },
  { id: 'liked', label: 'Liked', emoji: '🙂' },
  { id: 'neutral', label: 'Neutral', emoji: '😐' },
  { id: 'disliked', label: 'Disliked', emoji: '😕' },
  { id: 'refused', label: 'Refused', emoji: '🙅' },
] as const;

export const NUTRIENTS = [
  { key: 'calories', name: 'Energy', unit: 'kcal', icon: '🔥' },
  { key: 'protein_g', name: 'Protein', unit: 'g', icon: '💪' },
  { key: 'fat_g', name: 'Fat', unit: 'g', icon: '🧈' },
  { key: 'carbs_g', name: 'Carbs', unit: 'g', icon: '🍚' },
  { key: 'fiber_g', name: 'Fiber', unit: 'g', icon: '🥬' },
  { key: 'calcium_mg', name: 'Calcium', unit: 'mg', icon: '🦴' },
  { key: 'iron_mg', name: 'Iron', unit: 'mg', icon: '🩸' },
  { key: 'zinc_mg', name: 'Zinc', unit: 'mg', icon: '⚡' },
  { key: 'vitamin_a_mcg', name: 'Vitamin A', unit: 'mcg', icon: '👁️' },
  { key: 'vitamin_c_mg', name: 'Vitamin C', unit: 'mg', icon: '🍊' },
  { key: 'vitamin_d_mcg', name: 'Vitamin D', unit: 'mcg', icon: '☀️' },
  { key: 'vitamin_b12_mcg', name: 'Vitamin B12', unit: 'mcg', icon: '🔴' },
  { key: 'folate_mcg', name: 'Folate', unit: 'mcg', icon: '🧬' },
  { key: 'omega3_mg', name: 'Omega-3', unit: 'mg', icon: '🐟' },
] as const;

export const PRIORITY_NUTRIENTS = [
  'calories', 'protein_g', 'iron_mg', 'calcium_mg',
  'omega3_mg', 'vitamin_a_mcg', 'vitamin_c_mg', 'vitamin_d_mcg',
] as const;

/**
 * Maps a serving size in grams to a relatable household description.
 */
export function portionGuide(grams: number, category?: string): string {
  if (grams <= 0) return '';
  const cat = (category || '').toLowerCase();

  if (cat.includes('milk') || cat.includes('liquid') || cat.includes('juice')) {
    if (grams <= 60) return `${grams}ml (~${Math.round(grams / 15)} tbsp)`;
    if (grams <= 120) return `${grams}ml (~½ cup)`;
    return `${grams}ml (~1 small cup)`;
  }

  if (grams <= 15) return `${grams}g (~1 tbsp)`;
  if (grams <= 30) return `${grams}g (~2 tbsp / 1 small katori)`;
  if (grams <= 50) return `${grams}g (~3-4 tbsp / ½ small bowl)`;
  if (grams <= 75) return `${grams}g (~1 small bowl / ½ plate)`;
  if (grams <= 100) return `${grams}g (~1 bowl / 1 small plate)`;
  if (grams <= 150) return `${grams}g (~1 big bowl)`;
  return `${grams}g (~1 plate)`;
}

export function getServingForAge(food: { serving_size_6_12?: number; serving_size_12_24?: number; serving_size_24_36?: number }, ageMonths: number): number {
  if (ageMonths < 12) return food.serving_size_6_12 || 30;
  if (ageMonths < 24) return food.serving_size_12_24 || 50;
  return food.serving_size_24_36 || 75;
}

export const HIDDEN_VEGGIES = [
  { key: 'spinach', label: 'Spinach', emoji: '🥬', default_g: 15 },
  { key: 'carrot', label: 'Carrot', emoji: '🥕', default_g: 15 },
  { key: 'beetroot', label: 'Beetroot', emoji: '🫒', default_g: 15 },
  { key: 'lauki', label: 'Lauki', emoji: '🥒', default_g: 15 },
  { key: 'pumpkin', label: 'Pumpkin', emoji: '🎃', default_g: 15 },
  { key: 'cauliflower', label: 'Cauliflower', emoji: '🥦', default_g: 15 },
  { key: 'methi', label: 'Methi', emoji: '🌿', default_g: 15 },
] as const;
