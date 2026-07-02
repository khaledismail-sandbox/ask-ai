/* Amplitude instrumentation wrapper.
   - autocapture + defaultTracking are both explicitly off: every event is sent by name, on purpose.
   - Session Replay plugin runs at sampleRate 1 so live navigation is always recorded.
   - Sessions are managed manually (App Opened is the session-start signal) — we never
     rely on Amplitude's automatic session handling. */
(function () {
  var API_KEY = 'c33e459dca9f449c1f10ca882d594f47';
  var inited = false;

  function governedProps() {
    var s = State.get();
    return {
      platform: s.platform,
      country: s.country,
      app_version: s.app_version,
      acquisition_source: s.acquisition_source,
      cohort_week: s.cohort_week,
      plan_tier: s.plan_tier
    };
  }

  function buildIdentify(s) {
    var identify = new amplitude.Identify();
    identify.set('platform', s.platform);
    identify.set('country', s.country);
    identify.set('app_version', s.app_version);
    identify.set('acquisition_source', s.acquisition_source);
    identify.set('cohort_week', s.cohort_week);
    identify.set('plan_tier', s.plan_tier);
    identify.set('utm_source', s.utm_source);
    identify.set('utm_medium', s.utm_medium);
    identify.set('utm_campaign', s.utm_campaign);
    return identify;
  }

  function init() {
    if (inited) return;
    inited = true;

    var sessionReplayTracking = window.sessionReplay.plugin({ sampleRate: 1 });
    amplitude.add(sessionReplayTracking);

    amplitude.init(API_KEY, {
      autocapture: false,
      defaultTracking: false
    });

    var s = State.get();
    amplitude.setSessionId(Date.now());

    // No name-based user ID exists until the user signs up / logs in. Until then we
    // stay anonymous (Amplitude device ID). On a same-session refresh the saved
    // <name>_<suffix> ID is already present, so re-apply it. On a brand-new session
    // clear any identity Amplitude persisted from a previous run, so pre-signup
    // events aren't misattributed to an earlier demo user.
    if (s.userId) {
      amplitude.setUserId(s.userId);
    } else {
      amplitude.setUserId(undefined);
    }

    if (!s.identified) {
      amplitude.identify(buildIdentify(s));
      s.identified = true;
      State.save(s);
    }
  }

  // Called at signup/login once the <name>_<suffix> ID is known. Sets the user ID
  // and re-sends identify so the named user profile carries all nine properties.
  function setUser(userId) {
    amplitude.setUserId(userId);
    amplitude.identify(buildIdentify(State.get()));
  }

  function updatePlanTier(tier) {
    var s = State.get();
    s.plan_tier = tier;
    State.save(s);
    var identify = new amplitude.Identify();
    identify.set('plan_tier', tier);
    amplitude.identify(identify);
  }

  function track(name, props) {
    var merged = Object.assign({}, governedProps(), props || {});
    amplitude.track(name, merged);
  }

  window.Analytics = {
    init: init,
    track: track,
    setUser: setUser,
    updatePlanTier: updatePlanTier
  };
})();
