const WHEEL = {
  "Happy": {
    "Playful": ["Aroused", "Cheeky"],
    "Content": ["Free", "Joyful"],
    "Interested": ["Curious", "Inquisitive"],
    "Proud": ["Successful", "Confident"],
    "Accepted": ["Respected", "Valued"],
    "Powerful": ["Courageous", "Creative"],
    "Peaceful": ["Loving", "Thankful"],
    "Trusting": ["Sensitive", "Intimate"],
    "Optimistic": ["Hopeful", "Inspired"]
  },
  "Surprised": {
    "Startled": ["Shocked", "Dismayed"],
    "Confused": ["Disillusioned", "Perplexed"],
    "Amazed": ["Astonished", "Awe"],
    "Excited": ["Eager", "Energetic"]
  },
  "Bad": {
    "Bored": ["Indifferent", "Apathetic"],
    "Busy": ["Pressured", "Rushed"],
    "Stressed": ["Overwhelmed", "Out of control"],
    "Tired": ["Sleepy", "Unfocused"]
  },
  "Fearful": {
    "Scared": ["Helpless", "Frightened"],
    "Anxious": ["Overwhelmed", "Worried"],
    "Insecure": ["Inadequate", "Inferior"],
    "Weak": ["Worthless", "Insignificant"],
    "Rejected": ["Excluded", "Persecuted"],
    "Threatened": ["Nervous", "Exposed"]
  },
  "Angry": {
    "Let down": ["Betrayed", "Resentful"],
    "Humiliated": ["Disrespected", "Ridiculed"],
    "Bitter": ["Indignant", "Violated"],
    "Mad": ["Furious", "Jealous"],
    "Aggressive": ["Provoked", "Hostile"],
    "Frustrated": ["Infuriated", "Annoyed"],
    "Distant": ["Withdrawn", "Numb"],
    "Critical": ["Sceptical", "Dismissive"]
  },
  "Disgusted": {
    "Disapproving": ["Judgmental", "Embarrassed"],
    "Disappointed": ["Appalled", "Revolted"],
    "Awful": ["Nauseated", "Detestable"],
    "Repelled": ["Horrified", "Hesitant"]
  },
  "Sad": {
    "Lonely": ["Isolated", "Abandoned"],
    "Vulnerable": ["Victimized", "Fragile"],
    "Despair": ["Powerless", "Grief"],
    "Guilty": ["Ashamed", "Remorseful"],
    "Depressed": ["Empty", "Inferior"],
    "Hurt": ["Embarrassed", "Disappointed"]
  }
};

const CORE_VALENCE = {
  Happy: 2,
  Surprised: 1,
  Bad: -1,
  Fearful: -2,
  Angry: -2,
  Disgusted: -1.5,
  Sad: -2
};

const CORE_EMOJIS = {
  Happy: '💛',
  Surprised: '🧡',
  Bad: '🤍',
  Fearful: '💜',
  Angry: '❤️',
  Disgusted: '💚',
  Sad: '💙'
};

module.exports = {
  WHEEL,
  CORE_VALENCE,
  CORE_EMOJIS
};
