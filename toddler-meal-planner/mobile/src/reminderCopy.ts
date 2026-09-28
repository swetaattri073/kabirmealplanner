/**
 * Cheeky, encouraging meal-reminder copy.
 * Title is what Android shows large in the collapsed shade; keep it short.
 */

export type ReminderCopy = {
  title: string;
  body: string;
};

const GENERIC_TITLES = [
  (name: string) => `Bowl check — did ${name} eat?`,
  (name: string) => `${name}'s tummy called. Log it!`,
  (name: string) => `Tiny spoon detective: where’s ${name}'s meal?`,
  (name: string) => `Psst… log ${name}'s bite before it vanishes`,
  (name: string) => `Growth mode: tap to log for ${name}`,
  (name: string) => `${name} vs plate — who won? Log it`,
  (name: string) => `LittleBowl wants the tea on ${name}'s meal`,
  (name: string) => `Quick! Capture ${name}'s meal moment`,
  (name: string) => `Hungry for data — log ${name}'s meal`,
  (name: string) => `${name}'s bowl is waiting for a log`,
];

const MEAL_TITLES: Record<string, Array<(name: string) => string>> = {
  breakfast: [
    (name: string) => `Rise & bite — log ${name}'s breakfast`,
    (name: string) => `Morning mission: ${name}'s breakfast log`,
    (name: string) => `Did ${name} conquer breakfast? Tell us`,
  ],
  mid_morning_snack: [
    (name: string) => `Snack spy alert: log ${name}'s nibble`,
    (name: string) => `Mid-morning munch for ${name}? Log it`,
    (name: string) => `${name}'s snack break needs a log`,
  ],
  lunch: [
    (name: string) => `Lunch o’clock — log ${name}'s plate`,
    (name: string) => `Noon bowl check for ${name}`,
    (name: string) => `${name}'s lunch: hero or drama? Log it`,
  ],
  evening_snack: [
    (name: string) => `Evening nibble for ${name}? Log away`,
    (name: string) => `Snack o’clock for ${name} — quick log`,
    (name: string) => `${name}'s afternoon fuel: tap to log`,
  ],
  dinner: [
    (name: string) => `Dinner curtain call — log ${name}`,
    (name: string) => `End the day strong: log ${name}'s dinner`,
    (name: string) => `${name}'s dinner drama — log the ending`,
  ],
};

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickReminderCopy(mealKey: string, mealLabel: string, toddlerName: string): ReminderCopy {
  const name = (toddlerName || '').trim() || 'your little one';
  const mealPool = MEAL_TITLES[mealKey] || [];
  const pool = [...mealPool, ...GENERIC_TITLES];
  const titleFn = pickOne(pool);
  const title = titleFn(name);
  const body = `${mealLabel} · Tap to log in LittleBowl`;
  return { title, body };
}
