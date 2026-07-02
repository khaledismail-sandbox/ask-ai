/* Demo user/session state. Uses sessionStorage on purpose: every new tab/session
   gets a freshly randomized demo identity (country, acquisition source, etc.)
   so recorded Session Replays show varied, realistic user profiles. */
(function () {
  var KEY = 'askai_demo_state_v1';
  var cached = null;

  var COUNTRIES = ['Turkey', 'UAE', 'Germany', 'France'];
  var CAMPAIGNS = ['ww_evergreen', 'mena_q3', 'dach_launch', 'retargeting', 'aso_brand'];
  // Fallback first names for when identity is established without a typed name
  // (e.g. tapping Continue with Apple/Google on a blank field).
  var FALLBACK_NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Jamie'];
  var ACQUISITION_MAP = {
    'Organic':            { source: 'organic',          medium: 'organic' },
    'App Store Search':   { source: 'apple_search_ads',  medium: 'cpc' },
    'Instagram Ads':      { source: 'instagram',         medium: 'paid_social' },
    'TikTok Ads':         { source: 'tiktok',             medium: 'paid_social' },
    'Google Ads':         { source: 'google',             medium: 'cpc' },
    'Referral':           { source: 'referral',           medium: 'referral' }
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // User ID = <name>_<random 1–10000>. The name comes from the /signup (or /login)
  // screen; the suffix is a fresh integer generated once per session and persisted.
  function randSuffix() {
    return Math.floor(Math.random() * 10000) + 1; // 1–10000 inclusive
  }

  function sanitizeName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
  }

  function buildUserId(name) {
    var clean = sanitizeName(name);
    if (!clean) clean = pick(FALLBACK_NAMES);
    return clean + '_' + randSuffix();
  }

  function isoWeek(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
  }

  function createFresh() {
    var acquisitionSource = pick(Object.keys(ACQUISITION_MAP));
    var utm = ACQUISITION_MAP[acquisitionSource];
    return {
      userId: null, // finalized at /signup or /login from the typed name + random suffix
      platform: 'iOS',
      country: pick(COUNTRIES),
      app_version: '4.12.0',
      acquisition_source: acquisitionSource,
      utm_source: utm.source,
      utm_medium: utm.medium,
      utm_campaign: pick(CAMPAIGNS),
      cohort_week: isoWeek(new Date()),
      plan_tier: 'free_trial',
      identified: false,

      signedUp: false,
      isReturning: false,
      trialActive: false,
      justStartedTrial: false,
      subscribedAt: null,

      messageCount: 0,
      messages: [],

      sessionNumber: 0,
      sessionStart: null,
      deepestStep: 1
    };
  }

  function load() {
    if (cached) return cached;
    var raw = null;
    try { raw = sessionStorage.getItem(KEY); } catch (e) {}
    if (raw) {
      try {
        cached = JSON.parse(raw);
        return cached;
      } catch (e) { /* fall through to fresh */ }
    }
    cached = createFresh();
    save(cached);
    return cached;
  }

  function save(state) {
    cached = state;
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  window.State = {
    get: load,
    save: save,
    pick: pick,
    buildUserId: buildUserId
  };
})();
