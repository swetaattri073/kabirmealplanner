export type User = {
  id: number;
  email: string;
  name?: string | null;
  subscription_tier?: string;
  is_premium?: boolean;
  toddler_count?: number;
};

export type Toddler = {
  id: number;
  ref: string;
  name: string;
  age_months: number;
  birth_date?: string | null;
  gender?: string;
  weight_kg?: number | null;
  height_cm?: number | null;
  allergies?: string[];
  dietary_preference?: string;
  activity_level?: string;
  health_conditions?: string[];
  meal_schedule?: {
    meals: string[];
    snacks: string[];
  };
};

export type Food = {
  id: number;
  name: string;
  name_hindi?: string;
  category?: string;
  calories?: number;
  protein_g?: number;
  iron_mg?: number;
  calcium_mg?: number;
  allergens?: string[];
  serving_size_6_12?: number;
  serving_size_12_24?: number;
  serving_size_24_36?: number;
};

export type MealLog = {
  id: number;
  toddler_id: number;
  food_id?: number | null;
  food?: Food | null;
  custom_food_name?: string | null;
  date: string;
  meal_type: string;
  portion_eaten_percent?: number;
  toddler_reaction?: string | null;
  notes?: string | null;
  photo_path?: string | null;
};

export type DashboardData = {
  toddler: Toddler;
  today: string;
  schedule: { meals: string[]; snacks: string[] };
  meals_eaten: string[];
  meals_remaining: string[];
  today_logs: MealLog[];
  today_plan?: {
    date: string;
    meals: Record<string, any>;
  } | null;
  nutrition: {
    nutrients?: Record<
      string,
      {
        name?: string;
        icon?: string;
        consumed?: number;
        target?: number;
        percent?: number;
        status?: string;
        unit?: string;
      }
    >;
    overall_percent?: number;
  };
  alerts: Array<{
    alert_type?: string;
    nutrient?: string;
    severity?: string;
    message?: string;
    recommendation?: string;
  }>;
  suggestions?: Record<string, Food[]>;
  logging_stats?: {
    total_meals_logged?: number;
    days_logged?: number;
    current_streak?: number;
    longest_streak?: number;
  };
};

export type Recipe = {
  id?: number;
  slug: string;
  name: string;
  category?: string;
  why?: string;
  cheese?: string;
  steps?: string;
  cover_url?: string | null;
  cover_image_path?: string | null;
  video_url?: string | null;
  hidden_veggies?: string | null;
  suitable_from_months?: number | null;
  calories?: number | null;
  protein_g?: number | null;
  iron_mg?: number | null;
  calcium_mg?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
};
