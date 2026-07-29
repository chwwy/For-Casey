// wheel-valence.js
// Scale: -2 (very negative) to +2 (very positive). These are a reasonable
// starting point based on typical word valence/intensity, not a clinically
// validated instrument — feel free to retune any individual number, it's
// just a flat lookup table, no logic depends on the exact values.

const LEAF_VALENCE = {
  // Happy branch
  "Aroused": 1.2, "Cheeky": 1.4, "Free": 1.6, "Joyful": 2.0,
  "Curious": 1.3, "Inquisitive": 1.2, "Successful": 1.8, "Confident": 1.7,
  "Respected": 1.6, "Valued": 1.7, "Courageous": 1.4, "Creative": 1.5,
  "Loving": 1.9, "Thankful": 1.8, "Sensitive": 0.8, "Intimate": 1.5,
  "Hopeful": 1.6, "Inspired": 1.8,

  // Surprised branch
  "Shocked": -0.8, "Dismayed": -1.0, "Disillusioned": -1.1, "Perplexed": -0.3,
  "Astonished": 0.9, "Awe": 1.5, "Eager": 1.4, "Energetic": 1.3,

  // Bad branch
  "Indifferent": -0.5, "Apathetic": -0.8, "Pressured": -1.0, "Rushed": -0.8,
  "Overwhelmed": -1.5, "Out of control": -1.6, "Sleepy": -0.3, "Unfocused": -0.5,

  // Fearful branch
  "Helpless": -1.7, "Frightened": -1.6, "Worried": -1.1, "Inadequate": -1.5,
  "Inferior": -1.4, "Worthless": -1.9, "Insignificant": -1.6, "Excluded": -1.6,
  "Persecuted": -1.8, "Nervous": -1.0, "Exposed": -1.2,

  // Angry branch
  "Betrayed": -1.8, "Resentful": -1.6, "Disrespected": -1.6, "Ridiculed": -1.7,
  "Indignant": -1.3, "Violated": -1.9, "Furious": -1.9, "Jealous": -1.3,
  "Provoked": -1.2, "Hostile": -1.6, "Infuriated": -1.9, "Annoyed": -1.0,
  "Withdrawn": -1.1, "Numb": -1.2, "Sceptical": -0.6, "Dismissive": -0.9,

  // Disgusted branch
  "Judgmental": -0.9, "Embarrassed": -1.1, "Appalled": -1.6, "Revolted": -1.7,
  "Nauseated": -1.5, "Detestable": -1.8, "Horrified": -1.8, "Hesitant": -0.5,

  // Sad branch
  "Isolated": -1.7, "Abandoned": -1.8, "Victimized": -1.7, "Fragile": -1.3,
  "Powerless": -1.7, "Grief": -1.9, "Ashamed": -1.6, "Remorseful": -1.3,
  "Empty": -1.7, "Disappointed": -1.2
};

// Fallback only — used if a log somehow has no specific_feeling saved
// (shouldn't normally happen since the 3-tier picker always ends on a leaf).
const CORE_VALENCE_FALLBACK = {
  Happy: 1.6, Surprised: 0.2, Bad: -0.9, Fearful: -1.5,
  Angry: -1.4, Disgusted: -1.3, Sad: -1.6
};

function valenceOf(log) {
  if (!log) return 0;
  if (LEAF_VALENCE[log.specific_feeling] !== undefined) {
    return LEAF_VALENCE[log.specific_feeling];
  }
  return CORE_VALENCE_FALLBACK[log.core_emotion] ?? 0;
}

module.exports = { LEAF_VALENCE, CORE_VALENCE_FALLBACK, valenceOf };
