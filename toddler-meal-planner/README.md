# Toddler Meal Planner

A personalized meal planning application for Indian toddlers (6 months - 5 years). Track daily meals, get nutrition insights, and receive customized meal plans based on your child's preferences and nutritional needs.

## Features

### Core Features

- **Multi-toddler Support**: Track multiple children with individual profiles
- **Age-based Recommendations**: Meal schedules and RDA automatically adjusted for age
- **Indian Food Database**: 68+ pre-loaded Indian foods with complete nutritional data
- **Allergy Management**: Filter foods based on allergens (dairy, gluten, nuts, etc.)
- **Dietary Preferences**: Support for vegetarian, eggetarian, and non-vegetarian diets

### Daily Tracking

- **Meal Logging**: Quick logging of breakfast, lunch, dinner, and snacks
- **Portion Tracking**: Record how much was actually eaten (0-100%)
- **Reaction Recording**: Track if your toddler loved, liked, or refused foods
- **Custom Foods**: Add foods not in the database

### Nutrition Analysis

- **Real-time RDA Tracking**: See daily progress for calories, protein, iron, calcium, and vitamins
- **Weekly Summaries**: Comprehensive nutrition reports for the week
- **Deficiency Alerts**: Get warned when key nutrients (especially iron, B12, Vitamin D) are low
- **Food Recommendations**: Smart suggestions to fill nutrition gaps

### Meal Planning

- **Weekly Meal Plans**: Auto-generated plans based on:
  - Your toddler's food preferences (learns what they like!)
  - Current nutrition gaps
  - Variety (avoids repetition)
  - Age-appropriate foods
- **Adult Meal Adaptation**: Input what adults are eating, get toddler-friendly versions
- **Preference Learning**: The system learns from logged reactions and suggests preferred foods more often

## Installation

### Prerequisites

- Python 3.8+
- pip

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd toddler-meal-planner
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python3 app.py
```

4. Open your browser to `http://localhost:5000`

## Usage

### Getting Started

1. **Create a Profile**: Enter your toddler's name, age (in months), dietary preference, and any allergies
2. **Log Meals**: Start logging what your toddler eats daily
3. **Check Nutrition**: View the dashboard to see nutrition progress
4. **Get Recommendations**: Use weekly plans and suggestions

### Logging a Meal

1. Go to "Log Meal" from the sidebar
2. Select the meal type (breakfast, lunch, etc.)
3. Search and select a food from the database (or enter custom)
4. Record how much was eaten
5. Log the toddler's reaction (loved, liked, neutral, disliked, refused)

### Adult Meal Adaptation

If you're eating family meals together:
1. Go to "Log Meal"
2. Enter what the adults are eating (e.g., "Paneer Butter Masala with Naan")
3. Click "Get Toddler Version"
4. Get specific adaptations and tips for making it toddler-friendly

## Nutritional Guidelines

The app follows **ICMR-NIN (National Institute of Nutrition)** guidelines for Indian children:

### Key Nutrients Tracked

| Nutrient | 12-24 months | 24-36 months |
|----------|--------------|--------------|
| Calories | 1060 kcal | 1240 kcal |
| Protein | 12g | 15g |
| Iron | 9mg | 9mg |
| Calcium | 500mg | 600mg |
| Vitamin D | 10mcg | 10mcg |

### Special Focus for Indian Toddlers

- **Iron**: Vegetarian diets can be low in iron. The app highlights iron-rich foods like ragi, spinach, dates
- **Vitamin B12**: Critical for brain development, mainly in animal products. Vegetarian toddlers need dairy or supplements
- **Vitamin D**: Most Indian children are deficient. App reminds about sunlight exposure

## API Reference

### Toddlers
- `GET /api/toddlers` - List all toddlers
- `POST /api/toddlers` - Create new toddler
- `GET /api/toddlers/:id` - Get toddler details
- `PUT /api/toddlers/:id` - Update toddler
- `DELETE /api/toddlers/:id` - Delete toddler

### Foods
- `GET /api/foods` - List foods (filterable by category, age, search)
- `GET /api/foods/:id` - Get food details
- `GET /api/foods/categories` - List categories
- `GET /api/foods/allergens` - List allergens

### Meal Logs
- `GET /api/meal-logs` - List meal logs (filterable by toddler, date)
- `POST /api/meal-logs` - Log a meal
- `PUT /api/meal-logs/:id` - Update meal log
- `DELETE /api/meal-logs/:id` - Delete meal log

### Nutrition
- `GET /api/nutrition/daily/:toddler_id` - Daily nutrition status
- `GET /api/nutrition/weekly/:toddler_id` - Weekly nutrition summary
- `GET /api/nutrition/alerts/:toddler_id` - Nutrition alerts
- `GET /api/nutrition/rda/:age_months` - Get RDA for age

### Meal Planning
- `GET /api/meal-plan/weekly/:toddler_id` - Get/generate weekly plan
- `GET /api/meal-plan/daily/:toddler_id` - Get daily suggestions
- `POST /api/adapt-meal/:toddler_id` - Adapt adult meal for toddler

### Dashboard
- `GET /api/dashboard/:toddler_id` - All dashboard data in one call

## Technology Stack

- **Backend**: Python, Flask
- **Database**: SQLite with SQLAlchemy ORM
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Custom CSS with CSS variables

## Food Database

The app includes 68+ Indian foods with complete nutritional data:

- **Grains**: Rice, Roti, Paratha, Idli, Dosa, Upma, Poha, Khichdi, Ragi, Daliya, Oats
- **Dals**: Moong, Toor, Masoor, Chana, Rajma, Chole, Sambar
- **Vegetables**: Potato, Sweet Potato, Carrot, Spinach, Pumpkin, Peas, Beetroot, Beans
- **Fruits**: Banana, Apple, Mango, Papaya, Chikoo, Orange, Watermelon
- **Dairy**: Milk, Curd, Paneer, Cheese, Ghee, Buttermilk
- **Protein**: Eggs, Chicken, Fish
- **Combos**: Dal Rice, Palak Paneer, Aloo Paratha, Curd Rice, Uttapam, Besan Chilla

Each food includes:
- Complete macronutrients (calories, protein, carbs, fat, fiber)
- Micronutrients (calcium, iron, zinc, vitamins A, C, D, B12, folate)
- Age suitability
- Allergen information
- Toddler-friendly preparation tips
- Recommended serving sizes by age

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License
