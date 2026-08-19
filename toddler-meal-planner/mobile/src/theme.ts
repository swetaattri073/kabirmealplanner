/** Visual tokens aligned with the existing LittleBowl web app (style.css + brand). */
export const colors = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  secondary: '#f97316',
  secondaryLight: '#fb923c',
  accent: '#ec4899',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  info: '#3b82f6',
  brandGreen: '#6b8f3c',
  brandLittle: '#6b8f3c',
  brandBowl: '#e07a3d',
  bg: '#faf5ff',
  bgCard: '#ffffff',
  bgTertiary: '#f3e8ff',
  text: '#1e1b4b',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e9d5ff',
  white: '#ffffff',
  storyBg: '#0f1222',
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

export const HIDDEN_VEGGIES = [
  { key: 'spinach', label: 'Spinach', emoji: '🥬', default_g: 15 },
  { key: 'carrot', label: 'Carrot', emoji: '🥕', default_g: 15 },
  { key: 'beetroot', label: 'Beetroot', emoji: '🫒', default_g: 15 },
  { key: 'lauki', label: 'Lauki', emoji: '🥒', default_g: 15 },
  { key: 'pumpkin', label: 'Pumpkin', emoji: '🎃', default_g: 15 },
  { key: 'cauliflower', label: 'Cauliflower', emoji: '🥦', default_g: 15 },
  { key: 'methi', label: 'Methi', emoji: '🌿', default_g: 15 },
] as const;
