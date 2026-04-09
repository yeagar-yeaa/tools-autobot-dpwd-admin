;(() => {
  const PANEL_ID = "pendingPanelFull";
  const STYLE_ID = "pendingPanelFullStyle";
  const INSTANCE_KEY = "__pendingPanelFullInstance";
  const BANK_HELPERS_KEY = "__ppPendingBankHelpers";
  const WD_MODE_KEY = "__ppWithdrawMode_v1";
  const DEPO_AUTO_APPROVE_KEY = "__ppDepositAutoApprove_v1";
  const DEPO_AUTO_APPROVE_LIMIT_KEY = "__ppDepositAutoApproveLimit_v1";
  const DEPO_AUTO_APPROVE_TARGET_KEY = "__ppDepositAutoApproveTarget_v1";
  const DEPO_AUTO_APPROVE_LOCKS_KEY = "__ppDepositAutoApproveLocks_v1";
  const PANEL_APPROVE_CTX_KEY = "__ppGsApproveCtx";
  const PANEL_SHARED_KEY = "__ppPendingShared";
  const PANEL_RECENT_IDS = new Map();
  const AUTH_STORAGE_KEY = "__ppUiLoginGate_v1";
  const AUTH_USERNAME = "ADMIN";
  const AUTH_PASSWORD = "210514";

  function setApproveContextLocal(source, kind, id) {
    if (id == null || id === "") return null;
    const ctx = { source: String(source || ""), kind: String(kind || ""), id: String(id), ts: Date.now() };
    try { window[PANEL_APPROVE_CTX_KEY] = ctx; } catch (_) {}
    return ctx;
  }

  function clearApproveContextLocal() {
    try {
      delete window[PANEL_APPROVE_CTX_KEY];
    } catch (_) {
      try { window[PANEL_APPROVE_CTX_KEY] = null; } catch (_) {}
    }
  }

  function recentlyHandledLocal(key, holdMs = 15000) {
    const ts = PANEL_RECENT_IDS.get(key) || 0;
    if (Date.now() - ts < holdMs) return true;
    PANEL_RECENT_IDS.set(key, Date.now());
    for (const [k, v] of PANEL_RECENT_IDS.entries()) {
      if (Date.now() - v > Math.max(holdMs, 15000)) PANEL_RECENT_IDS.delete(k);
    }
    return false;
  }

  function extractApproveIdLocal(value, kind) {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (value && value.dataset && value.dataset.approveId) return String(value.dataset.approveId);
    const row = value && value.closest ? value.closest(`tr[id^="${kind === "withdraw" ? "withdrawPending-" : "depositPending-"}"]`) : null;
    if (row && row.id) return row.id.replace(kind === "withdraw" ? "withdrawPending-" : "depositPending-", "");
    const onclick = value && value.getAttribute ? String(value.getAttribute("onclick") || "") : "";
    const matched = onclick.match(kind === "withdraw" ? /approveWithdraw\((?:'|")?(\d+)/ : /approveDeposit\((?:'|")?(\d+)/);
    return matched ? String(matched[1]) : "";
  }


  function loadWithdrawMode() {
    try { return localStorage.getItem(WD_MODE_KEY) === "1"; } catch (_) { return false; }
  }

  function saveWithdrawMode(enabled) {
    const value = !!enabled;
    try { localStorage.setItem(WD_MODE_KEY, value ? "1" : "0"); } catch (_) {}
    return value;
  }

  function parsePositiveAmount(value, fallback = 0) {
    const cleaned = String(value == null ? "" : value).replace(/[^\d]/g, "");
    const parsed = parseInt(cleaned, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function loadDepositAutoApprove() {
    try { return localStorage.getItem(DEPO_AUTO_APPROVE_KEY) === "1"; } catch (_) { return false; }
  }

  function saveDepositAutoApprove(enabled) {
    const value = !!enabled;
    try { localStorage.setItem(DEPO_AUTO_APPROVE_KEY, value ? "1" : "0"); } catch (_) {}
    return value;
  }

  function loadDepositAutoApproveLimit() {
    try {
      const raw = localStorage.getItem(DEPO_AUTO_APPROVE_LIMIT_KEY);
      return parsePositiveAmount(raw, 20000) || 20000;
    } catch (_) {
      return 20000;
    }
  }

  function saveDepositAutoApproveLimit(value) {
    const parsed = parsePositiveAmount(value, 20000) || 20000;
    try { localStorage.setItem(DEPO_AUTO_APPROVE_LIMIT_KEY, String(parsed)); } catch (_) {}
    return parsed;
  }

function getDepositAutoApproveGroupMap() {
  return {
    BANK: ["BCA", "MANDIRI", "BNI", "BRI", "DANAMON", "ANTARBANK", "JENIUS", "BSI", "CIMB", "SEABANK"],
    EWALLET: ["DANA", "OVO", "GOPAY", "LINKAJA"],
    PULSA: ["TELKOMSEL", "AXIATA"]
  };
}

function getDepositAutoApproveKnownKeys() {
  return ["BCA", "MANDIRI", "BNI", "BRI", "DANAMON", "ANTARBANK", "TELKOMSEL", "AXIATA", "JENIUS", "DANA", "OVO", "GOPAY", "LINKAJA", "BSI", "CIMB", "SEABANK"];
}

function normalizeDepositAutoApproveLockKey(value) {
  return normalizeBankLabelKey(value);
}

function isValidDepositAutoApproveLockKey(value) {
  const key = String(value || "").trim();
  if (!key) return false;
  if (/^\d+$/.test(key)) return false;
  if (!/[A-Z]/.test(key)) return false;
  return true;
}

function normalizeDepositAutoApproveLocks(values, options = {}) {
  const source = Array.isArray(values) ? values : [values];
  const out = [];
  const seen = new Set();
  source.forEach((value) => {
    const key = normalizeDepositAutoApproveLockKey(value);
    if (!isValidDepositAutoApproveLockKey(key) || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  if (out.length) return out;
  if (options.fallbackAll) return getDepositAutoApproveKnownKeys().slice();
  return [];
}

function convertLegacyDepositAutoApproveTargetToLocks(value) {
  const normalized = String(value || "").toUpperCase().trim();
  const groups = getDepositAutoApproveGroupMap();
  if (groups[normalized]) return groups[normalized].slice();
  if (normalized && normalized !== "ALL") return normalizeDepositAutoApproveLocks([normalized], { fallbackAll: false });
  return [];
}

function loadDepositAutoApproveLocks() {
  try {
    const raw = localStorage.getItem(DEPO_AUTO_APPROVE_LOCKS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return normalizeDepositAutoApproveLocks(parsed, { fallbackAll: false });
      } catch (_) {
        return normalizeDepositAutoApproveLocks(String(raw).split(","), { fallbackAll: false });
      }
    }
    return normalizeDepositAutoApproveLocks(convertLegacyDepositAutoApproveTargetToLocks(localStorage.getItem(DEPO_AUTO_APPROVE_TARGET_KEY)), { fallbackAll: false });
  } catch (_) {
    return [];
  }
}

function saveDepositAutoApproveLocks(values) {
  const normalized = normalizeDepositAutoApproveLocks(values, { fallbackAll: false });
  try { localStorage.setItem(DEPO_AUTO_APPROVE_LOCKS_KEY, JSON.stringify(normalized)); } catch (_) {}
  return normalized;
}

function getDepositAutoApproveLockOptions() {
  const known = getDepositAutoApproveKnownKeys();
  const knownSet = new Set(known);
  const extras = dedupeBankOptions(getAvailableBanks("depo").map((item) => ({
    value: normalizeDepositAutoApproveLockKey(item.value || item.text),
    text: item.text || inferBankLabelFromValue(item.value)
  })))
    .map((item) => normalizeDepositAutoApproveLockKey(item.value || item.text))
    .filter((key) => isValidDepositAutoApproveLockKey(key) && !knownSet.has(key))
    .sort((a, b) => String(inferBankLabelFromValue(a)).localeCompare(String(inferBankLabelFromValue(b))));

  return [...known, ...extras]
    .filter((key) => isValidDepositAutoApproveLockKey(key))
    .map((key) => ({
      value: key,
      text: inferBankLabelFromValue(key)
    }));
}

function areAllDepositAutoApproveLocksSelected(selectedValues, options) {
  const selected = new Set(normalizeDepositAutoApproveLocks(selectedValues));
  const values = (Array.isArray(options) ? options : []).map((item) => String(item.value)).filter(Boolean);
  if (!values.length) return false;
  return values.every((value) => selected.has(value));
}

function getDepositAutoApproveLockButtonLabel(selectedValues, options) {
  const selected = normalizeDepositAutoApproveLocks(selectedValues);
  const available = Array.isArray(options) ? options : getDepositAutoApproveLockOptions();
  if (!selected.length) return "None";
  if (areAllDepositAutoApproveLocksSelected(selected, available)) return "Select all";
  const labels = available.filter((item) => selected.includes(item.value)).map((item) => item.text);
  if (!labels.length) return "Custom";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} selected`;
}

function getDepositAutoApproveGroupLabelForKey(value) {
  const key = normalizeDepositAutoApproveLockKey(value);
  const groups = getDepositAutoApproveGroupMap();
  if (groups.EWALLET.includes(key)) return "EWALLET";
  if (groups.PULSA.includes(key)) return "PULSA";
  return "BANK";
}

function normalizeBankLabelKey(value) {
    const upper = String(value || "").toUpperCase().replace(/\s+/g, " ").trim();
    if (!upper) return "";
    if (/SEA\s*BANK|SEABANK/.test(upper)) return "SEABANK";
    if (/SYARIAH INDONESIA|\bBSI\b/.test(upper)) return "BSI";
    if (/LINK\s*AJA|LINKAJA/.test(upper)) return "LINKAJA";
    if (/TELKOMSEL|\bTSEL\b/.test(upper)) return "TELKOMSEL";
    if (/AXIATA|\bXL\b/.test(upper)) return "AXIATA";
    if (/ANTAR\s*BANK|ANTARBANK/.test(upper)) return "ANTARBANK";
    if (/MANDIRI/.test(upper)) return "MANDIRI";
    if (/DANAMON/.test(upper)) return "DANAMON";
    if (/JENIUS/.test(upper)) return "JENIUS";
    if (/GOPAY/.test(upper)) return "GOPAY";
    if (/DANA/.test(upper)) return "DANA";
    if (/\bOVO\b/.test(upper)) return "OVO";
    if (/CIMB/.test(upper)) return "CIMB";
    if (/BCA/.test(upper)) return "BCA";
    if (/BNI/.test(upper)) return "BNI";
    if (/BRI/.test(upper)) return "BRI";
    return upper.replace(/[^A-Z0-9]/g, "");
  }

  function inferBankLabelFromValue(value) {
    const key = normalizeBankLabelKey(value);
    const map = {
      BCA: "BCA",
      MANDIRI: "Mandiri",
      BNI: "BNI",
      BRI: "BRI",
      BSI: "BSI",
      CIMB: "CIMB",
      SEABANK: "SeaBank",
      DANAMON: "Danamon",
      ANTARBANK: "AntarBank",
      JENIUS: "Jenius",
      DANA: "DANA",
      OVO: "OVO",
      GOPAY: "GOPAY",
      LINKAJA: "LinkAja",
      TELKOMSEL: "Telkomsel",
      AXIATA: "Axiata"
    };
    return map[key] || String(value || "").trim() || "Unknown";
  }

  function dedupeBankOptions(items) {
    const out = [];
    const seen = new Set();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const value = String(item && item.value != null ? item.value : "").trim();
      const text = String(item && item.text != null ? item.text : "").trim();
      if (!value) return;
      const key = `${value}::${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ value, text: text || inferBankLabelFromValue(value) });
    });
    return out;
  }

  function collectBanksFromNativeSelect(select) {
    if (!select || !select.options) return [];
    return dedupeBankOptions([...select.options].map((option) => ({
      value: option.value,
      text: (option.textContent || option.label || "").replace(/\s+/g, " ").trim()
    })));
  }

  function findNativeBankSelect(type) {
    const selectors = type === "depo"
      ? ["body > #bank-select-depo", "#contentDepoHeader #bank-select-depo", "#bank-select-depo"]
      : ["body > #bank-select", "#contentWDHeader #bank-select", "#bank-select"];
    for (const selector of selectors) {
      const found = [...document.querySelectorAll(selector)].find((el) => !el.closest(`#${PANEL_ID}`));
      if (found) return found;
    }
    return null;
  }

  function collectBanksFromNativeDom(type) {
    return collectBanksFromNativeSelect(findNativeBankSelect(type));
  }

  function ensureSharedBankHelpers() {
    if (!window[BANK_HELPERS_KEY]) {
      window[BANK_HELPERS_KEY] = {
        normalizeBankLabelKey,
        inferBankLabelFromValue,
        dedupeBankOptions,
        collectBanksFromNativeDom,
        getLabelByValue(type, value) {
          const match = collectBanksFromNativeDom(type).find((item) => String(item.value) === String(value));
          return match ? match.text : "";
        }
      };
    }
    window.__ppPendingBankHelpers = window[BANK_HELPERS_KEY];
    return window[BANK_HELPERS_KEY];
  }

  ensureSharedBankHelpers();

  const existingInstance = window[INSTANCE_KEY];
  if (existingInstance && typeof existingInstance.destroy === "function") {
    try { existingInstance.destroy("reinit"); } catch (error) { console.error(error); }
  } else {
    const existingPanel = document.getElementById(PANEL_ID);
    if (existingPanel) existingPanel.remove();
    const oldStyle = document.getElementById(STYLE_ID);
    if (oldStyle) oldStyle.remove();
  }

  const state = {
    minimized: false,
    activeTab: "depo",
    loading: { depo: false, wd: false },
    initialized: { depo: false, wd: false },
    refreshTimers: { depo: [], wd: [] },
    refreshRunId: { depo: 0, wd: 0 },
    loadToken: { depo: 0, wd: 0 },
    abortControllers: { depo: null, wd: null },
    pendingReload: { depo: false, wd: false },
    deferredParsed: { depo: null, wd: null },
    fingerprints: { depo: "", wd: "" },
    signatures: { depo: "", wd: "" },
    lastLoadedAt: { depo: 0, wd: 0 },
    autoSyncTimer: 0,
    deferredFlushTimer: 0,
    interactionLockUntil: 0,
    lastInteractionAt: 0,
    cleanupFns: [],
    destroyed: false,
    authUnlocked: false,
    mainBooted: false,
    menuCloseFns: { depo: null, wd: null, depoAutoApproveLock: null },
    drag: { active: false, startX: 0, startY: 0, left: 0, top: 0, pointerId: null },
    lastEscShortcutAt: 0,
    depo: {
      showAll: true,
      sortBy: "date",
      bankMode: "",
      autoApprove: loadDepositAutoApprove(),
      autoApproveLimit: loadDepositAutoApproveLimit(),
      autoApproveLocks: loadDepositAutoApproveLocks(),
      autoApproveBusy: false,
      autoApproveTimer: 0,
      autoApproveRunToken: 0,
      banks: [],
      availableBanks: [],
      hasBankSelection: false,
      responseHtml: "",
      bankCounts: {},
      total: 0
    },
    wd: {
      showAll: true,
      sortBy: "date",
      showWDLimit: "100",
      bankMode: "",
      queueMode: loadWithdrawMode(),
      banks: [],
      availableBanks: [],
      hasBankSelection: false,
      responseHtml: "",
      bankCounts: {},
      total: 0
    }
  };

  injectStyle();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.className = "is-auth-locked";
  panel.innerHTML = `
    <div class="pp-shell" id="ppMainShell">
      <div class="pp-header bg-primary">
        <div class="pp-headMain">
          <div class="pp-titleText">Dashboard Admin</div>
          <div class="pp-nav" id="ppTabs">
            <button type="button" class="pp-navItem pp-staticNav">Menu</button>
            <button type="button" class="pp-navItem pp-tabButton is-active" data-tab="depo">Deposit <span class="pp-badge pp-badgeGreen" id="ppDepoBadge">0</span></button>
            <button type="button" class="pp-navItem pp-tabButton" data-tab="wd">Withdraw <span class="pp-badge pp-badgeAmber" id="ppWdBadge">0</span></button>
          </div>
        </div>
        <div class="pp-toolbar">
          <button type="button" class="pp-toolBtn pp-minimizeBtn" id="ppMinimizeBtn" title="Hide content" aria-label="Hide content">
            <span class="pp-toolIcon pp-toolIconCollapse" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12L10 7L15 12" />
              </svg>
            </span>
            <span class="pp-toolIcon pp-toolIconExpand" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 8L10 13L15 8" />
              </svg>
            </span>
          </button>
          <button type="button" class="pp-toolBtn pp-closeBtn" id="ppCloseBtn" title="Close" aria-label="Close panel">
            <span class="pp-toolIcon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6L14 14" />
                <path d="M14 6L6 14" />
              </svg>
            </span>
          </button>
        </div>
      </div>
      <div class="pp-content" id="ppContent">
        <div class="pp-authRoot" id="ppAuthRoot">
          <div class="pp-authContainer">
            <div class="pp-authTitle">TOOLS DEPOSIT WITHDRAW</div>
            <div class="pp-authAlert alert alert-warning py-2 mb-3" role="alert" style="overflow:hidden;">
              <div class="pp-authMarquee" style="white-space:nowrap;">
                <div class="pp-authMarqueeTrack">
                  <span>Tools Autbot ini bertujuan mempermudah perkerjaan Customer Services. JANGAN TUKANG CLAIM PEMBUAT !!</span>
                  <span>Tools Autbot ini bertujuan mempermudah perkerjaan Customer Services. JANGAN TUKANG CLAIM PEMBUAT !!!</span>
                </div>
              </div>
            </div>
            <div class="panel panel-danger pp-authLoginPanel" style="max-width: 18rem;">
              <div class="panel-heading"><i class="glyphicon glyphicon-user me-1"></i> Login</div>
              <div class="panel-body">
                <form id="formLogin" novalidate>
                  <div id="notification" class="pp-authNotice"></div>
                  <div class="mb-1 pp-authField">
                    <label for="inputUsername" class="form-label">Username</label>
                    <input type="text" class="form-control" id="inputUsername" name="username" autocomplete="username" spellcheck="false">
                  </div>
                  <div class="mb-3 pp-authField">
                    <label for="inputPassword" class="form-label">Password</label>
                    <input type="password" class="form-control" id="inputPassword" name="password" autocomplete="current-password" spellcheck="false">
                  </div>
                  <div id="mverifikasiform" class="w-100 pp-authCaptchaWrap">
                    <span id="verifikasi" class="pp-authCaptchaBtn" role="button" tabindex="0" title="Refresh captcha" aria-label="Refresh captcha">
                      <img id="captcha" src="/m/capimg.php?2698" width="100%" height="36" style="border-radius: 5px;" alt="Captcha">
                    </span>
                    <div class="login-field mt-1 pp-authVerifyGroup">
                      <input type="text" class="form-control login-input-field" name="verifikasi" id="mverform" autocomplete="off" placeholder="Verifikasi" spellcheck="false" inputmode="text">
                    </div>
                  </div>
                  <button type="submit" class="btn btn-info w-100 mt-5 pp-authSubmit">Login</button>
                </form>
              </div>
            </div>
          </div>
        </div>
        <div class="pp-tabContent" id="ppDepoTab" style="display:none"></div>
        <div class="pp-tabContent" id="ppWdTab" style="display:none"></div>
      </div>
      <div class="pp-footer">© 2026 Admin. Allrights Reserved</div>
    </div>
  `;
  document.body.appendChild(panel);

  const refs = {
    panel,
    authRoot: panel.querySelector("#ppAuthRoot"),
    authForm: panel.querySelector("#formLogin"),
    authNotice: panel.querySelector("#notification"),
    authUsername: panel.querySelector("#inputUsername"),
    authPassword: panel.querySelector("#inputPassword"),
    authCaptcha: panel.querySelector("#mverform"),
    authCaptchaImg: panel.querySelector("#captcha"),
    authCaptchaBtn: panel.querySelector("#verifikasi"),
    mainShell: panel.querySelector("#ppMainShell"),
    header: panel.querySelector(".pp-header"),
    tabs: [...panel.querySelectorAll(".pp-tabButton[data-tab]")],
    depoTab: panel.querySelector("#ppDepoTab"),
    wdTab: panel.querySelector("#ppWdTab"),
    depoBadge: panel.querySelector("#ppDepoBadge"),
    wdBadge: panel.querySelector("#ppWdBadge"),
    minimizeBtn: panel.querySelector("#ppMinimizeBtn"),
    closeBtn: panel.querySelector("#ppCloseBtn")
  };

  function isPanelAlive() {
    return !state.destroyed && !!refs.panel && document.body.contains(refs.panel);
  }

  refs.closeBtn.addEventListener("click", destroyPanel);
  refs.minimizeBtn.addEventListener("click", toggleMinimize);
  refs.tabs.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  setupDrag();
  setupKeyboardShortcuts();
  window.addEventListener("resize", clampPanel, { passive: true });
  clampPanel();
  initAuthGate();


  function loadAuthSession() {
    try {
      const raw = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "{}");
      return {
        ok: !!raw.ok,
        username: String(raw.username || "").toUpperCase(),
        ts: Number(raw.ts || 0)
      };
    } catch (_) {
      return { ok: false, username: "", ts: 0 };
    }
  }

  function saveAuthSession() {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ok: true, username: AUTH_USERNAME, ts: Date.now() }));
    } catch (_) {}
  }

  function clearAuthSession() {
    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (_) {}
  }

  function isAuthSessionValid() {
    const session = loadAuthSession();
    return !!session.ok && session.username === AUTH_USERNAME;
  }

  function isAuthenticated() {
    return !!state.authUnlocked;
  }

  function buildLocalCaptchaUrl() {
    return `/m/capimg.php?${Date.now()}`;
  }

  function refreshAuthCaptcha(options = {}) {
    const nextSrc = buildLocalCaptchaUrl();
    state.authCaptchaCode = "";
    if (refs.authCaptchaImg) {
      refs.authCaptchaImg.dataset.retryCount = "0";
      refs.authCaptchaImg.src = nextSrc;
      refs.authCaptchaImg.dataset.refreshTs = String(Date.now());
    }
    if (options.clearInput !== false && refs.authCaptcha) refs.authCaptcha.value = "";
    return nextSrc;
  }

  function handleAuthCaptchaImageError() {
    const img = refs.authCaptchaImg;
    if (!img) return;
    const retryCount = parseInt(String(img.dataset.retryCount || "0"), 10) || 0;
    if (retryCount < 1) {
      img.dataset.retryCount = String(retryCount + 1);
      window.setTimeout(() => refreshAuthCaptcha({ clearInput: false }), 120);
      return;
    }
    setAuthNotice("Captcha lokal gagal dimuat.", "error");
  }


  function setAuthNotice(message, mode = "idle") {
    if (!refs.authNotice) return;
    const text = String(message || "").trim();
    refs.authNotice.className = `pp-authNotice${text ? ` is-${mode}` : ""}`;
    refs.authNotice.textContent = text;
    refs.authNotice.style.display = text ? "block" : "none";
  }

  function showAuthGate() {
    state.authUnlocked = false;
    refs.panel.classList.add("is-auth-locked");
    refs.authRoot.style.display = "block";
    refs.mainShell.style.display = "flex";
    refs.depoTab.style.display = "none";
    refs.wdTab.style.display = "none";
    setAuthNotice("", "idle");
    refreshAuthCaptcha();
    requestAnimationFrame(() => {
      try { refs.authUsername.focus(); } catch (_) {}
    });
  }

  function initMainPanel() {
    if (state.mainBooted) return;
    state.mainBooted = true;
    setupDrag();
    setupInteractionGuards();
    clampPanel();
    syncNativeMenu(state.activeTab);
    loadSection("depo", { initial: true });
    scheduleIdlePreload("wd");
    startAutoSync();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus, { passive: true });
  }

  function unlockPanel(options = {}) {
    if (options.persist !== false) saveAuthSession();
    state.authUnlocked = true;
    refs.panel.classList.remove("is-auth-locked");
    refs.authRoot.style.display = "none";
    refs.mainShell.style.display = "flex";
    refs.depoTab.style.display = state.activeTab === "depo" ? "block" : "none";
    refs.wdTab.style.display = state.activeTab === "wd" ? "block" : "none";
    refs.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === state.activeTab));
    setAuthNotice("", "idle");
    initMainPanel();
  }

  function handleAuthSubmit(event) {
    if (event) event.preventDefault();
    const username = String(refs.authUsername?.value || "").trim().toUpperCase();
    const password = String(refs.authPassword?.value || "");
    const captcha = String(refs.authCaptcha?.value || "").trim();

    if (username !== AUTH_USERNAME) {
      setAuthNotice("Username salah.", "error");
      refreshAuthCaptcha();
      try { refs.authUsername.focus(); refs.authUsername.select(); } catch (_) {}
      return false;
    }
    if (password !== AUTH_PASSWORD) {
      setAuthNotice("Password salah.", "error");
      refreshAuthCaptcha();
      if (refs.authPassword) refs.authPassword.value = "";
      try { refs.authPassword.focus(); } catch (_) {}
      return false;
    }
    if (!captcha) {
      setAuthNotice("Verifikasi captcha wajib diisi.", "error");
      refreshAuthCaptcha();
      try { refs.authCaptcha.focus(); } catch (_) {}
      return false;
    }

    setAuthNotice("Login berhasil.", "success");
    unlockPanel({ persist: true });
    return true;
  }

  function initAuthGate() {
    if (refs.authForm && !refs.authForm.__ppAuthBound) {
      refs.authForm.__ppAuthBound = true;
      refs.authForm.addEventListener("submit", handleAuthSubmit);
    }
    if (refs.authCaptchaBtn && !refs.authCaptchaBtn.__ppAuthBound) {
      refs.authCaptchaBtn.__ppAuthBound = true;
      refs.authCaptchaBtn.addEventListener("click", (event) => {
        event.preventDefault();
        refreshAuthCaptcha();
      });
      refs.authCaptchaBtn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          refreshAuthCaptcha();
        }
      });
    }
    if (refs.authCaptchaImg && !refs.authCaptchaImg.__ppAuthImgBound) {
      refs.authCaptchaImg.__ppAuthImgBound = true;
      refs.authCaptchaImg.addEventListener("error", handleAuthCaptchaImageError);
      refs.authCaptchaImg.addEventListener("load", () => {
        refs.authCaptchaImg.dataset.retryCount = "0";
      });
    }
    [refs.authUsername, refs.authPassword, refs.authCaptcha].forEach((input) => {
      if (!input || input.__ppAuthClearBound) return;
      input.__ppAuthClearBound = true;
      input.addEventListener("input", () => {
        if (refs.authNotice && refs.authNotice.textContent) setAuthNotice("", "idle");
      });
    });
    if (isAuthSessionValid()) {
      unlockPanel({ persist: false });
      return;
    }
    showAuthGate();
  }

  function injectStyle() {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        --pp-radius: 3px;
        --pp-radius-sm: 2px;
        position: fixed;
        top: 20px;
        right: 12px;
        width: min(1360px, calc(100vw - 24px));
        height: min(900px, calc(100vh - 40px));
        max-height: calc(100vh - 40px);
        background: #fff;
        border: 1px solid #c9d2dc;
        box-shadow: 0 20px 40px rgb(0 0 0 / 0.18);
        z-index: 2147483647;
        transition: height .18s ease;
        overflow: hidden;
        border-radius: var(--pp-radius);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #${PANEL_ID} .bg-primary {
        --bs-bg-opacity: 1;
        background-color: rgba(126, 34, 79, var(--bs-bg-opacity)) !important;
      }
      #${PANEL_ID}.is-auth-locked {
        overflow: hidden;
      }
      #${PANEL_ID}:not(.is-auth-locked) {
        transform: none;
      }
      #${PANEL_ID}.is-auth-locked .pp-nav {
        visibility: hidden;
        pointer-events: none;
      }

      #${PANEL_ID} .pp-authRoot {
        display: none;
        min-height: 100%;
        padding: 14px 16px 16px;
        background: #fff;
        overflow: auto;
      }
      #${PANEL_ID} .pp-footer {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 8px 10px;
        background: #fff;
        color: #111;
        font-size: 12px;
        line-height: 1.35;
        border-top: 0;
        text-align: center;
      }
      #${PANEL_ID}.is-auth-locked .pp-footer {
        background: #fff;
        color: #111;
        border-top: 0;
      }
      #${PANEL_ID}.is-auth-locked .pp-authRoot {
        display: block;
      }
      #${PANEL_ID} .pp-authContainer {
        width: 100%;
        min-height: 100%;
        padding-bottom: 2px;
      }
      #${PANEL_ID} .pp-authTitle {
        margin: 0 0 10px;
        font-size: 28px;
        line-height: 1.15;
        font-weight: 400;
        color: #1f2937;
        letter-spacing: 0;
      }
      #${PANEL_ID} .pp-authAlert {
        margin: 0 0 14px;
        border: 1px solid #faebcc;
        background: #fcf8e3;
        color: #8a6d3b;
        padding: 0;
        border-radius: 0;
        box-shadow: none;
        overflow: hidden;
      }
      #${PANEL_ID} .pp-authMarquee {
        position: relative;
        width: 100%;
        min-height: 34px;
        overflow: hidden;
        white-space: nowrap;
      }
      #${PANEL_ID} .pp-authMarqueeTrack {
        display: inline-flex;
        align-items: center;
        gap: 50px;
        padding: 7px 0;
        min-width: max-content;
        animation: ppAuthMarquee 30s linear infinite;
      }
      #${PANEL_ID} .pp-authMarqueeTrack span {
        font-size: 12px;
        line-height: 1.4;
      }
      #${PANEL_ID} .pp-authLoginPanel {
        width: min(100%, 290px);
        margin-top: 0;
        border: 1px solid #ebccd1;
        border-radius: 0;
        background: #fff;
        box-shadow: none;
      }
      #${PANEL_ID} .pp-authLoginPanel .panel-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 38px;
        padding: 10px 12px;
        background: #f2dede;
        color: #8a2332;
        font-size: 14px;
        font-weight: 700;
        border: 0;
        border-bottom: 1px solid #ebccd1;
        border-radius: 0;
      }
      #${PANEL_ID} .pp-authLoginPanel .panel-body {
        padding: 12px;
        background: #fff;
      }
      #${PANEL_ID} .pp-authField {
        display: block;
      }
      #${PANEL_ID} .pp-authField.mb-1 {
        margin-bottom: 10px !important;
      }
      #${PANEL_ID} .pp-authField.mb-3 {
        margin-bottom: 13px !important;
      }
      #${PANEL_ID} .pp-authField label,
      #${PANEL_ID} .pp-authField .form-label {
        display: block;
        margin: 0 0 6px;
        font-size: 12px;
        line-height: 1.35;
        font-weight: 400;
        color: #374151;
      }
      #${PANEL_ID} .pp-authField input,
      #${PANEL_ID} .pp-authField .form-control {
        width: 100%;
        height: 32px;
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 4px !important;
        outline: 0;
        font-size: 13px;
        color: #111827;
        background: #fff;
        box-shadow: none;
      }
      #${PANEL_ID} .pp-authField input:focus,
      #${PANEL_ID} .pp-authField .form-control:focus {
        border-color: #9aa7b7;
        box-shadow: inset 0 1px 1px rgb(0 0 0 / 0.06), 0 0 5px rgb(102 175 233 / 0.32);
      }
      #${PANEL_ID} .pp-authCaptchaWrap {
        margin: 0 0 12px;
      }
      #${PANEL_ID} .pp-authCaptchaBtn {
        display: block;
        width: 100%;
        min-height: 36px;
        height: 36px;
        padding: 0;
        margin: 0;
        border: 0;
        border-radius: 5px !important;
        background: transparent;
        cursor: pointer;
        box-shadow: none;
        overflow: hidden;
      }
      #${PANEL_ID} .pp-authCaptchaBtn:hover {
        filter: brightness(.98);
      }
      #${PANEL_ID} .pp-authCaptchaBtn:focus {
        outline: 0;
        box-shadow: 0 0 0 2px rgb(102 175 233 / 0.24);
      }
      #${PANEL_ID} .pp-authCaptchaBtn img {
        display: block;
        width: 100%;
        height: 36px;
        object-fit: fill;
        border: 0;
        border-radius: 5px !important;
        background: #111;
        box-shadow: none;
      }
      #${PANEL_ID} .pp-authVerifyGroup {
        display: block;
        width: 100%;
        margin-top: 4px;
      }
      #${PANEL_ID} .pp-authVerifyGroup .form-control {
        width: 100%;
        height: 32px;
        border-radius: 0 4px 4px 0 !important;
      }
      #${PANEL_ID} .pp-authVerifyGroup .form-control:focus {
        position: relative;
        z-index: 1;
      }
      #${PANEL_ID} .pp-authNotice {
        display: none;
        margin: 0 0 10px;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.35;
        border-radius: 0;
      }
      #${PANEL_ID} .pp-authNotice.is-error {
        display: block;
        color: #a94442;
        background: #f2dede;
        border: 1px solid #ebccd1;
      }
      #${PANEL_ID} .pp-authNotice.is-success {
        display: block;
        color: #3c763d;
        background: #dff0d8;
        border: 1px solid #d6e9c6;
      }
      #${PANEL_ID} .pp-authSubmit {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 35px;
        margin-top: 16px !important;
        border: 0;
        border-radius: 3px !important;
        background: #772953;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: none;
      }
      #${PANEL_ID} .pp-authSubmit:hover {
        background: #682248;
      }
      #${PANEL_ID} .pp-authSubmit:active {
        transform: translateY(.5px);
      }
      @keyframes ppAuthMarquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      #${PANEL_ID} .pp-shell {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      #${PANEL_ID} .pp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 43px;
        padding: 0 10px 0 12px;
        color: #fff;
        cursor: grab;
        user-select: none;
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
      }
      #${PANEL_ID} .pp-headMain {
        display: flex;
        align-items: center;
        gap: 20px;
        min-width: 0;
        flex: 1 1 auto;
      }
      #${PANEL_ID} .pp-titleText {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        flex: 0 0 auto;
      }
      #${PANEL_ID} .pp-nav {
        display: flex;
        align-items: stretch;
        gap: 0;
        min-width: 0;
        flex: 1 1 auto;
      }
      #${PANEL_ID} .pp-navItem {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 42px;
        padding: 0 14px;
        border: 0;
        background: transparent;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color .14s ease, color .14s ease;
      }
      #${PANEL_ID} .pp-staticNav {
        cursor: default;
      }
      #${PANEL_ID} .pp-tabButton:hover,
      #${PANEL_ID} .pp-staticNav:hover {
        background: rgb(74 16 45 / 0.88);
      }
      #${PANEL_ID} .pp-toolbar {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      #${PANEL_ID} .pp-toolBtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: #fff;
        cursor: pointer;
        border-radius: var(--pp-radius);
        box-shadow: none;
        opacity: 0.96;
        transition: background-color .16s ease, opacity .16s ease, transform .16s ease;
      }
      #${PANEL_ID} .pp-toolBtn:hover {
        background: rgb(74 16 45 / 0.88);
        opacity: 1;
      }
      #${PANEL_ID} .pp-toolBtn:active {
        transform: translateY(0.5px);
      }
      #${PANEL_ID} .pp-toolIcon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
      }
      #${PANEL_ID} .pp-toolIcon svg {
        width: 16px;
        height: 16px;
        overflow: visible;
      }
      #${PANEL_ID} .pp-toolIcon svg path {
        stroke: currentColor;
        stroke-width: 2.1;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      #${PANEL_ID} .pp-toolIconExpand {
        display: none;
      }
      #${PANEL_ID} .pp-closeBtn .pp-toolIcon {
        width: 15px;
        height: 15px;
      }
      #${PANEL_ID} .pp-tabButton.is-active {
        color: #fff;
        background: transparent;
        box-shadow: none;
      }
      #${PANEL_ID} .pp-tabButton.is-active:hover {
        background: transparent;
      }
      #${PANEL_ID} .pp-badge {
        display: inline-block;
        min-width: 0;
        padding: 0;
        margin-left: 4px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        background: transparent !important;
        border-radius: var(--pp-radius);
      }
      #${PANEL_ID} .pp-badgeGreen { color: #fff; }
      #${PANEL_ID} .pp-badgeAmber { color: #fff; }
      #${PANEL_ID} .pp-content {
        flex: 1 1 auto;
        overflow: auto;
        background: #fff;
        min-height: 0;
      }
      #${PANEL_ID} .pp-tabContent {
        position: relative;
        min-height: 100%;
        padding: 14px;
      }
      #${PANEL_ID}.is-minimized {
        height: 43px;
      }
      #${PANEL_ID}.is-minimized .pp-content {
        display: none;
      }
      #${PANEL_ID}.is-minimized .pp-toolIconCollapse {
        display: none;
      }
      #${PANEL_ID}.is-minimized .pp-toolIconExpand {
        display: inline-flex;
      }
      #${PANEL_ID} .pp-sectionHeader h3 {
        margin: 0;
        font-size: 20px;
        line-height: 1.2;
        color: #111827;
      }
      #${PANEL_ID} .pp-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      #${PANEL_ID} .pp-rowPush {
        margin-left: auto;
      }
      #${PANEL_ID} .pp-bankSummary {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        min-height: 18px;
      }
      #${PANEL_ID} .pp-bankChip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.15;
      }
      #${PANEL_ID} .pp-bankChipBadge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        padding: 0 8px;
        background: #6b7280;
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        border-radius: 999px;
        line-height: 1;
      }
      #${PANEL_ID} .pp-alert {
        margin-bottom: 0;
      }
      #${PANEL_ID} .pp-filterBar {
        position: relative;
      }
      #${PANEL_ID} .pp-bankMenuWrap {
        position: relative;
      }
      #${PANEL_ID} .pp-bankMenu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        min-width: 290px;
        max-width: min(360px, calc(100vw - 50px));
        max-height: 320px;
        overflow: auto;
        background: #fff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 12px 30px rgb(0 0 0 / 0.14);
        padding: 10px;
        z-index: 30;
        display: none;
      }
      #${PANEL_ID} .pp-bankMenu.is-open {
        display: block;
      }
      #${PANEL_ID} .pp-bankMenuTools {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
        position: sticky;
        top: 0;
        background: #fff;
        padding-bottom: 6px;
      }
      #${PANEL_ID} .pp-bankMenuList {
        display: grid;
        gap: 6px;
      }
      #${PANEL_ID} .pp-bankOption {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 12px;
        line-height: 1.25;
      }
      #${PANEL_ID} .pp-tableWrap {
        overflow: auto;
      }
      #${PANEL_ID} .pp-empty {
        padding: 28px 16px;
        text-align: center;
        color: #6b7280;
        border: 1px dashed #d1d5db;
      }
      #${PANEL_ID} .pp-loading {
        padding: 28px 16px;
        text-align: center;
        color: #475569;
      }
      #${PANEL_ID} .pp-error {
        padding: 22px 16px;
        text-align: center;
        color: #b91c1c;
        background: #fff5f5;
        border: 1px solid #fecaca;
      }
      #${PANEL_ID} input[readonly].pp-copyable,
      #${PANEL_ID} .pp-copyable {
        cursor: pointer;
      }
      #${PANEL_ID} .btn,
      #${PANEL_ID} .form-control,
      #${PANEL_ID} .form-select {
        border-radius: var(--pp-radius) !important;
      }
      #${PANEL_ID} .pp-refreshBtn.is-loading {
        opacity: 0.9;
        pointer-events: none;
      }
      #${PANEL_ID} .pp-navItem,
      #${PANEL_ID} .alert,
      #${PANEL_ID} .well,
      #${PANEL_ID} .table,
      #${PANEL_ID} table,
      #${PANEL_ID} .pp-tableWrap,
      #${PANEL_ID} .pp-bankMenu,
      #${PANEL_ID} .pp-empty,
      #${PANEL_ID} .pp-error {
        border-radius: var(--pp-radius) !important;
      }
      #${PANEL_ID} .pp-tabButton.is-active {
        border-radius: var(--pp-radius-sm) var(--pp-radius-sm) 0 0;
      }
      #${PANEL_ID} .alert,
      #${PANEL_ID} .well,
      #${PANEL_ID} table,
      #${PANEL_ID} .table {
        margin-bottom: 0;
      }
      @media (max-width: 860px) {
        #${PANEL_ID} .pp-header {
          align-items: flex-start;
          padding-top: 6px;
          padding-bottom: 6px;
        }
        #${PANEL_ID} .pp-headMain {
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }
        #${PANEL_ID} .pp-nav {
          flex-wrap: wrap;
          margin-left: -10px;
        }
        #${PANEL_ID} .pp-navItem {
          min-height: 28px;
          padding: 0 10px;
        }
      }
      #${PANEL_ID},
      #${PANEL_ID} .pp-content,
      #${PANEL_ID} .pp-tabContent,
      #${PANEL_ID} .pp-tableWrap,
      #${PANEL_ID} .pp-bankMenu {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      #${PANEL_ID}::-webkit-scrollbar,
      #${PANEL_ID} .pp-content::-webkit-scrollbar,
      #${PANEL_ID} .pp-tabContent::-webkit-scrollbar,
      #${PANEL_ID} .pp-tableWrap::-webkit-scrollbar,
      #${PANEL_ID} .pp-bankMenu::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
        background: transparent !important;
      }
      #${PANEL_ID} .pp-hidden {
        display: none !important;
      }
      #${PANEL_ID} .pp-wd-amount-mask {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        width: 100%;
        min-height: 34px;
        box-sizing: border-box;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        -ms-user-select: none;
        pointer-events: none;
        cursor: default;
      }
      #${PANEL_ID} .pp-wd-lock-tooltip-wrap {
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
        cursor: not-allowed;
        max-width: 100%;
      }
      #${PANEL_ID} .pp-header {
        min-height: 48px;
        padding: 0 12px 0 14px;
      }
      #${PANEL_ID} .pp-titleText {
        font-size: 15px;
      }
      #${PANEL_ID} .pp-navItem {
        min-height: 46px;
        padding: 0 16px;
        font-size: 13px;
      }
      #${PANEL_ID} .pp-tabContent {
        padding: 16px;
      }
      #${PANEL_ID} .pp-sectionHeader h3 {
        font-size: 22px;
      }
      #${PANEL_ID} .pp-bankSummary {
        gap: 10px;
        min-height: 24px;
      }
      #${PANEL_ID} .btn,
      #${PANEL_ID} .form-control,
      #${PANEL_ID} .form-select,
      #${PANEL_ID} label,
      #${PANEL_ID} .alert,
      #${PANEL_ID} .well,
      #${PANEL_ID} .pp-empty,
      #${PANEL_ID} .pp-loading,
      #${PANEL_ID} .pp-error,
      #${PANEL_ID} .pp-footer,
      #${PANEL_ID} .table,
      #${PANEL_ID} table,
      #${PANEL_ID} td,
      #${PANEL_ID} th {
        font-size: 13px !important;
      }
      #${PANEL_ID} .btn {
        font-weight: 700;
      }
      #${PANEL_ID} .form-control,
      #${PANEL_ID} .form-select {
        min-height: 36px;
      }
      #${PANEL_ID} .pp-previewValue,
      #${PANEL_ID} .pp-userMuted,
      #${PANEL_ID} .pp-testStatus,
      #${PANEL_ID} .pp-statusBadge,
      #${PANEL_ID} .pp-colSectionTitle,
      #${PANEL_ID} .pp-userField label {
        font-size: 13px !important;
      }
      #${PANEL_ID}, #${PANEL_ID} * {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      #${PANEL_ID}::-webkit-scrollbar,
      #${PANEL_ID} *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  function markInteracting(duration = 520) {
    const ts = Date.now();
    state.lastInteractionAt = ts;
    state.interactionLockUntil = Math.max(state.interactionLockUntil || 0, ts + duration);
  }

  function isInteractionLocked(type) {
    const activeEl = document.activeElement;
    const tab = type === "depo" ? refs.depoTab : refs.wdTab;
    if (state.drag.active) return true;
    if (Date.now() < (state.interactionLockUntil || 0)) return true;
    if (tab && tab.querySelector(".pp-bankMenu.is-open")) return true;
    if (type === state.activeTab && activeEl && refs.panel.contains(activeEl) && activeEl.closest("input, select, textarea, button, label, a, .pp-bankMenu")) {
      return true;
    }
    return false;
  }

  function scheduleDeferredFlush(preferredType) {
    if (state.deferredFlushTimer) {
      clearTimeout(state.deferredFlushTimer);
      state.deferredFlushTimer = 0;
    }
    state.deferredFlushTimer = window.setTimeout(() => {
      state.deferredFlushTimer = 0;
      if (!document.body.contains(refs.panel)) return;
      const order = preferredType
        ? [preferredType, preferredType === "depo" ? "wd" : "depo"]
        : [state.activeTab, state.activeTab === "depo" ? "wd" : "depo"];
      order.forEach((type) => {
        if (!isInteractionLocked(type)) {
          flushDeferredRender(type);
        }
      });
    }, 180);
  }

  function setupInteractionGuards() {
    const softLock = () => markInteracting(360);
    const hardLock = () => markInteracting(820);
    const flushLater = () => scheduleDeferredFlush();

    refs.panel.addEventListener("pointerdown", hardLock, true);
    refs.panel.addEventListener("focusin", hardLock, true);
    refs.panel.addEventListener("input", hardLock, true);
    refs.panel.addEventListener("change", hardLock, true);
    refs.panel.addEventListener("keydown", hardLock, true);
    refs.panel.addEventListener("wheel", softLock, { passive: true, capture: true });
    refs.panel.addEventListener("scroll", softLock, { passive: true, capture: true });
    refs.panel.addEventListener("focusout", flushLater, true);
    window.addEventListener("pointerup", flushLater, { passive: true });
    window.addEventListener("mouseup", flushLater, { passive: true });
    window.addEventListener("touchend", flushLater, { passive: true });

    state.cleanupFns.push(() => refs.panel.removeEventListener("focusout", flushLater, true));
    state.cleanupFns.push(() => window.removeEventListener("pointerup", flushLater));
    state.cleanupFns.push(() => window.removeEventListener("mouseup", flushLater));
    state.cleanupFns.push(() => window.removeEventListener("touchend", flushLater));
  }

  function captureTabUiState(type, tab) {
    const content = refs.panel.querySelector("#ppContent");
    const wrap = tab ? tab.querySelector(".pp-tableWrap") : null;
    const menu = tab ? tab.querySelector(type === "depo" ? "#ppDepoBankMenu" : "#ppWdBankMenu") : null;
    return {
      contentScrollTop: content ? content.scrollTop : 0,
      contentScrollLeft: content ? content.scrollLeft : 0,
      tabScrollTop: tab ? tab.scrollTop : 0,
      tabScrollLeft: tab ? tab.scrollLeft : 0,
      wrapScrollTop: wrap ? wrap.scrollTop : 0,
      wrapScrollLeft: wrap ? wrap.scrollLeft : 0,
      bankMenuOpen: !!(menu && menu.classList.contains("is-open"))
    };
  }

  function restoreTabUiState(type, tab, snapshot) {
    if (!snapshot || !tab) return;
    requestAnimationFrame(() => {
      const content = refs.panel.querySelector("#ppContent");
      const wrap = tab.querySelector(".pp-tableWrap");
      const menu = tab.querySelector(type === "depo" ? "#ppDepoBankMenu" : "#ppWdBankMenu");
      if (content) {
        content.scrollTop = snapshot.contentScrollTop || 0;
        content.scrollLeft = snapshot.contentScrollLeft || 0;
      }
      tab.scrollTop = snapshot.tabScrollTop || 0;
      tab.scrollLeft = snapshot.tabScrollLeft || 0;
      if (wrap) {
        wrap.scrollTop = snapshot.wrapScrollTop || 0;
        wrap.scrollLeft = snapshot.wrapScrollLeft || 0;
      }
      if (snapshot.bankMenuOpen && menu) {
        menu.classList.add("is-open");
      }
    });
  }

  function renderSectionIntoTab(type, parsed) {
    const tab = type === "depo" ? refs.depoTab : refs.wdTab;
    const snapshot = captureTabUiState(type, tab);
    tab.innerHTML = buildSectionMarkup(type, parsed);
    tab.dataset.rendered = "1";
    bindSection(type);
    restoreTabUiState(type, tab, snapshot);
  }

  function flushDeferredRender(type) {
    const parsed = state.deferredParsed[type];
    if (!parsed) return false;
    state.deferredParsed[type] = null;
    renderSectionIntoTab(type, parsed);
    return true;
  }

  function startAutoSync() {
    if (!isPanelAlive()) return;
    stopAutoSync();
    Object.keys(state.menuCloseFns || {}).forEach((key) => {
      const fn = state.menuCloseFns[key];
      if (typeof fn === "function") document.removeEventListener("mousedown", fn, true);
    });
    const loop = () => {
      if (!isPanelAlive()) return;
      const now = Date.now();
      const activeType = state.activeTab;
      const secondaryType = activeType === "depo" ? "wd" : "depo";
      const sinceInteraction = now - (state.lastInteractionAt || 0);
      const fastDepositAutoApprove = activeType === "depo" && state.depo.autoApprove;
      const activeMinAge = state.minimized
        ? 7000
        : (fastDepositAutoApprove ? (sinceInteraction < 4500 ? 900 : 1200) : (sinceInteraction < 4500 ? 1800 : 2800));
      const secondaryMinAge = state.minimized
        ? 11000
        : (fastDepositAutoApprove ? 3200 : (sinceInteraction < 4500 ? 4200 : 5600));

      if (!document.hidden) {
        maybeAutoRefresh(activeType, now, activeMinAge);
        if (state.initialized[secondaryType]) {
          maybeAutoRefresh(secondaryType, now, secondaryMinAge);
        }
      }

      state.autoSyncTimer = window.setTimeout(loop, state.minimized ? 1600 : (fastDepositAutoApprove ? 900 : 1200));
    };
    loop();
  }

  function stopAutoSync() {
    if (state.autoSyncTimer) {
      clearTimeout(state.autoSyncTimer);
      state.autoSyncTimer = 0;
    }
  }

  function isUserTabVisible() {
    const userTab = refs.panel ? refs.panel.querySelector("#ppUserTab") : null;
    return !!(userTab && userTab.style.display !== "none");
  }

  function maybeAutoRefresh(type, now, minAge) {
    if (!isPanelAlive() || document.hidden) return;
    if (isUserTabVisible()) return;
    if (type === "depo" && state.depo.autoApproveBusy) return;
    if (state.minimized && type !== state.activeTab) return;
    if (flushDeferredRender(type)) return;
    if (state.loading[type]) return;
    if (!state.initialized[type] && type !== state.activeTab) return;
    if (isInteractionLocked(type)) return;
    if (now - (state.lastLoadedAt[type] || 0) < minAge) return;
    loadSection(type, { busyText: "Syncing...", silent: true });
  }

  function handleVisibilityChange() {
    if (!isPanelAlive() || document.hidden) return;
    const activeType = state.activeTab;
    if (activeType === "depo" && state.depo.autoApproveBusy) return;
    if (!isInteractionLocked(activeType) && flushDeferredRender(activeType)) return;
    if (state.loading[activeType]) {
      state.pendingReload[activeType] = true;
      return;
    }
    loadSection(activeType, { busyText: "Syncing...", silent: true });
  }

  function handleWindowFocus() {
    if (!isPanelAlive()) return;
    const activeType = state.activeTab;
    if (activeType === "depo" && state.depo.autoApproveBusy) return;
    if (!isInteractionLocked(activeType) && flushDeferredRender(activeType)) return;
    if (state.loading[activeType]) {
      state.pendingReload[activeType] = true;
      return;
    }
    if (Date.now() - (state.lastLoadedAt[activeType] || 0) > ((activeType === "depo" && state.depo.autoApprove) ? 650 : 1200)) {
      loadSection(activeType, { busyText: "Syncing...", silent: true });
    }
  }

  function scheduleIdlePreload(type) {
    const run = () => {
      if (!state.initialized[type] && !state.loading[type]) {
        loadSection(type, { initial: true, silent: true });
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 1200 });
      return;
    }
    window.setTimeout(run, 450);
  }

  async function loadSection(type, options = {}) {
    if (!isPanelAlive() || !isAuthenticated()) return false;
    const tab = type === "depo" ? refs.depoTab : refs.wdTab;
    const cfg = state[type];
    const hasRendered = tab.dataset.rendered === "1" && tab.innerHTML.trim();
    const previousHeight = Math.max(tab.offsetHeight || 0, 220);
    const token = ++state.loadToken[type];
    const currentController = state.abortControllers[type];

    if (currentController) {
      try { currentController.abort(); } catch (error) {}
    }

    const controller = new AbortController();
    state.abortControllers[type] = controller;
    state.loading[type] = true;
    state.pendingReload[type] = false;

    if (hasRendered) {
      tab.style.minHeight = `${previousHeight}px`;
      if (!options.silent) {
        setSectionBusy(tab, true, options.busyText || "Refreshing...");
      }
    } else {
      tab.innerHTML = `<div class="pp-loading">Loading ${type === "depo" ? "Deposit" : "Withdraw"}...</div>`;
      tab.dataset.rendered = "0";
    }

    try {
      const response = type === "depo"
        ? await fetchPendingDeposit(cfg, controller.signal)
        : await fetchPendingWithdraw(cfg, controller.signal);

      if (token !== state.loadToken[type]) return;
      const previousHtml = cfg.responseHtml || "";
      if (hasRendered && response === previousHtml) {
        state.lastLoadedAt[type] = Date.now();
        state.initialized[type] = true;
        updateBadges();
        return;
      }
      cfg.responseHtml = response;
      const parsed = parsePendingResponse(type, response);
      const previousSignature = state.signatures[type] || "";
      cfg.bankCounts = parsed.bankCounts;
      cfg.total = parsed.total;
      cfg.availableBanks = parsed.availableBanks || cfg.availableBanks || [];
      state.fingerprints[type] = parsed.fingerprint;
      state.signatures[type] = parsed.signature;
      state.lastLoadedAt[type] = Date.now();

      if (!hasRendered || previousSignature !== parsed.signature) {
        if (hasRendered && options.silent && isInteractionLocked(type)) {
          state.deferredParsed[type] = parsed;
          state.pendingReload[type] = true;
          scheduleDeferredFlush(type);
        } else {
          state.deferredParsed[type] = null;
          renderSectionIntoTab(type, parsed);
        }
      }

      state.initialized[type] = true;
      updateBadges();
      if (type === "depo") {
        renderDepositAutoApproveUi(refs.depoTab);
        scheduleDepositAutoApprove(state.depo.autoApprove ? (hasRendered ? 90 : 150) : (hasRendered ? 220 : 420));
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      console.error(`[${PANEL_ID}] ${type} load failed`, error);
      if (token === state.loadToken[type] && !hasRendered) {
        tab.innerHTML = `<div class="pp-error">Gagal memuat ${type === "depo" ? "Deposit" : "Withdraw"}</div>`;
      }
    } finally {
      if (token !== state.loadToken[type]) return;
      if (state.abortControllers[type] === controller) {
        state.abortControllers[type] = null;
      }
      state.loading[type] = false;
      if (!options.silent) {
        setSectionBusy(tab, false);
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          tab.style.minHeight = "";
        });
      });
      if (state.pendingReload[type]) {
        if (state.deferredParsed[type]) {
          scheduleDeferredFlush(type);
        } else {
          state.pendingReload[type] = false;
          queueMicrotask(() => loadSection(type, { busyText: "Refreshing...", silent: true }));
        }
      }
    }
  }

  function getStateSection(type) {
    return type === "depo" ? state.depo : state.wd;
  }

  function getAvailableBanks(type, extras = {}) {
    const cfg = getStateSection(type);
    const nativeBanks = collectBanksFromNativeDom(type);
    const rowBanks = dedupeBankOptions(extras.rowBanks || []);
    const merged = dedupeBankOptions([...(cfg.availableBanks || []), ...nativeBanks, ...rowBanks]);
    if (merged.length) {
      cfg.availableBanks = merged;
      const helpers = ensureSharedBankHelpers();
      helpers.getLabelByValue = function (kind, value) {
        const current = getAvailableBanks(kind);
        const match = current.find((item) => String(item.value) === String(value));
        return match ? match.text : "";
      };
    }
    return cfg.availableBanks || [];
  }

  function syncBankSelection(type, availableBanks) {
    const cfg = getStateSection(type);
    const values = (availableBanks || []).map((item) => String(item.value));
    if (!values.length) {
      cfg.availableBanks = [];
      if (!cfg.hasBankSelection) cfg.banks = [];
      return;
    }
    cfg.availableBanks = availableBanks.slice();
    if (!cfg.hasBankSelection) {
      cfg.banks = values.slice();
      return;
    }
    cfg.banks = (cfg.banks || []).filter((value) => values.includes(String(value)));
  }

  function getFetchBankCodes(type) {
    const cfg = getStateSection(type);
    const available = getAvailableBanks(type);
    const availableValues = available.map((item) => String(item.value)).filter(Boolean);
    const selectedValues = (cfg.banks || []).map((value) => String(value)).filter(Boolean);
    const values = cfg.hasBankSelection ? selectedValues : availableValues;
    return [...new Set(values)];
  }

  function lookupBankLabel(type, value, extras = []) {
    const all = dedupeBankOptions([...(extras || []), ...getAvailableBanks(type)]);
    const hit = all.find((item) => String(item.value) === String(value));
    return hit ? hit.text : "";
  }

  function extractRowBankMeta(type, row, availableBanks = []) {
    const id = extractRowId(row, type === "depo" ? "depositPending-" : "withdrawPending-");
    const hidden = row.querySelector(`.rek${cssEscapeSafe(id)}`) || row.querySelector(`input.rek${cssEscapeSafe(id)}`) || row.querySelector("input[class^='rek']");
    const code = hidden ? String(hidden.value || "").trim() : "";
    const labelFromCode = code ? lookupBankLabel(type, code, availableBanks) : "";
    if (code && labelFromCode) {
      return { value: code, text: labelFromCode, key: normalizeBankLabelKey(labelFromCode) };
    }

    const img = row.querySelector("img[src*='logo-']");
    const src = img ? img.getAttribute("src") || "" : "";
    const imgMatch = src.match(/logo-([^.\/]+)\./i);
    const imgText = imgMatch ? inferBankLabelFromValue(imgMatch[1]) : "";
    const imgKey = imgText ? normalizeBankLabelKey(imgText) : "";

    if (code) {
      return { value: code, text: imgText || inferBankLabelFromValue(code), key: imgKey || normalizeBankLabelKey(code) };
    }

    if (imgKey) {
      const mapped = (availableBanks || []).find((item) => normalizeBankLabelKey(item.text) === imgKey);
      if (mapped) return { value: String(mapped.value), text: mapped.text, key: imgKey };
      return { value: `KEY:${imgKey}`, text: imgText, key: imgKey };
    }

    return { value: "", text: "", key: "" };
  }

  function collectRowBankOptions(type, rows, nativeBanks = []) {
    return dedupeBankOptions((rows || []).map((row) => {
      const meta = extractRowBankMeta(type, row, nativeBanks);
      return meta && meta.value ? { value: meta.value, text: meta.text || inferBankLabelFromValue(meta.key || meta.value) } : null;
    }).filter(Boolean));
  }

  function filterPendingRows(type, rows, availableBanks = []) {
    const cfg = getStateSection(type);
    if (!cfg.hasBankSelection) return rows.slice();
    const selected = new Set((cfg.banks || []).map((value) => String(value)));
    return rows.filter((row) => {
      const meta = extractRowBankMeta(type, row, availableBanks);
      return meta.value && selected.has(String(meta.value));
    });
  }

  function createFetchSignal(parentSignal, timeoutMs = 12000) {
    const controller = new AbortController();
    let parentAbort = null;
    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort(parentSignal.reason || new DOMException("Aborted", "AbortError"));
      } else {
        parentAbort = () => controller.abort(parentSignal.reason || new DOMException("Aborted", "AbortError"));
        parentSignal.addEventListener("abort", parentAbort, { once: true });
      }
    }
    const timer = window.setTimeout(() => {
      controller.abort(new DOMException("Request timeout", "AbortError"));
    }, timeoutMs);
    return {
      signal: controller.signal,
      cleanup() {
        clearTimeout(timer);
        if (parentSignal && parentAbort) parentSignal.removeEventListener("abort", parentAbort);
      }
    };
  }

  async function fetchPendingDeposit(cfg, signal) {
    const body = new URLSearchParams();
    getFetchBankCodes("depo").forEach((value) => body.append("listRekening[]", value));
    body.append("showAll", String(!!cfg.showAll));
    body.append("sortBy", cfg.sortBy);

    const request = createFetchSignal(signal, 12000);
    try {
      const response = await fetch("https://admsrt74adm.com/process/service/depositPending", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: request.signal,
        headers: {
          accept: "*/*",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`Deposit pending request failed: ${response.status}`);
      }

      return response.text();
    } finally {
      request.cleanup();
    }
  }

  async function fetchPendingWithdraw(cfg, signal) {
    const body = new URLSearchParams();
    getFetchBankCodes("wd").forEach((value) => body.append("listRekening[]", value));
    body.append("showAll", String(!!cfg.showAll));
    body.append("showWDLimit", cfg.showWDLimit);
    body.append("sortBy", cfg.sortBy);

    const request = createFetchSignal(signal, 12000);
    try {
      const response = await fetch("https://admsrt74adm.com/process/service/withdrawPending", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: request.signal,
        headers: {
          accept: "*/*",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`Withdraw pending request failed: ${response.status}`);
      }

      return response.text();
    } finally {
      request.cleanup();
    }
  }

  function parsePendingResponse(type, html) {
    const doc = new DOMParser().parseFromString(`<div id="ppParseRoot">${html}</div>`, "text/html");
    const root = doc.getElementById("ppParseRoot") || doc.body;
    const rowSelector = type === "depo" ? 'tr[id^="depositPending-"]' : 'tr[id^="withdrawPending-"]';
    const rows = [...root.querySelectorAll(rowSelector)];
    const actionId = type === "depo" ? "depositPendingActionButtons" : "withdrawPendingActionButtons";
    const actionButtons = root.querySelector(`#${actionId}`);
    const mainWrap = type === "depo"
      ? root.querySelector(".well.well-sm") || root.querySelector(".well") || root.querySelector("table")
      : root.querySelector(".alert.alert-danger") || root.querySelector(".well") || root.querySelector("table");

    const nativeBanks = collectBanksFromNativeDom(type);
    const rowBanks = collectRowBankOptions(type, rows, nativeBanks);
    const availableBanks = dedupeBankOptions([...nativeBanks, ...rowBanks]);
    syncBankSelection(type, availableBanks);

    const visibleRows = filterPendingRows(type, rows, availableBanks);
    const visibleIds = new Set(visibleRows.map((row) => row.id));

    if (mainWrap) {
      [...mainWrap.querySelectorAll(rowSelector)].forEach((row) => {
        if (!visibleIds.has(row.id)) row.remove();
      });
    }

    const actionHtml = actionButtons ? sanitizeBlock(type, actionButtons, true) : "";
    const tableHtml = mainWrap ? sanitizeBlock(type, mainWrap, false) : "";
    const bankCounts = type === "depo" ? extractDepositBankCounts(html, rows) : extractWithdrawBankCounts(html, rows);
    const total = rows.length;
    const visibleTotal = visibleRows.length;
    const fingerprint = rows.map((row) => row.id || "").join("|");
    const signature = `${total}:${visibleTotal}:${hashString(actionHtml)}:${hashString(tableHtml)}:${hashString(JSON.stringify((availableBanks || []).map((item) => item.value)))}`;

    return {
      actionHtml,
      tableHtml,
      bankCounts,
      total,
      visibleTotal,
      availableBanks,
      fingerprint,
      signature
    };
  }

  function sanitizeBlock(type, node, isAction) {
    const cloned = node.cloneNode(true);
    cloned.querySelectorAll("script").forEach((script) => script.remove());
    cloned.querySelectorAll("#deleteSelectedButton").forEach((button) => {
      button.removeAttribute("id");
    });

    if (type === "depo") {
      cloned.querySelectorAll(".rowCheckboxDepositPending").forEach((input) => {
        input.removeAttribute("onclick");
        input.value = extractRowId(input.closest("tr"), "depositPending-");
      });
      cloned.querySelectorAll("#depositPendingActionButtons button").forEach((button) => button.removeAttribute("onclick"));
      cloned.querySelectorAll(".deporekform").forEach((input) => input.removeAttribute("onclick"));
      cloned.querySelectorAll(".fmdepo").forEach((input) => input.removeAttribute("onclick"));
      cloned.querySelectorAll(".bonusevent").forEach((select) => select.removeAttribute("onchange"));
    } else {
      cloned.querySelectorAll(".rowCheckboxWithdrawPending").forEach((input) => {
        input.removeAttribute("onclick");
        input.value = extractRowId(input.closest("tr"), "withdrawPending-");
      });
      cloned.querySelectorAll("#withdrawPendingActionButtons button").forEach((button) => button.removeAttribute("onclick"));
      cloned.querySelectorAll("[onclick^='wdrekformSelect']").forEach((el) => el.removeAttribute("onclick"));
      cloned.querySelectorAll(".bonusturnover").forEach((select) => select.removeAttribute("onchange"));
    }

    if (!isAction) {
      cloned.querySelectorAll("[data-toggle='tooltip']").forEach((el) => {
        if (!el.getAttribute("title") && el.dataset.originalTitle) {
          el.setAttribute("title", el.dataset.originalTitle);
        }
      });
    }

    return cloned.outerHTML;
  }

  function extractDepositBankCounts(html, rows) {
    const counts = {};
    const match = html.match(/var\s+dataPending\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        data.forEach((item) => {
          const key = item && item.bankrek ? String(item.bankrek) : "Unknown";
          counts[key] = (counts[key] || 0) + 1;
        });
      } catch (error) {
        console.error(`[${PANEL_ID}] deposit dataPending parse failed`, error);
      }
    }
    if (Object.keys(counts).length) return counts;

    rows.forEach((row) => {
      const img = row.querySelector("img[src*='logo-']");
      const src = img ? img.getAttribute("src") || "" : "";
      const key = src.includes("logo-") ? src.split("logo-").pop().split(".")[0].toUpperCase() : "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  function extractWithdrawBankCounts(html, rows) {
    const counts = {};
    const match = html.match(/var\s+dataPending\s*=\s*(\{[\s\S]*?\});/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        Object.keys(data).forEach((key) => {
          counts[key] = Array.isArray(data[key]) ? data[key].length : 0;
        });
      } catch (error) {
        console.error(`[${PANEL_ID}] withdraw dataPending parse failed`, error);
      }
    }
    if (Object.keys(counts).length) return counts;

    rows.forEach((row) => {
      const img = row.querySelector("img[src*='logo-']");
      const src = img ? img.getAttribute("src") || "" : "";
      const key = src.includes("logo-") ? src.split("logo-").pop().split(".")[0].toUpperCase() : "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  function buildSectionMarkup(type, parsed) {
    const cfg = state[type];
    const banks = getAvailableBanks(type, { rowBanks: parsed.availableBanks || [] });
    syncBankSelection(type, banks);
    const isDeposit = type === "depo";
    const bankSummary = renderBankSummary(parsed.bankCounts);
    const autoApproveLockOptions = isDeposit ? getDepositAutoApproveLockOptions() : [];
    cfg.autoApproveLocks = isDeposit ? normalizeDepositAutoApproveLocks(cfg.autoApproveLocks, { fallbackAll: false }) : cfg.autoApproveLocks;
    const autoApproveLockLabel = isDeposit ? getDepositAutoApproveLockButtonLabel(cfg.autoApproveLocks, autoApproveLockOptions) : "";
    const selectedCount = (cfg.banks || []).length;
    const totalBanks = banks.length;
    const bankLabel = !cfg.hasBankSelection || selectedCount === totalBanks
      ? `All selected (${totalBanks})`
      : `${selectedCount} selected`;
    const bodyHtml = parsed.visibleTotal
      ? `${parsed.actionHtml ? `<div class="pp-actionWrap">${parsed.actionHtml}</div>` : ""}<div class="pp-tableWrap">${parsed.tableHtml}</div>`
      : `<div class="pp-empty">${cfg.hasBankSelection ? `Tidak ada pending ${isDeposit ? "deposit" : "withdraw"} pada filter bank` : `Tidak ada pending ${isDeposit ? "deposit" : "withdraw"}`}</div>`;

    return `
      <div class="pp-sectionHeader">
        <div class="pp-row" style="margin-bottom:10px;">
          <div class="col"><h3>${isDeposit ? "Deposit" : "Withdraw"}</h3></div>
          ${isDeposit ? `<div class="pp-rowPush"><button type="button" class="btn btn-info" id="ppOpenMutasiBtn"><span class="glyphicon glyphicon-folder-open me-1"></span> Open Mutasi Window</button></div>` : ""}
        </div>
        <div class="alert ${isDeposit ? "alert-success" : "alert-danger"} pp-alert" style="border-color:${isDeposit ? "#d6e9c6" : "#eed3d7"};margin-bottom:0;${!isDeposit ? "margin-top:8px;" : ""}">
          <div class="pp-row">
            <div><strong><span class="glyphicon glyphicon-tasks"></span> ${isDeposit ? "DEPOSIT IN PROGRESS" : "WITHDRAW IN PROGRESS"}</strong></div>
            <div class="pp-rowPush pp-row">
              ${isDeposit ? `<label style="display:flex;align-items:center;gap:8px;margin:0;font-size:12px;font-weight:700"><input type="checkbox" id="ppDepoAutoApprove" ${cfg.autoApprove ? "checked" : ""}> Mode Auto Approve</label><span><strong>Lock Deposit</strong></span><div class="pp-bankMenuWrap"><button type="button" class="btn btn-secondary" id="ppDepoAutoApproveLockToggle" style="min-width:138px">${escapeHtml(autoApproveLockLabel)}</button><div class="pp-bankMenu pp-autoApproveLockMenu" id="ppDepoAutoApproveLockMenu"><div class="pp-bankMenuTools"><button type="button" class="btn btn-xs btn-secondary" data-auto-lock-action="all">All</button><button type="button" class="btn btn-xs btn-secondary" data-auto-lock-action="none">None</button><button type="button" class="btn btn-xs btn-primary" data-auto-lock-action="apply">Apply</button></div><div class="pp-bankMenuList"><label class="pp-bankOption"><input type="checkbox" id="ppDepoAutoApproveLockAll"> <span>Select all</span></label>${autoApproveLockOptions.map((item) => `<label class="pp-bankOption"><input type="checkbox" data-auto-lock-key="1" value="${escapeHtml(item.value)}" ${cfg.autoApproveLocks.includes(item.value) ? "checked" : ""}> <span>${escapeHtml(item.text)}</span></label>`).join("")}</div></div></div>` : `<label style="display:flex;align-items:center;gap:8px;margin:0;font-size:12px;font-weight:700"><input type="checkbox" id="ppWdQueueMode" ${cfg.queueMode ? "checked" : ""}> Mode Safe Withdraw</label><span><strong>Show Pending Forms</strong></span><select class="form-control form-select" id="ppWdLimit" style="width:100px;display:inline-block"><option value="999999">All</option><option value="100">100</option><option value="200">200</option><option value="300">300</option></select>`}
              <span><strong>Sort By</strong></span>
              <select class="form-control form-select" id="${isDeposit ? "ppDepoSort" : "ppWdSort"}" style="width:100px;display:inline-block">
                <option value="date">Tanggal</option>
                <option value="bank">Bank</option>
                <option value="jumlah">Jumlah</option>
              </select>
            </div>
          </div>
        </div>
        <div class="alert ${isDeposit ? "alert-success" : "alert-danger"} pp-filterBar" style="background-color:#F9F9F9;margin-top:0;border-color:${isDeposit ? "#d6e9c6" : "#eed3d7"};">
          <div class="pp-row">
            <div class="col-auto"><label style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" id="${isDeposit ? "ppDepoShowAll" : "ppWdShowAll"}"> <strong>Show All Transactions</strong></label></div>
            <div class="pp-bankSummary">${bankSummary}</div>
            <div class="pp-rowPush pp-row">
              <span><strong>Select Bank</strong></span>
              <select class="form-control form-select" id="${isDeposit ? "ppDepoBankMode" : "ppWdBankMode"}" style="width:90px;display:inline-block">
                <option value="">All</option>
                <option value="active">Active</option>
              </select>
              <div class="pp-bankMenuWrap">
                <button type="button" class="btn btn-secondary" id="${isDeposit ? "ppDepoBankToggle" : "ppWdBankToggle"}" style="min-width:140px">${bankLabel}</button>
                <div class="pp-bankMenu" id="${isDeposit ? "ppDepoBankMenu" : "ppWdBankMenu"}">
                  <div class="pp-bankMenuTools">
                    <button type="button" class="btn btn-xs btn-secondary" data-bank-action="all">All</button>
                    <button type="button" class="btn btn-xs btn-secondary" data-bank-action="none">None</button>
                    <button type="button" class="btn btn-xs btn-primary" data-bank-action="apply">Apply</button>
                  </div>
                  <div class="pp-bankMenuList">
                    ${banks.map((bank) => `
                      <label class="pp-bankOption">
                        <input type="checkbox" value="${escapeHtml(bank.value)}" ${cfg.banks.includes(bank.value) ? "checked" : ""}>
                        <span>${escapeHtml(bank.text)}</span>
                      </label>
                    `).join("")}
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-secondary pp-refreshBtn" id="${isDeposit ? "ppDepoRefresh" : "ppWdRefresh"}" style="width:90px">Refresh</button>
            </div>
          </div>
        </div>
      </div>
      <div class="pp-sectionBody" style="margin-top:18px;">
        ${bodyHtml}
      </div>
    `;
  }

  function bindSection(type) {
    const tab = type === "depo" ? refs.depoTab : refs.wdTab;
    const cfg = state[type];
    const isDeposit = type === "depo";

    const sortSelect = tab.querySelector(isDeposit ? "#ppDepoSort" : "#ppWdSort");
    if (sortSelect) {
      sortSelect.value = cfg.sortBy;
      sortSelect.addEventListener("change", () => {
        cfg.sortBy = sortSelect.value;
        loadSection(type);
      });
    }

    const showAllInput = tab.querySelector(isDeposit ? "#ppDepoShowAll" : "#ppWdShowAll");
    if (showAllInput) {
      showAllInput.checked = !!cfg.showAll;
      showAllInput.addEventListener("change", () => {
        cfg.showAll = !!showAllInput.checked;
        loadSection(type);
      });
    }

    const bankModeSelect = tab.querySelector(isDeposit ? "#ppDepoBankMode" : "#ppWdBankMode");
    if (bankModeSelect) {
      bankModeSelect.value = cfg.bankMode;
      bankModeSelect.addEventListener("change", () => {
        cfg.bankMode = bankModeSelect.value;
        if (isDeposit && typeof window.menuDeposit === "function") {
          try { window.menuDeposit(true); } catch (error) { console.error(error); }
        }
        if (!isDeposit && typeof window.menuWithdraw === "function") {
          try { window.menuWithdraw(true); } catch (error) { console.error(error); }
        }
      });
    }

    if (isDeposit) {
      const autoApproveInput = tab.querySelector("#ppDepoAutoApprove");
      const autoApproveLimitBtn = tab.querySelector("#ppDepoAutoApproveLimitBtn");

      bindDepositAutoApproveLockMenu(tab);

      if (autoApproveInput) {
        autoApproveInput.checked = !!cfg.autoApprove;
        autoApproveInput.addEventListener("change", async () => {
          if (autoApproveInput.checked) {
            const nextLimit = await promptDepositAutoApproveLimit(cfg.autoApproveLimit);
            if (!nextLimit) {
              disableDepositAutoApprove({ render: true });
              autoApproveInput.checked = false;
              return;
            }
            cfg.autoApproveLimit = saveDepositAutoApproveLimit(nextLimit);
            cfg.autoApprove = saveDepositAutoApprove(true);
            renderDepositAutoApproveUi(tab);
            scheduleDepositAutoApprove(90);
            return;
          }

          disableDepositAutoApprove({ render: true });
        });
      }

      if (autoApproveLimitBtn) {
        autoApproveLimitBtn.addEventListener("click", async () => {
          const nextLimit = await promptDepositAutoApproveLimit(cfg.autoApproveLimit);
          if (!nextLimit) return;
          cfg.autoApproveLimit = saveDepositAutoApproveLimit(nextLimit);
          if (!cfg.autoApprove) {
            cfg.autoApprove = saveDepositAutoApprove(true);
            const toggle = tab.querySelector("#ppDepoAutoApprove");
            if (toggle) toggle.checked = true;
          }
          renderDepositAutoApproveUi(tab);
          scheduleDepositAutoApprove(90);
        });
      }
    } else {
      const queueModeInput = tab.querySelector("#ppWdQueueMode");
      if (queueModeInput) {
        queueModeInput.checked = !!cfg.queueMode;
        queueModeInput.addEventListener("change", () => {
          cfg.queueMode = saveWithdrawMode(!!queueModeInput.checked);
          applyWithdrawQueueMode(tab);
        });
      }

      const limitSelect = tab.querySelector("#ppWdLimit");
      if (limitSelect) {
        limitSelect.value = cfg.showWDLimit;
        limitSelect.addEventListener("change", () => {
          cfg.showWDLimit = limitSelect.value;
          loadSection(type);
        });
      }
    }

    const refreshBtn = tab.querySelector(isDeposit ? "#ppDepoRefresh" : "#ppWdRefresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        if (state.loading[type]) {
          state.pendingReload[type] = true;
          return;
        }
        loadSection(type, { busyText: "Refreshing..." });
      });
    }

    if (isDeposit) {
      const openMutasiBtn = tab.querySelector("#ppOpenMutasiBtn");
      if (openMutasiBtn) {
        openMutasiBtn.addEventListener("click", () => {
          if (typeof window.openMutasiBank === "function") {
            try { window.openMutasiBank(); } catch (error) { console.error(error); }
          }
        });
      }
    }

    bindBankMenu(type, tab);
    bindScopedBulkActions(type, tab);
    bindScopedHelpers(type, tab);
    applyDynamicValues(type, tab);
  }

  function bindBankMenu(type, tab) {
    const cfg = state[type];
    const toggle = tab.querySelector(type === "depo" ? "#ppDepoBankToggle" : "#ppWdBankToggle");
    const menu = tab.querySelector(type === "depo" ? "#ppDepoBankMenu" : "#ppWdBankMenu");
    if (!toggle || !menu) return;

    if (state.menuCloseFns[type]) {
      document.removeEventListener("mousedown", state.menuCloseFns[type], true);
      state.menuCloseFns[type] = null;
    }

    const closeMenu = (event) => {
      if (!menu.classList.contains("is-open")) return;
      if (menu.contains(event.target) || event.target === toggle) return;
      menu.classList.remove("is-open");
      document.removeEventListener("mousedown", closeMenu, true);
      if (state.menuCloseFns[type] === closeMenu) {
        state.menuCloseFns[type] = null;
      }
    };

    state.menuCloseFns[type] = closeMenu;

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", willOpen);
      document.removeEventListener("mousedown", closeMenu, true);
      if (willOpen) document.addEventListener("mousedown", closeMenu, true);
    });

    menu.addEventListener("click", (event) => {
      const button = event.target.closest("[data-bank-action]");
      if (!button) return;
      const action = button.dataset.bankAction;
      const boxes = [...menu.querySelectorAll("input[type='checkbox']")];
      if (action === "all") {
        boxes.forEach((box) => { box.checked = true; });
        return;
      }
      if (action === "none") {
        boxes.forEach((box) => { box.checked = false; });
        return;
      }
      if (action === "apply") {
        const selected = boxes.filter((box) => box.checked).map((box) => box.value);
        const allValues = boxes.map((box) => box.value).filter(Boolean);
        cfg.hasBankSelection = selected.length !== allValues.length;
        cfg.banks = selected;
        menu.classList.remove("is-open");
        document.removeEventListener("mousedown", closeMenu, true);
        loadSection(type, { busyText: "Filtering...", silent: true });
      }
    });

    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        menu.classList.remove("is-open");
        document.removeEventListener("mousedown", closeMenu, true);
        if (state.menuCloseFns[type] === closeMenu) {
          state.menuCloseFns[type] = null;
        }
      }
    });
  }

function bindDepositAutoApproveLockMenu(tab) {
  const cfg = state.depo;
  const toggle = tab.querySelector("#ppDepoAutoApproveLockToggle");
  const menu = tab.querySelector("#ppDepoAutoApproveLockMenu");
  if (!toggle || !menu) return;

  if (state.menuCloseFns.depoAutoApproveLock) {
    document.removeEventListener("mousedown", state.menuCloseFns.depoAutoApproveLock, true);
    state.menuCloseFns.depoAutoApproveLock = null;
  }

  const getAllBox = () => menu.querySelector("#ppDepoAutoApproveLockAll");
  const getItemBoxes = () => [...menu.querySelectorAll("input[data-auto-lock-key]")];

  const syncAllBoxFromItems = () => {
    const allBox = getAllBox();
    const itemBoxes = getItemBoxes();
    if (!allBox) return;
    allBox.checked = !!itemBoxes.length && itemBoxes.every((box) => !!box.checked);
  };

  const syncMenuFromState = () => {
    const selected = new Set(normalizeDepositAutoApproveLocks(cfg.autoApproveLocks, { fallbackAll: false }));
    getItemBoxes().forEach((box) => {
      box.checked = selected.has(String(box.value));
    });
    syncAllBoxFromItems();
  };

  const applyLocksFromMenu = () => {
    const selected = getItemBoxes().filter((box) => box.checked).map((box) => box.value);
    cfg.autoApproveLocks = saveDepositAutoApproveLocks(selected);
    renderDepositAutoApproveUi(tab);
    if (cfg.autoApprove) scheduleDepositAutoApprove(120);
  };

  const closeMenu = (event) => {
    if (!menu.classList.contains("is-open")) return;
    if (menu.contains(event.target) || event.target === toggle) return;
    menu.classList.remove("is-open");
    document.removeEventListener("mousedown", closeMenu, true);
    if (state.menuCloseFns.depoAutoApproveLock === closeMenu) {
      state.menuCloseFns.depoAutoApproveLock = null;
    }
  };

  state.menuCloseFns.depoAutoApproveLock = closeMenu;
  syncMenuFromState();

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !menu.classList.contains("is-open");
    if (willOpen) syncMenuFromState();
    menu.classList.toggle("is-open", willOpen);
    document.removeEventListener("mousedown", closeMenu, true);
    if (willOpen) document.addEventListener("mousedown", closeMenu, true);
  });

  const allBox = getAllBox();
  const itemBoxes = getItemBoxes();

  if (allBox) {
    allBox.addEventListener("change", () => {
      getItemBoxes().forEach((box) => {
        box.checked = !!allBox.checked;
      });
      syncAllBoxFromItems();
    });
  }

  itemBoxes.forEach((box) => {
    box.addEventListener("change", () => {
      syncAllBoxFromItems();
    });
  });

  menu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-auto-lock-action]");
    if (!button) return;
    const action = String(button.dataset.autoLockAction || "");
    const currentBoxes = getItemBoxes();
    if (action === "all") {
      currentBoxes.forEach((box) => { box.checked = true; });
      syncAllBoxFromItems();
      return;
    }
    if (action === "none") {
      currentBoxes.forEach((box) => { box.checked = false; });
      syncAllBoxFromItems();
      return;
    }
    if (action === "apply") {
      applyLocksFromMenu();
      menu.classList.remove("is-open");
      document.removeEventListener("mousedown", closeMenu, true);
      if (state.menuCloseFns.depoAutoApproveLock === closeMenu) {
        state.menuCloseFns.depoAutoApproveLock = null;
      }
    }
  });

  menu.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const button = event.target.closest("[data-auto-lock-action='apply']");
      if (button) {
        applyLocksFromMenu();
        menu.classList.remove("is-open");
        document.removeEventListener("mousedown", closeMenu, true);
        if (state.menuCloseFns.depoAutoApproveLock === closeMenu) {
          state.menuCloseFns.depoAutoApproveLock = null;
        }
        return;
      }
    }
    if (event.key === "Escape") {
      menu.classList.remove("is-open");
      document.removeEventListener("mousedown", closeMenu, true);
      if (state.menuCloseFns.depoAutoApproveLock === closeMenu) {
        state.menuCloseFns.depoAutoApproveLock = null;
      }
    }
  });
}

  function bindScopedBulkActions(type, tab) {
    const isDeposit = type === "depo";
    const rowSelector = isDeposit ? ".rowCheckboxDepositPending" : ".rowCheckboxWithdrawPending";
    const actionWrap = tab.querySelector(isDeposit ? "#depositPendingActionButtons" : "#withdrawPendingActionButtons");
    const checkboxes = [...tab.querySelectorAll(rowSelector)];
    const buttons = actionWrap ? [...actionWrap.querySelectorAll("button")] : [];
    let bulkBusy = false;

    const syncActionState = () => {
      if (!actionWrap) return;
      const checkedCount = checkboxes.filter((box) => box.checked).length;
      actionWrap.style.display = checkedCount > 0 ? "flex" : "none";
      buttons.forEach((button) => {
        button.disabled = bulkBusy || checkedCount === 0;
      });
    };

    const selectedIds = () => checkboxes.filter((box) => box.checked).map((box) => box.value).filter(Boolean);

    const runSerial = async (ids, mode) => {
      bulkBusy = true;
      syncActionState();
      try {
        for (const id of ids) {
          if (mode === "approve") {
            if (isDeposit && typeof window.approveDeposit === "function") {
              setApproveContextLocal("panel-bulk", "deposit", id);
              window.approveDeposit(id, false);
            } else if (!isDeposit && typeof window.approveWithdraw === "function") {
              setApproveContextLocal("panel-bulk", "withdraw", id);
              window.approveWithdraw(id, false);
            }
          } else if (mode === "reject") {
            if (isDeposit && typeof window.deleteDeposit === "function") window.deleteDeposit(id, false);
            if (!isDeposit && typeof window.deleteWithdraw === "function") window.deleteWithdraw(id, false);
          }
          await new Promise((resolve) => window.setTimeout(resolve, isDeposit ? 140 : 180));
        }
      } finally {
        bulkBusy = false;
        checkboxes.forEach((box) => {
          box.checked = false;
        });
        syncActionState();
        scheduleSectionRefresh(type, true);
      }
    };

    checkboxes.forEach((box) => {
      box.addEventListener("change", () => {
        if (checkboxes.filter((item) => item.checked).length > 20) {
          box.checked = false;
          alert("You can only select up to 20 items.");
          return;
        }
        syncActionState();
      });
    });

    buttons.forEach((button) => {
      const text = (button.textContent || "").trim().toLowerCase();
      button.addEventListener("click", async () => {
        if (bulkBusy) return;
        const ids = selectedIds();
        if (!ids.length) return;

        if (text.includes("approve")) {
          const ok = confirm(`Approve selected ${isDeposit ? "deposits" : "withdraws"}?`);
          if (!ok) return;
          await runSerial(ids, "approve");
          return;
        }

        if (text.includes("delete") || text.includes("reject")) {
          const ok = confirm(`Reject selected ${isDeposit ? "deposits" : "withdraws"}?`);
          if (!ok) return;
          await runSerial(ids, "reject");
        }
      });
    });

    syncActionState();
  }

  function bindScopedHelpers(type, tab) {
    if (type === "depo") {
      tab.querySelectorAll(".deporekform").forEach((input) => {
        input.addEventListener("click", () => {
          const prevValue = input.value;
          input.disabled = true;
          input.value = "Loading...";
          if (typeof window.getDepositRekening === "function") {
            try {
              window.getDepositRekening(input, prevValue);
            } catch (error) {
              console.error(error);
              input.disabled = false;
              input.value = prevValue;
            }
          } else {
            input.disabled = false;
            input.value = prevValue;
          }
        });
      });

      tab.querySelectorAll(".fmdepo").forEach((input) => {
        input.addEventListener("click", () => {
          const prevValue = input.value;
          input.disabled = true;
          input.value = "Loading...";
          if (typeof window.pilihanMutasi === "function") {
            try {
              window.pilihanMutasi(input);
            } catch (error) {
              console.error(error);
              input.disabled = false;
              input.value = prevValue;
            }
          } else {
            input.disabled = false;
            input.value = prevValue;
          }
        });
      });

      tab.querySelectorAll(".bonusevent").forEach((select) => {
        select.addEventListener("change", () => updateDepositBonusForSelect(select, tab));
      });
    } else {
      tab.querySelectorAll("div[class^='wdrek']").forEach((wrap) => {
        wrap.addEventListener("click", () => {
          const input = wrap.querySelector(".wdrekform");
          if (!input) return;
          const id = input.getAttribute("att");
          input.disabled = true;
          input.value = "Loading...";
          if (typeof window.getWithdrawRekening === "function") {
            try {
              window.getWithdrawRekening(id);
            } catch (error) {
              console.error(error);
              input.disabled = false;
            }
          } else {
            input.disabled = false;
          }
        });
      });

      tab.querySelectorAll(".bonusturnover").forEach((select) => {
        select.addEventListener("change", () => updateWithdrawBonusForSelect(select, tab));
      });
    }

    tab.querySelectorAll("input[readonly]").forEach((input) => {
      const className = input.className || "";
      if (/\bjumlah\b/.test(className) || /\bribuan\b/.test(className) || /click to copy/i.test(input.getAttribute("title") || "")) {
        input.classList.add("pp-copyable");
        input.addEventListener("click", () => copyReadonlyValue(input));
      }
    });

    tab.querySelectorAll("button[onclick]").forEach((button) => {
      const onclick = button.getAttribute("onclick") || "";
      if (/approveDeposit\(/.test(onclick)) {
        button.addEventListener("click", () => {
          const id = extractApproveIdLocal(button, "deposit") || (onclick.match(/approveDeposit\((?:'|")?(\d+)/) || [])[1] || "";
          if (id) setApproveContextLocal("panel-click", "deposit", id);
        });
        return;
      }
      if (/approveWithdraw\(/.test(onclick)) {
        button.addEventListener("click", () => {
          const id = extractApproveIdLocal(button, "withdraw") || (onclick.match(/approveWithdraw\((?:'|")?(\d+)/) || [])[1] || "";
          if (id) setApproveContextLocal("panel-click", "withdraw", id);
        });
      }
    });
  }

  function applyDynamicValues(type, tab) {
    if (type === "depo") {
      tab.querySelectorAll(".bonusevent").forEach((select) => updateDepositBonusForSelect(select, tab));
      renderDepositAutoApproveUi(tab);
    } else {
      tab.querySelectorAll(".bonusturnover").forEach((select) => updateWithdrawBonusForSelect(select, tab));
      applyWithdrawQueueMode(tab);
    }
  }

  function setWithdrawModeNodeState(node, hidden) {
    if (!node) return;
    if (hidden) {
      if (node.dataset.ppWdModeDisplay == null) node.dataset.ppWdModeDisplay = node.style.display || "";
      if (node.dataset.ppWdModeVisibility == null) node.dataset.ppWdModeVisibility = node.style.visibility || "";
      if (node.dataset.ppWdModePointer == null) node.dataset.ppWdModePointer = node.style.pointerEvents || "";
      node.style.visibility = "hidden";
      node.style.pointerEvents = "none";
    } else {
      if (node.dataset.ppWdModeDisplay != null) node.style.display = node.dataset.ppWdModeDisplay;
      if (node.dataset.ppWdModeVisibility != null) node.style.visibility = node.dataset.ppWdModeVisibility;
      if (node.dataset.ppWdModePointer != null) node.style.pointerEvents = node.dataset.ppWdModePointer;
      delete node.dataset.ppWdModeDisplay;
      delete node.dataset.ppWdModeVisibility;
      delete node.dataset.ppWdModePointer;
    }
  }

  function applyWithdrawModeAmountMirrorStyle(input, mirror) {
    if (!input || !mirror) return;
    const computed = window.getComputedStyle(input);
    mirror.style.display = "flex";
    mirror.style.alignItems = "center";
    mirror.style.justifyContent = computed.textAlign === "left" ? "flex-start" : computed.textAlign === "center" ? "center" : "flex-end";
    mirror.style.width = computed.width;
    mirror.style.minHeight = computed.height;
    mirror.style.height = computed.height;
    mirror.style.paddingTop = computed.paddingTop;
    mirror.style.paddingRight = computed.paddingRight;
    mirror.style.paddingBottom = computed.paddingBottom;
    mirror.style.paddingLeft = computed.paddingLeft;
    mirror.style.marginTop = computed.marginTop;
    mirror.style.marginRight = computed.marginRight;
    mirror.style.marginBottom = computed.marginBottom;
    mirror.style.marginLeft = computed.marginLeft;
    mirror.style.background = computed.background;
    mirror.style.backgroundColor = computed.backgroundColor;
    mirror.style.borderTop = computed.borderTop;
    mirror.style.borderRight = computed.borderRight;
    mirror.style.borderBottom = computed.borderBottom;
    mirror.style.borderLeft = computed.borderLeft;
    mirror.style.borderRadius = computed.borderRadius;
    mirror.style.boxShadow = computed.boxShadow;
    mirror.style.color = computed.color;
    mirror.style.font = computed.font;
    mirror.style.fontSize = computed.fontSize;
    mirror.style.fontWeight = computed.fontWeight;
    mirror.style.fontFamily = computed.fontFamily;
    mirror.style.letterSpacing = computed.letterSpacing;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.textAlign = computed.textAlign;
    mirror.style.textTransform = computed.textTransform;
    mirror.style.textIndent = computed.textIndent;
    mirror.style.opacity = computed.opacity;
    mirror.style.verticalAlign = computed.verticalAlign;
  }

  function setWithdrawModeInputState(input, hidden) {
    if (!input) return;
    if (hidden) {
      if (input.dataset.ppWdModeValue == null) input.dataset.ppWdModeValue = input.value || "";
      if (input.dataset.ppWdModeDisabled == null) input.dataset.ppWdModeDisabled = input.disabled ? "1" : "0";
      if (input.dataset.ppWdModeReadOnly == null) input.dataset.ppWdModeReadOnly = input.readOnly ? "1" : "0";
      if (input.dataset.ppWdModeTabIndex == null) input.dataset.ppWdModeTabIndex = String(input.tabIndex);
      input.value = "";
      input.disabled = true;
      input.readOnly = true;
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
      input.setAttribute("data-mode-withdraw-hidden", "1");
    } else {
      if (input.dataset.ppWdModeValue != null) input.value = input.dataset.ppWdModeValue;
      if (input.dataset.ppWdModeDisabled != null) input.disabled = input.dataset.ppWdModeDisabled === "1";
      if (input.dataset.ppWdModeReadOnly != null) input.readOnly = input.dataset.ppWdModeReadOnly === "1";
      if (input.dataset.ppWdModeTabIndex != null) {
        const nextTabIndex = Number(input.dataset.ppWdModeTabIndex);
        input.tabIndex = Number.isFinite(nextTabIndex) ? nextTabIndex : 0;
      } else {
        input.removeAttribute("tabindex");
      }
      input.removeAttribute("aria-hidden");
      input.removeAttribute("data-mode-withdraw-hidden");
      delete input.dataset.ppWdModeValue;
      delete input.dataset.ppWdModeDisabled;
      delete input.dataset.ppWdModeReadOnly;
      delete input.dataset.ppWdModeTabIndex;
    }
  }


  function setWithdrawModeTooltipAttrs(el, message) {
    if (!el) return;
    const text = String(message || "").trim();
    if (!text) return;
    el.setAttribute("title", text);
    el.setAttribute("data-toggle", "tooltip");
    el.setAttribute("data-placement", "top");
    el.setAttribute("data-bs-original-title", text);
    el.setAttribute("aria-label", text);
  }

  function clearWithdrawModeTooltipAttrs(el) {
    if (!el) return;
    el.removeAttribute("title");
    el.removeAttribute("data-toggle");
    el.removeAttribute("data-placement");
    el.removeAttribute("data-bs-original-title");
    el.removeAttribute("aria-label");
  }

  function ensureWithdrawModeButtonTooltipWrap(button) {
    if (!button) return null;
    const parent = button.parentElement;
    if (parent && parent.classList.contains("pp-wd-lock-tooltip-wrap")) return parent;
    const wrap = document.createElement("span");
    wrap.className = "pp-wd-lock-tooltip-wrap";
    wrap.style.display = "inline-flex";
    wrap.style.alignItems = "center";
    wrap.style.verticalAlign = "middle";
    wrap.style.cursor = "not-allowed";
    wrap.style.maxWidth = "100%";
    button.insertAdjacentElement("beforebegin", wrap);
    wrap.appendChild(button);
    return wrap;
  }

  function unwrapWithdrawModeButtonTooltip(button) {
    if (!button) return;
    const parent = button.parentElement;
    if (!parent || !parent.classList.contains("pp-wd-lock-tooltip-wrap")) return;
    parent.insertAdjacentElement("beforebegin", button);
    parent.remove();
  }

  function setWithdrawModeAmountState(input, disabled) {
    if (!input) return;
    const mirrorId = input.dataset.ppWdModeMirrorId || `pp-wd-amount-mask-${Math.random().toString(36).slice(2, 10)}`;
    input.dataset.ppWdModeMirrorId = mirrorId;
    let mirror = document.getElementById(mirrorId);
    if (disabled) {
      if (input.dataset.ppWdModeDisabled == null) input.dataset.ppWdModeDisabled = input.disabled ? "1" : "0";
      if (input.dataset.ppWdModeReadOnly == null) input.dataset.ppWdModeReadOnly = input.readOnly ? "1" : "0";
      if (input.dataset.ppWdModeTabIndex == null) input.dataset.ppWdModeTabIndex = String(input.tabIndex);
      if (input.dataset.ppWdModePointer == null) input.dataset.ppWdModePointer = input.style.pointerEvents || "";
      if (input.dataset.ppWdModeUserSelect == null) input.dataset.ppWdModeUserSelect = input.style.userSelect || "";
      if (input.dataset.ppWdModeWebkitUserSelect == null) input.dataset.ppWdModeWebkitUserSelect = input.style.webkitUserSelect || "";
      if (input.dataset.ppWdModeCursor == null) input.dataset.ppWdModeCursor = input.style.cursor || "";
      if (input.dataset.ppWdModeOpacity == null) input.dataset.ppWdModeOpacity = input.style.opacity || "";
      if (input.dataset.ppWdModeDisplay == null) input.dataset.ppWdModeDisplay = input.style.display || "";
      if (input.dataset.ppWdModeAriaLabel == null) input.dataset.ppWdModeAriaLabel = input.getAttribute("aria-label") || "";
      if (input.dataset.ppWdModeDataBsTitle == null) input.dataset.ppWdModeDataBsTitle = input.getAttribute("data-bs-original-title") || "";
      if (input.dataset.ppWdModeTitle == null) input.dataset.ppWdModeTitle = input.getAttribute("title") || "";
      if (input.dataset.ppWdModeDataToggle == null) input.dataset.ppWdModeDataToggle = input.getAttribute("data-toggle") || "";
      if (input.dataset.ppWdModeDataPlacement == null) input.dataset.ppWdModeDataPlacement = input.getAttribute("data-placement") || "";
      input.disabled = true;
      input.readOnly = true;
      input.tabIndex = -1;
      input.style.pointerEvents = "none";
      input.style.userSelect = "none";
      input.style.webkitUserSelect = "none";
      input.style.cursor = "default";
      input.style.opacity = "1";
      input.style.display = "none";
      input.removeAttribute("aria-label");
      input.removeAttribute("title");
      input.removeAttribute("data-bs-original-title");
      input.removeAttribute("data-toggle");
      input.removeAttribute("data-placement");
      input.setAttribute("data-mode-withdraw-locked", "1");
      if (!mirror) {
        mirror = document.createElement("div");
        mirror.id = mirrorId;
        mirror.className = `form-control pp-wd-amount-mask ${input.className || ""}`.trim();
        mirror.setAttribute("aria-hidden", "true");
        mirror.setAttribute("data-mode-withdraw-locked", "1");
        mirror.addEventListener("mousedown", (event) => event.preventDefault());
        mirror.addEventListener("dblclick", (event) => event.preventDefault());
        mirror.addEventListener("selectstart", (event) => event.preventDefault());
        input.insertAdjacentElement("afterend", mirror);
      }
      mirror.textContent = String(input.value || "");
      applyWithdrawModeAmountMirrorStyle(input, mirror);
      mirror.style.display = "flex";
      setWithdrawModeTooltipAttrs(mirror, "Nominal dikunci saat Mode Safe Withdraw aktif. Hanya row paling atas yang bisa diproses.");
    } else {
      if (mirror) {
        clearWithdrawModeTooltipAttrs(mirror);
        mirror.remove();
      }
      if (input.dataset.ppWdModeDisabled != null) input.disabled = input.dataset.ppWdModeDisabled === "1";
      if (input.dataset.ppWdModeReadOnly != null) input.readOnly = input.dataset.ppWdModeReadOnly === "1";
      if (input.dataset.ppWdModeTabIndex != null) {
        const nextTabIndex = Number(input.dataset.ppWdModeTabIndex);
        input.tabIndex = Number.isFinite(nextTabIndex) ? nextTabIndex : 0;
      } else {
        input.removeAttribute("tabindex");
      }
      if (input.dataset.ppWdModePointer != null) input.style.pointerEvents = input.dataset.ppWdModePointer;
      if (input.dataset.ppWdModeUserSelect != null) input.style.userSelect = input.dataset.ppWdModeUserSelect;
      if (input.dataset.ppWdModeWebkitUserSelect != null) input.style.webkitUserSelect = input.dataset.ppWdModeWebkitUserSelect;
      if (input.dataset.ppWdModeCursor != null) input.style.cursor = input.dataset.ppWdModeCursor;
      if (input.dataset.ppWdModeOpacity != null) input.style.opacity = input.dataset.ppWdModeOpacity;
      if (input.dataset.ppWdModeDisplay != null) input.style.display = input.dataset.ppWdModeDisplay; else input.style.removeProperty("display");
      if (input.dataset.ppWdModeAriaLabel) input.setAttribute("aria-label", input.dataset.ppWdModeAriaLabel); else input.removeAttribute("aria-label");
      if (input.dataset.ppWdModeTitle) input.setAttribute("title", input.dataset.ppWdModeTitle); else input.removeAttribute("title");
      if (input.dataset.ppWdModeDataBsTitle) input.setAttribute("data-bs-original-title", input.dataset.ppWdModeDataBsTitle); else input.removeAttribute("data-bs-original-title");
      if (input.dataset.ppWdModeDataToggle) input.setAttribute("data-toggle", input.dataset.ppWdModeDataToggle); else input.removeAttribute("data-toggle");
      if (input.dataset.ppWdModeDataPlacement) input.setAttribute("data-placement", input.dataset.ppWdModeDataPlacement); else input.removeAttribute("data-placement");
      input.removeAttribute("data-mode-withdraw-locked");
      delete input.dataset.ppWdModeDisabled;
      delete input.dataset.ppWdModeReadOnly;
      delete input.dataset.ppWdModeTabIndex;
      delete input.dataset.ppWdModePointer;
      delete input.dataset.ppWdModeUserSelect;
      delete input.dataset.ppWdModeWebkitUserSelect;
      delete input.dataset.ppWdModeCursor;
      delete input.dataset.ppWdModeOpacity;
      delete input.dataset.ppWdModeDisplay;
      delete input.dataset.ppWdModeAriaLabel;
      delete input.dataset.ppWdModeDataBsTitle;
      delete input.dataset.ppWdModeTitle;
      delete input.dataset.ppWdModeDataToggle;
      delete input.dataset.ppWdModeDataPlacement;
    }
  }

  function setWithdrawModeButtonState(button, disabled) {
    if (!button) return;
    if (disabled) {
      if (button.dataset.ppWdModeDisabled == null) button.dataset.ppWdModeDisabled = button.disabled ? "1" : "0";
      if (button.dataset.ppWdModeTabIndex == null) button.dataset.ppWdModeTabIndex = String(button.tabIndex);
      if (button.dataset.ppWdModeOpacity == null) button.dataset.ppWdModeOpacity = button.style.opacity || "";
      if (button.dataset.ppWdModePointer == null) button.dataset.ppWdModePointer = button.style.pointerEvents || "";
      button.disabled = true;
      button.tabIndex = -1;
      button.style.opacity = "0.5";
      button.style.pointerEvents = "none";
      button.setAttribute("aria-disabled", "true");
      const wrap = ensureWithdrawModeButtonTooltipWrap(button);
      setWithdrawModeTooltipAttrs(wrap, "Approve button dikunci saat Mode Safe Withdraw aktif. Hanya row paling atas yang bisa diproses.");
    } else {
      const wrap = button.parentElement && button.parentElement.classList && button.parentElement.classList.contains("pp-wd-lock-tooltip-wrap")
        ? button.parentElement
        : null;
      if (button.dataset.ppWdModeDisabled != null) button.disabled = button.dataset.ppWdModeDisabled === "1";
      if (button.dataset.ppWdModeTabIndex != null) {
        const nextTabIndex = Number(button.dataset.ppWdModeTabIndex);
        button.tabIndex = Number.isFinite(nextTabIndex) ? nextTabIndex : 0;
      } else {
        button.removeAttribute("tabindex");
      }
      if (button.dataset.ppWdModeOpacity != null) button.style.opacity = button.dataset.ppWdModeOpacity;
      if (button.dataset.ppWdModePointer != null) button.style.pointerEvents = button.dataset.ppWdModePointer;
      button.removeAttribute("aria-disabled");
      if (wrap) clearWithdrawModeTooltipAttrs(wrap);
      unwrapWithdrawModeButtonTooltip(button);
      delete button.dataset.ppWdModeDisabled;
      delete button.dataset.ppWdModeTabIndex;
      delete button.dataset.ppWdModeOpacity;
      delete button.dataset.ppWdModePointer;
    }
  }

  function getWithdrawQueueTargets(row) {
    if (!row) return { nomorInput: null, jumlahInput: null, nomorWrap: null, jumlahWrap: null, approveBtn: null };
    const id = extractRowId(row, "withdrawPending-");
    const textInputs = [...row.querySelectorAll('input[type="text"], input:not([type])')]
      .filter((input) => input && input.type !== "hidden");
    const nomorCandidates = textInputs.filter((input) => {
      const className = String(input.className || "");
      if (/\bwdrekform\b|\bjumlah\b|\bribuan\b|\bnote\b|\bapprovalwd\b/i.test(className)) return false;
      if (input.closest("div[class^='wdrek']")) return false;
      const value = String(input.value || "").replace(/\s+/g, "").trim();
      return /^\+?\d{8,20}$/.test(value);
    });
    const formGroups = [...row.querySelectorAll("td.form-group")];
    const nomorFallbackGroup = formGroups[0] || null;
    const nomorInput = nomorCandidates[0]
      || (nomorFallbackGroup ? [...nomorFallbackGroup.querySelectorAll('input[type="text"], input:not([type])')].find((input, index) => {
        const className = String(input.className || "");
        if (/\bwdrekform\b|\bjumlah\b|\bribuan\b|\bnote\b|\bapprovalwd\b/i.test(className)) return false;
        return index > 0;
      }) : null)
      || null;
    const jumlahInput = row.querySelector(`.jumlah${cssEscapeSafe(id)}`) || row.querySelector("input.ribuan.jumlah") || row.querySelector("input[class*='jumlah']");
    const approveBtn = row.querySelector(`.wdapproved${cssEscapeSafe(id)}`) || row.querySelector("button[onclick*='approveWithdraw(']");
    const nomorWrap = nomorInput || null;
    const jumlahWrap = jumlahInput || null;
    return { nomorInput, jumlahInput, nomorWrap, jumlahWrap, approveBtn };
  }

  function applyWithdrawQueueMode(tab) {
    if (!tab) return;
    const enabled = !!state.wd.queueMode;
    const rows = [...tab.querySelectorAll('tr[id^="withdrawPending-"]')];
    rows.forEach((row, index) => {
      const hidden = enabled && index > 0;
      const targets = getWithdrawQueueTargets(row);
      row.dataset.ppWdQueueLocked = hidden ? "1" : "0";
      setWithdrawModeNodeState(targets.nomorWrap, hidden);
      setWithdrawModeInputState(targets.nomorInput, hidden);
      setWithdrawModeAmountState(targets.jumlahInput, hidden);
      setWithdrawModeButtonState(targets.approveBtn, hidden);
    });
  }

  function updateDepositBonusForSelect(select, tab) {
    const id = findNumericSuffix(select.className, "bonusevent");
    if (!id) return;
    const amountInput = tab.querySelector(`.jumlah${cssEscapeSafe(id)}`);
    const bonusAmountInput = tab.querySelector(`.bonuseventjumlah${cssEscapeSafe(id)}`);
    if (!amountInput || !bonusAmountInput) return;

    const base = parseInt(String(amountInput.value || "0").replace(/,/g, ""), 10) || 0;
    const selectedId = select.value;
    if (selectedId && selectedId !== "-1") {
      const max = parseInt(select.getAttribute(`max${selectedId}`) || "0", 10) || 0;
      const bonusAmount = parseFloat(select.getAttribute(`bonusamount${selectedId}`) || "0") || 0;
      const isPercent = (select.getAttribute(`percent${selectedId}`) || "").toLowerCase() === "y";
      let result = isPercent ? (bonusAmount * base) / 100 : bonusAmount;
      if (max && result > max) result = max;
      bonusAmountInput.style.color = "#CC0000";
      bonusAmountInput.value = Math.floor(result).toLocaleString("en-US");
    } else {
      bonusAmountInput.style.color = "#000000";
      bonusAmountInput.value = "0";
    }
  }

  function updateWithdrawBonusForSelect(select, tab) {
    const id = findNumericSuffix(select.className, "bonusturnover");
    if (!id) return;
    const amountInput = tab.querySelector(`.jumlah${cssEscapeSafe(id)}`);
    const optionKey = select.value;
    const raw = select.getAttribute(optionKey);
    if (amountInput && raw != null) {
      amountInput.value = raw;
    }
  }

  async function copyReadonlyValue(input) {
    const original = input.value;
    const cleaned = original.replace(/,/g, "");
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(cleaned);
        return;
      } catch (error) {
        console.error(error);
      }
    }
    input.value = cleaned;
    input.select();
    try {
      document.execCommand("copy");
    } catch (error) {
      console.error(error);
    }
    input.value = original;
  }

  function updateBadges() {
    refs.depoBadge.textContent = String(state.depo.total || 0);
    refs.wdBadge.textContent = String(state.wd.total || 0);
  }

  function formatWholeNumber(value) {
    const parsed = parsePositiveAmount(value, 0);
    return parsed.toLocaleString("en-US");
  }

function renderDepositAutoApproveUi(tab) {
  const scope = tab || refs.depoTab;
  if (!scope) return;
  const toggle = scope.querySelector("#ppDepoAutoApprove");
  const lockToggle = scope.querySelector("#ppDepoAutoApproveLockToggle");
  const lockMenu = scope.querySelector("#ppDepoAutoApproveLockMenu");
  const lockAll = scope.querySelector("#ppDepoAutoApproveLockAll");
  const limitText = scope.querySelector("#ppDepoAutoApproveLimitText");
  const stateText = scope.querySelector("#ppDepoAutoApproveState");
  const options = getDepositAutoApproveLockOptions();
  const selected = normalizeDepositAutoApproveLocks(state.depo.autoApproveLocks, { fallbackAll: false });
  state.depo.autoApproveLocks = selected;
  if (toggle) toggle.checked = !!state.depo.autoApprove;
  if (lockToggle) {
    lockToggle.textContent = getDepositAutoApproveLockButtonLabel(selected, options);
  }
  if (lockMenu) {
    const selectedSet = new Set(selected);
    const itemBoxes = [...lockMenu.querySelectorAll("input[data-auto-lock-key]")];
    itemBoxes.forEach((box) => {
      box.checked = selectedSet.has(String(box.value));
    });
    if (lockAll) {
      lockAll.checked = areAllDepositAutoApproveLocksSelected(selected, options);
    }
  }
  if (limitText) {
    limitText.textContent = `Limit ${formatWholeNumber(state.depo.autoApproveLimit || 20000)}`;
  }
  if (stateText) {
    const suffix = getDepositAutoApproveLockButtonLabel(selected, options).toUpperCase();
    stateText.textContent = state.depo.autoApproveBusy ? `AUTO RUNNING · ${suffix}` : (state.depo.autoApprove ? `AUTO ON · ${suffix}` : `AUTO OFF · ${suffix}`);
    stateText.style.color = state.depo.autoApproveBusy ? "#0f766e" : (state.depo.autoApprove ? "#166534" : "#991b1b");
  }
}
  function disableDepositAutoApprove(options = {}) {
    state.depo.autoApprove = saveDepositAutoApprove(false);
    state.depo.autoApproveBusy = false;
    state.depo.autoApproveRunToken = (state.depo.autoApproveRunToken || 0) + 1;
    state.pendingReload.depo = false;
    state.deferredParsed.depo = null;
    clearDepositAutoApproveTimer();
    clearApproveContextLocal();
    if (options.render !== false) {
      renderDepositAutoApproveUi(refs.depoTab);
    }
    return false;
  }

  async function promptDepositAutoApproveLimit(currentValue) {
    const startValue = parsePositiveAmount(currentValue, loadDepositAutoApproveLimit() || 20000) || 20000;
    let next = startValue;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const raw = window.prompt("Mode Auto Approve Deposit\nMasukkan nominal maksimal auto approve.\nContoh: 20000", String(next));
      if (raw == null) return null;
      const parsed = parsePositiveAmount(raw, 0);
      if (parsed > 0) return parsed;
      try {
        if (typeof window.alert === "function") {
          window.alert("Nominal auto approve harus berupa angka lebih dari 0.");
        }
      } catch (_) {}
      next = startValue;
    }
    return null;
  }

function getDepositAutoApproveLockLabel(value) {
  return inferBankLabelFromValue(value);
}

function detectDepositAutoApproveLockKeyFromText(value) {
  const key = normalizeDepositAutoApproveLockKey(value);
  return key || "";
}

function getDepositAutoApproveLockKeyForRow(row, id) {
  if (!row) return "";
  const options = getDepositAutoApproveLockOptions();
  const allowed = new Set(options.map((item) => item.value));
  const escapeId = cssEscapeSafe(id || "");

  const directSelect = row.querySelector(`.approvaldepo${escapeId}`) || row.querySelector(".approvaldepo");
  const directRek = directSelect ? String(directSelect.getAttribute("rek") || directSelect.getAttribute("data-rek") || "").trim() : "";
  const directKey = normalizeDepositAutoApproveLockKey(directRek);
  if (directKey && allowed.has(directKey)) return directKey;

  const bankMeta = extractRowBankMeta("depo", row, getAvailableBanks("depo"));
  const metaKey = normalizeDepositAutoApproveLockKey(bankMeta.key || bankMeta.text || bankMeta.value);
  if (metaKey && allowed.has(metaKey)) return metaKey;

  const img = row.querySelector("img[src*='logo-']");
  const src = img ? String(img.getAttribute("src") || "").trim() : "";
  const imgMatch = src.match(/logo-([^.\/]+)\./i);
  const imgKey = normalizeDepositAutoApproveLockKey(imgMatch ? imgMatch[1] : "");
  if (imgKey && allowed.has(imgKey)) return imgKey;

  return "";
}

function getDepositApproveButton(row, id) {
    if (!row) return null;
    return row.querySelector(`.dpapproved${cssEscapeSafe(id)}`) || row.querySelector("button[onclick*='approveDeposit(']");
  }

function getDepositExactAmountInput(row, id) {
    if (!row) return null;
    const escapeId = cssEscapeSafe(id || "");
    const selectors = [
      `.jumlah${escapeId}`,
      `input.jumlah${escapeId}`,
      "input[class*='jumlah'][readonly]",
      "input[class*='jumlah']"
    ];
    for (const selector of selectors) {
      const matches = [...row.querySelectorAll(selector)];
      for (const el of matches) {
        if (!el) continue;
        const className = String(el.className || "");
        if (selector.includes("class*='jumlah'") && id && className && !className.includes(`jumlah${id}`) && className.includes("bonuseventjumlah")) {
          continue;
        }
        const raw = String(el.value || el.textContent || "").trim();
        if (!raw) continue;
        const parsed = parsePositiveAmount(raw, 0);
        if (parsed > 0) return el;
      }
    }
    return null;
  }

  function getDepositAutoApproveAmount(row, id) {
    if (!row) return 0;
    const amountInput = getDepositExactAmountInput(row, id);
    if (!amountInput) return 0;
    const raw = String(amountInput.value || amountInput.textContent || "").trim();
    return parsePositiveAmount(raw, 0);
  }

  function clearDepositAutoApproveTimer() {
    if (state.depo.autoApproveTimer) {
      clearTimeout(state.depo.autoApproveTimer);
      state.depo.autoApproveTimer = 0;
    }
  }

  function scheduleDepositAutoApprove(delay = 180) {
    clearDepositAutoApproveTimer();
    if (!isPanelAlive() || !state.depo.autoApprove || state.depo.autoApproveBusy) return;
    state.depo.autoApproveTimer = window.setTimeout(() => {
      state.depo.autoApproveTimer = 0;
      if (!isPanelAlive() || !state.depo.autoApprove) return;
      runDepositAutoApprove().catch((error) => console.error("[PP-DEPO-AUTO] run failed", error));
    }, Math.max(0, delay));
  }

  async function runDepositAutoApprove() {
    if (!isPanelAlive() || !state.depo.autoApprove || state.depo.autoApproveBusy) return false;
    if (state.activeTab !== "depo" || state.minimized || isUserTabVisible()) return false;
    if (state.loading.depo || isInteractionLocked("depo")) {
      scheduleDepositAutoApprove(420);
      return false;
    }

    const tab = refs.depoTab;
    if (!tab || !document.body.contains(tab)) return false;

    const limit = parsePositiveAmount(state.depo.autoApproveLimit, loadDepositAutoApproveLimit() || 20000) || 20000;
    const lockOptions = getDepositAutoApproveLockOptions();
    const selectedLocks = normalizeDepositAutoApproveLocks(state.depo.autoApproveLocks, { fallbackAll: false });
    const allowAllLocks = areAllDepositAutoApproveLocksSelected(selectedLocks, lockOptions);
    const selectedLockSet = new Set(selectedLocks);
    if (!selectedLockSet.size) {
      renderDepositAutoApproveUi(tab);
      return false;
    }
    const runToken = (state.depo.autoApproveRunToken || 0) + 1;
    state.depo.autoApproveRunToken = runToken;
    state.depo.autoApproveLimit = limit;
    state.depo.autoApproveLocks = selectedLocks;
    const rows = [...tab.querySelectorAll('tr[id^="depositPending-"]')];
    const candidates = rows
      .map((row) => {
        const id = extractRowId(row, "depositPending-");
        const amount = getDepositAutoApproveAmount(row, id);
        const button = getDepositApproveButton(row, id);
        const rowLockKey = getDepositAutoApproveLockKeyForRow(row, id);
        if (!id || !button || button.disabled || !rowLockKey) return null;
        if (!allowAllLocks && !selectedLockSet.has(rowLockKey)) return null;
        if (!Number.isFinite(amount) || amount <= 0 || amount > limit) return null;
        if (recentlyHandledLocal("panel-auto-deposit-scan:" + id, 1600)) return null;
        return { id, amount, button, rowLockKey, row };
      })
      .filter(Boolean)
      .slice(0, 20);

    if (!candidates.length) {
      renderDepositAutoApproveUi(tab);
      return false;
    }

    state.depo.autoApproveBusy = true;
    renderDepositAutoApproveUi(tab);

    let approvedCount = 0;
    try {
      for (const item of candidates) {
        if (!state.depo.autoApprove || state.activeTab !== "depo" || runToken !== state.depo.autoApproveRunToken) break;
        if (recentlyHandledLocal("panel-auto-deposit-action:" + item.id, 3200)) continue;

        const liveRow = tab.querySelector(`#depositPending-${cssEscapeSafe(item.id)}`);
        const liveAmount = getDepositAutoApproveAmount(liveRow || item.row || null, item.id);
        const liveLockKey = getDepositAutoApproveLockKeyForRow(liveRow || item.row || null, item.id);
        const liveButton = getDepositApproveButton(liveRow || item.row || null, item.id);

        if (!liveRow || !liveButton || liveButton.disabled) continue;
        if (!Number.isFinite(liveAmount) || liveAmount <= 0 || liveAmount > limit) continue;
        if (!liveLockKey || (!allowAllLocks && !selectedLockSet.has(liveLockKey))) continue;

        setApproveContextLocal("auto-deposit", "deposit", item.id);
        let result = null;
        try {
          if (typeof window.approveDeposit === "function") {
            result = window.approveDeposit(item.id, false);
          } else if (liveButton && typeof liveButton.click === "function") {
            liveButton.click();
          }
        } catch (error) {
          console.error("[PP-DEPO-AUTO] approve failed", error);
          continue;
        }
        if (result !== false) approvedCount += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        if (!state.depo.autoApprove || runToken !== state.depo.autoApproveRunToken) break;
      }
    } finally {
      state.depo.autoApproveBusy = false;
      renderDepositAutoApproveUi(tab);
    }

    if (!state.depo.autoApprove || runToken !== state.depo.autoApproveRunToken) {
      return false;
    }

    if (approvedCount > 0) {
      scheduleSectionRefresh("depo", true);
      return true;
    }

    scheduleDepositAutoApprove(650);
    return false;
  }

  function renderBankSummary(counts) {
    const keys = Object.keys(counts || {});
    if (!keys.length) return "";
    return keys.map((key) => `
      <span class="pp-bankChip">
        <span>${escapeHtml(key)}</span>
        <span class="pp-bankChipBadge">${escapeHtml(String(counts[key]))}</span>
      </span>
    `).join("");
  }

  function syncNativeMenu(type) {
    const menuName = type === "depo" ? "menuDeposit" : "menuWithdraw";

    try {
      if (typeof window.switchMenu === "function") {
        window.switchMenu(menuName);
        return;
      }
    } catch (error) {
      console.error(error);
    }

    const fallbackLink = [...document.querySelectorAll('a[href^="javascript:switchMenu("]')].find((link) => {
      const href = link.getAttribute("href") || "";
      return href.includes(menuName);
    });

    if (fallbackLink) {
      try { fallbackLink.click(); } catch (error) { console.error(error); }
    }
  }

  function switchTab(type) {
    if (!isAuthenticated()) return;
    state.activeTab = type;
    refs.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === type));
    refs.depoTab.style.display = type === "depo" ? "block" : "none";
    refs.wdTab.style.display = type === "wd" ? "block" : "none";
    syncNativeMenu(type);

    if (!isInteractionLocked(type)) {
      flushDeferredRender(type);
    }

    if (!state.initialized[type] && !state.loading[type]) {
      loadSection(type, { initial: true });
      return;
    }

    if (!state.loading[type] && Date.now() - (state.lastLoadedAt[type] || 0) > 180) {
      loadSection(type, { busyText: "Syncing...", silent: true });
    }
    if (type === "depo") {
      renderDepositAutoApproveUi(refs.depoTab);
      scheduleDepositAutoApprove(state.depo.autoApprove ? 90 : 200);
    } else {
      clearDepositAutoApproveTimer();
    }
  }


  function setSectionBusy(tab, isBusy, text) {
    if (!tab) return;
    const refreshBtn = tab.querySelector('.pp-refreshBtn, #ppDepoRefresh, #ppWdRefresh');
    if (!refreshBtn) return;
    if (!refreshBtn.dataset.defaultText) {
      refreshBtn.dataset.defaultText = refreshBtn.textContent.trim() || 'Refresh';
    }
    refreshBtn.classList.toggle('is-loading', !!isBusy);
    refreshBtn.disabled = !!isBusy;
    refreshBtn.textContent = isBusy ? (text || 'Refreshing...') : refreshBtn.dataset.defaultText;
  }

  function clearScheduledRefresh(type) {
    const timers = state.refreshTimers[type] || [];
    timers.forEach((id) => clearTimeout(id));
    state.refreshTimers[type] = [];
  }

  function scheduleSectionRefresh(type, immediate) {
    if (!isPanelAlive()) return null;
    clearScheduledRefresh(type);
    const runId = Date.now();
    const baseFingerprint = state.fingerprints[type] || "";
    const baseSignature = state.signatures[type] || "";
    state.refreshRunId[type] = runId;
    const delays = immediate ? [70, 260, 900] : [0];

    delays.forEach((delay, index) => {
      const timer = window.setTimeout(async () => {
        if (state.refreshRunId[type] !== runId) return;
        const beforeFingerprint = state.fingerprints[type] || "";
        const beforeSignature = state.signatures[type] || "";
        await loadSection(type, { busyText: index === 0 ? "Updating..." : "Syncing...", silent: index > 0 });
        if (state.refreshRunId[type] !== runId) return;
        const afterFingerprint = state.fingerprints[type] || "";
        const afterSignature = state.signatures[type] || "";
        if (
          (afterFingerprint && afterFingerprint !== baseFingerprint && afterFingerprint !== beforeFingerprint) ||
          (afterSignature && afterSignature !== baseSignature && afterSignature !== beforeSignature)
        ) {
          clearScheduledRefresh(type);
          state.refreshRunId[type] = 0;
        }
      }, delay);
      state.refreshTimers[type].push(timer);
    });
  }

  function toggleMinimize() {
    state.minimized = !state.minimized;
    refs.panel.classList.toggle("is-minimized", state.minimized);
    refs.minimizeBtn.title = state.minimized ? "Show content" : "Hide content";
    refs.minimizeBtn.setAttribute("aria-label", state.minimized ? "Show content" : "Hide content");
    clampPanel();
  }

  function hasOpenPanelMenu() {
    return !!refs.panel.querySelector(".pp-bankMenu.is-open");
  }

  function setupKeyboardShortcuts() {
    const onWindowKeydown = (event) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (!isPanelAlive()) return;
      if (hasOpenPanelMenu()) return;

      const now = Date.now();
      if (now - (state.lastEscShortcutAt || 0) < 140) return;
      state.lastEscShortcutAt = now;

      event.preventDefault();
      event.stopPropagation();
      markInteracting(220);

      requestAnimationFrame(() => {
        if (!isPanelAlive() || !refs.minimizeBtn) return;
        refs.minimizeBtn.click();
      });
    };

    window.addEventListener("keydown", onWindowKeydown, true);
    state.cleanupFns.push(() => window.removeEventListener("keydown", onWindowKeydown, true));
  }

  function setupDrag() {
    if (state.drag && state.drag.bound) return;
    if (state.drag) state.drag.bound = true;
    const start = (event) => {
      if (event.target.closest("button, input, select, textarea, label, a")) return;
      const rect = refs.panel.getBoundingClientRect();
      state.drag.active = true;
      state.drag.pointerId = event.pointerId;
      state.drag.startX = event.clientX;
      state.drag.startY = event.clientY;
      state.drag.left = rect.left;
      state.drag.top = rect.top;
      refs.header.style.cursor = "grabbing";
      refs.header.setPointerCapture(event.pointerId);
    };

    const move = (event) => {
      if (!state.drag.active || event.pointerId !== state.drag.pointerId) return;
      const nextLeft = state.drag.left + (event.clientX - state.drag.startX);
      const nextTop = state.drag.top + (event.clientY - state.drag.startY);
      refs.panel.style.left = `${nextLeft}px`;
      refs.panel.style.top = `${nextTop}px`;
      refs.panel.style.right = "auto";
      clampPanel();
    };

    const end = (event) => {
      if (!state.drag.active || event.pointerId !== state.drag.pointerId) return;
      state.drag.active = false;
      refs.header.style.cursor = "grab";
      try { refs.header.releasePointerCapture(event.pointerId); } catch (error) {}
    };

    refs.header.addEventListener("pointerdown", start);
    refs.header.addEventListener("pointermove", move);
    refs.header.addEventListener("pointerup", end);
    refs.header.addEventListener("pointercancel", end);
  }

  function clampPanel() {
    const rect = refs.panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left;
    let top = rect.top;

    if (Number.isNaN(left) || Number.isNaN(top)) return;
    if (!refs.panel.style.left) {
      left = Math.max(8, vw - rect.width - 18);
      refs.panel.style.left = `${left}px`;
      refs.panel.style.right = "auto";
    }
    if (!refs.panel.style.top) {
      top = 52;
      refs.panel.style.top = `${top}px`;
    }

    left = Math.min(Math.max(8, parseFloat(refs.panel.style.left) || left), Math.max(8, vw - rect.width - 8));
    top = Math.min(Math.max(8, parseFloat(refs.panel.style.top) || top), Math.max(8, vh - Math.min(rect.height, vh - 16) - 8));
    refs.panel.style.left = `${left}px`;
    refs.panel.style.top = `${top}px`;
  }

  function destroyPanel(reason) {
    if (state.destroyed) return;
    state.destroyed = true;
    clearApproveContextLocal();
    stopAutoSync();
    clearDepositAutoApproveTimer();
    if (state.deferredFlushTimer) {
      clearTimeout(state.deferredFlushTimer);
      state.deferredFlushTimer = 0;
    }
    clearScheduledRefresh("depo");
    clearScheduledRefresh("wd");
    while (state.cleanupFns.length) {
      const fn = state.cleanupFns.pop();
      try { if (typeof fn === "function") fn(); } catch (error) { console.error(error); }
    }
    ["depo", "wd"].forEach((type) => {
      const controller = state.abortControllers[type];
      if (controller) {
        try { controller.abort(); } catch (error) {}
        state.abortControllers[type] = null;
      }
      const closeFn = state.menuCloseFns[type];
      if (closeFn) {
        document.removeEventListener("mousedown", closeFn, true);
        state.menuCloseFns[type] = null;
      }
    });
    if (state.menuCloseFns.depoAutoApproveLock) {
      document.removeEventListener("mousedown", state.menuCloseFns.depoAutoApproveLock, true);
      state.menuCloseFns.depoAutoApproveLock = null;
    }
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleWindowFocus);
    window.removeEventListener("resize", clampPanel);
    if (window[PANEL_SHARED_KEY] === panelSharedApi) {
      delete window[PANEL_SHARED_KEY];
    }
    if (window[INSTANCE_KEY] && window[INSTANCE_KEY].destroy === destroyPanel) {
      delete window[INSTANCE_KEY];
    }
    refs.panel.remove();
  }

  function extractRowId(row, prefix) {
    if (!row || !row.id) return "";
    return row.id.startsWith(prefix) ? row.id.slice(prefix.length) : "";
  }

  function findNumericSuffix(className, prefix) {
    const match = String(className || "").match(new RegExp(`${prefix}(\\d+)`));
    return match ? match[1] : "";
  }

  function hashString(value) {
    const str = String(value || "");
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cssEscapeSafe(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }

  const panelSharedApi = {
    scheduleSectionRefresh,
    extractApproveId: extractApproveIdLocal,
    recentlyHandled: recentlyHandledLocal,
    setApproveContext: setApproveContextLocal,
    clearApproveContext: clearApproveContextLocal
  };

  window[PANEL_SHARED_KEY] = panelSharedApi;

  window[INSTANCE_KEY] = {
    destroy: destroyPanel,
    switchTab,
    refresh(type = state.activeTab) {
      if (!isPanelAlive() || !isAuthenticated()) return;
      loadSection(type, { busyText: "Refreshing..." });
    },
    logout() {
      clearAuthSession();
      showAuthGate();
    }
  };
})();



;(() => {
  const PANEL_ID = "pendingPanelFull";
  const INSTANCE_KEY = "__pendingPanelFullInstance";
  const USER_TAB_ID = "ppUserTab";
  const STORAGE_KEY = "__pp_gs_config_v2";
  const QUEUE_KEY = "__pp_gs_queue_v2";
  const SEEN_KEY = "__pp_gs_seen_v2";
  const DEAD_KEY = "__pp_gs_dead_v2";
  const WRAP_LOCK = "__ppGsWrapInstalled";
  const APPROVE_CTX_KEY = "__ppGsApproveCtx";
  const RECENT_IDS = new Map();

  if (window.__PP_GS_USER_TAB_PATCH__) return;
  window.__PP_GS_USER_TAB_PATCH__ = true;

  const DEFAULT_CFG = {
    enabled: false,
    autoCopy: false,
    urls: { A: "", B: "", C: "", D: "", E: "" },
    colMap: {
      BCA: "", MANDIRI: "", BNI: "", BRI: "", BSI: "", CIMB: "", SEABANK: "", DANAMON: "", ANTARBANK: "", JENIUS: "",
      DANA: "", OVO: "", GOPAY: "", LINKAJA: "",
      TELKOMSEL: "", AXIATA: "",
      WD_BCA: "", WD_MANDIRI: "", WD_BNI: "", WD_BRI: "", WD_BSI: "", WD_CIMB: "", WD_SEABANK: "", WD_DANAMON: "", WD_ANTARBANK: "", WD_JENIUS: "",
      WD_DANA: "", WD_OVO: "", WD_GOPAY: "", WD_LINKAJA: "",
      WITHDRAW: ""
    },
    stats: { okAt: 0, errAt: 0 }
  };

  const memoryQueue = { deposit: [], withdraw: [], ewallet: [], pulsa: [] };
  let flushBusy = false;
  let flushTimer = 0;
  let flushTimerAt = 0;
  let uiStyleInjected = false;
  let wrappedSignature = "";
  let wrapWatchTimer = 0;

  function getPanelShared() {
    return window.__ppPendingShared || {};
  }

  function schedulePanelRefresh(type, immediate) {
    const shared = getPanelShared();
    if (shared && typeof shared.scheduleSectionRefresh === "function") {
      return shared.scheduleSectionRefresh(type, immediate);
    }
    const inst = window[INSTANCE_KEY];
    if (inst && typeof inst.refresh === "function") {
      return window.setTimeout(() => {
        try { inst.refresh(type); } catch (_) {}
      }, immediate ? 80 : 0);
    }
    return null;
  }

  function now() { return Date.now(); }

  function compactUrl(value, head = 42, tail = 18) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (url.length <= head + tail + 3) return url;
    return `${url.slice(0, head)}...${url.slice(-tail)}`;
  }

  async function showNativeBrowserNotice(title, body) {
    try {
      if (!("Notification" in window)) return false;
      if (Notification.permission === "granted") {
        new Notification(title, { body, tag: "pp-gsheet-toggle" });
        return true;
      }
      if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(title, { body, tag: "pp-gsheet-toggle" });
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function loadCfg() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        enabled: !!raw.enabled,
        autoCopy: !!raw.autoCopy,
        urls: { ...DEFAULT_CFG.urls, ...(raw.urls || {}) },
        colMap: { ...DEFAULT_CFG.colMap, ...(raw.colMap || {}) },
        stats: { ...DEFAULT_CFG.stats, ...(raw.stats || {}) }
      };
    } catch (_) {
      return JSON.parse(JSON.stringify(DEFAULT_CFG));
    }
  }

  function saveCfg(next) {
    const cfg = {
      enabled: !!next.enabled,
      autoCopy: !!next.autoCopy,
      urls: { ...DEFAULT_CFG.urls, ...(next.urls || {}) },
      colMap: { ...DEFAULT_CFG.colMap, ...(next.colMap || {}) },
      stats: { ...DEFAULT_CFG.stats, ...(next.stats || {}) }
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (_) {}
    renderUserTabIfVisible();
    return cfg;
  }

  function isGsOn() { return !!loadCfg().enabled; }
  function isAutoCopyOn() { return !!loadCfg().autoCopy; }
  function setGsOn(enabled) {
    const cfg = loadCfg();
    cfg.enabled = !!enabled;
    const saved = saveCfg(cfg);
    if (saved.enabled && getPendingCount() > 0) scheduleFlush(0);
    return saved;
  }
  function setAutoCopyOn(enabled) {
    const cfg = loadCfg();
    cfg.autoCopy = !!enabled;
    return saveCfg(cfg);
  }
  function getGsUrls() { return loadCfg().urls; }
  function setGsUrls(a, b, c, d, e) {
    const cfg = loadCfg();
    cfg.urls = { A: (a || "").trim(), B: (b || "").trim(), C: (c || "").trim(), D: (d || "").trim(), E: (e || "").trim() };
    const saved = saveCfg(cfg);
    if (saved.enabled && getPendingCount() > 0) scheduleFlush(0);
    return saved;
  }
  function getColMap() { return loadCfg().colMap; }
  function setColMap(map) {
    const cfg = loadCfg();
    cfg.colMap = { ...DEFAULT_CFG.colMap, ...(map || {}) };
    return saveCfg(cfg);
  }
  function updateStats(patch) {
    const cfg = loadCfg();
    cfg.stats = { ...cfg.stats, ...(patch || {}) };
    saveCfg(cfg);
  }

  function loadSeen() {
    try {
      const arr = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }
  function saveSeen(arr) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify((arr || []).slice(-600))); } catch (_) {}
  }
  function seenHas(sig) {
    const arr = loadSeen();
    for (let i = arr.length - 1; i >= 0; i -= 1) {
      if (arr[i] === sig) return true;
    }
    return false;
  }
  function seenAddMany(sigs) {
    if (!sigs || !sigs.length) return;
    const arr = loadSeen();
    sigs.forEach((sig) => arr.push(sig));
    saveSeen(arr);
  }

  function loadPersistedQueue() {
    try {
      const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) || "{}");
      return {
        deposit: Array.isArray(raw.deposit) ? raw.deposit : [],
        withdraw: Array.isArray(raw.withdraw) ? raw.withdraw : [],
        ewallet: Array.isArray(raw.ewallet) ? raw.ewallet : [],
        pulsa: Array.isArray(raw.pulsa) ? raw.pulsa : []
      };
    } catch (_) {
      return { deposit: [], withdraw: [], ewallet: [], pulsa: [] };
    }
  }

  function savePersistedQueue(queue) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify({
        deposit: queue.deposit || [],
        withdraw: queue.withdraw || [],
        ewallet: queue.ewallet || [],
        pulsa: queue.pulsa || []
      }));
    } catch (_) {}
  }

  function hydrateQueueFromStorage() {
    const stored = loadPersistedQueue();
    ["deposit", "withdraw", "ewallet", "pulsa"].forEach((type) => {
      if (stored[type] && stored[type].length) {
        memoryQueue[type].push(...stored[type]);
      }
    });
    savePersistedQueue({ deposit: [], withdraw: [], ewallet: [], pulsa: [] });
  }

  function persistMemoryQueue() {
    savePersistedQueue(memoryQueue);
  }

  function pushDead(type, rows) {
    if (!rows || !rows.length) return;
    let dead = [];
    try { dead = JSON.parse(localStorage.getItem(DEAD_KEY) || "[]"); } catch (_) {}
    if (!Array.isArray(dead)) dead = [];
    rows.forEach((row) => dead.push({ type, row, ts: now() }));
    try { localStorage.setItem(DEAD_KEY, JSON.stringify(dead.slice(-300))); } catch (_) {}
  }

  function hashRow(value) {
    const str = JSON.stringify(value || "");
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function getRowTargetCol(row) {
    const arr = Array.isArray(row) ? row : [];
    return String(arr[arr.length - 1] == null ? "" : arr[arr.length - 1]).trim().toUpperCase();
  }

  function getRowTxKey(type, row) {
    const arr = Array.isArray(row) ? row : [];
    const upperType = String(type || "").toLowerCase();
    if (upperType === "deposit" || upperType === "ewallet" || upperType === "withdraw") {
      const txKey = String(arr[4] == null ? "" : arr[4]).trim();
      if (txKey) return `${upperType}|${txKey}`;
    }
    return "";
  }

  function rowQueueSig(type, row) {
    const upperType = String(type || "").toLowerCase();
    const txKey = getRowTxKey(upperType, row);
    if (txKey) return `tx|${txKey}`;
    const arr = Array.isArray(row) ? row.slice() : [];
    return `raw|${upperType}|${hashRow([upperType].concat(arr).concat([getRowTargetCol(arr)]))}`;
  }

  function rowSeenSig(type, row) {
    const upperType = String(type || "").toLowerCase();
    const txKey = getRowTxKey(upperType, row);
    return txKey ? `tx|${txKey}` : "";
  }

  function dedupeRowsBySig(rows, type, mode = "queue") {
    const out = [];
    const seen = new Set();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const sig = mode === "seen" ? rowSeenSig(type, row) : rowQueueSig(type, row);
      if (sig && seen.has(sig)) return;
      if (sig) seen.add(sig);
      out.push(row);
    });
    return out;
  }

  function encodedSize(rows) {
    try {
      return new TextEncoder().encode("data=" + encodeURIComponent(JSON.stringify(rows || []))).length;
    } catch (_) {
      return ("data=" + encodeURIComponent(JSON.stringify(rows || []))).length;
    }
  }

  function chunkRows(rows, maxRows = 80, maxBytes = 180000) {
    const out = [];
    let i = 0;
    while (i < rows.length) {
      const chunk = [];
      while (i < rows.length && chunk.length < maxRows) {
        chunk.push(rows[i]);
        if (encodedSize(chunk) > maxBytes) {
          chunk.pop();
          break;
        }
        i += 1;
      }
      if (!chunk.length && i < rows.length) {
        chunk.push(rows[i]);
        i += 1;
      }
      out.push(chunk);
    }
    return out;
  }

  function getPendingCount() {
    const stored = loadPersistedQueue();
    return memoryQueue.deposit.length + memoryQueue.withdraw.length + memoryQueue.ewallet.length + memoryQueue.pulsa.length
      + stored.deposit.length + stored.withdraw.length + stored.ewallet.length + stored.pulsa.length;
  }

  function enqueueRows(rows, type) {
    if (!Array.isArray(rows) || !rows.length) return;
    const target = memoryQueue[type];
    if (!target) return;
    const stored = loadPersistedQueue();
    const existing = new Set();
    target.forEach((row) => existing.add(rowQueueSig(type, row)));
    (stored[type] || []).forEach((row) => existing.add(rowQueueSig(type, row)));
    dedupeRowsBySig(rows, type, "queue").forEach((row) => {
      const sig = rowQueueSig(type, row);
      if (sig && existing.has(sig)) return;
      if (sig) existing.add(sig);
      target.push(row);
    });
    persistMemoryQueue();
    renderUserTabIfVisible();
    scheduleFlush();
  }

  function sendToGSheetBatch(rows, type) {
    if (!isGsOn()) return;
    enqueueRows(rows, type);
  }

  function getCfgNetwork() {
    const base = { CONC: 3, RETRY: 3, BASE_DELAY: 220, MAX_ROWS: 60, MAX_BYTES: 150000 };
    try {
      const eff = navigator.connection && navigator.connection.effectiveType;
      if (eff === "slow-2g" || eff === "2g") return { CONC: 1, RETRY: 2, BASE_DELAY: 350, MAX_ROWS: 20, MAX_BYTES: 50000 };
      if (eff === "3g") return { CONC: 2, RETRY: 3, BASE_DELAY: 260, MAX_ROWS: 35, MAX_BYTES: 90000 };
    } catch (_) {}
    return base;
  }

  async function copyPlainText(text) {
    const value = String(text || "").replace(/\r/g, "").trim();
    if (!value) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      ta.style.top = "-9999px";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  function getCopyMatrix(type, rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const arr = Array.isArray(row) ? row : [];
      if (type === "pulsa") {
        return [arr[0] || "", arr[1] || "", arr[2] || "", arr[3] || "", arr[4] || "", arr[5] || "", arr[6] || ""]
          .map((v) => String(v == null ? "" : v));
      }
      return [arr[0] || "", arr[1] || "", arr[2] || ""]
        .map((v) => String(v == null ? "" : v));
    }).filter((cells) => cells.some((value) => String(value || "") !== ""));
  }

  function buildCopyTextFromMatrix(matrix) {
    return (Array.isArray(matrix) ? matrix : []).map((cells) => cells.join("\t")).join("\r\n");
  }

  function escapeClipboardHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\r?\n/g, "<br>");
  }

  function buildCopyHtmlFromMatrix(matrix) {
    const rows = (Array.isArray(matrix) ? matrix : []).map((cells) => {
      const tds = (Array.isArray(cells) ? cells : []).map((value) => `<td>${escapeClipboardHtml(value)}</td>`).join("");
      return `<tr>${tds}</tr>`;
    }).join("");
    return `<table><tbody>${rows}</tbody></table>`;
  }

  async function copyStructuredMatrix(matrix) {
    const text = buildCopyTextFromMatrix(matrix);
    if (!text) return false;
    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.write === "function" &&
        typeof window.ClipboardItem === "function"
      ) {
        const html = buildCopyHtmlFromMatrix(matrix);
        const item = new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/tab-separated-values": new Blob([text], { type: "text/tab-separated-values" }),
          "text/html": new Blob([html], { type: "text/html" })
        });
        await navigator.clipboard.write([item]);
        return true;
      }
    } catch (_) {}
    return copyPlainText(text);
  }

  async function autoCopyPayload(payload) {
    if (!isAutoCopyOn() || !payload || !Array.isArray(payload.rows) || !payload.rows.length) return false;
    const matrix = getCopyMatrix(payload.type, payload.rows);
    if (!matrix.length) return false;
    const text = buildCopyTextFromMatrix(matrix);
    const ok = await copyStructuredMatrix(matrix);
    if (ok) console.info("[PP-AUTO-COPY] copied", payload.type, text);
    else console.warn("[PP-AUTO-COPY] failed", payload.type);
    return ok;
  }

  async function timeoutFetch(url, body, timeoutMs = 9000) {
    const ctrl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => {
      try { ctrl && ctrl.abort(); } catch (_) {}
    }, timeoutMs);

    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ data: JSON.stringify(body) }),
        signal: ctrl ? ctrl.signal : undefined
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function getQueuedRowBankKey(type, row) {
    const arr = Array.isArray(row) ? row : [];
    if (type === "withdraw") {
      const label = String(arr[3] == null ? "" : arr[3]).trim();
      const match = label.match(/WITHDRAW\s+(.+)/i);
      return normalizeBankKey(match ? match[1] : label);
    }
    if (type === "deposit" || type === "ewallet") {
      return normalizeBankKey(arr[3] == null ? "" : arr[3]);
    }
    return "";
  }

  function resolveEndpointForQueuedRow(type, row, urls = getGsUrls()) {
    const bankKey = getQueuedRowBankKey(type, row);
    if (bankKey === "DANA" && urls.E) return { url: urls.E || "", route: "dana", bankKey };
    if (type === "withdraw") return { url: urls.B || "", route: "withdraw", bankKey };
    if (type === "ewallet") return { url: urls.C || "", route: "ewallet", bankKey };
    if (type === "pulsa") return { url: urls.D || "", route: "pulsa", bankKey };
    return { url: urls.A || "", route: "deposit", bankKey };
  }

  async function fetchRetry(url, rows, type, maxRetry, baseDelay) {
    let attempt = 0;
    while (true) {
      try {
        const res = await timeoutFetch(url, rows, 9000);
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            pushDead(type, rows);
            updateStats({ errAt: now() });
            return null;
          }
          throw new Error("HTTP " + res.status);
        }
        updateStats({ okAt: now() });
        return true;
      } catch (error) {
        updateStats({ errAt: now() });
        attempt += 1;
        if (attempt > maxRetry) throw error;
        const wait = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 120);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  async function runPool(tasks, limit) {
    let i = 0;
    let active = 0;
    let done = 0;
    return new Promise((resolve) => {
      const pump = () => {
        if (done === tasks.length) return resolve();
        while (active < limit && i < tasks.length) {
          const fn = tasks[i++];
          active += 1;
          Promise.resolve()
            .then(() => fn())
            .catch(() => {})
            .finally(() => {
              active -= 1;
              done += 1;
              pump();
            });
        }
      };
      pump();
    });
  }

  function scheduleFlush(delay = 60) {
    if (!isGsOn()) return;
    if (navigator.onLine === false) return;
    const pending = getPendingCount();
    if (!pending && delay > 0) return;

    let nextDelay = Math.max(0, Number(delay) || 0);
    if (pending >= 80) nextDelay = Math.min(nextDelay, 15);
    else if (pending >= 30) nextDelay = Math.min(nextDelay, 30);
    else if (pending >= 10) nextDelay = Math.min(nextDelay, 45);
    if (document.visibilityState === "hidden" && nextDelay > 0) {
      nextDelay = Math.max(nextDelay, 180);
    }

    const targetAt = Date.now() + nextDelay;
    if (flushBusy) {
      flushTimerAt = flushTimerAt ? Math.min(flushTimerAt, targetAt) : targetAt;
      return;
    }
    if (flushTimer && flushTimerAt && flushTimerAt <= targetAt) return;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = 0;
    }
    flushTimerAt = targetAt;
    flushTimer = setTimeout(async () => {
      flushTimer = 0;
      flushTimerAt = 0;
      await flushSend();
    }, nextDelay);
  }

  async function flushSend() {
    if (!isGsOn()) return;
    if (flushBusy) {
      scheduleFlush(120);
      return;
    }
    if (navigator.onLine === false) {
      scheduleFlush(800);
      return;
    }
    flushBusy = true;
    hydrateQueueFromStorage();

    const urls = getGsUrls();
    const plan = [
      { type: "deposit" },
      { type: "withdraw" },
      { type: "ewallet" },
      { type: "pulsa" }
    ];
    const cfg = getCfgNetwork();
    const seenSet = new Set(loadSeen());
    const seenToAppend = [];

    try {
      const tasks = [];
      for (const item of plan) {
        const buf = memoryQueue[item.type];
        if (!buf.length) continue;
        const sending = dedupeRowsBySig(buf.splice(0, buf.length), item.type, "queue");
        const filtered = sending.filter((row) => {
          const sig = rowSeenSig(item.type, row);
          return !sig || !seenSet.has(sig);
        });
        if (!filtered.length) continue;

        const bucketMap = new Map();
        filtered.forEach((row) => {
          const endpointInfo = resolveEndpointForQueuedRow(item.type, row, urls);
          if (!endpointInfo.url) {
            memoryQueue[item.type].push(row);
            return;
          }
          const bucketKey = `${endpointInfo.route}|${endpointInfo.url}`;
          if (!bucketMap.has(bucketKey)) bucketMap.set(bucketKey, { url: endpointInfo.url, route: endpointInfo.route, rows: [] });
          bucketMap.get(bucketKey).rows.push(row);
        });

        bucketMap.forEach((bucket) => {
          const chunks = chunkRows(bucket.rows, cfg.MAX_ROWS, cfg.MAX_BYTES);
          chunks.forEach((chunk) => {
            tasks.push(async () => {
              try {
                const ok = await fetchRetry(bucket.url, chunk, item.type, cfg.RETRY, cfg.BASE_DELAY);
                if (ok === true) {
                  chunk.map((row) => rowSeenSig(item.type, row)).filter(Boolean).forEach((sig) => {
                    if (!seenSet.has(sig)) {
                      seenSet.add(sig);
                      seenToAppend.push(sig);
                    }
                  });
                  return;
                }
                if (ok === false) {
                  chunk.forEach((row) => memoryQueue[item.type].push(row));
                }
              } catch (_) {
                chunk.forEach((row) => memoryQueue[item.type].push(row));
              }
            });
          });
        });
      }
      if (tasks.length) {
        await runPool(tasks, cfg.CONC);
      }
      if (seenToAppend.length) {
        saveSeen(Array.from(seenSet).slice(-600));
      }
    } finally {
      flushBusy = false;
      persistMemoryQueue();
      renderUserTabIfVisible();
      const remain = getPendingCount();
      if (remain > 0) {
        scheduleFlush(document.visibilityState === "hidden" ? 420 : (remain >= 30 ? 35 : 140));
      }
    }
  }

  function normalizeBankKey(value) {
    const v = String(value || "").toUpperCase();
    if (!v) return "";
    if (v.includes("AXIATA") || v === "XL") return "AXIATA";
    if (v.includes("TELKOMSEL") || v === "TSEL") return "TELKOMSEL";
    if (v.includes("MANDIRI")) return "MANDIRI";
    if (v.includes("ANTARBANK")) return "ANTARBANK";
    if (v.includes("LINKAJA")) return "LINKAJA";
    if (v.includes("SEA BANK") || v.includes("SEABANK")) return "SEABANK";
    if (v.includes("CIMB")) return "CIMB";
    if (v.includes("BSI") || v.includes("SYARIAH INDONESIA")) return "BSI";
    return v.replace(/[^A-Z0-9]/g, "");
  }

  function getBankLabelText(type, value) {
    const helpers = window.__ppPendingBankHelpers;
    if (helpers && typeof helpers.getLabelByValue === "function") {
      const label = helpers.getLabelByValue(type, value);
      if (label) return label;
    }
    return normalizeBankKey(value) || String(value || "").trim();
  }

  function routeTypeForBank(bankName) {
    const key = normalizeBankKey(bankName);
    if (["TELKOMSEL", "AXIATA"].includes(key)) return "pulsa";
    if (["DANA", "OVO", "GOPAY", "LINKAJA"].includes(key)) {
      return "ewallet";
    }
    return "deposit";
  }

  function pickTargetCol(keyName) {
    const map = getColMap();
    const key = normalizeBankKey(keyName);
    return (map[key] || "").trim();
  }

  function pickWithdrawTargetCol(keyName) {
    const map = getColMap();
    const key = normalizeBankKey(keyName);
    if (key) {
      const exact = (map["WD_" + key] || "").trim();
      if (exact) return exact;
    }
    return (map.WITHDRAW || "").trim();
  }

  function formatNumber(value) {
    const n = Number(value || 0);
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function genNonce() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function textFromNode(node) {
    return String(node && (node.value != null ? node.value : node.textContent) || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function collectRowStrings(row) {
    if (!row) return [];
    const values = [];
    row.querySelectorAll("input, textarea, select").forEach((el) => {
      const val = textFromNode(el);
      if (val) values.push(val);
    });
    row.querySelectorAll("td, div, span, strong, small").forEach((el) => {
      const val = textFromNode(el);
      if (val) values.push(val);
    });
    return [...new Set(values)];
  }

  function getBankNameFromRow(row) {
    if (!row) return "";
    const img = row.querySelector("img[src*='logo-']");
    if (img) {
      const src = img.getAttribute("src") || "";
      const match = src.match(/logo-([^.\/]+)\./i);
      if (match) return normalizeBankKey(match[1]);
    }
    const texts = collectRowStrings(row);
    const known = ["BCA","MANDIRI","BNI","BRI","BSI","CIMB","SEABANK","DANAMON","ANTARBANK","JENIUS","DANA","OVO","GOPAY","LINKAJA","TELKOMSEL","AXIATA","XL"];
    for (const text of texts) {
      const upper = normalizeBankKey(text);
      if (known.includes(upper)) return upper;
      for (const k of known) {
        if (text.toUpperCase().includes(k)) return k === "XL" ? "AXIATA" : k;
      }
    }
    return "";
  }

  function getDepositTargetKey(row, id) {
    if (!row) return "";
    const known = ["BCA","MANDIRI","BNI","BRI","BSI","CIMB","SEABANK","DANAMON","ANTARBANK","JENIUS","DANA","OVO","GOPAY","LINKAJA","TELKOMSEL","AXIATA"];
    const depoInput = row.querySelector(`.deporekform[att="${id}"]`) || row.querySelector(`.deporek${id} .deporekform`) || row.querySelector(`.deporek${id} input.form-control[readonly]`) || row.querySelector(".deporekform");
    const direct = findKnownTransferKey(textFromNode(depoInput), known);
    if (direct) return direct;

    const hidden = row.querySelector(`.rek${id}`) || row.querySelector(`input.rek${id}`) || row.querySelector("input[class^='rek']");
    const code = hidden ? String(hidden.value || "").trim() : "";
    if (code) {
      const foundText = getBankLabelText("depo", code);
      const mapped = foundText ? findKnownTransferKey(foundText, known) : "";
      if (mapped) return mapped;
    }

    const targetWrap = row.children && row.children[5] ? row.children[5] : null;
    if (targetWrap) {
      const targetImg = targetWrap.querySelector("img[src*='logo-']");
      if (targetImg) {
        const src = targetImg.getAttribute("src") || "";
        const match = src.match(/logo-([^.\/]+)\./i);
        const imgKey = match ? normalizeBankKey(match[1]) : "";
        if (imgKey) return imgKey;
      }
      const texts = collectRowStrings(targetWrap);
      for (const text of texts) {
        const match = findKnownTransferKey(text, known);
        if (match) return match;
      }
    }

    return getBankNameFromRow(row);
  }

  function findKnownTransferKey(text, knownKeys) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const upper = raw.toUpperCase();
    const norm = normalizeBankKey(raw);
    if (knownKeys.includes(norm)) return norm;
    for (const key of knownKeys) {
      if (key === "SEABANK" && /SEA\s*BANK|SEABANK/.test(upper)) return "SEABANK";
      if (key === "BSI" && /BSI|SYARIAH INDONESIA/.test(upper)) return "BSI";
      if (key === "LINKAJA" && /LINK\s*AJA|LINKAJA/.test(upper)) return "LINKAJA";
      if (upper.includes(key)) return key;
    }
    return "";
  }

  function getWithdrawSourceKey(row, id) {
    if (!row) return "";
    const known = ["BCA","MANDIRI","BNI","BRI","BSI","CIMB","SEABANK","DANAMON","ANTARBANK","JENIUS","DANA","OVO","GOPAY","LINKAJA"];
    const wdInput = row.querySelector(`#wdrek${id}`) || row.querySelector(`.wdrekform[att="${id}"]`) || row.querySelector(".wdrekform");
    const direct = findKnownTransferKey(textFromNode(wdInput), known);
    if (direct) return direct;

    const hidden = row.querySelector(`.rek${id}`) || row.querySelector(`input.rek${id}`) || row.querySelector("input[class^='rek']");
    const code = hidden ? String(hidden.value || "").trim() : "";
    if (code) {
      const foundText = getBankLabelText("wd", code);
      const mapped = foundText ? findKnownTransferKey(foundText, known) : "";
      if (mapped) return mapped;
    }

    const texts = collectRowStrings(row);
    for (const text of texts) {
      const match = findKnownTransferKey(text, known);
      if (match) return match;
    }
    return "";
  }

  function getNominalFromRow(row, id) {
    if (!row) return 0;
    const specific = row.querySelector(`.jumlah${id || ""}`);
    if (specific) {
      const raw = (specific.value || specific.textContent || "").replace(/[^\d.]/g, "");
      if (raw) return parseFloat(raw) || 0;
    }
    let best = 0;
    collectRowStrings(row).forEach((txt) => {
      const m = txt.match(/-?\d[\d.,]*/g);
      if (!m) return;
      m.forEach((part) => {
        const cleaned = part.replace(/,/g, "");
        const num = parseFloat(cleaned);
        if (Number.isFinite(num) && Math.abs(num) > best) best = Math.abs(num);
      });
    });
    return best;
  }

  function getNumberOrSnFromRow(row) {
    if (!row) return "";
    const direct = row.querySelector("td:nth-child(5) .row:nth-child(2) input");
    if (direct && direct.value) return String(direct.value).trim();
    const inputs = [...row.querySelectorAll("input")].map((el) => (el.value || "").trim()).filter(Boolean);
    const numeric = inputs.find((v) => /^[0-9]{6,30}$/.test(v.replace(/\s+/g, "")));
    return numeric || "";
  }

  function extractLikelyUsernameToken(value) {
    const raw = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (!raw) return "";
    const tokens = raw.split(/[^A-Za-z0-9_.-]+/).map((v) => v.trim()).filter(Boolean);
    const blocked = /^(approve|approved|delete|reject|manual|auto|all|active|loading|bank|bonus|mutasi|refresh|pending|deposit|withdraw|note|catatan|jumlah|tanggal|action|approval|copy|click|open|show|select|dana|ovo|gopay|linkaja|bca|bni|bri|bsi|cimb|mandiri|seabank|danamon|jenius|antarbank|telkomsel|axiata)$/i;
    const ranked = tokens
      .filter((v) => /^[A-Za-z0-9_.-]{3,30}$/.test(v))
      .filter((v) => !/^\d+$/.test(v))
      .filter((v) => !blocked.test(v))
      .map((v) => {
        let score = 0;
        if (/[a-z]/.test(v)) score += 5;
        if (/\d/.test(v)) score += 4;
        if (/[_.-]/.test(v)) score += 2;
        if (/^[A-Z0-9_.-]+$/.test(v) && !/\d/.test(v)) score -= 5;
        if (/^(20\d{2}|\d{1,2})$/.test(v)) score -= 6;
        return { value: v, score };
      })
      .sort((a, b) => b.score - a.score || a.value.length - b.value.length);
    return ranked[0] ? ranked[0].value : "";
  }

  function getRowCellUsername(row) {
    if (!row) return "";
    const cells = [...row.children].filter((el) => el && el.tagName === "TD");
    const preferredIndexes = [2, 3, 1, 4];
    for (const index of preferredIndexes) {
      const cell = cells[index];
      if (!cell) continue;
      const hit = extractLikelyUsernameToken(textFromNode(cell));
      if (hit) return hit;
    }
    const candidates = [
      ...row.querySelectorAll("[data-username], [name*='username'], [id*='username'], [class*='username']"),
      ...row.querySelectorAll("strong, b, span, div, small, a")
    ];
    for (const node of candidates) {
      const hit = extractLikelyUsernameToken(textFromNode(node));
      if (hit) return hit;
    }
    return "";
  }

  function getExactUsername(row, id, kind) {
    if (!row) return "";
    const exactClass = kind === "deposit" ? `.rowDepoPendingUsername${id}` : `.rowWDPendingUsername${id}`;
    const exactNode = row.querySelector(exactClass);
    if (exactNode) {
      const val = extractLikelyUsernameToken(textFromNode(exactNode));
      if (val) return val;
    }
    const fromCells = getRowCellUsername(row);
    if (fromCells) return fromCells;
    const strongs = [...row.querySelectorAll("strong, b")]
      .map((el) => extractLikelyUsernameToken(textFromNode(el)))
      .filter(Boolean);
    if (strongs.length) return strongs[0];
    return "";
  }

  function isLikelyAmountText(value) {
    if (!value) return false;
    const s = String(value).trim();
    if (!s) return false;
    return /^\(?\d[\d.,]*\)?$/.test(s);
  }

  function isLikelyBankTargetText(value) {
    if (!value) return false;
    const s = normalizeBankKey(value);
    return /^(BCA|MANDIRI|BNI|BRI|BSI|CIMB|SEABANK|DANAMON|ANTARBANK|JENIUS|DANA|OVO|GOPAY|LINKAJA|TELKOMSEL|AXIATA|XL)\b/.test(s);
  }

  function getExactAccountName(row, username) {
    if (!row) return "";
    const inputs = [...row.querySelectorAll("td input.form-control[readonly], td input[readonly]")]
      .map((el) => textFromNode(el))
      .filter(Boolean)
      .filter((v) => !/^\d{6,30}$/.test(v.replace(/\s+/g, "")))
      .filter((v) => !isLikelyAmountText(v))
      .filter((v) => !isLikelyBankTargetText(v))
      .filter((v) => !username || v.toLowerCase() !== String(username).toLowerCase());
    if (inputs.length) return inputs[0].toUpperCase();
    return "";
  }

  function guessUsername(row, id, kind) {
    const exact = getExactUsername(row, id, kind);
    if (exact) return exact;
    const fromCells = getRowCellUsername(row);
    if (fromCells) return fromCells;
    const texts = collectRowStrings(row);
    for (const text of texts) {
      const m = text.match(/\b(?:user(?:name)?|userid|user id)\s*[:\-]?\s*([A-Za-z0-9_.-]{3,30})/i);
      if (m) return m[1];
    }
    const candidates = texts
      .map((txt) => extractLikelyUsernameToken(txt))
      .filter(Boolean);
    return candidates[0] || "";
  }

  function guessName(row, username) {
    const exact = getExactAccountName(row, username);
    if (exact) return exact;
    const texts = collectRowStrings(row);
    for (const text of texts) {
      const m = text.match(/(?:nama(?: rekening)?|account name)\s*[:\-]?\s*([A-Za-z][A-Za-z '.-]{3,})/i);
      if (m) return m[1].trim().toUpperCase();
    }
    const preferred = texts
      .filter((txt) => /[A-Za-z]/.test(txt))
      .filter((txt) => txt.length >= 4 && txt.length <= 60)
      .filter((txt) => !txt.includes(username))
      .filter((txt) => !/approve|delete|reject|show all|sort by|select bank|loading|refresh|pending|deposit|withdraw|bonus|click to copy/i.test(txt))
      .filter((txt) => !isLikelyAmountText(txt))
      .filter((txt) => !isLikelyBankTargetText(txt))
      .sort((a, b) => b.length - a.length);
    return (preferred[0] || "").toUpperCase();
  }

  function buildDepositPayload(id) {
    const row = document.getElementById("depositPending-" + id);
    if (!row) return null;
    const sourceKey = getBankNameFromRow(row);
    const targetKey = getDepositTargetKey(row, id) || sourceKey;
    const route = routeTypeForBank(targetKey);
    const username = guessUsername(row, id, "deposit");
    const nama = guessName(row, username);
    const nominal = getNominalFromRow(row, id);
    const nomorSn = getNumberOrSnFromRow(row);
    const targetCol = pickTargetCol(targetKey || (route === "pulsa" ? "TELKOMSEL" : ""));
    if (!targetCol || !nama || !username || !nominal) return null;

    if (route === "pulsa") {
      const potongan = nominal * 0.05;
      const jumlahDiproses = nominal - potongan;
      return {
        type: "pulsa",
        rows: [[nomorSn || "", nama, username, formatNumber(jumlahDiproses), formatNumber(potongan), "", formatNumber(nominal), targetCol]]
      };
    }

    const txKey = "DEP-" + id;
    const nonce = "DEP-N-" + id;
    return {
      type: route,
      rows: [[nama, username, formatNumber(nominal), targetKey || sourceKey || "DEPOSIT", txKey, nonce, targetCol]]
    };
  }

  function buildWithdrawPayload(id) {
    const row = document.getElementById("withdrawPending-" + id);
    if (!row) return null;
    const username = guessUsername(row, id, "withdraw");
    const nama = guessName(row, username);
    const nominal = getNominalFromRow(row, id);
    const sourceKey = getWithdrawSourceKey(row, id);
    const targetCol = pickWithdrawTargetCol(sourceKey);
    if (!targetCol || !nama || !username || !nominal) return null;
    const txKey = "WD-" + id;
    const nonce = "WD-N-" + id;
    return {
      type: "withdraw",
      rows: [[nama, username, "(" + formatNumber(nominal) + ")", sourceKey ? "WITHDRAW " + sourceKey : "WITHDRAW", txKey, nonce, targetCol]]
    };
  }

  function recentlyHandled(key, holdMs = 15000) {
    const ts = RECENT_IDS.get(key) || 0;
    if (now() - ts < holdMs) return true;
    RECENT_IDS.set(key, now());
    for (const [k, v] of RECENT_IDS.entries()) {
      if (now() - v > Math.max(holdMs, 15000)) RECENT_IDS.delete(k);
    }
    return false;
  }

  function extractApproveId(value, kind) {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (value && value.dataset && value.dataset.id) return String(value.dataset.id);
    const row = value && value.closest && value.closest(`tr[id^="${kind === "deposit" ? "depositPending-" : "withdrawPending-"}"]`);
    if (row && row.id) return row.id.replace(kind === "deposit" ? "depositPending-" : "withdrawPending-", "");
    return "";
  }

  function setApproveContext(source, kind, id) {
    if (!id) return;
    window[APPROVE_CTX_KEY] = { source: String(source || ""), kind: String(kind || ""), id: String(id), ts: now() };
  }

  function consumeApproveContext(kind, id) {
    const ctx = window[APPROVE_CTX_KEY];
    window[APPROVE_CTX_KEY] = null;
    if (!ctx || !id) return null;
    if (String(ctx.kind || "") !== String(kind || "")) return null;
    if (String(ctx.id || "") !== String(id)) return null;
    if (now() - (ctx.ts || 0) > 1500) return null;
    return ctx;
  }

  function installPanelApproveSourceCapture() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel || panel.__ppGsApproveCaptureBound) return;
    panel.__ppGsApproveCaptureBound = true;

    panel.addEventListener("click", (event) => {
      const button = event.target && event.target.closest && event.target.closest('button[onclick]');
      if (!button || !panel.contains(button)) return;
      const onclick = String(button.getAttribute("onclick") || "");
      if (/approveDeposit\(/.test(onclick)) {
        const id = extractApproveId(button, "deposit") || (onclick.match(/approveDeposit\((?:'|")?(\d+)/) || [])[1] || "";
        if (id) setApproveContext("panel-click", "deposit", id);
        return;
      }
      if (/approveWithdraw\(/.test(onclick)) {
        const id = extractApproveId(button, "withdraw") || (onclick.match(/approveWithdraw\((?:'|")?(\d+)/) || [])[1] || "";
        if (id) setApproveContext("panel-click", "withdraw", id);
      }
    }, true);
  }

  function invokeWithConfirmTracking(fn, ctx, argsLike) {
    const originalConfirm = window.confirm;
    let confirmSeen = false;
    let confirmAccepted = true;
    try {
      window.confirm = function () {
        confirmSeen = true;
        confirmAccepted = originalConfirm.apply(this, arguments);
        return confirmAccepted;
      };
      const result = fn.apply(ctx, argsLike);
      return { result, confirmSeen, confirmAccepted };
    } finally {
      window.confirm = originalConfirm;
    }
  }

  function shouldProcessNativeAction(meta) {
    if (!meta) return false;
    if (meta.confirmSeen && !meta.confirmAccepted) return false;
    if (meta.result === false) return false;
    return true;
  }

  function waitForPendingRowRemoval(kind, id, timeoutMs = 5000, intervalMs = 160) {
    return new Promise((resolve) => {
      const startedAt = now();
      const selector = `#${kind === "deposit" ? "depositPending-" : "withdrawPending-"}${id}`;
      const check = () => {
        if (!document.querySelector(selector)) {
          resolve(true);
          return;
        }
        if (now() - startedAt >= timeoutMs) {
          resolve(false);
          return;
        }
        window.setTimeout(check, intervalMs);
      };
      check();
    });
  }

  function wrapNativeApprovals() {
    const nativeDepo = window.approveDeposit;
    const nativeWd = window.approveWithdraw;
    const nativeDeleteDepo = window.deleteDeposit;
    const nativeDeleteWd = window.deleteWithdraw;
    const nextSignature = [nativeDepo, nativeWd, nativeDeleteDepo, nativeDeleteWd].map((fn) => typeof fn === "function" ? String(fn) : "").join("||");
    if (window[WRAP_LOCK] && wrappedSignature === nextSignature) return;
    if (typeof nativeDepo !== "function" || typeof nativeWd !== "function") return;

    window.approveDeposit = function () {
      const id = extractApproveId(arguments[0], "deposit");
      const ctx = consumeApproveContext("deposit", id);
      let payload = null;
      try {
        if (ctx && id && (isGsOn() || isAutoCopyOn())) {
          payload = buildDepositPayload(id);
        }
      } catch (error) {
        console.error("[PP-GS] buildDepositPayload failed", error);
      }
      const meta = invokeWithConfirmTracking(nativeDepo, this, arguments);
      try {
        if (shouldProcessNativeAction(meta) && ctx && payload && payload.rows && payload.rows.length) {
          queueMicrotask(async () => {
            try {
              const removed = await waitForPendingRowRemoval("deposit", id, ctx && ctx.source === "auto-deposit" ? 6500 : 5000, 170);
              if (!removed) return;
              if (recentlyHandled("panel-approve:deposit:" + id, 8000)) return;
              if (isGsOn()) sendToGSheetBatch(payload.rows, payload.type);
              if (isAutoCopyOn()) {
                await autoCopyPayload(payload).catch((error) => console.warn("[PP-AUTO-COPY] deposit failed", error));
              }
            } catch (error) {
              console.error("[PP-GS] deposit queue failed", error);
            }
          });
        }
        if (shouldProcessNativeAction(meta) && !(ctx && ctx.source === "auto-deposit")) {
          queueMicrotask(() => schedulePanelRefresh("depo", true));
        }
      } catch (error) {
        console.error("[PP-GS] deposit queue failed", error);
      }
      return meta.result;
    };

    window.approveWithdraw = function () {
      const id = extractApproveId(arguments[0], "withdraw");
      const ctx = consumeApproveContext("withdraw", id);
      let payload = null;
      try {
        if (ctx && id && (isGsOn() || isAutoCopyOn())) {
          payload = buildWithdrawPayload(id);
        }
      } catch (error) {
        console.error("[PP-GS] buildWithdrawPayload failed", error);
      }
      const meta = invokeWithConfirmTracking(nativeWd, this, arguments);
      try {
        if (shouldProcessNativeAction(meta) && ctx && payload && payload.rows && payload.rows.length) {
          queueMicrotask(async () => {
            try {
              const removed = await waitForPendingRowRemoval("withdraw", id, 5000, 170);
              if (!removed) return;
              if (recentlyHandled("panel-approve:withdraw:" + id, 8000)) return;
              if (isGsOn()) sendToGSheetBatch(payload.rows, payload.type);
              if (isAutoCopyOn()) {
                await autoCopyPayload(payload).catch((error) => console.warn("[PP-AUTO-COPY] withdraw failed", error));
              }
            } catch (error) {
              console.error("[PP-GS] withdraw queue failed", error);
            }
          });
        }
        if (shouldProcessNativeAction(meta)) {
          queueMicrotask(() => schedulePanelRefresh("wd", true));
        }
      } catch (error) {
        console.error("[PP-GS] withdraw queue failed", error);
      }
      return meta.result;
    };

    if (typeof nativeDeleteDepo === "function") {
      window.deleteDeposit = function () {
        const meta = invokeWithConfirmTracking(nativeDeleteDepo, this, arguments);
        if (shouldProcessNativeAction(meta)) {
          queueMicrotask(() => schedulePanelRefresh("depo", true));
        }
        return meta.result;
      };
    }

    if (typeof nativeDeleteWd === "function") {
      window.deleteWithdraw = function () {
        const meta = invokeWithConfirmTracking(nativeDeleteWd, this, arguments);
        if (shouldProcessNativeAction(meta)) {
          queueMicrotask(() => schedulePanelRefresh("wd", true));
        }
        return meta.result;
      };
    }

    wrappedSignature = nextSignature;
    window[WRAP_LOCK] = true;
  }

  function startWrapWatcher() {
    if (wrapWatchTimer) return;
    const tick = () => {
      wrapWatchTimer = window.setTimeout(() => {
        wrapWatchTimer = 0;
        try {
          wrapNativeApprovals();
        } catch (error) {
          console.error("[PP-GS] wrap watcher failed", error);
        }
        if (document.visibilityState !== "hidden") {
          startWrapWatcher();
        } else {
          wrapWatchTimer = window.setTimeout(() => {
            wrapWatchTimer = 0;
            startWrapWatcher();
          }, 10000);
        }
      }, document.visibilityState === "hidden" ? 6000 : 2200);
    };
    tick();
    window.addEventListener("pagehide", () => {
      if (wrapWatchTimer) {
        clearTimeout(wrapWatchTimer);
        wrapWatchTimer = 0;
      }
    }, { once: true });
  }

  function injectUserStyle() {
    if (uiStyleInjected) return;
    uiStyleInjected = true;
    const style = document.createElement("style");
    style.id = "ppUserGsStyle";
    style.textContent = `
      #${PANEL_ID} .pp-userCard{border:1px solid #dbe4ee;background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);border-radius:8px;padding:16px;box-shadow:0 10px 22px rgb(15 23 42 / .04)}
      #${PANEL_ID} .pp-userGrid{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:12px}
      #${PANEL_ID} .pp-userGrid3{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px}
      #${PANEL_ID} .pp-colSections{display:grid;gap:14px}
      #${PANEL_ID} .pp-colSection{border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:12px}
      #${PANEL_ID} .pp-colSectionHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap}
      #${PANEL_ID} .pp-colSectionTitle{display:inline-flex;align-items:center;gap:7px;min-height:28px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.04em;color:#0f172a;white-space:nowrap;flex-wrap:nowrap}\n      #${PANEL_ID} .pp-colSectionTitle .glyphicon{font-size:12px;line-height:1;flex:0 0 auto}\n      #${PANEL_ID} .pp-colSectionTitleText{display:inline-block;white-space:nowrap;line-height:1.1}
      #${PANEL_ID} .pp-colSectionNote{font-size:11px;color:#64748b}
      #${PANEL_ID} .pp-colSection.is-deposit{border-color:#badbcc;background:#f6fbf8}
      #${PANEL_ID} .pp-colSection.is-deposit .pp-colSectionTitle{background:#d1e7dd;color:#0f5132}
      #${PANEL_ID} .pp-colSection.is-withdraw{border-color:#f1bfc5;background:#fff8f8}
      #${PANEL_ID} .pp-colSection.is-withdraw .pp-colSectionTitle{background:#f8d7da;color:#842029}
      #${PANEL_ID} .pp-userField{display:flex;flex-direction:column;gap:6px;min-width:0}
      #${PANEL_ID} .pp-userField label{font-size:12px;font-weight:700;color:#334155}
      #${PANEL_ID} .pp-userInput{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:9px 11px;font-size:12px;line-height:1.45;background:#fff;min-width:0;transition:border-color .15s ease, box-shadow .15s ease}
      #${PANEL_ID} .pp-userInput:focus{border-color:#93c5fd;box-shadow:0 0 0 3px rgb(59 130 246 / .14);outline:0}
      #${PANEL_ID} .pp-userMuted{font-size:12px;color:#64748b;line-height:1.45}
      #${PANEL_ID} .pp-userTop{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      #${PANEL_ID} .pp-statusBadge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700}
      #${PANEL_ID} .pp-statusOn{background:#dcfce7;color:#166534}
      #${PANEL_ID} .pp-statusOff{background:#fee2e2;color:#991b1b}
      #${PANEL_ID} .pp-userActions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      #${PANEL_ID} .pp-testLayout{display:grid;grid-template-columns:minmax(280px,1.05fr) minmax(320px,1.15fr);gap:14px;margin-top:12px}
      #${PANEL_ID} .pp-testPane{border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:12px;min-width:0}
      #${PANEL_ID} .pp-testPaneHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
      #${PANEL_ID} .pp-testMetaGrid{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
      #${PANEL_ID} .pp-previewValue{display:flex;align-items:center;width:100%;min-height:40px;padding:9px 11px;border:1px solid #d7e0ea;border-radius:8px;background:#fff;color:#0f172a;font-size:12px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${PANEL_ID} .pp-previewValue.pp-previewMono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      #${PANEL_ID} .pp-userInput.pp-is-readonly{background:#f3f4f6;color:#6b7280;cursor:not-allowed}
      #${PANEL_ID} .pp-endpointPreview{display:block;position:relative;min-height:40px;max-height:none;overflow-x:auto;overflow-y:hidden;white-space:nowrap;word-break:normal;overflow-wrap:normal;text-overflow:clip;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);cursor:pointer;scrollbar-width:none;-ms-overflow-style:none}
      #${PANEL_ID} .pp-endpointPreview[data-has-url="1"]{cursor:pointer}
      #${PANEL_ID} .pp-endpointPreview::-webkit-scrollbar{width:0 !important;height:0 !important;display:none !important;background:transparent !important}
      #${PANEL_ID} .pp-testStatus{display:flex;align-items:center;gap:8px;min-height:44px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:12px 13px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;font-weight:700;color:#334155}
      #${PANEL_ID} .pp-testStatus::before{content:'';flex:0 0 auto;width:9px;height:9px;border-radius:999px;background:#94a3b8;box-shadow:0 0 0 4px rgba(148,163,184,.12)}
      #${PANEL_ID} .pp-testStatus.is-ok{background:#ecfdf5;border-color:#bbf7d0;color:#166534}
      #${PANEL_ID} .pp-testStatus.is-ok::before{background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.12)}
      #${PANEL_ID} .pp-testStatus.is-err{background:#fef2f2;border-color:#fecaca;color:#991b1b}
      #${PANEL_ID} .pp-testStatus.is-err::before{background:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.12)}
      #${PANEL_ID} .pp-codeArea{min-height:222px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;resize:none;background:#0f172a;color:#e2e8f0;border-color:#0f172a;line-height:1.55;padding:12px 13px;overflow:auto;scrollbar-width:none;-ms-overflow-style:none}
      #${PANEL_ID} .pp-codeArea::-webkit-scrollbar{width:0 !important;height:0 !important;display:none !important;background:transparent !important}
      #${PANEL_ID} .pp-codeArea:focus{border-color:#1e293b;box-shadow:0 0 0 3px rgb(15 23 42 / .14)}
      #${PANEL_ID} .pp-userTabButton.is-active{background:transparent;color:#fff}
      @media (max-width:1024px){
        #${PANEL_ID} .pp-testLayout{grid-template-columns:1fr}
      }
      @media (max-width:900px){
        #${PANEL_ID} .pp-userGrid{grid-template-columns:1fr}
        #${PANEL_ID} .pp-userGrid3{grid-template-columns:repeat(2,minmax(140px,1fr))}
        #${PANEL_ID} .pp-testMetaGrid{grid-template-columns:1fr}
      }
      @media (max-width:640px){
        #${PANEL_ID} .pp-userGrid3{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function fmtTime(ts) {
    if (!ts) return "-";
    try {
      return new Date(ts).toLocaleString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch (_) {
      return "-";
    }
  }

  function parseLooseNumber(value) {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    const normalized = raw
      .replace(/[ ]+/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(/,/g, ".")
      .replace(/[^\d.-]/g, "");
    const num = Number(normalized);
    return Number.isFinite(num) ? Math.abs(num) : 0;
  }

  function getTestEndpoint(type, bankName = "", urls = getGsUrls()) {
    const bankKey = normalizeBankKey(bankName);
    if (type === "dana") return urls.E || urls.C || "";
    if (bankKey === "DANA" && urls.E) return urls.E || "";
    if (type === "withdraw") return urls.B || "";
    if (type === "ewallet") return urls.C || "";
    if (type === "pulsa") return urls.D || "";
    return urls.A || "";
  }

  function buildTestRow(type, form) {
    const amount = parseLooseNumber(form.nominal);
    const bankKey = type === "dana" ? "DANA" : normalizeBankKey(form.bank || "");
    const targetCol = String(form.targetCol || (type === "withdraw" ? pickWithdrawTargetCol(bankKey) : pickTargetCol(bankKey)) || "").trim().toUpperCase();
    if (!targetCol) return { error: "Kolom tujuan belum ketemu. Isi kolom manual atau lengkapi mapping kolom." };
    if (!form.nama || !form.username || !amount) return { error: "Nama, username, dan nominal test wajib diisi." };

    if (type === "withdraw") {
      return {
        endpoint: getTestEndpoint(type, bankKey),
        targetCol,
        rows: [[String(form.nama).trim().toUpperCase(), String(form.username).trim(), "(" + formatNumber(amount) + ")", bankKey ? "WITHDRAW " + bankKey : "WITHDRAW", "TEST-WD", genNonce(), targetCol]]
      };
    }

    if (type === "pulsa") {
      const potongan = amount * 0.05;
      const jumlahDiproses = amount - potongan;
      return {
        endpoint: getTestEndpoint(type, bankKey),
        targetCol,
        rows: [[String(form.nomor || "").trim(), String(form.nama).trim().toUpperCase(), String(form.username).trim(), formatNumber(jumlahDiproses), formatNumber(potongan), "", formatNumber(amount), targetCol]]
      };
    }

    if (type === "dana") {
      return {
        endpoint: getTestEndpoint(type, "DANA"),
        targetCol,
        rows: [[String(form.nama).trim().toUpperCase(), String(form.username).trim(), formatNumber(amount), "DANA", "TEST-DANA", genNonce(), targetCol]]
      };
    }

    return {
      endpoint: getTestEndpoint(type, bankKey),
      targetCol,
      rows: [[String(form.nama).trim().toUpperCase(), String(form.username).trim(), formatNumber(amount), bankKey || type.toUpperCase(), "TEST-" + type.toUpperCase(), genNonce(), targetCol]]
    };
  }

  function fillTestDefaults(tab) {
    const type = tab.querySelector("#ppTestType")?.value || "deposit";
    const presets = {
      deposit: { bank: "BRI", nama: "TEST DEPOSIT PANEL", username: "testdepo01", nominal: "100000", nomor: "" },
      withdraw: { bank: "BNI", nama: "TEST WITHDRAW PANEL", username: "testwd01", nominal: "250000", nomor: "" },
      dana: { bank: "DANA", nama: "TEST DANA PANEL", username: "testdana01", nominal: "150000", nomor: "" },
      ewallet: { bank: "OVO", nama: "TEST EWALLET PANEL", username: "testewallet01", nominal: "150000", nomor: "" },
      pulsa: { bank: "TELKOMSEL", nama: "TEST PULSA PANEL", username: "testpulsa01", nominal: "93000", nomor: "081234567890" }
    };
    const data = presets[type] || presets.deposit;
    if (tab.querySelector("#ppTestBank")) tab.querySelector("#ppTestBank").value = data.bank || "";
    if (tab.querySelector("#ppTestName")) tab.querySelector("#ppTestName").value = data.nama || "";
    if (tab.querySelector("#ppTestUser")) tab.querySelector("#ppTestUser").value = data.username || "";
    if (tab.querySelector("#ppTestAmount")) tab.querySelector("#ppTestAmount").value = data.nominal || "";
    if (tab.querySelector("#ppTestNumber")) tab.querySelector("#ppTestNumber").value = data.nomor || "";
    if (tab.querySelector("#ppTestCol")) tab.querySelector("#ppTestCol").value = "";
    updateTestPreview(tab);
  }

  function syncTestBankFieldState(tab) {
    const type = tab.querySelector("#ppTestType")?.value || "deposit";
    const bankInput = tab.querySelector("#ppTestBank");
    if (!bankInput) return;
    if (type === "dana") {
      bankInput.value = "DANA";
      bankInput.readOnly = true;
      bankInput.placeholder = "DANA";
      bankInput.classList.add("pp-is-readonly");
      return;
    }
    bankInput.readOnly = false;
    bankInput.placeholder = "contoh: BRI";
    bankInput.classList.remove("pp-is-readonly");
  }

  function setTestStatus(tab, message, kind, detail = "") {
    const box = tab.querySelector("#ppTestStatus");
    if (!box) return;
    const text = String(message || "").trim() || "-";
    const extra = String(detail || "").trim();
    box.textContent = text;
    box.title = extra || text;
    box.dataset.detail = extra;
    box.classList.remove("is-ok", "is-err");
    if (kind === "ok") box.classList.add("is-ok");
    if (kind === "err") box.classList.add("is-err");
  }

  function refreshUserConfigState(tab) {
    if (!tab) return;
    const cfg = loadCfg();
    const status = tab.querySelector("#ppGsStatus");
    const toggle = tab.querySelector("#ppGsToggle");
    const autoCopyToggle = tab.querySelector("#ppAutoCopyToggle");
    if (status) {
      status.textContent = cfg.enabled ? "Google Sheet ON" : "Google Sheet OFF";
      status.className = cfg.enabled ? "pp-statusBadge pp-statusOn" : "pp-statusBadge pp-statusOff";
    }
    if (toggle) toggle.checked = !!cfg.enabled;
    if (autoCopyToggle) autoCopyToggle.checked = !!cfg.autoCopy;
    ["A", "B", "C", "D", "E"].forEach((key) => {
      const input = tab.querySelector(`#ppGs${key}`);
      if (input) input.value = cfg.urls[key] || "";
    });
    tab.querySelectorAll("[data-col-key]").forEach((input) => {
      const key = input.getAttribute("data-col-key");
      if (!key) return;
      input.value = cfg.colMap[key] || "";
    });
    updateTestPreview(tab);
  }

  function updateTestPreview(tab) {
    const type = tab.querySelector("#ppTestType")?.value || "deposit";
    syncTestBankFieldState(tab);
    const form = {
      bank: type === "dana" ? "DANA" : (tab.querySelector("#ppTestBank")?.value || ""),
      nama: tab.querySelector("#ppTestName")?.value || "",
      username: tab.querySelector("#ppTestUser")?.value || "",
      nominal: tab.querySelector("#ppTestAmount")?.value || "",
      nomor: tab.querySelector("#ppTestNumber")?.value || "",
      targetCol: tab.querySelector("#ppTestCol")?.value || ""
    };
    const result = buildTestRow(type, form);
    const endpointPreview = tab.querySelector("#ppTestEndpointPreview");
    const payloadPreview = tab.querySelector("#ppTestPayloadPreview");
    const colPreview = tab.querySelector("#ppTestResolvedCol");
    const previewBankKey = type === "dana" ? "DANA" : normalizeBankKey(form.bank);
    const autoCol = result && !result.error ? result.targetCol : String(form.targetCol || (type === "withdraw" ? pickWithdrawTargetCol(previewBankKey) : pickTargetCol(previewBankKey)) || "").trim().toUpperCase();

    if (endpointPreview) {
      const rawEndpoint = String((result && result.endpoint) || getTestEndpoint(type) || "").trim();
      endpointPreview.textContent = rawEndpoint || "Endpoint belum diisi";
      endpointPreview.title = rawEndpoint || "Endpoint belum diisi";
      endpointPreview.dataset.hasUrl = rawEndpoint ? "1" : "0";
      endpointPreview.dataset.fullUrl = rawEndpoint || "";
    }
    if (payloadPreview) payloadPreview.value = result && !result.error ? JSON.stringify(result.rows, null, 2) : ((result && result.error) || "Lengkapi data test untuk melihat payload.");
    if (colPreview) colPreview.textContent = autoCol || "-";
    return result;
  }

  async function runTestSend(tab) {
    const type = tab.querySelector("#ppTestType")?.value || "deposit";
    const form = {
      bank: type === "dana" ? "DANA" : (tab.querySelector("#ppTestBank")?.value || ""),
      nama: tab.querySelector("#ppTestName")?.value || "",
      username: tab.querySelector("#ppTestUser")?.value || "",
      nominal: tab.querySelector("#ppTestAmount")?.value || "",
      nomor: tab.querySelector("#ppTestNumber")?.value || "",
      targetCol: tab.querySelector("#ppTestCol")?.value || ""
    };
    const result = buildTestRow(type, form);
    if (!result || result.error) {
      setTestStatus(tab, result && result.error ? result.error : "Payload test gagal dibuat.", "err");
      return;
    }
    if (!result.endpoint) {
      setTestStatus(tab, `Endpoint ${type} belum diisi.`, "err");
      return;
    }

    const sendBtn = tab.querySelector("#ppTestSend");
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Testing...";
    }
    setTestStatus(tab, "Mengirim Test...", "", `Jenis: ${type}`);

    try {
      const res = await timeoutFetch(result.endpoint, result.rows, 9000);
      const bodyText = await res.text().catch(() => "");
      const snippet = String(bodyText || "").trim().slice(0, 600) || "(tanpa body response)";
      if (!res.ok) {
        const detail = `HTTP ${res.status}
Target Col: ${result.targetCol}
Response: ${snippet}`;
        console.warn("[Pending Panel][Test Send Failed]", { status: res.status, targetCol: result.targetCol, response: bodyText, endpoint: result.endpoint, type });
        setTestStatus(tab, "Test Gagal", "err", detail);
        return;
      }
      const detail = `HTTP ${res.status}
Target Col: ${result.targetCol}
Response: ${snippet}`;
      console.info("[Pending Panel][Test Send OK]", { status: res.status, targetCol: result.targetCol, response: bodyText, endpoint: result.endpoint, type });
      setTestStatus(tab, "Test Berhasil", "ok", detail);
    } catch (error) {
      const detail = error && error.message ? error.message : String(error);
      console.error("[Pending Panel][Test Send Error]", error);
      setTestStatus(tab, "Test Error", "err", detail);
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Test Send";
      }
    }
  }

  function buildUserMarkup() {
    const cfg = loadCfg();
    const badgeClass = cfg.enabled ? "pp-statusBadge pp-statusOn" : "pp-statusBadge pp-statusOff";
    const colGroups = [
      {
        title: "DEPOSIT BANK",
        tone: "deposit",
        note: "Kolom tujuan deposit bank.",
        keys: ["BCA","MANDIRI","BNI","BRI","BSI","CIMB","SEABANK","DANAMON","ANTARBANK","JENIUS"]
      },
      {
        title: "DEPOSIT DANA",
        tone: "deposit",
        note: "Kolom khusus tujuan deposit DANA.",
        keys: ["DANA"]
      },
      {
        title: "DEPOSIT EWALLET",
        tone: "deposit",
        note: "Kolom tujuan deposit e-wallet selain DANA.",
        keys: ["OVO","GOPAY","LINKAJA"]
      },
      {
        title: "DEPOSIT PULSA",
        tone: "deposit",
        note: "Kolom tujuan deposit pulsa.",
        keys: ["TELKOMSEL","AXIATA"]
      },
      {
        title: "WITHDRAW BANK",
        tone: "withdraw",
        note: "Kolom withdraw dipisah mengikuti bank asal transfer.",
        items: [
          { label: "BCA", key: "WD_BCA" },
          { label: "MANDIRI", key: "WD_MANDIRI" },
          { label: "BNI", key: "WD_BNI" },
          { label: "BRI", key: "WD_BRI" },
          { label: "BSI", key: "WD_BSI" },
          { label: "CIMB", key: "WD_CIMB" },
          { label: "SEABANK", key: "WD_SEABANK" },
          { label: "DANAMON", key: "WD_DANAMON" },
          { label: "ANTARBANK", key: "WD_ANTARBANK" },
          { label: "JENIUS", key: "WD_JENIUS" }
        ]
      },
      {
        title: "WITHDRAW EWALLET",
        tone: "withdraw",
        note: "Kolom withdraw dipisah mengikuti e-wallet asal transfer.",
        items: [
          { label: "DANA", key: "WD_DANA" },
          { label: "OVO", key: "WD_OVO" },
          { label: "GOPAY", key: "WD_GOPAY" },
          { label: "LINKAJA", key: "WD_LINKAJA" }
        ]
      }
    ];
    return `
      <div class="pp-sectionHeader">
        <div class="pp-userTop">
          <div>
            <h3 style="margin:0">Menu</h3>
            <div class="pp-userMuted" style="margin-top:4px">Menu Google Sheet untuk auto input saat approve deposit / withdraw, termasuk jalur khusus DANA.</div>
          </div>
          <div class="${badgeClass}" id="ppGsStatus">${cfg.enabled ? "Google Sheet ON" : "Google Sheet OFF"}</div>
        </div>
      </div>
      <div class="pp-sectionBody" style="margin-top:18px;display:grid;gap:14px">
        <div class="pp-userCard">
          <div class="pp-userTop" style="margin-bottom:12px">
            <strong>Web App Endpoint</strong>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:8px;margin:0;font-size:12px;font-weight:700">
                <input type="checkbox" id="ppGsToggle" ${cfg.enabled ? "checked" : ""}> Aktifkan Google Sheet
              </label>
              <label style="display:flex;align-items:center;gap:8px;margin:0;font-size:12px;font-weight:700">
                <input type="checkbox" id="ppAutoCopyToggle" ${cfg.autoCopy ? "checked" : ""}> Aktifkan Auto Copy
              </label>
            </div>
          </div>
          <div class="pp-userGrid">
            <div class="pp-userField"><label>Endpoint A — Deposit</label><input class="pp-userInput" id="ppGsA" value="${escapeHtml(cfg.urls.A)}" placeholder="https://script.google.com/..."></div>
            <div class="pp-userField"><label>Endpoint B — Withdraw</label><input class="pp-userInput" id="ppGsB" value="${escapeHtml(cfg.urls.B)}" placeholder="https://script.google.com/..."></div>
            <div class="pp-userField"><label>Endpoint C — E-Wallet</label><input class="pp-userInput" id="ppGsC" value="${escapeHtml(cfg.urls.C)}" placeholder="https://script.google.com/..."></div>
            <div class="pp-userField"><label>Endpoint D — Pulsa</label><input class="pp-userInput" id="ppGsD" value="${escapeHtml(cfg.urls.D)}" placeholder="https://script.google.com/..."></div>
            <div class="pp-userField"><label>Endpoint E — DANA</label><input class="pp-userInput" id="ppGsE" value="${escapeHtml(cfg.urls.E)}" placeholder="https://script.google.com/..."></div>
          </div>
          <div class="pp-userActions" style="margin-top:12px">
            <button type="button" class="btn btn-default" id="ppGsReset">Reset</button>
            <button type="button" class="btn btn-primary" id="ppGsSave">Save</button>
          </div>
          <div class="pp-userMuted" style="margin-top:10px">A=Deposit, B=Withdraw, C=E-Wallet, D=Pulsa, E=DANA. Endpoint DANA akan otomatis diprioritaskan saat sumber / tujuan terbaca sebagai DANA. Auto Copy bekerja terpisah dari Google Sheet dan akan menyalin format approve yang sama ke clipboard.</div>
        </div>

        <div class="pp-userCard">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
            <strong>Set Kolom Tujuan</strong>
            <div class="pp-userMuted">DEPOSIT BANK, DEPOSIT DANA, DEPOSIT EWALLET, DEPOSIT PULSA, dan WITHDRAW</div>
          </div>
          <div class="pp-colSections">
            ${colGroups.map((group) => `
              <div class="pp-colSection ${group.tone === "withdraw" ? "is-withdraw" : "is-deposit"}">
                <div class="pp-colSectionHead">
                  <div class="pp-colSectionTitle"><span class="glyphicon glyphicon-tasks"></span><span class="pp-colSectionTitleText">${group.title}</span></div>
                  <div class="pp-colSectionNote">${group.note}</div>
                </div>
                <div class="pp-userGrid3">
                  ${(group.items || (group.keys || []).map((key) => ({ label: key, key }))).map((item) => `
                    <div class="pp-userField">
                      <label>${item.label}</label>
                      <input class="pp-userInput" data-col-key="${item.key}" value="${escapeHtml(cfg.colMap[item.key] || "")}" placeholder="contoh: A">
                    </div>
                  `).join("")}
                </div>
              </div>
            `).join("")}
          </div>
          <div class="pp-userActions" style="margin-top:12px">
            <button type="button" class="btn btn-default" id="ppColReset">Reset Kolom</button>
            <button type="button" class="btn btn-primary" id="ppColSave">Save Kolom</button>
          </div>
        </div>

        <div class="pp-userCard">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
            <strong>Test Send</strong>
            <div class="pp-userMuted">Tes kirim 1 row uji ke endpoint aktif untuk cek target kolom, payload, dan response endpoint tanpa menunggu approve asli. Mode DANA akan otomatis memakai endpoint dan kolom DANA khusus.</div>
          </div>
          <div class="pp-userGrid3">
            <div class="pp-userField"><label>Jenis Test</label><select class="pp-userInput" id="ppTestType"><option value="deposit">Deposit</option><option value="dana">DANA</option><option value="withdraw">Withdraw</option><option value="ewallet">E-Wallet</option><option value="pulsa">Pulsa</option></select></div>
            <div class="pp-userField"><label>Bank / Sumber</label><input class="pp-userInput" id="ppTestBank" placeholder="contoh: BRI"></div>
            <div class="pp-userField"><label>Kolom Manual (opsional)</label><input class="pp-userInput" id="ppTestCol" placeholder="kosongkan untuk auto"></div>
          </div>
          <div class="pp-userGrid3" style="margin-top:12px">
            <div class="pp-userField"><label>Nama</label><input class="pp-userInput" id="ppTestName" placeholder="nama rekening / nama tujuan"></div>
            <div class="pp-userField"><label>Username</label><input class="pp-userInput" id="ppTestUser" placeholder="username"></div>
            <div class="pp-userField"><label>Nominal</label><input class="pp-userInput" id="ppTestAmount" placeholder="contoh: 100000"></div>
          </div>
          <div class="pp-userGrid3" style="margin-top:12px">
            <div class="pp-userField"><label>Nomor / SN</label><input class="pp-userInput" id="ppTestNumber" placeholder="khusus pulsa, boleh kosong untuk selain pulsa"></div>
          </div>
          <div class="pp-testLayout">
            <div class="pp-testPane">
              <div class="pp-testPaneHead">
                <div>
                  <strong>Preview Tujuan</strong>
                  <div class="pp-userMuted" style="margin-top:4px">Cek cepat kolom tujuan dan endpoint yang akan dipakai sebelum test dikirim.</div>
                </div>
              </div>
              <div class="pp-testMetaGrid">
                <div class="pp-userField"><label>Resolved Target Col</label><div class="pp-previewValue pp-previewMono" id="ppTestResolvedCol">-</div></div>
                <div class="pp-userField"><label>Endpoint Aktif</label><div class="pp-previewValue pp-previewMono pp-endpointPreview" id="ppTestEndpointPreview" title="Endpoint belum diisi">-</div></div>
              </div>
              <div class="pp-userActions" style="margin-top:12px;justify-content:flex-start">
                <button type="button" class="btn btn-default" id="ppTestFill">Isi Contoh</button>
                <button type="button" class="btn btn-primary" id="ppTestSend">Test Send</button>
              </div>
            </div>
            <div class="pp-testPane pp-testPayloadPane">
              <div class="pp-testPaneHead">
                <div>
                  <strong>Payload Preview</strong>
                  <div class="pp-userMuted" style="margin-top:4px">Preview row payload yang benar-benar akan dikirim ke endpoint aktif.</div>
                </div>
              </div>
              <textarea class="pp-userInput pp-codeArea" id="ppTestPayloadPreview" readonly spellcheck="false"></textarea>
            </div>
          </div>
          <div class="pp-testStatus" id="ppTestStatus" style="margin-top:12px">Belum ada test.</div>
        </div>
      </div>
    `;
  }

  function bindUserTab(tab) {
    const toggle = tab.querySelector("#ppGsToggle");
    const autoCopyToggle = tab.querySelector("#ppAutoCopyToggle");
    const saveBtn = tab.querySelector("#ppGsSave");
    const resetBtn = tab.querySelector("#ppGsReset");
    const colSaveBtn = tab.querySelector("#ppColSave");
    const colResetBtn = tab.querySelector("#ppColReset");
    const testType = tab.querySelector("#ppTestType");
    const testFillBtn = tab.querySelector("#ppTestFill");
    const testSendBtn = tab.querySelector("#ppTestSend");

    const readColMapFromInputs = () => {
      const map = {};
      tab.querySelectorAll("[data-col-key]").forEach((input) => {
        const key = input.getAttribute("data-col-key");
        const value = String(input.value || "").trim().toUpperCase();
        if (key) map[key] = value;
      });
      return map;
    };

    if (toggle) {
      toggle.addEventListener("change", async () => {
        const saved = setGsOn(toggle.checked);
        refreshUserConfigState(tab);
        if (saved && saved.enabled) {
          try {
            if (typeof window.alert === "function") {
              window.alert("Google Sheet berhasil diaktifkan.");
            }
          } catch (_) {}
          await showNativeBrowserNotice("Google Sheet ON", "Sinkronisasi approve ke endpoint aktif sudah diaktifkan.");
        }
      });
    }

    if (autoCopyToggle) {
      autoCopyToggle.addEventListener("change", async () => {
        const saved = setAutoCopyOn(autoCopyToggle.checked);
        refreshUserConfigState(tab);
        if (saved && saved.autoCopy) {
          await showNativeBrowserNotice("Auto Copy ON", "Format approve sekarang otomatis dicopy ke clipboard saat approve.");
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        setGsUrls(
          tab.querySelector("#ppGsA")?.value || "",
          tab.querySelector("#ppGsB")?.value || "",
          tab.querySelector("#ppGsC")?.value || "",
          tab.querySelector("#ppGsD")?.value || "",
          tab.querySelector("#ppGsE")?.value || ""
        );
        refreshUserConfigState(tab);
        try {
          if (typeof window.alert === "function") window.alert("Endpoint Google Sheet berhasil disimpan.");
        } catch (_) {}
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const cfg = loadCfg();
        cfg.urls = { ...DEFAULT_CFG.urls };
        saveCfg(cfg);
        refreshUserConfigState(tab);
      });
    }

    if (colSaveBtn) {
      colSaveBtn.addEventListener("click", () => {
        setColMap(readColMapFromInputs());
        refreshUserConfigState(tab);
        try {
          if (typeof window.alert === "function") window.alert("Set Kolom Tujuan berhasil disimpan.");
        } catch (_) {}
      });
    }

    if (colResetBtn) {
      colResetBtn.addEventListener("click", () => {
        setColMap({});
        refreshUserConfigState(tab);
      });
    }

    tab.querySelectorAll("[data-col-key]").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          colSaveBtn?.click();
        }
      });
    });
    tab.querySelectorAll("#ppTestType, #ppTestBank, #ppTestName, #ppTestUser, #ppTestAmount, #ppTestNumber, #ppTestCol").forEach((input) => {
      if (!input) return;
      input.addEventListener("input", () => updateTestPreview(tab));
      input.addEventListener("change", () => {
        if (input.id === "ppTestType") syncTestBankFieldState(tab);
        updateTestPreview(tab);
      });
    });

    if (testFillBtn) {
      testFillBtn.addEventListener("click", () => fillTestDefaults(tab));
    }

    const endpointPreviewBox = tab.querySelector("#ppTestEndpointPreview");
    if (endpointPreviewBox) {
      endpointPreviewBox.addEventListener("click", async () => {
        const fullUrl = String(endpointPreviewBox.dataset.fullUrl || "").trim();
        if (!fullUrl) return;
        const ok = await copyPlainText(fullUrl);
        endpointPreviewBox.title = ok ? `${fullUrl}\n\nEndpoint penuh berhasil dicopy.` : fullUrl;
      });
    }

    if (testSendBtn) {
      testSendBtn.addEventListener("click", () => {
        runTestSend(tab);
      });
    }

    refreshUserConfigState(tab);
    syncTestBankFieldState(tab);

    if (testType) {
      fillTestDefaults(tab);
    } else {
      updateTestPreview(tab);
    }
  }

  function renderUserTabIfVisible() {
    const tab = document.getElementById(USER_TAB_ID);
    if (!tab || tab.style.display === "none") return;
    tab.innerHTML = buildUserMarkup();
    bindUserTab(tab);
  }

  function hideUserTab() {
    const tab = document.getElementById(USER_TAB_ID);
    if (tab) tab.style.display = "none";
  }

  function activateNav(activeType) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.querySelectorAll(".pp-tabButton[data-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === activeType);
    });
  }

  function openUserTab() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const depo = panel.querySelector("#ppDepoTab");
    const wd = panel.querySelector("#ppWdTab");
    const user = panel.querySelector("#" + USER_TAB_ID);
    if (!user) return;
    if (depo) depo.style.display = "none";
    if (wd) wd.style.display = "none";
    user.style.display = "block";
    activateNav("user");
    renderUserTabIfVisible();
  }

  function bindUserNav(panel) {
    const tabs = panel.querySelector("#ppTabs");
    if (!tabs) return;
    if (panel.__ppGsUserNavBound) return;
    panel.__ppGsUserNavBound = true;
    let userBtn = tabs.querySelector('[data-tab="user"]');
    if (!userBtn) {
      const legacyUsers = [...tabs.querySelectorAll(".pp-staticNav")].find((el) => /users|menu/i.test(el.textContent || ""));
      userBtn = document.createElement("button");
      userBtn.type = "button";
      userBtn.className = "pp-navItem pp-tabButton";
      userBtn.dataset.tab = "user";
      userBtn.textContent = "Menu";
      if (legacyUsers) legacyUsers.replaceWith(userBtn);
      else tabs.insertBefore(userBtn, tabs.firstChild);
    }
    if (!panel.querySelector("#" + USER_TAB_ID)) {
      const content = panel.querySelector("#ppContent");
      const userTab = document.createElement("div");
      userTab.className = "pp-tabContent";
      userTab.id = USER_TAB_ID;
      userTab.style.display = "none";
      content.appendChild(userTab);
    }
    userBtn.addEventListener("click", (event) => {
      event.preventDefault();
      openUserTab();
    });

    panel.querySelectorAll('.pp-tabButton[data-tab="depo"], .pp-tabButton[data-tab="wd"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        hideUserTab();
      });
    });
  }

  function ensurePatchedUi() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return false;
    injectUserStyle();
    bindUserNav(panel);
    renderUserTabIfVisible();
    return true;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function boot() {
    const ok = ensurePatchedUi();
    installPanelApproveSourceCapture();
    wrapNativeApprovals();
    startWrapWatcher();
    if (ok) scheduleFlush(0);
    return ok;
  }

  hydrateQueueFromStorage();
  window.addEventListener("online", () => scheduleFlush(0), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleFlush(0);
  }, { passive: true });

  if (!boot()) {
    const timer = setInterval(() => {
      if (boot()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 15000);
  }

  window.__PP_GS_USER_TAB_API__ = {
    isGsOn, isAutoCopyOn, setGsOn, setAutoCopyOn, getGsUrls, setGsUrls, getColMap, setColMap, flushSend, sendToGSheetBatch, autoCopyPayload
  };
})();
