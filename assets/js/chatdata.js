/* Canned suggestion chips + templated AI replies. No real model, no network calls. */
(function () {
  var SUGGESTIONS = [
    { label: 'Write a poem', emoji: '✍️', topic: 'writing' },
    { label: 'Plan a trip to Japan', emoji: '🗾', topic: 'travel' },
    { label: 'Explain quantum computing', emoji: '🔬', topic: 'study_help' },
    { label: 'Fix my code', emoji: '🐛', topic: 'coding' },
    { label: 'Translate this', emoji: '🌐', topic: 'translation' },
    { label: 'Dad jokes', emoji: '😄', topic: 'general' }
  ];

  var TOPIC_KEYWORDS = {
    translation: ['translate', 'translation', 'spanish', 'french', 'german', 'turkish', 'arabic'],
    coding: ['code', 'bug', 'error', 'function', 'javascript', 'python', 'fix my', 'debug', 'stack trace'],
    recipes: ['recipe', 'cook', 'dinner', 'bake', 'ingredient', 'dish'],
    travel: ['trip', 'travel', 'flight', 'itinerary', 'japan', 'vacation', 'visit'],
    writing: ['poem', 'essay', 'write', 'story', 'letter', 'caption'],
    study_help: ['explain', 'what is', 'how does', 'quantum', 'study', 'homework', 'define']
  };

  var REPLIES = {
    writing: [
      "Here's a first draft — short, warm, and easy to riff on:\n\n\"Morning light through half-closed blinds,\nquiet thoughts, unhurried minds —\na page still blank, a pen in hand,\nwaiting for wherever words will land.\"\n\nWant it longer, funnier, or in a different style?",
      "Sure! Give me a tone (playful, formal, heartfelt) and a length, and I'll tailor the next draft to match.",
      "Here's a punchy opening line for you: \"Some stories start with once upon a time — this one starts with a really bad decision.\" Want me to keep going?"
    ],
    travel: [
      "For a 5-day Japan trip I'd suggest: Day 1-2 Tokyo (Shibuya, Asakusa, teamLab), Day 3 bullet train to Kyoto (Fushimi Inari, Arashiyama), Day 4 Kyoto/Nara day trip, Day 5 Osaka street food before flying out. Want a budget breakdown too?",
      "Best time to visit is late March–April (cherry blossoms) or October–November (autumn colors). I can build a day-by-day itinerary if you tell me your trip length and budget.",
      "A 7-day JR Pass usually pays for itself if you're doing Tokyo → Kyoto → Osaka. Want me to map out the train legs?"
    ],
    study_help: [
      "Quantum computing uses qubits, which — unlike regular bits — can be in a mix of 0 and 1 at once (superposition), and can be linked together (entanglement). That lets certain problems be explored in parallel in ways classical bits can't. Want an analogy or a deeper dive into a specific part?",
      "Think of a classical bit as a coin lying flat (heads or tails). A qubit is more like a spinning coin — it's a blend of both until you measure it. Want me to explain how that helps with actual computation?",
      "Good question — what's the context? A quick intuition-level explanation, or something closer to exam-prep detail?"
    ],
    coding: [
      "Can you paste the error message or the function? A common culprit is an off-by-one index or an unhandled async rejection — I can spot it faster with the actual snippet.",
      "Try wrapping the call in a try/catch and logging the input right before it fails — that usually narrows it down in one pass. Paste what you find and I'll take a look.",
      "That looks like it could be a scope issue — a variable declared inside a block but referenced outside it. Share the snippet and I'll pinpoint the line."
    ],
    translation: [
      "Happy to help — paste the text and tell me the target language and I'll translate it, keeping the tone as close to the original as I can.",
      "Sure thing. Formal or casual tone? That changes the phrasing quite a bit in most languages.",
      "Got it — drop the text in and I'll give you the translation plus a quick note on any idioms that don't carry over directly."
    ],
    recipes: [
      "Here's a quick one: garlic butter pasta — boil pasta, sauté 4 cloves garlic in butter + olive oil, toss with pasta, a splash of pasta water, parmesan, and cracked pepper. 20 minutes, minimal cleanup. Want a variation with protein?",
      "If you tell me what's in your fridge, I can suggest something that uses it up before it goes bad.",
      "For a weeknight dinner I'd go with a sheet-pan recipe — one pan, ~30 minutes, easy cleanup. Want chicken, tofu, or fish?"
    ],
    general: [
      "Why don't scientists trust atoms? Because they make up everything. 😄 Want another one, or something less punny?",
      "Happy to help with that — can you give me a bit more detail on what you're going for?",
      "Got it. Tell me a little more about the context and I'll tailor my answer."
    ]
  };

  function detectTopic(text) {
    var lower = text.toLowerCase();
    var topics = Object.keys(TOPIC_KEYWORDS);
    for (var i = 0; i < topics.length; i++) {
      var keywords = TOPIC_KEYWORDS[topics[i]];
      for (var j = 0; j < keywords.length; j++) {
        if (lower.indexOf(keywords[j]) !== -1) return topics[i];
      }
    }
    return 'general';
  }

  function replyFor(topic) {
    var pool = REPLIES[topic] || REPLIES.general;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  window.ChatData = {
    SUGGESTIONS: SUGGESTIONS,
    detectTopic: detectTopic,
    replyFor: replyFor
  };
})();
