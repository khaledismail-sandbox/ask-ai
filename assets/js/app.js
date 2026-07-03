/* App controller: owns navigation side-effects, ephemeral UI state, and all
   Amplitude event firing. Views are dumb renderers; every action funnels through here. */
(function () {
  var appEl = document.getElementById('app');
  var PROTECTED = ['/chat', '/trial', '/upgrade', '/upgrade-v2'];
  // Funnel order matches the generated data: App Opened → Signed Up →
  // Home Page Viewed (chat) → Trial Started (trial) → Plan Upgraded (upgrade).
  var DEEPEST_STEP_MAP = { '/': 1, '/signup': 2, '/login': 2, '/chat': 3, '/trial': 4, '/upgrade': 5, '/upgrade-v2': 5 };

  var currentRoute = '/';
  var ui = {
    slide: 0,
    settingsOpen: false,
    selectedTier: 'standard',
    typing: false,
    sending: false,
    wallToast: false,
    v2BannerDismissed: false
  };

  var appOpenedFired = false;
  var sessionEndedFiredForThisHide = false;

  // ---------- helpers ----------
  function isCapped(state) {
    if (state.isReturning) return false;
    if (state.plan_tier === 'standard' || state.plan_tier === 'premium') return false;
    // Free trial does NOT lift the cap: trial users still hit the 3-message wall,
    // which drives the friction story into /upgrade.
    return state.messageCount >= 3;
  }

  // A fresh signup must choose a plan (start the free trial) before chatting. This
  // keeps Home Page Viewed firing BEFORE Trial Started, matching the data funnel:
  // App Opened → Signed Up → Home Page Viewed → Trial Started → Plan Upgraded.
  function needsPlan(state) {
    if (state.isReturning) return false;
    if (state.trialActive) return false;
    if (state.plan_tier === 'standard' || state.plan_tier === 'premium') return false;
    return true;
  }

  function computeChatEntry(state) {
    if (state.justStartedTrial) {
      state.justStartedTrial = false;
      State.save(state);
      return 'post_trial';
    }
    return state.isReturning ? 'return' : 'post_signup';
  }

  function guardRoute(route, state) {
    if (PROTECTED.indexOf(route) !== -1 && !state.signedUp) {
      try { history.replaceState({ route: '/' }, '', Router.base + '/'); } catch (e) {}
      return '/';
    }
    return route;
  }

  // The treatment (/upgrade-v2) is a demo artifact meant to be opened cold by
  // pasting the URL in front of an audience. Rather than bouncing to onboarding,
  // provision a throwaway demo identity so it renders straight away. It's still
  // never linked or auto-routed from the app.
  function ensureDemoIdentity(state) {
    if (!state.userId) {
      state.userId = State.buildUserId('');
      Analytics.setUser(state.userId);
    }
    state.signedUp = true;
    State.save(state);
  }

  function updateDeepestStep(route, state) {
    var step = DEEPEST_STEP_MAP[route] || 1;
    state.deepestStep = Math.max(state.deepestStep, step);
    State.save(state);
  }

  function dispatchView(route, state, fireEvents) {
    switch (route) {
      case '/':
        Views.onboarding(appEl, ui);
        break;
      case '/signup':
        Views.signup(appEl);
        break;
      case '/login':
        Views.login(appEl);
        break;
      case '/chat':
        if (fireEvents) {
          Analytics.track('Home Page Viewed', { entry: computeChatEntry(state) });
        }
        Views.chat(appEl, state, ui, needsPlan(state));
        break;
      case '/trial':
        Views.trial(appEl, state);
        break;
      case '/upgrade':
        Views.upgrade(appEl, state, ui);
        break;
      case '/upgrade-v2':
        Views.chatV2(appEl, state, ui);
        break;
    }
  }

  // Entering a route (via navigation): resets ephemeral UI + fires route-entry events.
  function renderForNavigation(route) {
    var state = State.get();
    // Let the treatment URL open cold (pasted) without the signup gate — provision
    // a throwaway demo identity so /upgrade-v2 renders instead of bouncing to onboarding.
    if (route === '/upgrade-v2' && !state.signedUp) {
      ensureDemoIdentity(state);
    }
    var effective = guardRoute(route, state);
    updateDeepestStep(effective, state);
    currentRoute = effective;

    ui.wallToast = false;
    ui.typing = false;
    ui.sending = false;
    ui.settingsOpen = false;
    if (effective === '/') ui.slide = 0;
    if (effective === '/upgrade') ui.selectedTier = 'standard';
    if (effective === '/upgrade-v2') ui.v2BannerDismissed = false;

    dispatchView(effective, state, true);
  }

  // Re-rendering the current route after a state change (no route-entry events).
  function refreshView() {
    dispatchView(currentRoute, State.get(), false);
  }

  // ---------- message sending (shared by /chat and /upgrade-v2) ----------
  function sendMessage(route, text, forcedTopic) {
    text = (text || '').trim();
    if (!text) return;

    var state = State.get();
    var bypassCap = route === '/upgrade-v2';

    // On the chat home, a fresh signup can't chat until they start the trial —
    // route them to the plan choice instead of sending.
    if (route === '/chat' && needsPlan(state)) {
      App.navigate('/trial');
      return;
    }

    if (!bypassCap && isCapped(state)) {
      ui.wallToast = true;
      refreshView();
      setTimeout(function () {
        ui.wallToast = false;
        App.navigate('/upgrade');
      }, 900);
      return;
    }

    var topic = forcedTopic || ChatData.detectTopic(text);
    var messageLength = text.length;
    var tokensUsed = Math.max(1, Math.round(messageLength / 3) + Math.floor(Math.random() * 10));
    Analytics.track('Message Sent', { message_length: messageLength, topic: topic, tokens_used: tokensUsed });

    state.messages.push({ role: 'user', text: text });
    state.messageCount += 1;
    state.deepestStep = Math.max(state.deepestStep, 3);
    State.save(state);

    ui.sending = true;
    ui.typing = true;
    refreshView();

    var delay = 600 + Math.random() * 900;
    setTimeout(function () {
      var reply = ChatData.replyFor(topic);
      var model = Math.random() < 0.6 ? 'fast' : 'advanced';
      var tokensGenerated = Math.max(5, Math.round(reply.length / 3));
      Analytics.track('AI Response Received', {
        response_time_ms: Math.round(delay),
        tokens_generated: tokensGenerated,
        model: model
      });

      var s2 = State.get();
      s2.messages.push({ role: 'ai', text: reply });
      State.save(s2);

      ui.typing = false;
      ui.sending = false;
      if (currentRoute === route) refreshView();
    }, delay);
  }

  // ---------- session lifecycle ----------
  function fireAppOpened() {
    if (appOpenedFired) return;
    appOpenedFired = true;
    var s = State.get();
    s.sessionNumber = (s.sessionNumber || 0) + 1;
    s.sessionStart = Date.now();
    State.save(s);
    Analytics.track('App Opened', { session_number: s.sessionNumber, is_return: s.sessionNumber > 1 });
  }

  function fireSessionEnded() {
    var s = State.get();
    var duration = s.sessionStart ? Math.round((Date.now() - s.sessionStart) / 1000) : 0;
    var converted = s.plan_tier === 'standard' || s.plan_tier === 'premium';
    Analytics.track('Session Ended', { duration_s: duration, deepest_step: s.deepestStep, converted: converted });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (!sessionEndedFiredForThisHide) {
        sessionEndedFiredForThisHide = true;
        fireSessionEnded();
      }
    } else if (document.visibilityState === 'visible') {
      sessionEndedFiredForThisHide = false;
    }
  });
  window.addEventListener('beforeunload', function () {
    if (!sessionEndedFiredForThisHide) {
      sessionEndedFiredForThisHide = true;
      fireSessionEnded();
    }
  });

  // ---------- public actions (called from view onclick handlers) ----------
  window.App = {
    navigate: function (route) {
      Router.navigate(route);
    },

    onboardingNext: function () {
      if (ui.slide < Views.ONBOARDING_SLIDES.length - 1) {
        ui.slide += 1;
        Views.onboarding(appEl, ui);
      } else {
        App.navigate('/signup');
      }
    },
    onboardingGoTo: function (i) {
      ui.slide = i;
      Views.onboarding(appEl, ui);
    },

    signup: function (method) {
      var state = State.get();
      // Prefix comes from the typed name; Apple/Google on a blank field fall back
      // to a random friendly first name inside State.buildUserId.
      var nameInput = document.getElementById('signup-name');
      state.userId = State.buildUserId(nameInput ? nameInput.value : '');
      state.signedUp = true;
      state.isReturning = false;
      State.save(state);
      Analytics.setUser(state.userId);
      Analytics.track('Signed Up', { signup_method: method, is_referral: Math.random() < 0.15 });
      // Land on the chat home first (fires Home Page Viewed). Chatting itself is
      // gated until the user starts the trial — see needsPlan / the plan gate.
      App.navigate('/chat');
    },

    login: function () {
      var state = State.get();
      // Returning users need an ID too; derive the prefix from the local-part of
      // the email (before "@"), e.g. khaled@x.com -> khaled_5310.
      var emailInput = document.getElementById('login-email');
      var raw = emailInput ? emailInput.value : '';
      var at = raw.indexOf('@');
      var prefix = at !== -1 ? raw.slice(0, at) : raw;
      state.userId = State.buildUserId(prefix);
      state.signedUp = true;
      state.isReturning = true;
      State.save(state);
      Analytics.setUser(state.userId);
      App.navigate('/chat');
    },

    chatSuggestionTap: function (topic, label) {
      sendMessage(currentRoute, label, topic);
    },
    chatSendFromInput: function (route) {
      var input = document.getElementById('chat-input');
      if (!input) return;
      var text = input.value;
      input.value = '';
      sendMessage(route, text);
    },

    trialStart: function () {
      var state = State.get();
      state.trialActive = true;
      state.justStartedTrial = true;
      state.deepestStep = Math.max(state.deepestStep, 4);
      State.save(state);
      Analytics.track('Trial Started', { trial_length_days: 7 });
      App.navigate('/chat');
    },

    upgradeSelectTier: function (tier) {
      ui.selectedTier = tier;
      refreshView();
    },
    upgradeContinue: function () {
      var tier = ui.selectedTier || 'standard';
      var price = tier === 'premium' ? 12.99 : 6.99;
      var quantity = 1;
      Analytics.track('Plan Upgraded', {
        revenue: price * quantity,
        price: price,
        quantity: quantity,
        revenueType: 'subscription',
        productId: 'ask_ai_' + tier + '_weekly',
        tier: tier,
        billing_period: 'weekly'
      });
      Analytics.updatePlanTier(tier);
      var state = State.get();
      state.subscribedAt = Date.now();
      state.deepestStep = Math.max(state.deepestStep, 5);
      State.save(state);
      App.navigate('/chat');
    },
    upgradeCancel: function () {
      var state = State.get();
      var reasons = ['price', 'remind_me_later', 'interrupted_mid_chat', 'accidental_tap'];
      Analytics.track('Upgrade Abandoned', {
        surface: 'upgrade_form',
        reason: State.pick(reasons),
        messages_before_wall: state.messageCount
      });
      App.navigate('/chat');
    },

    upgradeV2Tap: function () {
      var tier = 'standard';
      var price = 6.99;
      Analytics.track('Plan Upgraded', {
        revenue: price,
        price: price,
        quantity: 1,
        revenueType: 'subscription',
        productId: 'ask_ai_' + tier + '_weekly',
        tier: tier,
        billing_period: 'weekly'
      });
      Analytics.updatePlanTier(tier);
      var state = State.get();
      state.subscribedAt = Date.now();
      state.deepestStep = Math.max(state.deepestStep, 5);
      State.save(state);
      ui.v2BannerDismissed = true;
      refreshView();
    },
    upgradeV2Dismiss: function () {
      ui.v2BannerDismissed = true;
      refreshView();
    },

    toggleSettingsMenu: function () {
      ui.settingsOpen = !ui.settingsOpen;
      refreshView();
    },
    cancelSubscription: function () {
      var state = State.get();
      var tier = state.plan_tier;
      var days = state.subscribedAt ? Math.max(1, Math.round((Date.now() - state.subscribedAt) / 86400000)) : 1;
      var reasons = ['too_expensive', 'not_using_it', 'found_alternative', 'temporary_break'];
      Analytics.track('Subscription Cancelled', { days_subscribed: days, tier: tier, reason: State.pick(reasons) });

      state.plan_tier = 'free_trial';
      state.trialActive = false;
      state.subscribedAt = null;
      State.save(state);
      Analytics.updatePlanTier('free_trial');

      ui.settingsOpen = false;
      refreshView();
    }
  };

  // ---------- bootstrap ----------
  Analytics.init();
  fireAppOpened();
  Router.onRoute(renderForNavigation);
  renderForNavigation(Router.current());
})();
