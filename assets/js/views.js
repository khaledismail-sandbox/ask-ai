/* Pure-ish view renderers: build HTML for each screen. Event handlers call back
   into window.App, which owns state mutation, navigation and Amplitude calls. */
(function () {
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nl2br(text) {
    return text.replace(/\n/g, '<br>');
  }

  var ONBOARDING_SLIDES = [
    { icon: '💬', title: 'Ask anything', subtitle: 'Get clear, fast answers to whatever is on your mind — no topic off limits.' },
    { icon: '📝', title: 'Write & summarise', subtitle: 'Draft emails, essays, and posts, or condense long articles in seconds.' },
    { icon: '🌍', title: 'Practice any language', subtitle: 'Translate, learn, and practice conversations in dozens of languages.' }
  ];

  function renderOnboarding(container, ui) {
    var slide = ui.slide || 0;
    var slidesHtml = ONBOARDING_SLIDES.map(function (s, i) {
      return '' +
        '<div class="onboarding-slide' + (i === slide ? ' active' : '') + '">' +
          '<div class="onboarding-icon">' + s.icon + '</div>' +
          '<h1 class="onboarding-title">' + s.title + '</h1>' +
          '<p class="onboarding-subtitle">' + s.subtitle + '</p>' +
        '</div>';
    }).join('');

    var dotsHtml = ONBOARDING_SLIDES.map(function (_, i) {
      return '<div class="dot' + (i === slide ? ' active' : '') + '" onclick="App.onboardingGoTo(' + i + ')"></div>';
    }).join('');

    var isLast = slide === ONBOARDING_SLIDES.length - 1;

    container.innerHTML =
      '<div class="screen">' +
        '<div class="onboarding-slides">' + slidesHtml + '</div>' +
        '<div class="onboarding-footer">' +
          '<div class="dots">' + dotsHtml + '</div>' +
          '<button class="btn btn-primary" onclick="App.onboardingNext()">' + (isLast ? 'Get Started' : 'Next') + '</button>' +
        '</div>' +
      '</div>';
  }

  function renderSignup(container) {
    container.innerHTML =
      '<div class="screen">' +
        '<div class="auth-header">' +
          '<div class="logo-mark" style="margin:0 auto;">✨</div>' +
          '<h1 class="auth-title">Create your account</h1>' +
          '<p class="auth-subtitle">Save your chats and unlock the full experience.</p>' +
        '</div>' +
        '<div class="auth-body">' +
          '<input class="text-input" id="signup-name" type="text" placeholder="Your name">' +
          '<button class="btn btn-primary" onclick="App.signup(\'email\')">Continue</button>' +
          '<div class="divider">or</div>' +
          '<button class="btn btn-secondary" onclick="App.signup(\'apple\')">🍎&nbsp; Continue with Apple</button>' +
          '<button class="btn btn-secondary" onclick="App.signup(\'google\')">🔎&nbsp; Continue with Google</button>' +
        '</div>' +
        '<div class="auth-footer">Already have an account? <a class="link-inline" onclick="App.navigate(\'/login\')">Log in</a></div>' +
      '</div>';
  }

  function renderLogin(container) {
    container.innerHTML =
      '<div class="screen">' +
        '<div class="auth-header">' +
          '<div class="logo-mark" style="margin:0 auto;">👋</div>' +
          '<h1 class="auth-title">Welcome back</h1>' +
          '<p class="auth-subtitle">Log in to pick up where you left off.</p>' +
        '</div>' +
        '<div class="auth-body">' +
          '<input class="text-input" id="login-email" type="email" placeholder="Email address">' +
          '<input class="text-input" id="login-password" type="password" placeholder="Password">' +
          '<button class="btn btn-primary" onclick="App.login()">Log in</button>' +
        '</div>' +
        '<div class="auth-footer">New here? <a class="link-inline" onclick="App.navigate(\'/signup\')">Create an account</a></div>' +
      '</div>';
  }

  function buildChatHeader(state, opts) {
    var showTrialPill = !state.trialActive && state.plan_tier === 'free_trial';
    var tierBadge = state.plan_tier !== 'free_trial'
      ? '<span class="badge-tier">' + (state.plan_tier === 'premium' ? '⭐ Premium' : '⚡ Standard') + '</span>'
      : (state.trialActive ? '<span class="badge-tier">🎁 Trial</span>' : '');

    return '' +
      '<div class="chat-header">' +
        '<div class="chat-header-left">' +
          '<div class="logo-mark">🤖</div>' +
          '<div>' +
            '<p class="chat-greeting-title">Hi there 👋</p>' +
            '<p class="chat-greeting-subtitle">What can I help you with?</p>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          tierBadge +
          (showTrialPill && !opts.hideTrialPill ? '<button class="chip-trial" onclick="App.navigate(\'/trial\')">✨ Try free</button>' : '') +
          '<button class="icon-btn" onclick="App.toggleSettingsMenu()">⚙️</button>' +
        '</div>' +
      '</div>' +
      (opts.settingsOpen ? buildSettingsMenu(state) : '');
  }

  function buildSettingsMenu(state) {
    var subscribed = state.plan_tier === 'standard' || state.plan_tier === 'premium';
    return '' +
      '<div class="settings-menu">' +
        (subscribed
          ? '<button class="danger" onclick="App.cancelSubscription()">Cancel subscription</button>'
          : '<button disabled style="color:#9a9aac;cursor:default;">No active subscription</button>') +
        '<div class="divider-line"></div>' +
        '<button onclick="App.toggleSettingsMenu()">Close</button>' +
      '</div>';
  }

  function buildSuggestions() {
    var chips = ChatData.SUGGESTIONS.map(function (s) {
      return '' +
        '<button class="suggestion-chip" onclick="App.chatSuggestionTap(\'' + s.topic + '\', \'' + s.label.replace(/'/g, "\\'") + '\')">' +
          '<span class="suggestion-emoji">' + s.emoji + '</span>' +
          '<span>' + s.label + '</span>' +
        '</button>';
    }).join('');

    return '' +
      '<div class="suggestions-wrap">' +
        '<p class="suggestions-heading">Try asking</p>' +
        '<div class="suggestion-grid">' + chips + '</div>' +
      '</div>';
  }

  function buildThread(state, ui) {
    var rows = state.messages.map(function (m) {
      var cls = m.role === 'user' ? 'user' : 'ai';
      return '' +
        '<div class="bubble-row ' + cls + '">' +
          '<div class="bubble ' + cls + '">' + nl2br(escapeHtml(m.text)) + '</div>' +
        '</div>';
    }).join('');

    if (ui.typing) {
      rows += '' +
        '<div class="bubble-row ai">' +
          '<div class="bubble ai typing"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>' +
        '</div>';
    }

    return '<div class="thread" id="thread">' + rows + '</div>';
  }

  function buildInputBar(opts) {
    return '' +
      '<div class="input-bar">' +
        '<input class="text-input" id="chat-input" type="text" placeholder="Message Ask AI..." ' +
          'onkeydown="if(event.key===\'Enter\'){App.chatSendFromInput(\'' + opts.route + '\')}">' +
        '<button class="send-btn" id="send-btn" onclick="App.chatSendFromInput(\'' + opts.route + '\')" ' + (opts.sending ? 'disabled' : '') + '>➤</button>' +
      '</div>';
  }

  function renderChat(container, state, ui) {
    var showSuggestions = state.messages.length === 0;
    var html = '<div class="screen">' +
      buildChatHeader(state, { settingsOpen: ui.settingsOpen }) +
      '<div class="screen-scroll" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">' +
        (showSuggestions ? buildSuggestions() : '') +
        buildThread(state, ui) +
      '</div>' +
      (ui.wallToast ? '<div class="wall-toast">✋ You\'re out of free messages — redirecting you to upgrade…</div>' : '') +
      buildInputBar({ route: '/chat', sending: ui.sending }) +
      '</div>';
    container.innerHTML = html;
    scrollThreadToBottom();
  }

  function renderChatV2(container, state, ui) {
    var showSuggestions = state.messages.length === 0;
    var bannerHtml = ui.v2BannerDismissed ? '' : '' +
      '<div class="inline-upgrade-banner">' +
        '<div class="msg">Unlock unlimited messages<small>$6.99/wk · cancel anytime</small></div>' +
        '<button class="banner-btn" onclick="App.upgradeV2Tap()">Upgrade</button>' +
        '<button class="banner-dismiss" onclick="App.upgradeV2Dismiss()">✕</button>' +
      '</div>';

    var html = '<div class="screen">' +
      buildChatHeader(state, { settingsOpen: ui.settingsOpen, hideTrialPill: true }) +
      '<div class="screen-scroll" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">' +
        (showSuggestions ? buildSuggestions() : '') +
        buildThread(state, ui) +
      '</div>' +
      bannerHtml +
      buildInputBar({ route: '/upgrade-v2', sending: ui.sending }) +
      '</div>';
    container.innerHTML = html;
    scrollThreadToBottom();
  }

  function scrollThreadToBottom() {
    var t = document.getElementById('thread');
    if (t) t.scrollTop = t.scrollHeight;
  }

  function renderTrial(container, state) {
    container.innerHTML =
      '<div class="screen">' +
        '<div class="screen-scroll">' +
          '<div class="trial-hero">' +
            '<div class="logo-mark" style="margin:0 auto;">🎁</div>' +
            '<h1>Unlock Ask AI Premium</h1>' +
            '<p>Try everything free for 7 days, cancel anytime.</p>' +
          '</div>' +
          '<div class="bullet-list">' +
            '<div class="bullet-item"><span class="bullet-emoji">♾️</span><span>Unlimited messages, every day</span></div>' +
            '<div class="bullet-item"><span class="bullet-emoji">⚡</span><span>Priority access to our fastest, most advanced model</span></div>' +
            '<div class="bullet-item"><span class="bullet-emoji">🖼️</span><span>Ad-free, distraction-free chat</span></div>' +
            '<div class="bullet-item"><span class="bullet-emoji">💬</span><span>Priority support when you need help</span></div>' +
          '</div>' +
          '<div class="timeline-card">' +
            '<div class="timeline">' +
              '<div class="timeline-step"><div class="tdot"></div><div class="line"></div><div class="tlabel">Today</div><div class="tsub">Start free trial</div></div>' +
              '<div class="timeline-step"><div class="tdot"></div><div class="line"></div><div class="tlabel">Day 5</div><div class="tsub">Reminder sent</div></div>' +
              '<div class="timeline-step"><div class="tdot"></div><div class="tlabel">Day 7</div><div class="tsub">Trial ends, billing starts</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="price-row">Just <strong>$6.99</strong> / week after trial</div>' +
        '</div>' +
        '<div class="trial-footer">' +
          '<button class="btn btn-primary" onclick="App.trialStart()">Start Free Trial</button>' +
          '<p class="reassurance">🔒 No payment due now</p>' +
          '<div style="text-align:center;margin-top:10px;">' +
            '<a class="link-inline" style="color:#9a9aac;" onclick="App.navigate(\'/chat\')">Not now</a>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function renderUpgrade(container, state, ui) {
    var tier = ui.selectedTier || 'standard';
    var frozenChat = '<div class="screen">' +
      buildChatHeader(state, { settingsOpen: false }) +
      '<div class="screen-scroll" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">' +
        (state.messages.length === 0 ? buildSuggestions() : '') +
        buildThread(state, {}) +
      '</div>' +
      buildInputBar({ route: '/chat', sending: true }) +
      '</div>';

    var sheet = '' +
      '<div class="sheet-overlay">' +
        '<div class="sheet">' +
          '<h2 class="sheet-title">You\'re out of free messages</h2>' +
          '<p class="sheet-subtitle">Choose a plan to keep chatting with Ask AI</p>' +
          '<div class="plan-card' + (tier === 'standard' ? ' selected' : '') + '" onclick="App.upgradeSelectTier(\'standard\')">' +
            '<div class="plan-card-top">' +
              '<span><span class="plan-radio"></span><span class="plan-name">Standard</span></span>' +
              '<span class="plan-price">$6.99/wk</span>' +
            '</div>' +
            '<ul class="plan-features"><li>Unlimited messages</li><li>Faster responses</li></ul>' +
          '</div>' +
          '<div class="plan-card' + (tier === 'premium' ? ' selected' : '') + '" onclick="App.upgradeSelectTier(\'premium\')">' +
            '<div class="plan-card-top">' +
              '<span><span class="plan-radio"></span><span class="plan-name">Premium</span></span>' +
              '<span class="plan-price">$12.99/wk</span>' +
            '</div>' +
            '<ul class="plan-features"><li>Unlimited messages</li><li>Our most advanced model</li><li>Priority support</li></ul>' +
          '</div>' +
          '<div class="sheet-actions">' +
            '<button class="btn btn-primary" onclick="App.upgradeContinue()">Continue</button>' +
            '<button class="btn btn-ghost" onclick="App.upgradeCancel()">Cancel / Not now</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.innerHTML = frozenChat + sheet;
  }

  window.Views = {
    escapeHtml: escapeHtml,
    onboarding: renderOnboarding,
    signup: renderSignup,
    login: renderLogin,
    chat: renderChat,
    chatV2: renderChatV2,
    trial: renderTrial,
    upgrade: renderUpgrade,
    scrollThreadToBottom: scrollThreadToBottom,
    ONBOARDING_SLIDES: ONBOARDING_SLIDES
  };
})();
