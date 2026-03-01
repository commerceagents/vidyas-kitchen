/**
 * Funny "Tanglish" Nudge Templates for Vidya's Kitchen.
 * Inspired by Swiggy/Zomato/Pasikalaya marketing tone.
 */

export const NUDGES = {
  sunday: [
    "Sunday na Mutton Chukka illamaya? 🍖 The kitchen is smelling semma delicious right now. Order pannreengala?",
    "Happy Sunday! 🌞 Vidya auntie has a special Keema Curry today. Limited slots only—apo vaanga!",
    "Weekend treat loading... 🍱 My spicy pepper chicken is ready to make your Sunday semma special. Want to see?"
  ],
  pasi: [
    "Pasi kalaya? 😋 It's 1 PM and your stomach is asking for Sambar Rice. Don't keep it waiting!",
    "Hungry ah? 🥘 I just finished a fresh batch of Idiyappam. It's semma soft and waiting for you!",
    "Your neighborhood auntie is here with the best lunch. 👩‍🍳 Tap below and let's eat!"
  ],
  festive: [
    "Festival vibes? 🪔 Celebrate with our special meal plan. Semma taste, guaranteed!",
    "Special day, special food. ✨ Vidya's Kitchen is open for orders. Apo vaanga!"
  ]
};

export function getRandomNudge(type: keyof typeof NUDGES): string {
  const templates = NUDGES[type];
  return templates[Math.floor(Math.random() * templates.length)];
}
