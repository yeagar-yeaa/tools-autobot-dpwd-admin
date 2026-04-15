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
  const SEARCH_LOADING_GIF_URL = "https://admsrt74adm.com//assets/loading.gif";
  const PANEL_RECENT_IDS = new Map();
  const AUTH_STORAGE_KEY = "__ppUiLoginGate_v1";
  const AUTH_USERNAME = "ADMIN";
  const AUTH_PASSWORD = "210514";
  const AUTH_SESSION_TTL = 1000 * 60 * 60 * 12;

  function installApprovedHistoryWaveGlobalStubs() {
    const globalObj = typeof window !== "undefined" ? window : globalThis;
    if (typeof globalObj.scheduleDepositApprovedHistoryRefreshWave !== "function") {
      globalObj.scheduleDepositApprovedHistoryRefreshWave = function scheduleDepositApprovedHistoryRefreshWaveStub() { return null; };
    }
    if (typeof globalObj.triggerDepositApprovedHistoryRefreshWave !== "function") {
      globalObj.triggerDepositApprovedHistoryRefreshWave = function triggerDepositApprovedHistoryRefreshWaveStub(options = {}) {
        try { return globalObj.scheduleDepositApprovedHistoryRefreshWave(options || {}); } catch (error) { console.warn("[PP] deposit approved wave stub failed", error); return null; }
      };
    }
    if (typeof globalObj.scheduleWithdrawApprovedHistoryRefreshWave !== "function") {
      globalObj.scheduleWithdrawApprovedHistoryRefreshWave = function scheduleWithdrawApprovedHistoryRefreshWaveStub() { return null; };
    }
    if (typeof globalObj.triggerWithdrawApprovedHistoryRefreshWave !== "function") {
      globalObj.triggerWithdrawApprovedHistoryRefreshWave = function triggerWithdrawApprovedHistoryRefreshWaveStub(options = {}) {
        try { return globalObj.scheduleWithdrawApprovedHistoryRefreshWave(options || {}); } catch (error) { console.warn("[PP] withdraw approved wave stub failed", error); return null; }
      };
    }
  }

  installApprovedHistoryWaveGlobalStubs();
  const PANEL_FETCH_MARK_HEADER = "x-pp-no-observe";
  const BANK_CODE_CACHE_KEY = "__ppBankCodeCache_v3";
  const SERVICE_PATHS = Object.freeze({
    depositPending: "/process/service/depositPending",
    depositApproved: "/process/service/depositApproved",
    depositApprovedContent: "/process/service/depositApprovedContent",
    depositApprovedHeader: "/process/service/depositApprovedHeader",
    withdrawPending: "/process/service/withdrawPending",
    withdrawApprovedContent: "/process/service/withdrawApprovedContent",
    withdrawApprovedHeader: "/process/service/withdrawApprovedHeader"
  });

  function getRuntimeOrigin() {
    try {
      if (window.location && /^https?:/i.test(String(window.location.origin || ""))) return String(window.location.origin);
    } catch (_) {}
    try {
      const href = String(window.location && window.location.href || "");
      if (href) return new URL(href).origin;
    } catch (_) {}
    return "";
  }

  function resolveServiceEndpoint(key) {
    const path = String(SERVICE_PATHS[key] || "");
    if (!path) return "";
    try {
      return new URL(path, getRuntimeOrigin() || window.location.href).toString();
    } catch (_) {
      return path;
    }
  }

  const SERVICE_ENDPOINTS = Object.freeze(Object.keys(SERVICE_PATHS).reduce((acc, key) => {
    acc[key] = resolveServiceEndpoint(key);
    return acc;
  }, {}));

  const USER_BRIEF_ENDPOINT = (() => {
    try {
      return new URL('/process/users/showBrief', getRuntimeOrigin() || window.location.href).toString();
    } catch (_) {
      return '/process/users/showBrief';
    }
  })();

  const USER_HISTORY_ENDPOINT = (() => {
    try {
      return new URL('/process/users/showHistoryDefUsers', getRuntimeOrigin() || window.location.href).toString();
    } catch (_) {
      return '/process/users/showHistoryDefUsers';
    }
  })();

  function normalizeBankCodeList(values) {
    const source = Array.isArray(values) ? values : [values];
    const out = [];
    const seen = new Set();
    source.forEach((value) => {
      const normalized = String(value == null ? "" : value).trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      out.push(normalized);
    });
    return out;
  }

  function readBankCodeCache(type) {
    const key = type === "wd" ? "wd" : "depo";
    try {
      const raw = JSON.parse(localStorage.getItem(BANK_CODE_CACHE_KEY) || "{}");
      return normalizeBankCodeList(raw && raw[key]);
    } catch (_) {
      return [];
    }
  }

  function writeBankCodeCache(type, values) {
    const key = type === "wd" ? "wd" : "depo";
    const normalized = normalizeBankCodeList(values);
    try {
      const raw = JSON.parse(localStorage.getItem(BANK_CODE_CACHE_KEY) || "{}");
      raw[key] = normalized;
      localStorage.setItem(BANK_CODE_CACHE_KEY, JSON.stringify(raw));
    } catch (_) {}
    return normalized;
  }

  function mergeBankCodeCache(type, values) {
    const merged = normalizeBankCodeList([...readBankCodeCache(type), ...normalizeBankCodeList(values)]);
    if (merged.length) writeBankCodeCache(type, merged);
    return merged;
  }

  function getCachedBankCodeOptions(type) {
    return readBankCodeCache(type).map((value) => ({ value, text: inferBankLabelFromValue(value) || String(value) }));
  }

  function getPanelAjaxHeaders(extra = {}) {
    return Object.assign({ [PANEL_FETCH_MARK_HEADER]: "1" }, extra || {});
  }

  function getUserHistoryDefaultState() {
    return {
      open: false,
      username: '',
      label: '',
      fpage: 'depo',
      source: 'deposit',
      filter: 'all',
      betId: '',
      page: 1,
      loading: false,
      abortController: null,
      html: '',
      briefHtml: '',
      detailHtml: '',
      briefRenderedHtml: '',
      detailRenderedHtml: '',
      renderedHtml: ''
    };
  }


  function hasObserveOptOutHeader(headers) {
    try {
      if (!headers) return false;
      if (typeof Headers !== "undefined" && headers instanceof Headers) {
        return String(headers.get(PANEL_FETCH_MARK_HEADER) || "") === "1";
      }
      if (Array.isArray(headers)) {
        return headers.some((pair) => Array.isArray(pair) && String(pair[0] || "").toLowerCase() === PANEL_FETCH_MARK_HEADER && String(pair[1] || "") === "1");
      }
      if (typeof headers === "object") {
        return Object.keys(headers).some((key) => String(key || "").toLowerCase() === PANEL_FETCH_MARK_HEADER && String(headers[key] || "") === "1");
      }
    } catch (_) {}
    return false;
  }

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
    lastRequestAt: { depo: 0, wd: 0 },
    pendingFetchHealth: {
      depo: { streak: 0, cooldownUntil: 0, lastToastAt: 0, lastStatus: 0 },
      wd: { streak: 0, cooldownUntil: 0, lastToastAt: 0, lastStatus: 0 }
    },
    autoSyncTimer: 0,
    deferredFlushTimer: 0,
    interactionLockUntil: 0,
    lastInteractionAt: 0,
    cleanupFns: [],
    destroyed: false,
    authUnlocked: false,
    mainBooted: false,
    panelToastHideTimer: 0,
    panelPosition: { mode: "center", left: 0, top: 0 },
    menuCloseFns: { depo: null, wd: null, depoAutoApproveLock: null },
    drag: { active: false, startX: 0, startY: 0, left: 0, top: 0, pointerId: null, bound: false },
    lastEscShortcutAt: 0,
    lastSafeWithdrawAlertAt: 0,
    headerSnapshotSignature: "",
    headerStyleSignature: "",
    headerNavSignature: "",
    headerBoxSignature: "",
    headerTabText: { depo: "", wd: "", user: "" },
    hoverInteractiveTarget: null,
    viewportLock: null,
    copy: { lastKey: "", lastAt: 0, pendingKey: "", pendingAt: 0, lastToastKey: "", lastToastAt: 0, buffer: null },
    history: getUserHistoryDefaultState(),
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
      total: 0,
      approved: getDepositApprovedDefaultState()
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
      total: 0,
      approved: getWithdrawApprovedDefaultState()
    }
  };

  const OPTIMISTIC_PENDING_ROWS = { depo: new Map(), wd: new Map() };

  function pruneOptimisticPendingRows(type) {
    const key = type === 'wd' ? 'wd' : 'depo';
    const bucket = OPTIMISTIC_PENDING_ROWS[key];
    const nowTs = Date.now();
    bucket.forEach((expireAt, id) => {
      if (!expireAt || nowTs >= expireAt) bucket.delete(id);
    });
    return bucket;
  }

  function markOptimisticPendingRow(type, id, ttlMs = 2600) {
    if (!id) return false;
    const key = type === 'wd' ? 'wd' : 'depo';
    const bucket = pruneOptimisticPendingRows(key);
    bucket.set(String(id), Date.now() + Math.max(900, Number(ttlMs) || 0));
    return true;
  }

  function hasOptimisticPendingRow(type, id) {
    if (!id) return false;
    const bucket = pruneOptimisticPendingRows(type);
    const expireAt = bucket.get(String(id)) || 0;
    return !!expireAt && Date.now() < expireAt;
  }

  function clearOptimisticPendingRow(type, id) {
    if (!id) return false;
    const bucket = pruneOptimisticPendingRows(type);
    return bucket.delete(String(id));
  }

  injectStyle();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.className = "is-auth-locked";
  panel.innerHTML = `
    <div class="pp-shell" id="ppMainShell">
      <div class="pp-header bg-primary">
        <div class="pp-headerFluid">
          <div class="pp-headMain">
            <button type="button" class="pp-titleText pp-titleBtn" id="ppHeaderBrand"></button>
            <div class="pp-nav" id="ppTabs"></div>
          </div>
          <div class="pp-headerMeta" id="ppHeaderMeta">
            <div class="pp-headerMetaItem pp-headerUser" id="ppHeaderUserWrap" title="User info">
              <span class="glyphicon glyphicon-user" aria-hidden="true"></span>
              <span class="pp-headerUserText">
                <strong id="ppHeaderUserPrimary"></strong>
                <span class="pp-headerUserDivider" id="ppHeaderUserDivider">|</span>
                <span class="pp-headerUserSecondary" id="ppHeaderUserSecondary"></span>
              </span>
            </div>
            <button type="button" class="pp-headerMetaItem pp-headerAction" id="ppHeaderLogoutBtn" title="Logout">
              <span class="glyphicon glyphicon-log-out" aria-hidden="true"></span>
              <span id="ppHeaderLogoutText"></span>
            </button>
            <div class="pp-headerMetaItem pp-headerClock" id="ppHeaderClockWrap" title="Clock">
              <span class="glyphicon glyphicon-time" aria-hidden="true"></span>
              <span id="ppHeaderClockText"></span>
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
    headerBrand: panel.querySelector("#ppHeaderBrand"),
    headerUserPrimary: panel.querySelector("#ppHeaderUserPrimary"),
    headerUserSecondary: panel.querySelector("#ppHeaderUserSecondary"),
    headerUserDivider: panel.querySelector("#ppHeaderUserDivider"),
    headerLogoutBtn: panel.querySelector("#ppHeaderLogoutBtn"),
    headerLogoutText: panel.querySelector("#ppHeaderLogoutText"),
    headerClockText: panel.querySelector("#ppHeaderClockText"),
    tabs: [...panel.querySelectorAll(".pp-tabButton[data-tab]")],
    depoTab: panel.querySelector("#ppDepoTab"),
    wdTab: panel.querySelector("#ppWdTab"),
    depoBadge: panel.querySelector("#ppDepoBadge"),
    wdBadge: panel.querySelector("#ppWdBadge"),
    minimizeBtn: panel.querySelector("#ppMinimizeBtn"),
    closeBtn: panel.querySelector("#ppCloseBtn")
  };

  ensureUserHistoryLayer();

  function cleanHeaderText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function getNativeHeaderNavbar() {
    return [...document.querySelectorAll("nav.navbar.navbar-expand-lg.navbar-dark.navbar-inverse.bg-primary, nav.navbar.bg-primary")]
      .find((node) => node && !refs.panel.contains(node)) || null;
  }

  function readNativeHeaderSnapshot() {
    const nav = getNativeHeaderNavbar();
    const fallback = {
      brand: cleanHeaderText(document.title || ""),
      userPrimary: cleanHeaderText(refs.authUsername && refs.authUsername.value),
      userSecondary: "",
      logoutText: "",
      clockText: ""
    };
    if (!nav) return fallback;
    const brand = cleanHeaderText(nav.querySelector(".navbar-brand") && nav.querySelector(".navbar-brand").textContent) || fallback.brand;
    const msAuto = nav.querySelector(".navbar-nav.ms-auto");
    const userItem = msAuto ? [...msAuto.querySelectorAll(".nav-item")].find((item) => item.querySelector("strong")) : null;
    const userPrimary = cleanHeaderText(userItem && userItem.querySelector("strong") && userItem.querySelector("strong").textContent) || fallback.userPrimary;
    let userSecondary = "";
    if (userItem) {
      const userText = cleanHeaderText(userItem.textContent || "");
      userSecondary = cleanHeaderText(userText.replace(userPrimary, "").replace(/^\|\s*/, ""));
    }
    const logoutItem = msAuto ? [...msAuto.querySelectorAll(".nav-item")].find((item) => /logout/i.test(cleanHeaderText(item.textContent || ""))) : null;
    const logoutText = cleanHeaderText(logoutItem && logoutItem.textContent) || fallback.logoutText;
    const clockText = cleanHeaderText(nav.querySelector("#clock") && nav.querySelector("#clock").textContent) || fallback.clockText;
    return { brand, userPrimary, userSecondary, logoutText, clockText };
  }

  function getNativeHeaderStyleSource(nav, selectorList, fallback = null) {
    if (!nav) return fallback || null;
    const selectors = Array.isArray(selectorList) ? selectorList : [selectorList];
    for (const selector of selectors) {
      try {
        const node = nav.querySelector(selector);
        if (node) return node;
      } catch (_) {}
    }
    return fallback || null;
  }

  function captureComputedTextStyle(element) {
    if (!element || typeof window.getComputedStyle !== "function") return null;
    const style = window.getComputedStyle(element);
    if (!style) return null;
    return {
      color: style.color || "",
      fontFamily: style.fontFamily || "",
      fontSize: style.fontSize || "",
      fontWeight: style.fontWeight || "",
      lineHeight: style.lineHeight || "",
      letterSpacing: style.letterSpacing || "",
      textTransform: style.textTransform || "",
      paddingTop: style.paddingTop || "",
      paddingRight: style.paddingRight || "",
      paddingBottom: style.paddingBottom || "",
      paddingLeft: style.paddingLeft || "",
      minHeight: style.minHeight || "",
      height: style.height || ""
    };
  }

  function readNativeHeaderStyleSnapshot() {
    const nav = getNativeHeaderNavbar();
    if (!nav) return null;
    const msAuto = nav.querySelector(".navbar-nav.ms-auto");
    const brandNode = getNativeHeaderStyleSource(nav, [".navbar-brand"]);
    const navItemNode = getNativeHeaderStyleSource(nav, [".navbar-nav:not(.ms-auto) .nav-item > a", ".navbar-nav:not(.ms-auto) .nav-item a", ".navbar-nav:not(.ms-auto) .nav-item"]);
    const userNode = getNativeHeaderStyleSource(msAuto || nav, [".nav-item a", ".nav-item"]);
    const logoutNode = getNativeHeaderStyleSource(msAuto || nav, [".nav-item a[href*='logout']", ".nav-item a", ".nav-item"]);
    const clockNode = getNativeHeaderStyleSource(msAuto || nav, ["#clock", ".nav-item a", ".nav-item"]);
    const navStyle = captureComputedTextStyle(navItemNode);
    const brandStyle = captureComputedTextStyle(brandNode) || navStyle;
    const userStyle = captureComputedTextStyle(userNode) || navStyle;
    const logoutStyle = captureComputedTextStyle(logoutNode) || userStyle || navStyle;
    const clockStyle = captureComputedTextStyle(clockNode) || userStyle || navStyle;
    return { brandStyle, navStyle, userStyle, logoutStyle, clockStyle };
  }

  function applyInlineHeaderTextStyle(node, style) {
    if (!node || !style) return;
    const map = {
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      minHeight: style.minHeight,
      height: style.height
    };
    Object.keys(map).forEach((key) => {
      const value = map[key];
      if (!value) return;
      try { node.style[key] = value; } catch (_) {}
    });
  }

  function syncHeaderStylesFromNative(snapshot = null) {
    if (!isPanelAlive()) return false;
    snapshot = snapshot || readNativeHeaderStyleSnapshot();
    if (!snapshot) return false;
    const signature = JSON.stringify(snapshot || {});
    if (signature === String(state.headerStyleSignature || "")) return false;
    state.headerStyleSignature = signature;
    applyInlineHeaderTextStyle(refs.headerBrand, snapshot.brandStyle || snapshot.navStyle);
    refs.tabs.forEach((button) => applyInlineHeaderTextStyle(button, snapshot.navStyle));
    const staticNav = refs.panel.querySelector('.pp-staticNav');
    applyInlineHeaderTextStyle(staticNav, snapshot.navStyle);
    applyInlineHeaderTextStyle(refs.headerUserWrap, snapshot.userStyle || snapshot.navStyle);
    applyInlineHeaderTextStyle(refs.headerLogoutBtn, snapshot.logoutStyle || snapshot.userStyle || snapshot.navStyle);
    const clockWrap = refs.headerClockText && refs.headerClockText.parentElement ? refs.headerClockText.parentElement : null;
    applyInlineHeaderTextStyle(clockWrap, snapshot.clockStyle || snapshot.userStyle || snapshot.navStyle);
    const userTextNodes = [refs.headerUserPrimary, refs.headerUserSecondary, refs.headerUserDivider, refs.headerLogoutText, refs.headerClockText].filter(Boolean);
    userTextNodes.forEach((node) => {
      const source = node === refs.headerClockText ? (snapshot.clockStyle || snapshot.userStyle || snapshot.navStyle) : (snapshot.userStyle || snapshot.navStyle);
      if (!source) return;
      try {
        node.style.fontFamily = source.fontFamily || "";
        node.style.fontSize = source.fontSize || "";
        node.style.fontWeight = source.fontWeight || "";
        node.style.lineHeight = source.lineHeight || "";
        node.style.letterSpacing = source.letterSpacing || "";
        node.style.textTransform = source.textTransform || "";
      } catch (_) {}
    });
    refs.panel.style.setProperty('--pp-native-header-font-family', (snapshot.navStyle && snapshot.navStyle.fontFamily) || 'Ubuntu, sans-serif');
    refs.panel.style.setProperty('--pp-native-header-font-size', (snapshot.navStyle && snapshot.navStyle.fontSize) || '12px');
    refs.panel.style.setProperty('--pp-native-header-weight', (snapshot.navStyle && snapshot.navStyle.fontWeight) || '400');
    return true;
  }

  function applyHeaderSnapshot(snapshot = {}) {
    const brand = cleanHeaderText(snapshot.brand);
    const userPrimary = cleanHeaderText(snapshot.userPrimary);
    const userSecondary = cleanHeaderText(snapshot.userSecondary);
    const logoutText = cleanHeaderText(snapshot.logoutText);
    const clockText = cleanHeaderText(snapshot.clockText);
    const signature = [brand, userPrimary, userSecondary, logoutText, clockText].join("\u0001");
    if (signature === String(state.headerSnapshotSignature || "")) return false;
    state.headerSnapshotSignature = signature;
    if (refs.headerBrand) {
      if (refs.headerBrand.textContent !== brand) refs.headerBrand.textContent = brand;
      refs.headerBrand.style.display = brand ? "inline-flex" : "none";
    }
    if (refs.headerUserPrimary && refs.headerUserPrimary.textContent !== userPrimary) refs.headerUserPrimary.textContent = userPrimary;
    if (refs.headerUserSecondary && refs.headerUserSecondary.textContent !== userSecondary) refs.headerUserSecondary.textContent = userSecondary;
    if (refs.headerUserWrap) {
      refs.headerUserWrap.style.display = userPrimary || userSecondary ? "inline-flex" : "none";
    }
    if (refs.headerUserDivider) {
      const dividerDisplay = userSecondary ? "inline" : "none";
      if (refs.headerUserDivider.style.display !== dividerDisplay) refs.headerUserDivider.style.display = dividerDisplay;
    }
    if (refs.headerLogoutText && refs.headerLogoutText.textContent !== logoutText) refs.headerLogoutText.textContent = logoutText;
    if (refs.headerLogoutBtn) refs.headerLogoutBtn.style.display = logoutText ? "inline-flex" : "none";
    if (refs.headerClockText) {
      if (refs.headerClockText.textContent !== clockText) refs.headerClockText.textContent = clockText;
      if (refs.headerClockText.parentElement) {
        const clockDisplay = clockText ? "inline-flex" : "none";
        if (refs.headerClockText.parentElement.style.display !== clockDisplay) refs.headerClockText.parentElement.style.display = clockDisplay;
      }
    }
    return true;
  }

  function syncHeaderFromNative(force = false) {
    if (!isPanelAlive()) return;
    const textSnapshot = readNativeHeaderSnapshot();
    const styleSnapshot = readNativeHeaderStyleSnapshot();
    if (force) {
      state.headerSnapshotSignature = "";
      state.headerStyleSignature = "";
    }
    applyHeaderSnapshot(textSnapshot);
    syncHeaderStylesFromNative(styleSnapshot);
  }

  function startHeaderChromeSync() {
    syncHeaderFromNative(true);
    const tick = window.setInterval(() => {
      try { syncHeaderFromNative(); } catch (_) {}
    }, 1000);
    state.cleanupFns.push(() => clearInterval(tick));
    if (refs.headerBrand && !refs.headerBrand.__ppBound) {
      refs.headerBrand.__ppBound = true;
      refs.headerBrand.addEventListener("click", () => {
        try {
          if (typeof window.switchMenu === "function") window.switchMenu("menuProvider");
        } catch (_) {}
      });
    }
    if (refs.headerLogoutBtn && !refs.headerLogoutBtn.__ppBound) {
      refs.headerLogoutBtn.__ppBound = true;
      refs.headerLogoutBtn.addEventListener("click", () => {
        try {
          if (typeof window.logout === "function") window.logout();
        } catch (_) {}
      });
    }
  }

  function isPanelAlive() {
    return !state.destroyed && !!refs.panel && document.body.contains(refs.panel);
  }

  function getPanelViewportMetrics() {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const gapX = 0;
    const gapY = 0;
    const zoom = 1;
    return { vw, vh, gapX, gapY, zoom };
  }

  function getPanelSizeFromViewport(vw, vh) {
    const width = Math.max(320, vw);
    const height = state.minimized ? 48 : Math.max(48, vh);
    return {
      width,
      height,
      maxWidth: width,
      maxHeight: Math.max(48, vh)
    };
  }

  function warmSearchLoadingGif() {
    if (window.__ppSearchLoadingGifWarmed) return;
    window.__ppSearchLoadingGifWarmed = true;
    try {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.referrerPolicy = "strict-origin-when-cross-origin";
      img.src = SEARCH_LOADING_GIF_URL;
      if (typeof img.decode === "function") img.decode().catch(() => {});
    } catch (_) {}
  }

  function lockPanelViewport() {
    if (state.viewportLock) return state.viewportLock;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html && html.style ? html.style.overflow : "",
      bodyOverflow: body && body.style ? body.style.overflow : ""
    };
    try { if (html && html.style) html.style.overflow = "hidden"; } catch (_) {}
    try { if (body && body.style) body.style.overflow = "hidden"; } catch (_) {}
    state.viewportLock = {
      release() {
        try { if (html && html.style) html.style.overflow = prev.htmlOverflow; } catch (_) {}
        try { if (body && body.style) body.style.overflow = prev.bodyOverflow; } catch (_) {}
      }
    };
    return state.viewportLock;
  }

  function renderSearchLoadingContent(message) {
    const label = escapeHtml(message || "Loading...");
    const src = escapeHtml(SEARCH_LOADING_GIF_URL);
    return `<div class="pp-loadingBlock"><img class="pp-loadingGif" src="${src}" alt="" aria-hidden="true"><div class="pp-loadingText">${label}</div></div>`;
  }

  function setSearchButtonLoading(button, loading) {
    if (!button) return;
    const label = String(button.dataset.ppDefaultLabel || button.textContent || "Search").trim() || "Search";
    if (!button.dataset.ppDefaultLabel) button.dataset.ppDefaultLabel = label;
    button.textContent = label;
    button.classList.toggle("is-loading", !!loading);
  }

  function getSyncRequestGap(type) {
    if (state.minimized) return type === state.activeTab ? 2200 : 4200;
    return type === state.activeTab ? 1350 : 2600;
  }

  function getPendingFetchHealth(type) {
    const key = type === "depo" ? "depo" : "wd";
    if (!state.pendingFetchHealth) {
      state.pendingFetchHealth = {
        depo: { streak: 0, cooldownUntil: 0, lastToastAt: 0, lastStatus: 0 },
        wd: { streak: 0, cooldownUntil: 0, lastToastAt: 0, lastStatus: 0 }
      };
    }
    if (!state.pendingFetchHealth[key]) {
      state.pendingFetchHealth[key] = { streak: 0, cooldownUntil: 0, lastToastAt: 0, lastStatus: 0 };
    }
    return state.pendingFetchHealth[key];
  }

  function getPendingFetchErrorStatus(error) {
    const directStatus = Number(error && error.status);
    if (Number.isFinite(directStatus) && directStatus > 0) return directStatus;
    const message = String(error && (error.message || error) || "");
    const matched = message.match(/(?:status|failed:)\s*(\d{3})/i) || message.match(/(408|429|500|502|503|504|520|521|522|523|524|525|526)/);
    return matched ? Number(matched[1]) : 0;
  }

  function isTransientPendingFetchStatus(status) {
    return [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526].includes(Number(status || 0));
  }

  function isTransientPendingFetchError(error) {
    if (!error || error.name === "AbortError") return false;
    return isTransientPendingFetchStatus(getPendingFetchErrorStatus(error));
  }

  function markPendingFetchSuccess(type) {
    const health = getPendingFetchHealth(type);
    health.streak = 0;
    health.cooldownUntil = 0;
    health.lastStatus = 0;
  }

  function markPendingFetchFailure(type, error, hasRendered) {
    const health = getPendingFetchHealth(type);
    const status = getPendingFetchErrorStatus(error);
    health.lastStatus = status || 0;
    health.streak = Math.min(health.streak + 1, 6);
    const base = type === "wd" ? 900 : 700;
    const max = type === "wd" ? 7200 : 5600;
    const cooldownMs = Math.min(max, base * health.streak * health.streak);
    health.cooldownUntil = Date.now() + cooldownMs;

    if (hasRendered && isTransientPendingFetchStatus(status)) {
      const now = Date.now();
      if (now - (health.lastToastAt || 0) > 2200) {
        health.lastToastAt = now;
        showPanelToast(`${type === "depo" ? "Deposit" : "Withdraw"} pending server sibuk (${status || "ERR"}), retry otomatis...`, "warn", 1700);
      }
    }

    return cooldownMs;
  }

  function showPanelToast(message, mode = "info", holdMs = 1800) {
    if (!isPanelAlive()) return false;
    const text = String(message || "").trim();
    if (!text) return false;
    let host = refs.panel.querySelector(".pp-toastHost");
    if (!host) {
      host = document.createElement("div");
      host.className = "pp-toastHost";
      host.innerHTML = '<div class="pp-toast" role="status" aria-live="polite"></div>';
      refs.panel.appendChild(host);
    }
    const toast = host.querySelector(".pp-toast");
    if (!toast) return false;
    toast.textContent = text;
    toast.className = `pp-toast is-show${mode ? ` is-${String(mode)}` : ""}`;
    if (state.panelToastHideTimer) {
      clearTimeout(state.panelToastHideTimer);
      state.panelToastHideTimer = 0;
    }
    state.panelToastHideTimer = window.setTimeout(() => {
      toast.className = "pp-toast";
      state.panelToastHideTimer = 0;
    }, Math.max(900, holdMs || 0));
    return true;
  }

  window.__ppPanelToast = (message, mode, holdMs) => showPanelToast(message, mode, holdMs);
  installUserHistoryGlobalBridge();

  if (refs.closeBtn) refs.closeBtn.style.display = "none";
  if (refs.minimizeBtn) refs.minimizeBtn.style.display = "none";
  refs.tabs.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  setupDrag();
  setupKeyboardShortcuts();
  warmSearchLoadingGif();
  lockPanelViewport();
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
    if (!session.ok || session.username !== AUTH_USERNAME) return false;
    const ts = Number(session.ts || 0);
    if (!Number.isFinite(ts) || ts <= 0) {
      clearAuthSession();
      return false;
    }
    if (Date.now() - ts > AUTH_SESSION_TTL) {
      clearAuthSession();
      return false;
    }
    return true;
  }

  function pauseMainPanelForAuth() {
    stopAutoSync();
    clearDepositAutoApproveTimer();
    clearDepositApprovedRefreshTimer();
    clearDepositApprovedSyncTimers();
    clearWithdrawApprovedRefreshTimer();
    clearWithdrawApprovedSyncTimers();
    state.depo.autoApproveBusy = false;
    state.pendingReload.depo = false;
    state.pendingReload.wd = false;
    state.deferredParsed.depo = null;
    state.deferredParsed.wd = null;
    ["depo", "wd"].forEach((type) => {
      const controller = state.abortControllers[type];
      if (controller) {
        try { controller.abort(); } catch (_) {}
        state.abortControllers[type] = null;
      }
      state.loading[type] = false;
    });
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
    pauseMainPanelForAuth();
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
    bindSafeWithdrawLockGuard();
    bindSafeWithdrawQuickCopy();
    clampPanel();
    startHeaderChromeSync();
    syncNativeMenu(state.activeTab);
    loadSection("depo", { initial: true });
    scheduleIdlePreload("wd");
    startAutoSync();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus, { passive: true });
    window.addEventListener("blur", handleWindowBlur, { passive: true });
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
        --pp-radius: 0px;
        --pp-radius-sm: 0px;
        position: fixed;
        --pp-panel-gap-x: 0px;
        --pp-panel-gap-y: 0px;
        --pp-panel-zoom: 1;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100dvh;
        max-width: 100vw;
        max-height: 100dvh;
        background: #fff;
        border: 0;
        box-shadow: none;
        z-index: 2147483647;
        transition: none;
        transform: none;
        overflow: hidden;
        border-radius: 0;
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
      #${PANEL_ID}.is-auth-locked .pp-nav,
      #${PANEL_ID}.is-auth-locked .pp-headerMeta {
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
      #${PANEL_ID}:not(.is-auth-locked) .pp-authMarqueeTrack {
        animation: none !important;
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
      #${PANEL_ID} .pp-toastHost {
        position: absolute;
        right: 14px;
        bottom: 14px;
        z-index: 60;
        pointer-events: none;
        display: flex;
        justify-content: flex-end;
      }
      #${PANEL_ID} .pp-toast {
        min-width: 220px;
        max-width: min(420px, calc(100vw - 40px));
        padding: 11px 14px;
        border-radius: 10px;
        background: rgba(17, 24, 39, 0.94);
        color: #fff;
        font-size: 12px;
        line-height: 1.45;
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.24);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity .18s ease, transform .18s ease;
        backdrop-filter: blur(6px);
      }
      #${PANEL_ID} .pp-toast.is-show {
        opacity: 1;
        transform: translateY(0);
      }
      #${PANEL_ID} .pp-toast.is-warn {
        background: rgba(126, 34, 79, 0.96);
      }
      #${PANEL_ID} .pp-toast.is-success {
        background: rgba(22, 101, 52, 0.95);
      }
      @media (prefers-reduced-motion: reduce) {
        #${PANEL_ID},
        #${PANEL_ID} *,
        #${PANEL_ID} *::before,
        #${PANEL_ID} *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      }
      #${PANEL_ID} .pp-shell {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }
      #${PANEL_ID} .pp-header {
        display: block;
        min-height: 50px;
        padding: 0;
        color: #fff;
        cursor: default;
        user-select: none;
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
        font-family: var(--pp-native-header-font-family, Ubuntu, sans-serif);
        font-size: var(--pp-native-header-font-size, 12px);
        font-weight: var(--pp-native-header-weight, 400);
      }
      #${PANEL_ID} .pp-headerFluid {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        min-height: 50px;
        padding: 0 12px;
      }
      #${PANEL_ID} .pp-headMain {
        display: flex;
        align-items: center;
        gap: 18px;
        min-width: 0;
        flex: 1 1 auto;
      }
      #${PANEL_ID} .pp-titleText {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding: 0 9px;
        font-size: 18px;
        font-weight: 500;
        line-height: 1.2;
        white-space: nowrap;
        flex: 0 0 auto;
        color: #fff;
        font-family: var(--pp-native-header-font-family, Ubuntu, sans-serif);
      }
      #${PANEL_ID} .pp-titleBtn {
        border: 0;
        outline: 0;
        background: transparent;
        cursor: pointer;
      }
      #${PANEL_ID} .pp-titleBtn:hover {
        opacity: .96;
      }
      #${PANEL_ID} .pp-nav {
        display: flex;
        align-items: stretch;
        gap: 0;
        min-width: 0;
        flex: 0 1 auto;
      }
      #${PANEL_ID} .pp-navItem {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 44px;
        padding: 0 9px;
        border: 0;
        background: transparent;
        color: #fff;
        font-size: 12px;
        font-weight: 400;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color .14s ease, color .14s ease;
        font-family: var(--pp-native-header-font-family, Ubuntu, sans-serif);
      }
      #${PANEL_ID} .pp-staticNav {
        cursor: default;
      }
      #${PANEL_ID} .pp-tabButton:hover,
      #${PANEL_ID} .pp-staticNav:hover,
      #${PANEL_ID} .pp-headerAction:hover {
        background: rgb(74 16 45 / 0.88);
      }
      #${PANEL_ID} .pp-headerMeta {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 2px;
        min-width: 0;
        flex: 0 1 auto;
      }
      #${PANEL_ID} .pp-headerMetaItem {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 0 9px;
        color: #fff;
        font-size: 12px;
        font-weight: 400;
        line-height: 1;
        white-space: nowrap;
        border-radius: var(--pp-radius-sm);
        font-family: var(--pp-native-header-font-family, Ubuntu, sans-serif);
      }
      #${PANEL_ID} .pp-headerMetaItem .glyphicon {
        font-size: 12px;
      }
      #${PANEL_ID} .pp-headerUserText {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      #${PANEL_ID} .pp-headerUserDivider {
        opacity: .7;
      }
      #${PANEL_ID} .pp-headerAction {
        border: 0;
        outline: 0;
        background: transparent;
        cursor: pointer;
      }
      #${PANEL_ID} .pp-headerClock {
        max-width: 320px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${PANEL_ID} .pp-toolbar {
        display: none !important;
        align-items: center;
        gap: 2px;
        margin-left: 2px;
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
        height: 48px;
        min-height: 48px;
      }
      #${PANEL_ID}.is-minimized .pp-content,
      #${PANEL_ID}.is-minimized .pp-footer {
        display: none;
      }
      #${PANEL_ID}.is-minimized .pp-header {
        border-bottom: 0;
      }
      #${PANEL_ID}.is-minimized .pp-toolIconCollapse {
        display: none;
      }
      #${PANEL_ID}.is-minimized .pp-toolIconExpand {
        display: inline-flex;
      }
      #${PANEL_ID}.pp-instantToggle,
      #${PANEL_ID}.pp-instantToggle *,
      #${PANEL_ID}.pp-instantToggle *::before,
      #${PANEL_ID}.pp-instantToggle *::after {
        transition: none !important;
        animation: none !important;
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
      #${PANEL_ID} #ppSectionMain-wd .pp-tableWrap > .alert.alert-danger {
        margin-bottom: 12px !important;
        padding: 9px 15px 8px !important;
      }
      #${PANEL_ID} #ppSectionMain-wd .pp-tableWrap > .alert.alert-danger > .table,
      #${PANEL_ID} #ppSectionMain-depo .pp-tableWrap > .well.well-sm > .table {
        margin-bottom: 0 !important;
      }
      #${PANEL_ID} #ppSectionMain-depo .pp-tableWrap > .well.well-sm {
        margin-bottom: 12px !important;
      }
      #${PANEL_ID} .pp-approvedToolbar {
        display: inline-flex;
        align-items: center;
        gap: 0;
        flex-wrap: wrap;
      }
      #${PANEL_ID} .pp-approvedToolbar label {
        margin: 0;
      }
      #${PANEL_ID} .pp-approvedToolbar .pp-approvedLabel {
        display: inline-flex;
        align-items: center;
        font-size: 13px;
        line-height: 1;
        margin: 0;
      }
      #${PANEL_ID} .pp-approvedDateInput {
        width: 110px !important;
        min-width: 110px;
        margin-left: 10px;
        height: 34px;
        padding: 6px 10px;
        font-size: 13px;
      }
      #${PANEL_ID} .pp-approvedDateInput.is-from {
        margin-right: 10px;
      }
      #${PANEL_ID} .pp-approvedDateInput.is-to {
        margin-right: 0;
      }
      #${PANEL_ID} .pp-approvedSearchField {
        width: auto !important;
        min-width: 180px;
        margin-right: 0;
        vertical-align: middle;
      }
      #${PANEL_ID} .pp-approvedToolbar:not(.pp-approvedToolbarBottom) .btn {
        margin-left: 10px;
      }
      #${PANEL_ID} .pp-approvedToolbarBottom {
        display: inline-flex;
        align-items: center;
        gap: 0;
        flex-wrap: nowrap;
      }
      #${PANEL_ID} .pp-approvedToolbarBottom .form-control,
      #${PANEL_ID} .pp-approvedToolbarBottom .form-select,
      #${PANEL_ID} .pp-approvedToolbarBottom .btn {
        display: inline-block;
        vertical-align: middle;
      }
      #${PANEL_ID} .pp-approvedToolbarBottom .btn + .btn {
        margin-left: 10px;
      }
      #${PANEL_ID} #ppWdApprovedShowAll {
        margin: 0;
        vertical-align: middle;
      }
      #${PANEL_ID} .pp-approvedShowAllLabel {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        line-height: 1.2;
      }
      #${PANEL_ID} .pp-approvedHistoryWrap {
        margin-top: 16px;
      }
      #${PANEL_ID} .pp-approvedHistorySurface {
        border: 1px solid #d8dee6;
        background: #fff;
        overflow: hidden;
      }
      #${PANEL_ID} .pp-approvedHistoryInner {
        padding: 0;
      }
      #${PANEL_ID} .pp-approvedHistoryInner > .table-responsive,
      #${PANEL_ID} .pp-approvedHistoryInner > .tableWrap,
      #${PANEL_ID} .pp-approvedHistoryInner > .pp-tableWrap {
        margin: 0;
        border: 0;
      }
      #${PANEL_ID} .pp-approvedHistoryInner .table,
      #${PANEL_ID} .pp-approvedHistoryInner table {
        width: 100%;
        margin: 0;
        border-collapse: separate;
        border-spacing: 0;
        background: #fff;
      }
      #${PANEL_ID} .pp-approvedHistoryInner table thead th,
      #${PANEL_ID} .pp-approvedHistoryInner table thead td {
        background: #f7f8fa;
        color: #374151;
        font-weight: 700;
        border-bottom: 1px solid #dde3ea;
        white-space: nowrap;
      }
      #${PANEL_ID} .pp-approvedHistoryInner table th,
      #${PANEL_ID} .pp-approvedHistoryInner table td {
        padding: 10px 12px;
        vertical-align: middle;
        border-top: 0;
        border-bottom: 1px solid #edf1f5;
      }
      #${PANEL_ID} .pp-approvedHistoryInner table tbody tr:last-child td {
        border-bottom: 0;
      }
      #${PANEL_ID} .pp-approvedHistoryInner table tbody tr:hover {
        background: #fafbfc;
      }
      #${PANEL_ID} .pp-approvedHistoryInner .pagination,
      #${PANEL_ID} .pp-approvedHistoryInner ul.pagination {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin: 0;
        padding: 12px;
        list-style: none;
        border-top: 1px solid #edf1f5;
        background: #fff;
      }
      #${PANEL_ID} .pp-approvedHistoryInner .pagination li,
      #${PANEL_ID} .pp-approvedHistoryInner ul.pagination li {
        margin: 0;
      }
      #${PANEL_ID} .pp-approvedHistoryInner .pagination a,
      #${PANEL_ID} .pp-approvedHistoryInner .pagination button,
      #${PANEL_ID} .pp-approvedHistoryInner .pagination span,
      #${PANEL_ID} .pp-approvedHistoryInner [data-pp-approved-page] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 34px;
        height: 32px;
        padding: 0 12px;
        border: 1px solid #d1d5db;
        background: #fff;
        color: #374151;
        text-decoration: none;
        cursor: pointer;
        border-radius: 4px;
        white-space: nowrap;
        box-shadow: none;
      }
      #${PANEL_ID} .pp-approvedHistoryInner .pagination .active a,
      #${PANEL_ID} .pp-approvedHistoryInner .pagination .active span,
      #${PANEL_ID} .pp-approvedHistoryInner .pagination .active button,
      #${PANEL_ID} .pp-approvedHistoryInner [data-pp-approved-page].is-active {
        background: #7e224f;
        border-color: #7e224f;
        color: #fff;
      }
      #${PANEL_ID} .pp-approvedHistoryInner .pagination .disabled a,
      #${PANEL_ID} .pp-approvedHistoryInner .pagination .disabled span,
      #${PANEL_ID} .pp-approvedHistoryInner .pagination .disabled button {
        opacity: .55;
        cursor: default;
        pointer-events: none;
        background: #f8fafc;
      }
      #${PANEL_ID} .pp-approvedHistoryInner .well,
      #${PANEL_ID} .pp-approvedHistoryInner .alert {
        margin: 0;
        border-left: 0;
        border-right: 0;
        border-radius: 0 !important;
      }
      #${PANEL_ID} .pp-approvedHistoryInner .text-danger,
      #${PANEL_ID} .pp-approvedHistoryInner .label-danger {
        color: #b91c1c;
      }
      @media (max-width: 860px) {
        #${PANEL_ID} .pp-approvedToolbar {
          width: 100%;
          justify-content: flex-start;
          gap: 8px;
        }
        #${PANEL_ID} .pp-approvedDateInput,
        #${PANEL_ID} .pp-approvedSearchField {
          width: 100% !important;
          min-width: 0;
          margin-left: 0;
          margin-right: 0;
        }
        #${PANEL_ID} .pp-approvedToolbarBottom {
          flex-wrap: wrap;
        }
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
      #${PANEL_ID} .pp-loadingBlock {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-width: 0;
      }
      #${PANEL_ID} .pp-loadingGif {
        display: block;
        width: 46px;
        height: 46px;
        object-fit: contain;
        image-rendering: auto;
      }
      #${PANEL_ID} .pp-loadingText {
        font-weight: 700;
        letter-spacing: .01em;
      }
      #${PANEL_ID} .btn.is-loading {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        pointer-events: none;
        opacity: 1;
      }
      #${PANEL_ID} .pp-btnSpinner {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        flex: 0 0 auto;
      }
      #${PANEL_ID} .pp-btnSpinner img {
        display: block;
        width: 18px;
        height: 18px;
        object-fit: contain;
      }
      #${PANEL_ID} .pp-searchBtnLabel {
        display: inline-flex;
        align-items: center;
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
      @media (max-width: 1180px) {
        #${PANEL_ID} .pp-headerClock {
          display: none;
        }
      }
      @media (max-width: 980px) {
        #${PANEL_ID} .pp-headerFluid {
          flex-wrap: wrap;
          align-items: flex-start;
          padding-top: 6px;
          padding-bottom: 6px;
        }
        #${PANEL_ID} .pp-headMain {
          width: 100%;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }
        #${PANEL_ID} .pp-nav {
          flex-wrap: wrap;
          margin-left: -10px;
        }
        #${PANEL_ID} .pp-headerMeta {
          width: 100%;
          justify-content: flex-start;
          flex-wrap: wrap;
          margin-left: -10px;
        }
        #${PANEL_ID} .pp-navItem,
        #${PANEL_ID} .pp-headerMetaItem {
          min-height: 32px;
          padding: 0 10px;
        }
        #${PANEL_ID} .pp-titleText {
          min-height: 32px;
          font-size: 16px;
        }
      }
      @media (max-width: 700px) {
        #${PANEL_ID} .pp-headerUserSecondary,
        #${PANEL_ID} .pp-headerUserDivider {
          display: none !important;
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
        min-height: 50px;
        padding: 0;
      }
      #${PANEL_ID} .pp-headerFluid {
        min-height: 50px;
        padding: 0 12px;
      }
      #${PANEL_ID} .pp-titleText {
        font-size: 18px;
      }
      #${PANEL_ID} .pp-navItem {
        min-height: 44px;
        padding: 0 14px;
        font-size: 13px;
      }
      #${PANEL_ID} .pp-tabContent {
        padding: 16px;
      }
      #${PANEL_ID} .pp-sectionHeader h3 {
        font-size: 22px;
      }
      #${PANEL_ID} .pp-bankSummary {
        gap: 12px;
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
        min-height: 34px;
      }
      #${PANEL_ID} .pp-previewValue,
      #${PANEL_ID} .pp-userMuted,
      #${PANEL_ID} .pp-testStatus,
      #${PANEL_ID} .pp-statusBadge,
      #${PANEL_ID} .pp-colSectionTitle,
      #${PANEL_ID} .pp-userField label {
        font-size: 13px !important;
      }
      #${PANEL_ID} .pp-tableWrap table {
        min-width: 100%;
      }
      #${PANEL_ID} .table th,
      #${PANEL_ID} .table td,
      #${PANEL_ID} table th,
      #${PANEL_ID} table td {
        padding: 8px 10px !important;
        vertical-align: middle;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center {
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        column-gap: 8px;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > [class*="col"] {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > .col {
        flex: 1 1 auto;
        min-width: 0;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > .col-auto {
        flex: 0 0 auto;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center .btn,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center .form-control,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center .form-select,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center .form-check-input {
        vertical-align: middle;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center .form-check-input {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        align-self: center;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center .btn-success,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center .btn.btn-success {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
      }
      #${PANEL_ID} .pp-tableWrap td[align="right"] {
        white-space: nowrap !important;
        text-align: right !important;
      }
      #${PANEL_ID} .pp-tableWrap td[align="right"] > .btn,
      #${PANEL_ID} .pp-tableWrap td[align="right"] > button,
      #${PANEL_ID} .pp-tableWrap td[align="right"] .btn.btn-sm,
      #${PANEL_ID} .pp-tableWrap td[align="right"] button.btn-sm {
        float: none !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 23px !important;
        min-width: 23px !important;
        height: 25px !important;
        min-height: 25px !important;
        padding: 0 !important;
        margin: 0 0 0 4px !important;
        vertical-align: middle !important;
        line-height: 1 !important;
      }
      #${PANEL_ID} .pp-tableWrap td[align="right"] > .btn:first-child,
      #${PANEL_ID} .pp-tableWrap td[align="right"] > button:first-child {
        margin-left: 0 !important;
      }
      #${PANEL_ID} .pp-tableWrap td[align="right"] .glyphicon,
      #${PANEL_ID} .pp-tableWrap td[align="right"] .btn .glyphicon,
      #${PANEL_ID} .pp-tableWrap td[align="right"] button .glyphicon {
        display: block !important;
        margin: 0 !important;
        line-height: 1 !important;
        position: static !important;
        top: auto !important;
        left: auto !important;
        transform: none !important;
      }
      #${PANEL_ID} .pp-actionIconBtn,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > .col-auto > .btn.btn-sm,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > .col-auto > button.btn-sm {
        float: none !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 26px !important;
        min-width: 26px !important;
        height: 26px !important;
        min-height: 26px !important;
        padding: 0 !important;
        margin: 0 !important;
        border-radius: 6px !important;
        line-height: 1 !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center {
        column-gap: 0 !important;
        row-gap: 0 !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow {
        display: flex !important;
        align-items: center !important;
        flex-wrap: nowrap !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > .col-auto {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > .col-auto + .col-auto {
        margin-left: 2px !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow > .pp-userLeadIconCol {
        flex: 0 0 auto !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow > .pp-userLeadIconCol + .pp-userLeadIconCol {
        margin-left: 2px !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow > .pp-userIdentityCol {
        margin-left: 14px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        min-width: 0 !important;
        flex: 1 1 auto !important;
      }
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow > .pp-userIdentityCol > a,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow > .pp-userIdentityCol > span,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow > .pp-userIdentityCol > strong,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow > .pp-userIdentityCol .text-danger,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center.pp-userLeadRow > .pp-userIdentityCol .text-primary {
        display: inline-block !important;
        line-height: 1.25 !important;
        margin-left: 0 !important;
      }
      #${PANEL_ID} .pp-safeCopyable {
        cursor: default !important;
        transition: box-shadow .12s ease, border-color .12s ease, background-color .12s ease;
      }
      #${PANEL_ID} .pp-safeCopyable:hover {
        border-color: #93c5fd !important;
        box-shadow: 0 0 0 2px rgb(59 130 246 / .12) !important;
        background-color: #f8fbff !important;
      }
      #${PANEL_ID} .pp-actionIconBtn .glyphicon,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > .col-auto > .btn.btn-sm .glyphicon,
      #${PANEL_ID} .pp-tableWrap td .row.align-items-center > .col-auto > button.btn-sm .glyphicon {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        font-size: 12px !important;
        line-height: 1 !important;
      }
      #${PANEL_ID} .pp-inlineActionRow {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 2px !important;
        flex-wrap: nowrap !important;
        white-space: nowrap !important;
      }
      #${PANEL_ID} .pp-inlineActionRow > .btn,
      #${PANEL_ID} .pp-inlineActionRow > button {
        flex: 0 0 auto !important;
        margin: 0 !important;
      }
      #${PANEL_ID} #ppDepoTab .pp-tableWrap table thead th:last-child,
      #${PANEL_ID} #ppDepoTab .pp-tableWrap table tbody td:last-child,
      #${PANEL_ID} #ppWdTab .pp-tableWrap table thead th:last-child,
      #${PANEL_ID} #ppWdTab .pp-tableWrap table tbody td:last-child {
        width: 92px !important;
        min-width: 92px !important;
      }
      #${PANEL_ID} #ppDepoTab .pp-tableWrap table thead th:nth-last-child(2),
      #${PANEL_ID} #ppDepoTab .pp-tableWrap table tbody td:nth-last-child(2),
      #${PANEL_ID} #ppWdTab .pp-tableWrap table thead th:nth-last-child(2),
      #${PANEL_ID} #ppWdTab .pp-tableWrap table tbody td:nth-last-child(2) {
        width: 112px !important;
        min-width: 112px !important;
      }
      #${PANEL_ID} #ppDepoTab .pp-tableWrap table tbody td:last-child,
      #${PANEL_ID} #ppWdTab .pp-tableWrap table tbody td:last-child {
        white-space: nowrap !important;
      }
      #${PANEL_ID} .pp-userHistoryLayer {
        position: absolute;
        inset: 0;
        z-index: 80;
        display: none;
        background: #eef2f7;
      }
      #${PANEL_ID} .pp-userHistoryLayer.is-open {
        display: block;
      }
      #${PANEL_ID} .pp-userHistoryBackdrop {
        display: none;
      }
      #${PANEL_ID} .pp-userHistoryDialog {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        background: #eef2f7;
        box-shadow: none;
        display: flex;
        flex-direction: column;
        border: 0;
      }
      #${PANEL_ID} .pp-userHistoryHead {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid #d9e1ea;
        background: #fff;
      }
      #${PANEL_ID} .pp-userHistoryHeadMain {
        min-width: 0;
      }
      #${PANEL_ID} .pp-userHistoryTitle {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #111827;
        line-height: 1.25;
      }
      #${PANEL_ID} .pp-userHistoryMeta {
        display: none;
        margin-top: 4px;
        font-size: 12px;
        color: #6b7280;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${PANEL_ID} #ppUserHistoryCloseBtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 0;
        border-radius: 10px;
        background: #f3f4f6;
        color: #475569;
        box-shadow: none;
        transition: background-color .14s ease, color .14s ease, transform .14s ease;
      }
      #${PANEL_ID} #ppUserHistoryCloseBtn:hover {
        background: #e5e7eb;
        color: #111827;
      }
      #${PANEL_ID} #ppUserHistoryCloseBtn:active {
        transform: translateY(.5px);
      }
      #${PANEL_ID} #ppUserHistoryCloseBtn .glyphicon {
        margin: 0;
        font-size: 14px;
        line-height: 1;
      }
      #${PANEL_ID} .pp-userHistoryBody {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        background: #eef2f7;
      }
      #${PANEL_ID} .pp-userHistoryBodyInner {
        min-height: 100%;
        padding: 0;
      }
      #${PANEL_ID} .pp-userHistorySurface {
        min-height: 100%;
        background: transparent;
        border: 0;
        border-radius: 0;
        overflow: visible;
        box-shadow: none;
      }
      #${PANEL_ID} .pp-userHistoryViewport {
        min-height: 100%;
        display: flex;
        flex-direction: column;
      }
      #${PANEL_ID} .pp-userHistoryPrimary {
        padding: 16px 16px 8px;
      }
      #${PANEL_ID} .pp-userHistorySecondary {
        flex: 1 1 auto;
        min-height: 0;
        padding: 0 16px 16px;
      }
      #${PANEL_ID} .pp-userHistoryPrimary > *:last-child,
      #${PANEL_ID} .pp-userHistorySecondary > *:last-child {
        margin-bottom: 0 !important;
      }
      #${PANEL_ID} .pp-userHistoryContent h3 {
        margin: 0 0 12px;
        font-size: 24px;
        line-height: 1.2;
        color: #1f2937;
      }
      #${PANEL_ID} .pp-userHistoryContent #notificationBar,
      #${PANEL_ID} .pp-userHistoryContent #notifsound,
      #${PANEL_ID} .pp-userHistoryContent [data-pp-history-hidden="1"] {
        display: none !important;
      }
      #${PANEL_ID} .pp-userHistoryContent .row {
        margin-left: -8px;
        margin-right: -8px;
      }
      #${PANEL_ID} .pp-userHistoryContent .row > [class*="col-"] {
        padding-left: 8px;
        padding-right: 8px;
      }
      #${PANEL_ID} .pp-userHistoryPrimary > .row {
        margin-bottom: 4px;
      }
      #${PANEL_ID} .pp-userHistoryContent .well,
      #${PANEL_ID} .pp-userHistoryContent .alert,
      #${PANEL_ID} .pp-userHistoryContent .table,
      #${PANEL_ID} .pp-userHistoryContent .table-responsive,
      #${PANEL_ID} .pp-userHistoryContent .tableWrap,
      #${PANEL_ID} .pp-userHistoryContent .pp-tableWrap {
        width: 100%;
        max-width: 100%;
      }
      #${PANEL_ID} .pp-userHistoryContent .well {
        margin: 0 0 12px;
        padding: 12px;
        background: #fff;
        border: 1px solid #d9e1ea;
        border-radius: 4px !important;
      }
      #${PANEL_ID} .pp-userHistoryContent .alert {
        margin: 0 0 12px;
        border-radius: 4px !important;
      }
      #${PANEL_ID} .pp-userHistoryPrimary > .alert.alert-info {
        margin-bottom: 12px;
        padding: 12px 14px;
        border: 1px solid #cfe0ee;
        background: #eaf4fb;
        color: #2a5d82;
      }
      #${PANEL_ID} .pp-userHistoryPrimary > .alert.alert-info h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        line-height: 1.25;
      }
      #${PANEL_ID} .pp-userHistoryContent .form-inline,
      #${PANEL_ID} .pp-userHistoryContent .form-group-sm.form-inline {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      #${PANEL_ID} .pp-userHistoryContent .form-control,
      #${PANEL_ID} .pp-userHistoryContent .form-select,
      #${PANEL_ID} .pp-userHistoryContent input[type="text"],
      #${PANEL_ID} .pp-userHistoryContent input[type="button"],
      #${PANEL_ID} .pp-userHistoryContent select,
      #${PANEL_ID} .pp-userHistoryContent button {
        max-width: 100%;
        min-height: 34px;
        border-radius: 4px !important;
      }
      #${PANEL_ID} .pp-userHistoryContent .table-responsive,
      #${PANEL_ID} .pp-userHistoryContent .tableWrap,
      #${PANEL_ID} .pp-userHistoryContent .pp-tableWrap {
        overflow: auto;
      }
      #${PANEL_ID} .pp-userHistoryContent .table,
      #${PANEL_ID} .pp-userHistoryContent table {
        width: 100%;
        margin: 0;
        background: #fff;
        border-collapse: separate;
        border-spacing: 0;
      }
      #${PANEL_ID} .pp-userHistoryContent table th,
      #${PANEL_ID} .pp-userHistoryContent table td {
        padding: 10px 12px !important;
        vertical-align: middle;
        border-top: 0;
        border-bottom: 1px solid #edf1f5;
      }
      #${PANEL_ID} .pp-userHistoryContent table thead th,
      #${PANEL_ID} .pp-userHistoryContent table thead td {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #f7f8fa;
        color: #374151;
        font-weight: 700;
        white-space: nowrap;
        border-bottom: 1px solid #dde3ea;
      }
      #${PANEL_ID} .pp-userHistoryContent table tbody tr:hover {
        background: #fafbfc;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
        background: transparent;
        border: 0;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination li,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li,
      #${PANEL_ID} .pp-userHistoryContent .pagination li.page-item,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li.page-item {
        display: inline-flex;
        align-items: center;
        margin: 0;
        padding: 0;
        background: transparent;
        border: 0;
        cursor: pointer;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination li.active,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li.active {
        cursor: default;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination a,
      #${PANEL_ID} .pp-userHistoryContent .pagination button,
      #${PANEL_ID} .pp-userHistoryContent .pagination span,
      #${PANEL_ID} .pp-userHistoryContent .pagination .page-link,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination a,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination button,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination span,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination .page-link,
      #${PANEL_ID} .pp-userHistoryContent a[data-pp-user-history-page],
      #${PANEL_ID} .pp-userHistoryContent button[data-pp-user-history-page],
      #${PANEL_ID} .pp-userHistoryContent span[data-pp-user-history-page] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 34px;
        height: 28px;
        padding: 0 12px;
        border: 1px solid #d1d5db;
        background: #fff;
        color: #4b5563;
        text-decoration: none;
        cursor: inherit;
        border-radius: 4px;
        white-space: nowrap;
        box-shadow: none;
        font-size: 12px;
        line-height: 1;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination li.active a,
      #${PANEL_ID} .pp-userHistoryContent .pagination li.active span,
      #${PANEL_ID} .pp-userHistoryContent .pagination li.active button,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li.active a,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li.active span,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li.active button {
        background: #7e224f;
        border-color: #7e224f;
        color: #fff;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination li.disabled a,
      #${PANEL_ID} .pp-userHistoryContent .pagination li.disabled span,
      #${PANEL_ID} .pp-userHistoryContent .pagination li.disabled button,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li.disabled a,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li.disabled span,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination li.disabled button {
        opacity: .55;
        cursor: default;
        pointer-events: none;
        background: #f8fafc;
      }
      #${PANEL_ID} .pp-userHistoryContent .btn,
      #${PANEL_ID} .pp-userHistoryContent input[type="button"],
      #${PANEL_ID} .pp-userHistoryContent input[type="submit"] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 32px;
        padding: 0 12px;
        border-radius: 4px !important;
        white-space: nowrap;
        box-shadow: none;
      }
      #${PANEL_ID} .pp-userHistoryContent .btn-warning,
      #${PANEL_ID} .pp-userHistoryContent .btn-warning:hover,
      #${PANEL_ID} .pp-userHistoryContent .btn-warning:focus {
        background: #f97316;
        border-color: #ea580c;
        color: #fff;
      }
      #${PANEL_ID} .pp-userHistoryContent .btn-primary,
      #${PANEL_ID} .pp-userHistoryContent .btn-primary:hover,
      #${PANEL_ID} .pp-userHistoryContent .btn-primary:focus {
        background: #7e224f;
        border-color: #7e224f;
        color: #fff;
      }
      #${PANEL_ID} .pp-userHistoryContent .btn-default:hover {
        background: #f8fafc;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination + div,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination + div {
        display: block;
        margin-top: 8px;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination + div .btn,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination + div .btn,
      #${PANEL_ID} .pp-userHistoryContent .pagination + div button,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination + div button,
      #${PANEL_ID} .pp-userHistoryContent .pagination + div a,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination + div a {
        min-height: 31px;
      }
      #${PANEL_ID} .pp-userHistoryContent .pp-tableWrap {
        border: 1px solid #dde3ea;
        border-radius: 4px;
        background: #fff;
      }
      #${PANEL_ID} .pp-userHistoryContent .pp-tableWrap table {
        border-radius: 4px;
        overflow: hidden;
      }
      #${PANEL_ID} .pp-userHistoryContent .pagination + .btn,
      #${PANEL_ID} .pp-userHistoryContent .pagination + .btn-warning,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination + .btn,
      #${PANEL_ID} .pp-userHistoryContent ul.pagination + .btn-warning {
        margin-top: 8px;
      }
      #${PANEL_ID} .pp-userHistoryContent .text-danger,
      #${PANEL_ID} .pp-userHistoryContent .label-danger {
        color: #b91c1c;
      }
      #${PANEL_ID} .pp-userHistoryFilterNote {
        margin-top: 10px;
        font-size: 12px;
        color: #6b7280;
      }
      #${PANEL_ID} .pp-userHistoryEmpty,
      #${PANEL_ID} .pp-userHistoryError {
        padding: 20px;
        color: #475569;
        background: #fff;
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

  function getInteractiveHoverTarget(node) {
    if (!node || typeof node.closest !== "function") return null;
    return node.closest([
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "label",
      "summary",
      ".btn",
      ".pp-navItem",
      ".pp-headerAction",
      ".pp-toolBtn",
      ".pp-bankMenu",
      ".pp-bankMenuWrap",
      ".pp-userHistoryControls",
      ".pagination",
      ".page-link",
      "[role='button']",
      "[data-bank-action]"
    ].join(","));
  }

  function setHoverInteractiveTarget(node) {
    const target = getInteractiveHoverTarget(node);
    if (target && refs.panel && refs.panel.contains(target)) {
      state.hoverInteractiveTarget = target;
      state.lastInteractionAt = Date.now();
      return target;
    }
    state.hoverInteractiveTarget = null;
    return null;
  }

  function markInteracting(duration = 520) {
    const ts = Date.now();
    state.lastInteractionAt = ts;
    state.interactionLockUntil = Math.max(state.interactionLockUntil || 0, ts + duration);
  }

  function isInteractionLocked(type) {
    const activeEl = document.activeElement;
    const tab = type === "depo" ? refs.depoTab : refs.wdTab;
    const hoverTarget = state.hoverInteractiveTarget;
    if (state.drag.active) return true;
    if (Date.now() < (state.interactionLockUntil || 0)) return true;
    if (tab && tab.querySelector(".pp-bankMenu.is-open")) return true;
    if (type === state.activeTab && hoverTarget && hoverTarget.isConnected && refs.panel.contains(hoverTarget)) {
      return true;
    }
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
    const syncHoverTarget = (event) => {
      const nextTarget = setHoverInteractiveTarget(event && event.target);
      if (nextTarget) markInteracting(980);
    };
    const releaseHoverTarget = (event) => {
      const related = event && event.relatedTarget;
      const nextTarget = related ? getInteractiveHoverTarget(related) : null;
      if (nextTarget && refs.panel.contains(nextTarget)) {
        state.hoverInteractiveTarget = nextTarget;
        return;
      }
      state.hoverInteractiveTarget = null;
      scheduleDeferredFlush();
    };

    refs.panel.addEventListener("pointerdown", hardLock, true);
    refs.panel.addEventListener("focusin", hardLock, true);
    refs.panel.addEventListener("input", hardLock, true);
    refs.panel.addEventListener("change", hardLock, true);
    refs.panel.addEventListener("keydown", hardLock, true);
    refs.panel.addEventListener("pointerover", syncHoverTarget, true);
    refs.panel.addEventListener("pointerout", releaseHoverTarget, true);
    refs.panel.addEventListener("wheel", softLock, { passive: true, capture: true });
    refs.panel.addEventListener("scroll", softLock, { passive: true, capture: true });
    refs.panel.addEventListener("focusout", flushLater, true);
    window.addEventListener("pointerup", flushLater, { passive: true });
    window.addEventListener("mouseup", flushLater, { passive: true });
    window.addEventListener("touchend", flushLater, { passive: true });

    state.cleanupFns.push(() => refs.panel.removeEventListener("focusout", flushLater, true));
    state.cleanupFns.push(() => refs.panel.removeEventListener("pointerover", syncHoverTarget, true));
    state.cleanupFns.push(() => refs.panel.removeEventListener("pointerout", releaseHoverTarget, true));
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

  function rerenderSectionFromCache(type) {
    const cfg = state[type];
    if (!cfg || !cfg.responseHtml) return false;
    const parsed = parsePendingResponse(type, cfg.responseHtml);
    cfg.bankCounts = parsed.bankCounts;
    cfg.total = parsed.total;
    cfg.availableBanks = parsed.availableBanks || cfg.availableBanks || [];
    state.fingerprints[type] = parsed.fingerprint;
    state.signatures[type] = parsed.signature;
    renderSectionIntoTab(type, parsed);
    updateBadges();
    if (type === "depo") renderDepositAutoApproveUi(refs.depoTab);
    return true;
  }

  function renderSectionIntoTab(type, parsed) {
    const tab = type === "depo" ? refs.depoTab : refs.wdTab;
    const snapshot = captureTabUiState(type, tab);
    const markup = buildSectionMarkup(type, parsed);
    const currentMain = tab.querySelector(`#ppSectionMain-${type}`);
    const currentApproved = tab.querySelector(`#ppSectionApproved-${type}`);

    if (currentMain && currentApproved) {
      const shell = document.createElement("div");
      shell.innerHTML = markup;
      const nextMain = shell.querySelector(`#ppSectionMain-${type}`);
      if (nextMain) currentMain.replaceWith(nextMain);
      if (!tab.querySelector(`#ppSectionApproved-${type}`)) {
        const nextApproved = shell.querySelector(`#ppSectionApproved-${type}`);
        if (nextApproved) tab.appendChild(nextApproved);
      }
    } else {
      tab.innerHTML = markup;
      tab.__ppDepoApprovedControlsBound = false;
      tab.__ppWdApprovedControlsBound = false;
    }

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
    if (!isPanelAlive() || state.autoSyncTimer || document.hidden) return;
    Object.keys(state.menuCloseFns || {}).forEach((key) => {
      const fn = state.menuCloseFns[key];
      if (typeof fn === "function") document.removeEventListener("mousedown", fn, true);
    });
    const loop = () => {
      if (!isPanelAlive()) return;
      if (document.hidden) {
        stopAutoSync();
        return;
      }
      const now = Date.now();
      const activeType = state.activeTab;
      const secondaryType = activeType === "depo" ? "wd" : "depo";
      const sinceInteraction = now - (state.lastInteractionAt || 0);
      const fastDepositAutoApprove = activeType === "depo" && state.depo.autoApprove;
      const activeMinAge = state.minimized
        ? (fastDepositAutoApprove ? 6500 : 9800)
        : (fastDepositAutoApprove ? (sinceInteraction < 3200 ? 1500 : 1900) : (sinceInteraction < 3200 ? 2600 : 3600));
      const secondaryMinAge = state.minimized
        ? 24000
        : (fastDepositAutoApprove ? (sinceInteraction < 3200 ? 5200 : 6800) : (sinceInteraction < 3200 ? 6200 : 7800));
      const nextDelay = state.minimized
        ? (fastDepositAutoApprove ? 2200 : 4200)
        : (fastDepositAutoApprove
            ? (sinceInteraction < 2200 ? 1450 : 1650)
            : (sinceInteraction < 2200 ? 1650 : 2100));

      maybeAutoRefresh(activeType, now, activeMinAge);
      if (!state.minimized && state.initialized[secondaryType]) {
        maybeAutoRefresh(secondaryType, now, secondaryMinAge);
      }

      state.autoSyncTimer = window.setTimeout(loop, nextDelay);
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

  function isUserHistoryDialogOpen() {
    return !!(refs.historyLayer && refs.historyLayer.classList.contains("is-open") && state.history && state.history.open);
  }

  function maybeAutoRefresh(type, now, minAge) {
    if (!isPanelAlive() || document.hidden) return;
    if (isUserTabVisible() || isUserHistoryDialogOpen()) return;
    if (state.hoverInteractiveTarget && state.hoverInteractiveTarget.isConnected && refs.panel.contains(state.hoverInteractiveTarget)) return;
    if (type === "depo" && state.depo.autoApproveBusy) return;
    if (state.minimized && type !== state.activeTab) return;
    if (flushDeferredRender(type)) return;
    if (state.loading[type]) return;
    if (!state.initialized[type] && type !== state.activeTab) return;
    if (isInteractionLocked(type)) return;
    if (now - (state.lastRequestAt[type] || 0) < getSyncRequestGap(type)) return;
    if (now - (state.lastLoadedAt[type] || 0) < minAge) return;
    loadSection(type, { busyText: "Syncing...", silent: true });
  }

  function resumeActiveSync(forceRefresh) {
    if (!isPanelAlive() || document.hidden) return;
    if (isUserHistoryDialogOpen()) return;
    if (!state.autoSyncTimer) startAutoSync();
    const activeType = state.activeTab;
    if (activeType === "depo" && state.depo.autoApproveBusy) return;
    if (!isInteractionLocked(activeType) && flushDeferredRender(activeType)) return;
    if (state.loading[activeType]) {
      state.pendingReload[activeType] = true;
      return;
    }
    const staleAge = (activeType === "depo" && state.depo.autoApprove) ? 1400 : 2200;
    if (forceRefresh || (Date.now() - (state.lastLoadedAt[activeType] || 0) > staleAge)) {
      loadSection(activeType, { busyText: "Syncing...", silent: true });
    }
  }

  function handleVisibilityChange() {
    if (!isPanelAlive()) return;
    if (document.hidden) {
      stopAutoSync();
      return;
    }
    resumeActiveSync(true);
  }

  function handleWindowFocus() {
    if (!isPanelAlive()) return;
    resumeActiveSync(false);
  }

  function handleWindowBlur() {
    if (!isPanelAlive()) return;
    if (document.hidden) stopAutoSync();
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
    const requestGap = options.initial ? 0 : (options.silent ? getSyncRequestGap(type) : 420);
    const nowTs = Date.now();
    const fetchHealth = getPendingFetchHealth(type);
    if (hasRendered && !options.force && nowTs < (fetchHealth.cooldownUntil || 0)) {
      return false;
    }
    if (hasRendered && !options.force && (nowTs - (state.lastRequestAt[type] || 0) < requestGap)) {
      return false;
    }
    const token = ++state.loadToken[type];
    const currentController = state.abortControllers[type];

    if (currentController) {
      try { currentController.abort(); } catch (error) {}
    }

    const controller = new AbortController();
    state.abortControllers[type] = controller;
    state.loading[type] = true;
    state.pendingReload[type] = false;
    state.lastRequestAt[type] = nowTs;

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

      markPendingFetchSuccess(type);
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
      const retryDelay = markPendingFetchFailure(type, error, !!hasRendered);
      if (isTransientPendingFetchError(error)) {
        if (token === state.loadToken[type] && !hasRendered) {
          tab.innerHTML = `<div class="pp-loading">${type === "depo" ? "Deposit" : "Withdraw"} pending server sibuk, retry otomatis...</div>`;
          tab.dataset.rendered = "0";
        }
        if (token === state.loadToken[type] && isPanelAlive() && isAuthenticated()) {
          window.setTimeout(() => {
            if (!isPanelAlive() || !isAuthenticated()) return;
            if (state.loadToken[type] !== token) return;
            loadSection(type, { busyText: "Retrying...", silent: !!hasRendered, force: true });
          }, Math.max(type === "wd" ? 850 : 650, retryDelay || 0));
        }
        return;
      }
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
      mergeBankCodeCache(type, merged.map((item) => item && item.value));
      const helpers = ensureSharedBankHelpers();
      helpers.getLabelByValue = function (kind, value) {
        const current = getAvailableBanks(kind);
        const match = current.find((item) => String(item.value) === String(value));
        return match ? match.text : "";
      };
      return cfg.availableBanks || [];
    }
    return getCachedBankCodeOptions(type);
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
    const unique = [...new Set(values)];
    return unique.length ? mergeBankCodeCache(type, unique) : readBankCodeCache(type);
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
    const selected = new Set((cfg.banks || []).map((value) => String(value)));
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const rowId = extractRowId(row, type === 'wd' ? 'withdrawPending-' : 'depositPending-');
      if (hasOptimisticPendingRow(type, rowId)) return false;
      if (!cfg.hasBankSelection) return true;
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

  function getLocalDateOnly(date = new Date()) {
    const value = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (Number.isNaN(value.getTime())) return "";
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }


  function getDepositApprovedDefaultState() {
    const currentDate = new Date();
    const sevenDaysAgo = new Date(currentDate.getTime());
    sevenDaysAgo.setDate(currentDate.getDate() - 7);
    return {
      showAll: true,
      from: getLocalDateOnly(sevenDaysAgo),
      to: getLocalDateOnly(currentDate),
      form: "username",
      val: "",
      indicator: "",
      page: 1,
      html: "",
      initialized: false,
      loading: false,
      abortController: null,
      refreshTimer: 0,
      syncTimers: [],
      renderedHtml: "",
      loadingMode: "idle"
    };
  }

  function ensureDepositApprovedState() {
    const cfg = state.depo;
    if (!cfg.approved || typeof cfg.approved !== "object") {
      cfg.approved = getDepositApprovedDefaultState();
      return cfg.approved;
    }
    const defaults = getDepositApprovedDefaultState();
    cfg.approved.showAll = !!cfg.approved.showAll;
    cfg.approved.from = String(cfg.approved.from || defaults.from);
    cfg.approved.to = String(cfg.approved.to || defaults.to);
    cfg.approved.form = ["username", "name", "rekening", "note"].includes(String(cfg.approved.form || "")) ? String(cfg.approved.form) : "username";
    cfg.approved.val = String(cfg.approved.val || "");
    cfg.approved.indicator = ["", "n", "g", "y", "r"].includes(String(cfg.approved.indicator || "")) ? String(cfg.approved.indicator) : "";
    cfg.approved.page = Math.max(1, parseInt(cfg.approved.page, 10) || 1);
    cfg.approved.html = String(cfg.approved.html || "");
    cfg.approved.initialized = !!cfg.approved.initialized;
    cfg.approved.loading = !!cfg.approved.loading;
    cfg.approved.abortController = cfg.approved.abortController || null;
    cfg.approved.refreshTimer = Number(cfg.approved.refreshTimer || 0) || 0;
    cfg.approved.syncTimers = Array.isArray(cfg.approved.syncTimers) ? cfg.approved.syncTimers.filter((value) => Number.isFinite(Number(value))) : [];
    cfg.approved.renderedHtml = String(cfg.approved.renderedHtml || "");
    cfg.approved.loadingMode = String(cfg.approved.loadingMode || "idle");
    return cfg.approved;
  }

  function clearDepositApprovedRefreshTimer() {
    const approved = ensureDepositApprovedState();
    if (approved.refreshTimer) {
      try { clearTimeout(approved.refreshTimer); } catch (_) {}
      approved.refreshTimer = 0;
    }
  }

  function clearDepositApprovedSyncTimers() {
    const approved = ensureDepositApprovedState();
    const timers = Array.isArray(approved.syncTimers) ? approved.syncTimers.slice() : [];
    approved.syncTimers = [];
    timers.forEach((timer) => {
      try { clearTimeout(timer); } catch (_) {}
    });
  }


  function extractApprovedBankOptionsFromHtml(type, html) {
    const source = String(html || "").trim();
    if (!source) return [];
    let doc = null;
    try {
      doc = new DOMParser().parseFromString(source, "text/html");
    } catch (_) {
      return [];
    }
    if (!doc) return [];

    const optionSelectors = type === "depo"
      ? [
          "#bank-select-depo option",
          "#bank-select option",
          "select[name='listRekening[]'] option",
          "select[name='listRekening'] option",
          "select[id*='bank'] option",
          "select[id*='rekening'] option"
        ]
      : [
          "#bank-select option",
          "#bank-select-depo option",
          "select[name='listRekening[]'] option",
          "select[name='listRekening'] option",
          "select[id*='bank'] option",
          "select[id*='rekening'] option"
        ];

    const inputSelectors = [
      "input[name='listRekening[]'][value]",
      "input[name='listRekening'][value]",
      "input[id*='rekening'][value]",
      "input[data-bank][value]"
    ];

    const options = [];
    optionSelectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((node) => {
        const value = String(node.value || node.getAttribute("value") || "").trim();
        if (!value) return;
        const textLabel = String(node.textContent || node.label || "").replace(/\s+/g, " ").trim();
        options.push({ value, text: textLabel || inferBankLabelFromValue(value) });
      });
    });

    inputSelectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((node) => {
        const value = String(node.value || node.getAttribute("value") || "").trim();
        if (!value) return;
        const labelNode = node.closest("label");
        const parentText = labelNode ? labelNode.textContent : ((node.parentElement && node.parentElement.textContent) || "");
        const textLabel = String(parentText || node.getAttribute("data-bank") || "").replace(/\s+/g, " ").trim();
        options.push({ value, text: textLabel || inferBankLabelFromValue(value) });
      });
    });

    return dedupeBankOptions(options);
  }

  function resolveApprovedBankOptions(type, headerHtml = "") {
    const cfg = getStateSection(type);
    const merged = dedupeBankOptions([
      ...extractApprovedBankOptionsFromHtml(type, headerHtml),
      ...collectBanksFromNativeDom(type),
      ...(cfg.availableBanks || []),
      ...getAvailableBanks(type),
      ...getCachedBankCodeOptions(type)
    ]);
    if (merged.length) {
      cfg.availableBanks = merged.slice();
      mergeBankCodeCache(type, merged.map((item) => item && item.value));
    }
    return merged;
  }

  async function fetchApprovedHeaderHtml(type, signal) {
    const approved = type === "depo" ? ensureDepositApprovedState() : ensureWithdrawApprovedState();
    const endpoint = type === "depo"
      ? SERVICE_ENDPOINTS.depositApprovedHeader
      : SERVICE_ENDPOINTS.withdrawApprovedHeader;

    const headers = getPanelAjaxHeaders({
      accept: "*/*",
      "x-requested-with": "XMLHttpRequest"
    });

    let body = null;
    if (type === "wd") {
      headers["content-type"] = "application/x-www-form-urlencoded; charset=UTF-8";
      const params = new URLSearchParams();
      params.append("showAll", approved.showAll ? "true" : "false");
      params.append("withdrawFrom", String(approved.from || ""));
      params.append("withdrawTo", String(approved.to || ""));
      params.append("withdrawForm", String(approved.form || "username"));
      params.append("withdrawVal", String(approved.val || ""));
      body = params.toString();
    }

    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      signal,
      headers,
      body
    });

    if (!response.ok) {
      throw new Error(`${type === "depo" ? "Deposit" : "Withdraw"} approved header request failed: ${response.status}`);
    }

    return response.text();
  }

  async function fetchDepositApprovedHistory(cfg, signal, page) {
    const approved = ensureDepositApprovedState();
    const request = createFetchSignal(signal, 15000);
    const currentPage = Math.max(1, parseInt(page, 10) || approved.page || 1);
    let headerHtml = "";
    try {
      headerHtml = await fetchApprovedHeaderHtml("depo", request.signal);
    } catch (error) {
      if (!(error && error.name === "AbortError")) {
        console.warn(`[${PANEL_ID}] deposit approved header fetch failed`, error);
      }
    }
    const bankCodes = resolveApprovedBankOptions("depo", headerHtml).map((item) => String(item.value)).filter(Boolean);

    const primaryBody = new URLSearchParams();
    bankCodes.forEach((value) => primaryBody.append("listRekening[]", value));
    primaryBody.append("showAll", approved.showAll ? "true" : "false");
    primaryBody.append("catBy", String(approved.form || "username"));
    primaryBody.append("catValue", String(approved.val || ""));
    primaryBody.append("indicator", String(approved.indicator || ""));
    primaryBody.append("startDate", String(approved.from || ""));
    primaryBody.append("endDate", String(approved.to || ""));
    primaryBody.append("page", String(currentPage));
    primaryBody.append("dpp", "40");

    const fallbackBody = new URLSearchParams(primaryBody.toString());
    fallbackBody.append("depoAppDtStart", String(approved.from || ""));
    fallbackBody.append("depoAppDtEnd", String(approved.to || ""));
    fallbackBody.append("depoAppCatBy", String(approved.form || "username"));
    fallbackBody.append("depoAppCatValue", String(approved.val || ""));
    fallbackBody.append("depoAppIndicator", String(approved.indicator || ""));
    fallbackBody.append("depositFrom", String(approved.from || ""));
    fallbackBody.append("depositTo", String(approved.to || ""));
    fallbackBody.append("depositForm", String(approved.form || "username"));
    fallbackBody.append("depositVal", String(approved.val || ""));
    fallbackBody.append("depositIndicator", String(approved.indicator || ""));

    const attempts = [
      {
        endpoint: SERVICE_ENDPOINTS.depositApproved,
        body: primaryBody.toString()
      },
      {
        endpoint: SERVICE_ENDPOINTS.depositApprovedContent,
        body: fallbackBody.toString()
      }
    ];

    try {
      let lastError = null;
      for (const attempt of attempts) {
        try {
          const response = await fetch(attempt.endpoint, {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            signal: request.signal,
            headers: getPanelAjaxHeaders({
              accept: "*/*",
              "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
              "x-requested-with": "XMLHttpRequest"
            }),
            body: attempt.body
          });

          if (!response.ok) {
            lastError = new Error(`Deposit approved request failed: ${response.status}`);
            continue;
          }

          return response.text();
        } catch (error) {
          if (error && error.name === "AbortError") throw error;
          lastError = error;
        }
      }
      throw lastError || new Error("Deposit approved request failed");
    } finally {
      request.cleanup();
    }
  }

  function extractDepositApprovedPage(source) {
    const text = String(source || "");
    const match = text.match(/menuDepositApproved\(\s*[^,]*,\s*(\d+)\s*\)/i);
    return match ? Math.max(1, parseInt(match[1], 10) || 1) : 0;
  }

  function sanitizeDepositApprovedHtml(html) {
    const doc = new DOMParser().parseFromString(`<div id="ppDepositApprovedRoot">${html}</div>`, "text/html");
    const wrapper = doc.getElementById("ppDepositApprovedRoot") || doc.body;
    const section = wrapper.querySelector("#contentDepositApproved2, #contentDepositApproved, #contentDepoApproved, #headerDepoApproved") || wrapper;

    section.querySelectorAll("script").forEach((node) => node.remove());

    const filterAlerts = [...section.querySelectorAll(".alert")].filter((node) => node.querySelector("#depoAppDtStart, #depoAppDtEnd, #depoAppCatBy, #depoAppCatValue, #depositApprovedAll, #depoAppIndicator"));
    filterAlerts.forEach((node) => node.remove());

    [...section.querySelectorAll("#depoAppDtStart, #depoAppDtEnd, #depoAppCatBy, #depoAppCatValue, #depositApprovedAll, #depoAppIndicator")].forEach((node) => {
      const wrap = node.closest(".alert") || node.closest(".row") || node.closest("div");
      if (wrap && wrap !== section) wrap.remove();
    });

    section.querySelectorAll("[onclick], a[href], button[href]").forEach((node) => {
      const onclick = node.getAttribute("onclick") || "";
      const href = node.getAttribute("href") || "";
      const page = extractDepositApprovedPage(onclick) || extractDepositApprovedPage(href);
      if (page) {
        node.setAttribute("data-pp-depo-approved-page", String(page));
        node.style.cursor = "pointer";
      }
      if (/resetFormApproved/i.test(onclick) || /resetFormApproved/i.test(href)) {
        node.setAttribute("data-pp-depo-approved-clear", "1");
        node.style.cursor = "pointer";
      }
      if (node.hasAttribute("onclick")) node.removeAttribute("onclick");
      if (/^javascript:/i.test(href)) node.setAttribute("href", "#");
    });

    const content = section.innerHTML.trim();
    return content || '<div class="pp-empty">Tidak ada history deposit approved.</div>';
  }

  function renderDepositApprovedBody(content) {
    const inner = String(content || '').trim() || '<div class="pp-empty">Tidak ada history deposit approved.</div>';
    return `<div class="pp-approvedHistorySurface"><div class="pp-approvedHistoryInner">${inner}</div></div>`;
  }

  function buildDepositApprovedMarkup() {
    const approved = ensureDepositApprovedState();
    const bodyHtml = renderDepositApprovedBody(approved.html
      ? sanitizeDepositApprovedHtml(approved.html)
      : '<div class="pp-empty">Belum ada history deposit approved.</div>');

    return `
      <div class="pp-sectionBody" style="margin-top:8px;">
        <div class="alert alert-success pp-alert" style="margin-bottom:0;border-color:#d6e9c6;border-radius:4px 4px 0 0 !important;">
          <div class="row align-items-center">
            <div class="col">
              <strong><span class="glyphicon glyphicon-tasks"></span> DEPOSIT APPROVED</strong>
            </div>
            <div class="col-auto">
              <span class="pull-right form-group-sm form-inline pp-approvedToolbar">
                <label for="ppDepoApprovedFrom" class="pp-approvedLabel"><strong>From</strong></label>
                <input type="text" class="form-control form-select datepicker pp-approvedDateInput is-from" id="ppDepoApprovedFrom" value="${escapeHtml(approved.from)}" placeholder="yyyy-mm-dd" inputmode="numeric" spellcheck="false">
                <label for="ppDepoApprovedTo" class="pp-approvedLabel"><strong>To</strong></label>
                <input type="text" class="form-control form-select datepicker pp-approvedDateInput is-to" id="ppDepoApprovedTo" value="${escapeHtml(approved.to)}" placeholder="Now" inputmode="numeric" spellcheck="false">
                <button type="button" class="btn btn-secondary" id="ppDepoApprovedSearchTop">Search</button>
              </span>
            </div>
          </div>
        </div>
        <div class="alert alert-success pp-filterBar" style="background-color:#F9F9F9;margin-top:0;border-radius:0 0 4px 4px !important;border-color:#d6e9c6;">
          <div class="row align-items-center">
            <div class="col">
              <input class="form-check-input" type="checkbox" value="" id="ppDepoApprovedShowAll" ${approved.showAll ? "checked" : ""}>
              <label class="form-check-label pp-approvedShowAllLabel" for="ppDepoApprovedShowAll">
                <strong>Show All Transactions</strong>
              </label>
            </div>
            <div class="col-auto">
              <span class="pull-right form-group-sm form-inline pp-approvedToolbar pp-approvedToolbarBottom">
                <select id="ppDepoApprovedForm" class="form-control form-select" style="margin-left:10px;display:inline-block;vertical-align:middle;">
                  <option value="username" ${approved.form === "username" ? "selected" : ""}>Username</option>
                  <option value="name" ${approved.form === "name" ? "selected" : ""}>Nama Rekening</option>
                  <option value="rekening" ${approved.form === "rekening" ? "selected" : ""}>Nomor Rekening</option>
                  <option value="note" ${approved.form === "note" ? "selected" : ""}>Deskripsi</option>
                </select>
                <input type="text" id="ppDepoApprovedVal" class="form-control pp-approvedSearchField" value="${escapeHtml(approved.val)}" style="display:inline-block;vertical-align:middle;margin-left:10px;" placeholder="">
                <button type="button" class="btn btn-secondary" id="ppDepoApprovedSearchBottom" style="margin-left:10px">Search</button>
                <select id="ppDepoApprovedIndicator" class="form-control form-select" style="margin-left:15px;margin-right:15px;display:inline-block;vertical-align:middle;">
                  <option value="" ${approved.indicator === "" ? "selected" : ""}>All Indicator</option>
                  <option value="n" ${approved.indicator === "n" ? "selected" : ""}>None Only</option>
                  <option value="g" ${approved.indicator === "g" ? "selected" : ""}>Green Only</option>
                  <option value="y" ${approved.indicator === "y" ? "selected" : ""}>Yellow Only</option>
                  <option value="r" ${approved.indicator === "r" ? "selected" : ""}>Red Only</option>
                </select>
                <button type="button" class="btn btn-secondary" id="ppDepoApprovedClear">Reset Form</button>
              </span>
            </div>
          </div>
        </div>
        <div id="ppDepoApprovedBody" class="pp-approvedHistoryWrap">${bodyHtml}</div>
      </div>
    `;
  }

  function syncDepositApprovedControls(tab) {
    const approved = ensureDepositApprovedState();
    if (!tab) return;
    const body = tab.querySelector("#ppDepoApprovedBody");
    const searchButtons = [tab.querySelector("#ppDepoApprovedSearchTop"), tab.querySelector("#ppDepoApprovedSearchBottom")].filter(Boolean);
    const clearButton = tab.querySelector("#ppDepoApprovedClear");
    const inputs = [
      tab.querySelector("#ppDepoApprovedShowAll"),
      tab.querySelector("#ppDepoApprovedFrom"),
      tab.querySelector("#ppDepoApprovedTo"),
      tab.querySelector("#ppDepoApprovedForm"),
      tab.querySelector("#ppDepoApprovedVal"),
      tab.querySelector("#ppDepoApprovedIndicator")
    ].filter(Boolean);
    const hardBusy = !!approved.loading && approved.loadingMode !== "silent";

    inputs.forEach((input) => {
      input.disabled = hardBusy;
    });

    searchButtons.forEach((button) => {
      button.disabled = hardBusy;
      setSearchButtonLoading(button, hardBusy);
    });

    if (clearButton) clearButton.disabled = hardBusy;
    if (body) {
      body.setAttribute("aria-busy", approved.loading ? "true" : "false");
      body.dataset.syncMode = approved.loading ? approved.loadingMode : "idle";
    }
  }

  function initDepositApprovedDatepickers(tab) {
    if (!tab || tab.__ppDepoApprovedDatepickerBound) return;
    tab.__ppDepoApprovedDatepickerBound = true;
    const dateNodes = [...tab.querySelectorAll("#ppDepoApprovedFrom, #ppDepoApprovedTo")];
    if (!dateNodes.length) return;
    const jq = window.jQuery || window.$;
    if (!jq || typeof jq.fn !== "object" || typeof jq.fn.datepicker !== "function") return;
    try {
      jq(dateNodes).datepicker({
        format: "yyyy-mm-dd",
        todayHighlight: true,
        autoclose: true
      });
    } catch (_) {}
  }

  function readDepositApprovedControls(tab) {
    const approved = ensureDepositApprovedState();
    if (!tab) return approved;
    const showAllInput = tab.querySelector("#ppDepoApprovedShowAll");
    const fromInput = tab.querySelector("#ppDepoApprovedFrom");
    const toInput = tab.querySelector("#ppDepoApprovedTo");
    const formSelect = tab.querySelector("#ppDepoApprovedForm");
    const valueInput = tab.querySelector("#ppDepoApprovedVal");
    const indicatorSelect = tab.querySelector("#ppDepoApprovedIndicator");

    approved.showAll = !!(showAllInput && showAllInput.checked);
    approved.from = normalizeApprovedDateValue(fromInput && fromInput.value, approved.from || getLocalDateOnly(new Date()));
    approved.to = normalizeApprovedDateValue(toInput && toInput.value, approved.to || getLocalDateOnly(new Date()));
    if (fromInput) fromInput.value = approved.from;
    if (toInput) toInput.value = approved.to;
    approved.form = String(formSelect && formSelect.value || approved.form || "username");
    approved.val = String(valueInput && valueInput.value || "").trim();
    approved.indicator = ["", "n", "g", "y", "r"].includes(String(indicatorSelect && indicatorSelect.value || approved.indicator || "")) ? String(indicatorSelect && indicatorSelect.value || approved.indicator || "") : "";
    return approved;
  }

  function scheduleDepositApprovedHistoryRefresh(delay = 650, options = {}) {
    const approved = ensureDepositApprovedState();
    clearDepositApprovedRefreshTimer();
    approved.refreshTimer = window.setTimeout(() => {
      approved.refreshTimer = 0;
      if (!isPanelAlive() || !isAuthenticated()) return;
      loadDepositApprovedHistory({
        page: Math.max(1, parseInt(options.page, 10) || approved.page || 1),
        forceBusy: !!options.forceBusy,
        silent: !!options.silent,
        busyText: options.busyText || "Refreshing deposit approved..."
      }).catch((error) => console.error(`[${PANEL_ID}] deposit approved refresh failed`, error));
    }, Math.max(0, delay || 0));
    return approved.refreshTimer;
  }

  function scheduleDepositApprovedHistoryRefreshWave(options = {}) {
    const approved = ensureDepositApprovedState();
    const delays = Array.isArray(options.delays) && options.delays.length ? options.delays : [350, 1200, 2600, 4300, 6800, 9400];
    clearDepositApprovedRefreshTimer();
    clearDepositApprovedSyncTimers();
    delays.forEach((delay, index) => {
      const timer = window.setTimeout(() => {
        const current = ensureDepositApprovedState();
        if (!isPanelAlive() || !isAuthenticated()) return;
        if (current.loading) {
          scheduleDepositApprovedHistoryRefresh(260, {
            page: options.page,
            forceBusy: false,
            silent: true,
            busyText: options.busyText || "Refreshing deposit approved..."
          });
          return;
        }
        loadDepositApprovedHistory({
          page: Math.max(1, parseInt(options.page, 10) || current.page || approved.page || 1),
          forceBusy: !!(options.forceBusy && index === 0),
          silent: options.silent !== false,
          busyText: options.busyText || "Refreshing deposit approved..."
        }).catch((error) => console.error(`[${PANEL_ID}] deposit approved wave refresh failed`, error));
      }, Math.max(0, delay || 0));
      approved.syncTimers.push(timer);
    });
    return approved.syncTimers.slice();
  }

  function triggerDepositApprovedHistoryRefreshWave(options = {}) {
    const localWave = typeof scheduleDepositApprovedHistoryRefreshWave === "function" ? scheduleDepositApprovedHistoryRefreshWave : null;
    const globalWave = typeof window.scheduleDepositApprovedHistoryRefreshWave === "function" ? window.scheduleDepositApprovedHistoryRefreshWave : null;
    const runner = localWave || globalWave;
    if (typeof runner === "function") {
      try {
        return runner(options || {});
      } catch (error) {
        console.warn(`[${PANEL_ID}] deposit approved wave bridge failed`, error);
      }
    }
    return scheduleDepositApprovedHistoryRefresh(360, {
      page: options && options.page,
      forceBusy: !!(options && options.forceBusy),
      silent: !(options && options.forceBusy),
      busyText: options && options.busyText || "Refreshing deposit approved..."
    });
  }

  window.scheduleDepositApprovedHistoryRefreshWave = function scheduleDepositApprovedHistoryRefreshWaveGlobal(options = {}) {
    return scheduleDepositApprovedHistoryRefreshWave(options || {});
  };
  window.triggerDepositApprovedHistoryRefreshWave = function triggerDepositApprovedHistoryRefreshWaveGlobal(options = {}) {
    return triggerDepositApprovedHistoryRefreshWave(options || {});
  };

  async function loadDepositApprovedHistory(options = {}) {
    if (!isPanelAlive() || !isAuthenticated()) return false;
    const tab = refs.depoTab;
    if (!tab) return false;

    const approved = readDepositApprovedControls(tab);
    const body = tab.querySelector("#ppDepoApprovedBody");
    const requestedPage = Math.max(1, parseInt(options.page, 10) || approved.page || 1);
    const silent = !!options.silent;

    if (approved.abortController) {
      try { approved.abortController.abort(); } catch (_) {}
    }

    const controller = new AbortController();
    approved.abortController = controller;
    approved.loading = true;
    approved.loadingMode = silent ? "silent" : "busy";
    approved.page = requestedPage;
    syncDepositApprovedControls(tab);

    if (body && (!approved.html || (options.forceBusy && !silent))) {
      const loadingMarkup = renderDepositApprovedBody(`<div class="pp-loading">${renderSearchLoadingContent(options.busyText || "Loading deposit approved...")}</div>`);
      if (loadingMarkup !== approved.renderedHtml) {
        body.innerHTML = loadingMarkup;
        approved.renderedHtml = loadingMarkup;
      }
    }

    try {
      const html = await fetchDepositApprovedHistory(state.depo, controller.signal, requestedPage);
      if (approved.abortController !== controller) return false;
      approved.html = String(html || "");
      approved.initialized = true;
      const nextMarkup = renderDepositApprovedBody(sanitizeDepositApprovedHtml(approved.html));
      if (body && nextMarkup !== approved.renderedHtml) {
        body.innerHTML = nextMarkup;
        approved.renderedHtml = nextMarkup;
      }
      return true;
    } catch (error) {
      if (error && error.name === "AbortError") return false;
      console.error(`[${PANEL_ID}] deposit approved load failed`, error);
      const errorMarkup = renderDepositApprovedBody('<div class="pp-error">Gagal memuat history deposit approved</div>');
      if (body && errorMarkup !== approved.renderedHtml) {
        body.innerHTML = errorMarkup;
        approved.renderedHtml = errorMarkup;
      }
      return false;
    } finally {
      if (approved.abortController === controller) {
        approved.abortController = null;
      }
      approved.loading = false;
      approved.loadingMode = "idle";
      syncDepositApprovedControls(tab);
    }
  }

  function bindDepositApprovedControls(tab) {
    if (!tab || tab.__ppDepoApprovedControlsBound) return;
    tab.__ppDepoApprovedControlsBound = true;
    initDepositApprovedDatepickers(tab);
    const approved = ensureDepositApprovedState();
    const showAllInput = tab.querySelector("#ppDepoApprovedShowAll");
    const fromInput = tab.querySelector("#ppDepoApprovedFrom");
    const toInput = tab.querySelector("#ppDepoApprovedTo");
    const formSelect = tab.querySelector("#ppDepoApprovedForm");
    const valueInput = tab.querySelector("#ppDepoApprovedVal");
    const indicatorSelect = tab.querySelector("#ppDepoApprovedIndicator");
    const searchButtons = [tab.querySelector("#ppDepoApprovedSearchTop"), tab.querySelector("#ppDepoApprovedSearchBottom")].filter(Boolean);
    const clearButton = tab.querySelector("#ppDepoApprovedClear");
    const body = tab.querySelector("#ppDepoApprovedBody");

    const runSearch = (page = 1, forceBusy = false) => {
      approved.page = Math.max(1, parseInt(page, 10) || 1);
      loadDepositApprovedHistory({ page: approved.page, forceBusy, busyText: approved.initialized ? "Refreshing history..." : "Loading deposit approved..." });
    };

    if (showAllInput) {
      showAllInput.checked = !!approved.showAll;
      showAllInput.addEventListener("change", () => runSearch(1, true));
    }

    [fromInput, toInput, formSelect, indicatorSelect].filter(Boolean).forEach((input) => {
      input.addEventListener("change", () => {
        readDepositApprovedControls(tab);
        if (input === indicatorSelect) runSearch(1, true);
      });
    });

    [fromInput, toInput].filter(Boolean).forEach((input) => {
      input.addEventListener("blur", () => {
        const fallback = input === fromInput ? approved.from : approved.to;
        input.value = normalizeApprovedDateValue(input.value, fallback);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearch(1, true);
        }
      });
    });

    if (valueInput) {
      valueInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearch(1, true);
        }
      });
      valueInput.addEventListener("input", () => {
        approved.val = String(valueInput.value || "");
      });
    }

    searchButtons.forEach((button) => {
      button.addEventListener("click", () => runSearch(1, true));
    });

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        clearDepositApprovedRefreshTimer();
        clearDepositApprovedSyncTimers();
        const defaults = getDepositApprovedDefaultState();
        Object.assign(approved, defaults, { html: "", initialized: false, loading: false, loadingMode: "idle", renderedHtml: "", abortController: null });
        if (showAllInput) showAllInput.checked = !!approved.showAll;
        if (fromInput) fromInput.value = approved.from;
        if (toInput) toInput.value = approved.to;
        if (formSelect) formSelect.value = approved.form;
        if (valueInput) valueInput.value = approved.val;
        if (indicatorSelect) indicatorSelect.value = approved.indicator;
        if (body) body.innerHTML = renderDepositApprovedBody(`<div class="pp-loading">${renderSearchLoadingContent("Loading deposit approved...")}</div>`);
        runSearch(1, true);
      });
    }

    if (body && !body.__ppDepoApprovedBound) {
      body.__ppDepoApprovedBound = true;
      body.addEventListener("click", (event) => {
        const clearTrigger = event.target.closest("[data-pp-depo-approved-clear='1']");
        if (clearTrigger) {
          event.preventDefault();
          if (clearButton) clearButton.click();
          return;
        }
        const pageTrigger = event.target.closest("[data-pp-depo-approved-page]");
        if (!pageTrigger) return;
        event.preventDefault();
        const nextPage = Math.max(1, parseInt(pageTrigger.getAttribute("data-pp-depo-approved-page") || "1", 10) || 1);
        runSearch(nextPage, true);
      });
    }

    syncDepositApprovedControls(tab);
    if (!approved.initialized && !approved.loading) {
      loadDepositApprovedHistory({ page: approved.page || 1, busyText: "Loading deposit approved..." });
    }
  }

  function getWithdrawApprovedDefaultState() {
    const currentDate = new Date();
    const sevenDaysAgo = new Date(currentDate.getTime());
    sevenDaysAgo.setDate(currentDate.getDate() - 7);
    return {
      showAll: true,
      from: getLocalDateOnly(sevenDaysAgo),
      to: getLocalDateOnly(currentDate),
      form: "username",
      val: "",
      page: 1,
      html: "",
      initialized: false,
      loading: false,
      abortController: null,
      refreshTimer: 0,
      syncTimers: [],
      renderedHtml: "",
      loadingMode: "idle"
    };
  }

  function ensureWithdrawApprovedState() {
    const cfg = state.wd;
    if (!cfg.approved || typeof cfg.approved !== "object") {
      cfg.approved = getWithdrawApprovedDefaultState();
      return cfg.approved;
    }
    const defaults = getWithdrawApprovedDefaultState();
    cfg.approved.showAll = !!cfg.approved.showAll;
    cfg.approved.from = String(cfg.approved.from || defaults.from);
    cfg.approved.to = String(cfg.approved.to || defaults.to);
    cfg.approved.form = ["username", "name", "rekening", "note"].includes(String(cfg.approved.form || "")) ? String(cfg.approved.form) : "username";
    cfg.approved.val = String(cfg.approved.val || "");
    cfg.approved.page = Math.max(1, parseInt(cfg.approved.page, 10) || 1);
    cfg.approved.html = String(cfg.approved.html || "");
    cfg.approved.initialized = !!cfg.approved.initialized;
    cfg.approved.loading = !!cfg.approved.loading;
    cfg.approved.abortController = cfg.approved.abortController || null;
    cfg.approved.refreshTimer = Number(cfg.approved.refreshTimer || 0) || 0;
    cfg.approved.syncTimers = Array.isArray(cfg.approved.syncTimers) ? cfg.approved.syncTimers.filter((value) => Number.isFinite(Number(value))) : [];
    cfg.approved.renderedHtml = String(cfg.approved.renderedHtml || "");
    cfg.approved.loadingMode = String(cfg.approved.loadingMode || "idle");
    return cfg.approved;
  }

  function clearWithdrawApprovedRefreshTimer() {
    const approved = ensureWithdrawApprovedState();
    if (approved.refreshTimer) {
      try { clearTimeout(approved.refreshTimer); } catch (_) {}
      approved.refreshTimer = 0;
    }
  }

  function clearWithdrawApprovedSyncTimers() {
    const approved = ensureWithdrawApprovedState();
    const timers = Array.isArray(approved.syncTimers) ? approved.syncTimers.slice() : [];
    approved.syncTimers = [];
    timers.forEach((timer) => {
      try { clearTimeout(timer); } catch (_) {}
    });
  }

  async function fetchWithdrawApprovedHistory(cfg, signal, page) {
    const approved = ensureWithdrawApprovedState();
    const body = new URLSearchParams();
    const request = createFetchSignal(signal, 15000);
    let headerHtml = "";
    try {
      headerHtml = await fetchApprovedHeaderHtml("wd", request.signal);
    } catch (error) {
      if (!(error && error.name === "AbortError")) {
        console.warn(`[${PANEL_ID}] withdraw approved header fetch failed`, error);
      }
    }
    const bankCodes = resolveApprovedBankOptions("wd", headerHtml).map((item) => String(item.value)).filter(Boolean);
    bankCodes.forEach((value) => body.append("listRekening[]", value));
    body.append("showAll", approved.showAll ? "1" : "0");
    body.append("withdrawFrom", String(approved.from || ""));
    body.append("withdrawTo", String(approved.to || ""));
    body.append("withdrawForm", String(approved.form || "username"));
    body.append("withdrawVal", String(approved.val || ""));
    body.append("page", String(Math.max(1, parseInt(page, 10) || approved.page || 1)));

    try {
      const response = await fetch(SERVICE_ENDPOINTS.withdrawApprovedContent, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: request.signal,
        headers: getPanelAjaxHeaders({
          accept: "*/*",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        }),
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`Withdraw approved request failed: ${response.status}`);
      }

      return response.text();
    } finally {
      request.cleanup();
    }
  }

  function extractWithdrawApprovedPage(source) {
    const text = String(source || "");
    const match = text.match(/menuWithdrawApprovedContent\(\s*[^,]*,\s*(\d+)\s*\)/i);
    return match ? Math.max(1, parseInt(match[1], 10) || 1) : 0;
  }

  function sanitizeWithdrawApprovedHtml(html) {
    const doc = new DOMParser().parseFromString(`<div id="ppWithdrawApprovedRoot">${html}</div>`, "text/html");
    const wrapper = doc.getElementById("ppWithdrawApprovedRoot") || doc.body;
    const section = wrapper.querySelector("#contentWithdrawApproved2, #contentWithdrawApproved, #contentWD2") || wrapper;

    section.querySelectorAll("script").forEach((node) => node.remove());

    const filterAlerts = [...section.querySelectorAll(".alert")].filter((node) => node.querySelector("#withdrawFrom, #withdrawTo, #withdrawForm, #withdrawVal, #withdrawApprovedAll"));
    filterAlerts.forEach((node) => node.remove());

    [...section.querySelectorAll("#withdrawFrom, #withdrawTo, #withdrawForm, #withdrawVal, #withdrawApprovedAll")].forEach((node) => {
      const wrap = node.closest(".alert") || node.closest(".row") || node.closest("div");
      if (wrap && wrap !== section) wrap.remove();
    });

    section.querySelectorAll("[onclick], a[href], button[href]").forEach((node) => {
      const onclick = node.getAttribute("onclick") || "";
      const href = node.getAttribute("href") || "";
      const page = extractWithdrawApprovedPage(onclick) || extractWithdrawApprovedPage(href);
      if (page) {
        node.setAttribute("data-pp-approved-page", String(page));
        node.style.cursor = "pointer";
      }
      if (/clearFormApproved/i.test(onclick) || /clearFormApproved/i.test(href)) {
        node.setAttribute("data-pp-approved-clear", "1");
        node.style.cursor = "pointer";
      }
      if (node.hasAttribute("onclick")) node.removeAttribute("onclick");
      if (/^javascript:/i.test(href)) node.setAttribute("href", "#");
    });

    const content = section.innerHTML.trim();
    return content || '<div class="pp-empty">Tidak ada history withdraw approved.</div>';
  }

  function renderWithdrawApprovedBody(content) {
    const inner = String(content || '').trim() || '<div class="pp-empty">Tidak ada history withdraw approved.</div>';
    return `<div class="pp-approvedHistorySurface"><div class="pp-approvedHistoryInner">${inner}</div></div>`;
  }

  function buildWithdrawApprovedMarkup() {
    const approved = ensureWithdrawApprovedState();
    const bodyHtml = approved.html
      ? renderWithdrawApprovedBody(sanitizeWithdrawApprovedHtml(approved.html))
      : renderWithdrawApprovedBody('<div class="pp-empty">Belum ada history withdraw approved.</div>');

    return `
      <div class="pp-sectionBody" style="margin-top:8px;">
        <div class="alert alert-danger pp-alert" style="margin-bottom:0;border-color:#eed3d7;border-radius:4px 4px 0 0 !important;">
          <div class="row align-items-center">
            <div class="col">
              <strong><span class="glyphicon glyphicon-tasks"></span> WITHDRAW APPROVED</strong>
            </div>
            <div class="col-auto">
              <span class="pull-right form-group-sm form-inline pp-approvedToolbar">
                <label for="ppWdApprovedFrom" class="pp-approvedLabel"><strong>From</strong></label>
                <input type="text" class="form-control form-select datepicker pp-approvedDateInput is-from" id="ppWdApprovedFrom" value="${escapeHtml(approved.from)}" placeholder="yyyy-mm-dd" inputmode="numeric" spellcheck="false">
                <label for="ppWdApprovedTo" class="pp-approvedLabel"><strong>To</strong></label>
                <input type="text" class="form-control form-select datepicker pp-approvedDateInput is-to" id="ppWdApprovedTo" value="${escapeHtml(approved.to)}" placeholder="Now" inputmode="numeric" spellcheck="false">
                <button type="button" class="btn btn-secondary" id="ppWdApprovedSearchTop">Search</button>
              </span>
            </div>
          </div>
        </div>
        <div class="alert alert-danger pp-filterBar" style="background-color:#F9F9F9;margin-top:0;border-radius:0 0 4px 4px !important;border-color:#d6e9c6;">
          <div class="row align-items-center">
            <div class="col">
              <input class="form-check-input" type="checkbox" value="" id="ppWdApprovedShowAll" ${approved.showAll ? "checked" : ""}>
              <label class="form-check-label pp-approvedShowAllLabel" for="ppWdApprovedShowAll">
                <strong>Show All Transactions</strong>
              </label>
            </div>
            <div class="col-auto">
              <span class="pull-right form-group-sm form-inline pp-approvedToolbar pp-approvedToolbarBottom">
                <select id="ppWdApprovedForm" class="form-control form-select" style="margin-left:10px;display:inline-block;vertical-align:middle;">
                  <option value="username" ${approved.form === "username" ? "selected" : ""}>Username</option>
                  <option value="name" ${approved.form === "name" ? "selected" : ""}>Nama Rekening</option>
                  <option value="rekening" ${approved.form === "rekening" ? "selected" : ""}>Nomor Rekening</option>
                  <option value="note" ${approved.form === "note" ? "selected" : ""}>Deskripsi</option>
                </select>
                <input type="text" id="ppWdApprovedVal" class="form-control pp-approvedSearchField" value="${escapeHtml(approved.val)}" style="display:inline-block;vertical-align:middle;margin-left:10px;" placeholder="">
                <button type="button" class="btn btn-secondary" id="ppWdApprovedSearchBottom" style="margin-left:10px">Search</button>
                <button type="button" class="btn btn-secondary" id="ppWdApprovedClear" style="margin-left:10px">Clear Form</button>
              </span>
            </div>
          </div>
        </div>
        <div id="ppWdApprovedBody" class="pp-approvedHistoryWrap">${bodyHtml}</div>
      </div>
    `;
  }

  function syncWithdrawApprovedControls(tab) {
    const approved = ensureWithdrawApprovedState();
    if (!tab) return;
    const body = tab.querySelector("#ppWdApprovedBody");
    const searchButtons = [tab.querySelector("#ppWdApprovedSearchTop"), tab.querySelector("#ppWdApprovedSearchBottom")].filter(Boolean);
    const clearButton = tab.querySelector("#ppWdApprovedClear");
    const inputs = [
      tab.querySelector("#ppWdApprovedShowAll"),
      tab.querySelector("#ppWdApprovedFrom"),
      tab.querySelector("#ppWdApprovedTo"),
      tab.querySelector("#ppWdApprovedForm"),
      tab.querySelector("#ppWdApprovedVal")
    ].filter(Boolean);
    const hardBusy = !!approved.loading && approved.loadingMode !== "silent";

    inputs.forEach((input) => {
      input.disabled = hardBusy;
    });

    searchButtons.forEach((button) => {
      button.disabled = hardBusy;
      setSearchButtonLoading(button, hardBusy);
    });

    if (clearButton) clearButton.disabled = hardBusy;
    if (body) {
      body.setAttribute("aria-busy", approved.loading ? "true" : "false");
      body.dataset.syncMode = approved.loading ? approved.loadingMode : "idle";
    }
  }

  function normalizeApprovedDateValue(value, fallback = "") {
    const raw = String(value || "").trim();
    if (!raw) return String(fallback || "");
    const normalized = raw.replace(/[./]/g, "-");
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? String(fallback || "") : getLocalDateOnly(parsed);
  }

  function initWithdrawApprovedDatepickers(tab) {
    if (!tab || tab.__ppWdApprovedDatepickerBound) return;
    tab.__ppWdApprovedDatepickerBound = true;
    const dateNodes = [...tab.querySelectorAll("#ppWdApprovedFrom, #ppWdApprovedTo")];
    if (!dateNodes.length) return;
    const jq = window.jQuery || window.$;
    if (!jq || typeof jq.fn !== "object" || typeof jq.fn.datepicker !== "function") return;
    try {
      jq(dateNodes).datepicker({
        format: "yyyy-mm-dd",
        todayHighlight: true,
        autoclose: true
      });
    } catch (_) {}
  }

  function readWithdrawApprovedControls(tab) {
    const approved = ensureWithdrawApprovedState();
    if (!tab) return approved;
    const showAllInput = tab.querySelector("#ppWdApprovedShowAll");
    const fromInput = tab.querySelector("#ppWdApprovedFrom");
    const toInput = tab.querySelector("#ppWdApprovedTo");
    const formSelect = tab.querySelector("#ppWdApprovedForm");
    const valueInput = tab.querySelector("#ppWdApprovedVal");

    approved.showAll = !!(showAllInput && showAllInput.checked);
    approved.from = normalizeApprovedDateValue(fromInput && fromInput.value, approved.from || getLocalDateOnly(new Date()));
    approved.to = normalizeApprovedDateValue(toInput && toInput.value, approved.to || getLocalDateOnly(new Date()));
    if (fromInput) fromInput.value = approved.from;
    if (toInput) toInput.value = approved.to;
    approved.form = String(formSelect && formSelect.value || approved.form || "username");
    approved.val = String(valueInput && valueInput.value || "").trim();
    return approved;
  }

  function scheduleWithdrawApprovedHistoryRefresh(delay = 650, options = {}) {
    const approved = ensureWithdrawApprovedState();
    clearWithdrawApprovedRefreshTimer();
    approved.refreshTimer = window.setTimeout(() => {
      approved.refreshTimer = 0;
      if (!isPanelAlive() || !isAuthenticated()) return;
      loadWithdrawApprovedHistory({
        page: Math.max(1, parseInt(options.page, 10) || approved.page || 1),
        forceBusy: !!options.forceBusy,
        silent: !!options.silent,
        busyText: options.busyText || "Refreshing withdraw approved..."
      }).catch((error) => console.error(`[${PANEL_ID}] withdraw approved refresh failed`, error));
    }, Math.max(0, delay || 0));
    return approved.refreshTimer;
  }

  function scheduleWithdrawApprovedHistoryRefreshWave(options = {}) {
    const approved = ensureWithdrawApprovedState();
    const delays = Array.isArray(options.delays) && options.delays.length ? options.delays : [350, 1200, 2600, 4300, 6800, 9400];
    clearWithdrawApprovedRefreshTimer();
    clearWithdrawApprovedSyncTimers();
    delays.forEach((delay, index) => {
      const timer = window.setTimeout(() => {
        const current = ensureWithdrawApprovedState();
        if (!isPanelAlive() || !isAuthenticated()) return;
        if (current.loading) {
          scheduleWithdrawApprovedHistoryRefresh(260, {
            page: options.page,
            forceBusy: false,
            silent: true,
            busyText: options.busyText || "Refreshing withdraw approved..."
          });
          return;
        }
        loadWithdrawApprovedHistory({
          page: Math.max(1, parseInt(options.page, 10) || current.page || approved.page || 1),
          forceBusy: !!(options.forceBusy && index === 0),
          silent: options.silent !== false,
          busyText: options.busyText || "Refreshing withdraw approved..."
        }).catch((error) => console.error(`[${PANEL_ID}] withdraw approved wave refresh failed`, error));
      }, Math.max(0, delay || 0));
      approved.syncTimers.push(timer);
    });
    return approved.syncTimers.slice();
  }

  function triggerWithdrawApprovedHistoryRefreshWave(options = {}) {
    const localWave = typeof scheduleWithdrawApprovedHistoryRefreshWave === "function" ? scheduleWithdrawApprovedHistoryRefreshWave : null;
    const globalWave = typeof window.scheduleWithdrawApprovedHistoryRefreshWave === "function" ? window.scheduleWithdrawApprovedHistoryRefreshWave : null;
    const runner = localWave || globalWave;
    if (typeof runner === "function") {
      try {
        return runner(options || {});
      } catch (error) {
        console.warn(`[${PANEL_ID}] withdraw approved wave bridge failed`, error);
      }
    }
    return scheduleWithdrawApprovedHistoryRefresh(360, {
      page: options && options.page,
      forceBusy: !!(options && options.forceBusy),
      silent: !(options && options.forceBusy),
      busyText: options && options.busyText || "Refreshing withdraw approved..."
    });
  }

  window.scheduleWithdrawApprovedHistoryRefreshWave = function scheduleWithdrawApprovedHistoryRefreshWaveGlobal(options = {}) {
    return scheduleWithdrawApprovedHistoryRefreshWave(options || {});
  };
  window.triggerWithdrawApprovedHistoryRefreshWave = function triggerWithdrawApprovedHistoryRefreshWaveGlobal(options = {}) {
    return triggerWithdrawApprovedHistoryRefreshWave(options || {});
  };

  async function loadWithdrawApprovedHistory(options = {}) {
    if (!isPanelAlive() || !isAuthenticated()) return false;
    const tab = refs.wdTab;
    if (!tab) return false;

    const approved = readWithdrawApprovedControls(tab);
    const body = tab.querySelector("#ppWdApprovedBody");
    const requestedPage = Math.max(1, parseInt(options.page, 10) || approved.page || 1);
    const silent = !!options.silent;

    if (approved.abortController) {
      try { approved.abortController.abort(); } catch (_) {}
    }

    const controller = new AbortController();
    approved.abortController = controller;
    approved.loading = true;
    approved.loadingMode = silent ? "silent" : "busy";
    approved.page = requestedPage;
    syncWithdrawApprovedControls(tab);

    if (body && (!approved.html || (options.forceBusy && !silent))) {
      const loadingMarkup = renderWithdrawApprovedBody(`<div class="pp-loading">${renderSearchLoadingContent(options.busyText || "Loading withdraw approved...")}</div>`);
      if (loadingMarkup !== approved.renderedHtml) {
        body.innerHTML = loadingMarkup;
        approved.renderedHtml = loadingMarkup;
      }
    }

    try {
      const html = await fetchWithdrawApprovedHistory(state.wd, controller.signal, requestedPage);
      if (approved.abortController !== controller) return false;
      approved.html = String(html || "");
      approved.initialized = true;
      const nextMarkup = renderWithdrawApprovedBody(sanitizeWithdrawApprovedHtml(approved.html));
      if (body && nextMarkup !== approved.renderedHtml) {
        body.innerHTML = nextMarkup;
        approved.renderedHtml = nextMarkup;
      }
      return true;
    } catch (error) {
      if (error && error.name === "AbortError") return false;
      console.error(`[${PANEL_ID}] withdraw approved load failed`, error);
      const errorMarkup = renderWithdrawApprovedBody('<div class="pp-error">Gagal memuat history withdraw approved</div>');
      if (body && errorMarkup !== approved.renderedHtml) {
        body.innerHTML = errorMarkup;
        approved.renderedHtml = errorMarkup;
      }
      return false;
    } finally {
      if (approved.abortController === controller) {
        approved.abortController = null;
      }
      approved.loading = false;
      approved.loadingMode = "idle";
      syncWithdrawApprovedControls(tab);
    }
  }

  function bindWithdrawApprovedControls(tab) {
    if (!tab || tab.__ppWdApprovedControlsBound) return;
    tab.__ppWdApprovedControlsBound = true;
    initWithdrawApprovedDatepickers(tab);
    const approved = ensureWithdrawApprovedState();
    const showAllInput = tab.querySelector("#ppWdApprovedShowAll");
    const fromInput = tab.querySelector("#ppWdApprovedFrom");
    const toInput = tab.querySelector("#ppWdApprovedTo");
    const formSelect = tab.querySelector("#ppWdApprovedForm");
    const valueInput = tab.querySelector("#ppWdApprovedVal");
    const searchButtons = [tab.querySelector("#ppWdApprovedSearchTop"), tab.querySelector("#ppWdApprovedSearchBottom")].filter(Boolean);
    const clearButton = tab.querySelector("#ppWdApprovedClear");
    const body = tab.querySelector("#ppWdApprovedBody");

    const runSearch = (page = 1, forceBusy = false) => {
      approved.page = Math.max(1, parseInt(page, 10) || 1);
      loadWithdrawApprovedHistory({ page: approved.page, forceBusy, busyText: approved.initialized ? "Refreshing history..." : "Loading withdraw approved..." });
    };

    if (showAllInput) {
      showAllInput.checked = !!approved.showAll;
      showAllInput.addEventListener("change", () => runSearch(1, true));
    }

    [fromInput, toInput, formSelect].filter(Boolean).forEach((input) => {
      input.addEventListener("change", () => {
        readWithdrawApprovedControls(tab);
      });
    });

    [fromInput, toInput].filter(Boolean).forEach((input) => {
      input.addEventListener("blur", () => {
        const fallback = input === fromInput ? approved.from : approved.to;
        input.value = normalizeApprovedDateValue(input.value, fallback);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearch(1, true);
        }
      });
    });

    if (valueInput) {
      valueInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearch(1, true);
        }
      });
      valueInput.addEventListener("input", () => {
        approved.val = String(valueInput.value || "");
      });
    }

    searchButtons.forEach((button) => {
      button.addEventListener("click", () => runSearch(1, true));
    });

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        clearWithdrawApprovedRefreshTimer();
        clearWithdrawApprovedSyncTimers();
        const defaults = getWithdrawApprovedDefaultState();
        Object.assign(approved, defaults, { html: "", initialized: false, loading: false, loadingMode: "idle", renderedHtml: "", abortController: null });
        if (showAllInput) showAllInput.checked = !!approved.showAll;
        if (fromInput) fromInput.value = approved.from;
        if (toInput) toInput.value = approved.to;
        if (formSelect) formSelect.value = approved.form;
        if (valueInput) valueInput.value = approved.val;
        if (body) body.innerHTML = renderWithdrawApprovedBody(`<div class="pp-loading">${renderSearchLoadingContent("Loading withdraw approved...")}</div>`);
        runSearch(1, true);
      });
    }

    if (body && !body.__ppWdApprovedBound) {
      body.__ppWdApprovedBound = true;
      body.addEventListener("click", (event) => {
        const clearTrigger = event.target.closest("[data-pp-approved-clear='1']");
        if (clearTrigger) {
          event.preventDefault();
          if (clearButton) clearButton.click();
          return;
        }
        const pageTrigger = event.target.closest("[data-pp-approved-page]");
        if (!pageTrigger) return;
        event.preventDefault();
        const nextPage = Math.max(1, parseInt(pageTrigger.getAttribute("data-pp-approved-page") || "1", 10) || 1);
        runSearch(nextPage, true);
      });
    }

    syncWithdrawApprovedControls(tab);
    if (!approved.initialized && !approved.loading) {
      loadWithdrawApprovedHistory({ page: approved.page || 1, busyText: "Loading withdraw approved..." });
    }
  }

  async function fetchPendingDeposit(cfg, signal) {
    const body = new URLSearchParams();
    getFetchBankCodes("depo").forEach((value) => body.append("listRekening[]", value));
    body.append("showAll", String(!!cfg.showAll));
    body.append("sortBy", cfg.sortBy);

    const request = createFetchSignal(signal, 12000);
    try {
      const response = await fetch(SERVICE_ENDPOINTS.depositPending, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: request.signal,
        headers: getPanelAjaxHeaders({
          accept: "*/*",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        }),
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
      const response = await fetch(SERVICE_ENDPOINTS.withdrawPending, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: request.signal,
        headers: getPanelAjaxHeaders({
          accept: "*/*",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        }),
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

  function getHistoryKindMeta(value) {
    const key = String(value || '').toLowerCase() === 'wd' ? 'wd' : 'depo';
    return key === 'wd'
      ? { type: 'wd', fpage: 'wd', source: 'withdraw', label: 'Withdraw' }
      : { type: 'depo', fpage: 'depo', source: 'deposit', label: 'Deposit' };
  }

  function extractHistoryTriggerData(raw, fallbackType) {
    const onclick = String(raw || '').trim();
    if (!onclick) return null;
    const matched = onclick.match(/showHistory(?:Depo|WD)\(\s*['"]?([^,'")]+)['"]?\s*,\s*['"]?(depo|wd)['"]?\s*\)/i);
    if (!matched) return null;
    const username = String(matched[1] || '').trim();
    if (!username) return null;
    const meta = getHistoryKindMeta(matched[2] || fallbackType);
    return { username, fpage: meta.fpage, source: meta.source, type: meta.type, label: meta.label };
  }

  function normalizeActionIconButton(button) {
    if (!button) return;
    button.classList.add('pp-actionIconBtn');
    ['float', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'margin-top', 'margin-right', 'margin-left', 'margin-bottom', 'width', 'height'].forEach((prop) => {
      try { button.style.removeProperty(prop); } catch (_) {}
    });
  }

  function normalizeActionButtonsLayout(root) {
    if (!root) return;
    root.querySelectorAll("td[align='right'] > .btn, td[align='right'] > button, td[align='right'] .btn.btn-sm, td[align='right'] button.btn-sm, .row.align-items-center > .col-auto > .btn.btn-sm, .row.align-items-center > .col-auto > button.btn-sm").forEach((button) => {
      normalizeActionIconButton(button);
    });
  }

  function normalizePendingActionCellRows(root, type) {
    if (!root) return;
    const rowSelector = type === 'wd' ? 'tr[id^="withdrawPending-"]' : 'tr[id^="depositPending-"]';
    root.querySelectorAll(rowSelector).forEach((row) => {
      const cells = [...row.children].filter((node) => node && /^(TD|TH)$/i.test(node.tagName || ''));
      const actionCell = cells.length ? cells[cells.length - 1] : null;
      if (!actionCell) return;
      const directButtons = [...actionCell.children].filter((node) => node && /^(BUTTON)$/i.test(node.tagName || '') || (node && node.classList && node.classList.contains('btn')));
      if (directButtons.length < 2) return;
      let wrap = [...actionCell.children].find((node) => node && node.classList && node.classList.contains('pp-inlineActionRow')) || null;
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'pp-inlineActionRow';
        directButtons.forEach((button) => wrap.appendChild(button));
        actionCell.appendChild(wrap);
      }
      directButtons.forEach((button) => normalizeActionIconButton(button));
    });
  }

  function normalizePendingUserLeadRows(root) {
    if (!root) return;
    root.querySelectorAll('.pp-tableWrap td .row.align-items-center, td .row.align-items-center').forEach((row) => {
      const children = [...row.children].filter((node) => node && /^DIV$/i.test(node.tagName || ''));
      if (children.length < 3) return;
      children.forEach((child) => child.classList.remove('pp-userLeadIconCol', 'pp-userIdentityCol'));
      row.classList.remove('pp-userLeadRow');
      let seenLeadIcons = 0;
      let identityCol = null;
      for (const child of children) {
        const hasButton = !!child.querySelector('button, .btn');
        const hasLeadIcon = !!child.querySelector('.glyphicon-calendar, .glyphicon-search, .pp-historyTrigger');
        if (!identityCol && hasButton && hasLeadIcon) {
          child.classList.add('pp-userLeadIconCol');
          seenLeadIcons += 1;
          continue;
        }
        if (seenLeadIcons >= 1) {
          identityCol = child;
          break;
        }
      }
      if (!identityCol || seenLeadIcons < 1) return;
      row.classList.add('pp-userLeadRow');
      identityCol.classList.add('pp-userIdentityCol');
    });
  }

  function normalizePendingColumnWidths(root) {
    if (!root) return;
    root.querySelectorAll('table').forEach((table) => {
      const headerRows = [...table.querySelectorAll('thead tr')].filter((row) => row.children && row.children.length >= 2);
      const headerRow = headerRows[0] || null;
      if (!headerRow) return;
      const headCells = [...headerRow.children].filter((node) => node && /^(TH|TD)$/i.test(node.tagName || ''));
      if (headCells.length < 2) return;
      const actionIndex = headCells.length - 1;
      const approvalIndex = headCells.length - 2;
      const bodyRows = [...table.querySelectorAll('tbody tr')].filter((row) => row.children && row.children.length >= headCells.length);
      const applyWidth = (cell, width) => {
        if (!cell) return;
        cell.style.setProperty('width', width, 'important');
        cell.style.setProperty('min-width', width, 'important');
      };
      applyWidth(headCells[actionIndex], '92px');
      applyWidth(headCells[approvalIndex], '112px');
      bodyRows.forEach((row) => {
        applyWidth(row.children[actionIndex], '92px');
        applyWidth(row.children[approvalIndex], '112px');
      });
    });
  }

  function markHistoryTriggerButton(button, type) {
    if (!button) return;
    const data = extractHistoryTriggerData(button.getAttribute('onclick') || '', type);
    if (!data) return;
    button.dataset.ppHistoryUsername = data.username;
    button.dataset.ppHistoryFpage = data.fpage;
    button.dataset.ppHistorySource = data.source;
    button.dataset.ppHistoryType = data.type;
    button.setAttribute('type', 'button');
    button.setAttribute('title', `${data.label} history`);
    button.setAttribute('aria-label', `${data.label} history`);
    button.removeAttribute('onclick');
    button.removeAttribute('data-toggle');
    button.removeAttribute('data-placement');
    button.removeAttribute('data-bs-original-title');
    button.classList.add('pp-historyTrigger');
    normalizeActionIconButton(button);
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
      cloned.querySelectorAll("#depositPendingActionButtons button:not([onclick*='showHistoryDepo(']):not([onclick*='showHistoryWD('])").forEach((button) => button.removeAttribute("onclick"));
      cloned.querySelectorAll(".deporekform").forEach((input) => input.removeAttribute("onclick"));
      cloned.querySelectorAll(".fmdepo").forEach((input) => input.removeAttribute("onclick"));
      cloned.querySelectorAll(".bonusevent").forEach((select) => select.removeAttribute("onchange"));
    } else {
      cloned.querySelectorAll(".rowCheckboxWithdrawPending").forEach((input) => {
        input.removeAttribute("onclick");
        input.value = extractRowId(input.closest("tr"), "withdrawPending-");
      });
      cloned.querySelectorAll("#withdrawPendingActionButtons button:not([onclick*='showHistoryDepo(']):not([onclick*='showHistoryWD('])").forEach((button) => button.removeAttribute("onclick"));
      cloned.querySelectorAll("[onclick^='wdrekformSelect']").forEach((el) => el.removeAttribute("onclick"));
      cloned.querySelectorAll(".bonusturnover").forEach((select) => select.removeAttribute("onchange"));
    }

    normalizeActionButtonsLayout(cloned);
    normalizePendingActionCellRows(cloned, type);
    cloned.querySelectorAll("button[onclick*='showHistoryDepo('], button[onclick*='showHistoryWD(']").forEach((button) => {
      markHistoryTriggerButton(button, type);
    });
    normalizePendingActionCellRows(cloned, type);
    normalizePendingUserLeadRows(cloned);
    normalizePendingColumnWidths(cloned);

    if (!isAction) {
      cloned.querySelectorAll("[data-toggle='tooltip']").forEach((el) => {
        if (!el.getAttribute("title") && el.dataset.originalTitle) {
          el.setAttribute("title", el.dataset.originalTitle);
        }
      });
    }

    return cloned.outerHTML;
  }

  function readUserHistoryState() {
    if (!state.history || typeof state.history !== 'object') {
      state.history = getUserHistoryDefaultState();
      return state.history;
    }
    const defaults = getUserHistoryDefaultState();
    state.history.open = !!state.history.open;
    state.history.username = String(state.history.username || defaults.username);
    state.history.label = String(state.history.label || defaults.label);
    state.history.fpage = String(state.history.fpage || defaults.fpage) === 'wd' ? 'wd' : 'depo';
    state.history.source = String(state.history.source || defaults.source).toLowerCase() === 'withdraw' ? 'withdraw' : 'deposit';
    state.history.filter = String(state.history.filter || defaults.filter || 'all');
    state.history.page = Math.max(1, parseInt(state.history.page, 10) || 1);
    state.history.loading = !!state.history.loading;
    state.history.abortController = state.history.abortController || null;
    state.history.html = String(state.history.html || '');
    state.history.renderedHtml = String(state.history.renderedHtml || '');
    return state.history;
  }

  function ensureUserHistoryLayer() {
    if (!refs || !refs.panel) return null;
    if (refs.historyLayer && refs.historyLayer.isConnected) return refs.historyLayer;
    const layer = document.createElement('div');
    layer.id = 'ppUserHistoryLayer';
    layer.className = 'pp-userHistoryLayer';
    layer.innerHTML = `
      <div class="pp-userHistoryBackdrop" data-pp-history-close="1"></div>
      <div class="pp-userHistoryDialog" role="dialog" aria-modal="true" aria-labelledby="ppUserHistoryTitle">
        <div class="pp-userHistoryHead">
          <div class="pp-userHistoryHeadMain">
            <h3 class="pp-userHistoryTitle" id="ppUserHistoryTitle">History</h3>
            <div class="pp-userHistoryMeta" id="ppUserHistoryMeta"></div>
          </div>
          <button type="button" class="btn btn-default" id="ppUserHistoryCloseBtn" aria-label="Close history" title="Close history"><span class="glyphicon glyphicon-remove"></span></button>
        </div>
        <div class="pp-userHistoryBody" id="ppUserHistoryBody"></div>
      </div>
    `;
    refs.panel.appendChild(layer);
    refs.historyLayer = layer;
    refs.historyMeta = layer.querySelector('#ppUserHistoryMeta');
    refs.historyTitle = layer.querySelector('#ppUserHistoryTitle');
    refs.historyBody = layer.querySelector('#ppUserHistoryBody');
    refs.historyCloseBtn = layer.querySelector('#ppUserHistoryCloseBtn');
    layer.addEventListener('click', (event) => {
      const closeTrigger = event.target.closest('[data-pp-history-close="1"], #ppUserHistoryCloseBtn');
      if (!closeTrigger) return;
      event.preventDefault();
      closeUserHistory();
    });
    refs.historyBody.addEventListener('click', (event) => {
      const pageTrigger = event.target.closest('[data-pp-user-history-page]');
      if (pageTrigger) {
        event.preventDefault();
        markInteracting(1200);
        const page = Math.max(1, parseInt(pageTrigger.getAttribute('data-pp-user-history-page') || '1', 10) || 1);
        loadUserHistory({ page, refreshBrief: false, forceBusy: false });
        return;
      }
      const submitTrigger = event.target.closest('[data-pp-user-history-submit]');
      if (submitTrigger) {
        event.preventDefault();
        markInteracting(820);
        applyUserHistoryLocalFilters();
      }
    });
    refs.historyBody.addEventListener('change', (event) => {
      const filterTrigger = event.target.closest('[data-pp-user-history-filter]');
      if (!filterTrigger) return;
      markInteracting(820);
      applyUserHistoryLocalFilters();
    });
    refs.historyBody.addEventListener('keydown', (event) => {
      const input = event.target.closest('[data-pp-user-history-betid]');
      if (!input || event.key !== 'Enter') return;
      event.preventDefault();
      markInteracting(820);
      applyUserHistoryLocalFilters();
    });
    return layer;
  }

  function syncUserHistoryMeta() {
    ensureUserHistoryLayer();
    const history = readUserHistoryState();
    if (refs.historyTitle) {
      refs.historyTitle.textContent = `${history.label || (history.source === 'withdraw' ? 'Withdraw' : 'Deposit')} History`;
    }
    if (refs.historyMeta) {
      refs.historyMeta.textContent = '';
      refs.historyMeta.style.display = 'none';
    }
  }


  function applyUserHistoryLocalFilters() {
    if (!refs || !refs.historyBody) return false;
    const filterSelect = refs.historyBody.querySelector('[data-pp-user-history-filter]');
    const betIdInput = refs.historyBody.querySelector('[data-pp-user-history-betid]');
    const filter = String(filterSelect && filterSelect.value || 'all').trim() || 'all';
    const betId = String(betIdInput && betIdInput.value || '').trim();
    markInteracting(900);
    loadUserHistory({
      filter,
      betId,
      page: 1,
      refreshBrief: false,
      forceBusy: false
    }).catch(() => {});
    return true;
  }

  function closeUserHistory() {
    markInteracting(520);
    const history = readUserHistoryState();
    history.open = false;
    if (history.abortController) {
      try { history.abortController.abort(); } catch (_) {}
      history.abortController = null;
    }
    if (refs.historyLayer) refs.historyLayer.classList.remove('is-open');
    resumeActiveSync(false);
  }

  function extractUserHistoryPageFromNode(node) {
    if (!node) return 0;
    const dataPage = parseInt(node.getAttribute && node.getAttribute('data-page') || '', 10);
    if (Number.isFinite(dataPage) && dataPage > 0) return dataPage;

    const samples = [
      node.getAttribute && node.getAttribute('onclick') || '',
      node.getAttribute && node.getAttribute('href') || '',
      node.textContent || ''
    ].map((value) => String(value || '').trim()).filter(Boolean);

    for (const sample of samples) {
      const hrefMatch = sample.match(/[?&]page=(\d+)/i);
      if (hrefMatch) return Math.max(1, parseInt(hrefMatch[1], 10) || 1);

      const showHistoryUserMatch = sample.match(/showHistoryUser\(\s*['\"][^'\"]+['\"]\s*,\s*['\"]?(\d+)['\"]?\s*,/i);
      if (showHistoryUserMatch) return Math.max(1, parseInt(showHistoryUserMatch[1], 10) || 1);

      const defUsersMatch = sample.match(/showHistoryDefUsers\(\s*['\"][^'\"]+['\"]\s*,\s*['\"]?(?:depo|wd)['\"]?\s*,\s*['\"][^'\"]*['\"]\s*,\s*['\"]?(\d+)['\"]?/i);
      if (defUsersMatch) return Math.max(1, parseInt(defUsersMatch[1], 10) || 1);

      const directMatch = sample.match(/(?:^|[^\w])(first|last)\s*\(\s*(\d+)\s*\)/i);
      if (directMatch) return Math.max(1, parseInt(directMatch[2], 10) || 1);

      if (/^\d+$/.test(sample)) return Math.max(1, parseInt(sample, 10) || 1);
    }
    return 0;
  }

  function sanitizeUserHistoryBriefHtml(html) {
    const doc = new DOMParser().parseFromString(`<div id="ppUserHistoryBriefRoot">${html}</div>`, 'text/html');
    const wrapper = doc.getElementById('ppUserHistoryBriefRoot') || doc.body;
    wrapper.querySelectorAll('script').forEach((node) => node.remove());
    wrapper.querySelectorAll('#notificationBar, #notifsound, #contentTemp').forEach((node) => node.remove());

    const heading = wrapper.querySelector('.alert.alert-info h4');
    if (heading) heading.textContent = String(heading.textContent || '').replace(/^\s*Username\s*:\s*/i, 'User: ').trim();

    wrapper.querySelectorAll('table').forEach((table) => {
      if (table.closest('.pp-tableWrap')) return;
      const tableWrap = doc.createElement('div');
      tableWrap.className = 'pp-tableWrap';
      table.parentNode.insertBefore(tableWrap, table);
      tableWrap.appendChild(table);
    });

    wrapper.querySelectorAll('[id]').forEach((node) => {
      const originalId = String(node.getAttribute('id') || '').trim();
      if (!originalId) return;
      node.setAttribute('data-pp-history-original-id', originalId);
      node.removeAttribute('id');
    });

    const filterSelect = wrapper.querySelector('[data-pp-history-original-id="viewHistory"]');
    if (filterSelect) {
      filterSelect.setAttribute('data-pp-user-history-filter', '1');
      filterSelect.removeAttribute('onchange');
    }

    const betIdInput = wrapper.querySelector('[data-pp-history-original-id="betid"]');
    if (betIdInput) {
      betIdInput.setAttribute('data-pp-user-history-betid', '1');
      betIdInput.removeAttribute('onchange');
    }

    const submitButton = wrapper.querySelector('[data-pp-history-original-id="betidButton"]');
    if (submitButton) {
      submitButton.setAttribute('type', 'button');
      submitButton.setAttribute('data-pp-user-history-submit', '1');
      submitButton.removeAttribute('onclick');
    }

    const resultsSlot = wrapper.querySelector('[data-pp-history-original-id="contentHistoryUser"]');
    if (resultsSlot) {
      resultsSlot.setAttribute('data-pp-user-history-results-slot', '1');
      resultsSlot.innerHTML = '';
    }

    return String(wrapper.innerHTML || '').trim();
  }

  function sanitizeUserHistoryDetailHtml(html) {
    const history = readUserHistoryState();
    const doc = new DOMParser().parseFromString(`<div id="ppUserHistoryDetailRoot">${html}</div>`, 'text/html');
    const wrapper = doc.getElementById('ppUserHistoryDetailRoot') || doc.body;
    wrapper.querySelectorAll('script').forEach((node) => node.remove());
    wrapper.querySelectorAll('#notificationBar, #notifsound, #contentTemp').forEach((node) => node.remove());

    let currentPage = Math.max(1, parseInt(history.page, 10) || 1);

    wrapper.querySelectorAll('li, a, button, [onclick]').forEach((node) => {
      const page = extractUserHistoryPageFromNode(node);
      if (page > 0) {
        node.setAttribute('data-pp-user-history-page', String(page));
        node.removeAttribute('onclick');
        if (node.tagName && node.tagName.toLowerCase() === 'a') node.setAttribute('href', '#');
        const li = node.closest && node.closest('li');
        if (li && /\bactive\b/i.test(li.className || '')) currentPage = page;
      }
    });

    const activeText = wrapper.querySelector('.pagination .active a, .pagination .active span, ul.pagination .active a, ul.pagination .active span');
    if (activeText) {
      const activePage = parseInt(String(activeText.textContent || '').trim(), 10);
      if (Number.isFinite(activePage) && activePage > 0) currentPage = activePage;
    }

    wrapper.querySelectorAll('[id]').forEach((node) => {
      const originalId = String(node.getAttribute('id') || '').trim();
      if (!originalId) return;
      node.setAttribute('data-pp-history-original-id', originalId);
      node.removeAttribute('id');
    });

    wrapper.querySelectorAll("button[onclick*='getGamesHistory'], button[onclick*='openImg('], button[onclick*='downloadInvoice(']").forEach((button) => {
      normalizeActionIconButton(button);
    });

    wrapper.querySelectorAll('button[onclick*="switchMenu("], a[onclick*="switchMenu("]').forEach((node) => {
      node.setAttribute('data-pp-history-close', '1');
      node.removeAttribute('onclick');
      if (node.tagName && node.tagName.toLowerCase() === 'a') node.setAttribute('href', '#');
    });

    return {
      page: currentPage,
      html: String(wrapper.innerHTML || '').trim() || '<div class="pp-userHistoryEmpty">History user kosong.</div>'
    };
  }

  function renderUserHistoryComposite() {
    const history = readUserHistoryState();
    const primaryHtml = String(history.briefRenderedHtml || '').trim();
    const detailHtml = String(history.detailRenderedHtml || '').trim() || '<div class="pp-userHistoryEmpty">History user kosong.</div>';

    if (primaryHtml) {
      const doc = new DOMParser().parseFromString(`<div id="ppUserHistoryCompositeRoot">${primaryHtml}</div>`, 'text/html');
      const wrapper = doc.getElementById('ppUserHistoryCompositeRoot') || doc.body;
      const slot = wrapper.querySelector('[data-pp-user-history-results-slot]');
      if (slot) slot.remove();
      const primaryContent = String(wrapper.innerHTML || '').trim();
      return `<div class="pp-userHistoryBodyInner"><div class="pp-userHistorySurface"><div class="pp-userHistoryContent"><div class="pp-userHistoryViewport"><div class="pp-userHistoryPrimary">${primaryContent}</div><div class="pp-userHistorySecondary">${detailHtml}</div></div></div></div></div>`;
    }

    return `<div class="pp-userHistoryBodyInner"><div class="pp-userHistorySurface"><div class="pp-userHistoryContent"><div class="pp-userHistoryViewport"><div class="pp-userHistorySecondary">${detailHtml}</div></div></div></div></div>`;
  }

  async function fetchUserHistoryBriefHtml(options = {}, signal) {
    const history = readUserHistoryState();
    const request = createFetchSignal(signal, 15000);
    const body = new URLSearchParams();
    body.append('username', String(options.username || history.username || ''));
    body.append('fpage', String(options.fpage || history.fpage || 'depo'));

    try {
      const response = await fetch(USER_BRIEF_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        signal: request.signal,
        headers: getPanelAjaxHeaders({
          accept: '*/*',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest'
        }),
        body: body.toString()
      });

      if (!response.ok) throw new Error(`User history brief request failed: ${response.status}`);
      return response.text();
    } finally {
      request.cleanup();
    }
  }

  async function fetchUserHistoryHtml(options = {}, signal) {
    const history = readUserHistoryState();
    const request = createFetchSignal(signal, 15000);
    const body = new URLSearchParams();
    body.append('username', String(options.username || history.username || ''));
    body.append('fpage', String(options.fpage || history.fpage || 'depo'));
    body.append('filter', String(options.filter || history.filter || 'all'));
    body.append('page', String(Math.max(1, parseInt(options.page, 10) || history.page || 1)));
    body.append('source', String(options.source || history.source || 'deposit'));
    const betId = String(options.betId != null ? options.betId : history.betId || '').trim();
    if (betId) body.append('betid', betId);

    try {
      const response = await fetch(USER_HISTORY_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        signal: request.signal,
        headers: getPanelAjaxHeaders({
          accept: '*/*',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest'
        }),
        body: body.toString()
      });

      if (!response.ok) throw new Error(`User history request failed: ${response.status}`);
      return response.text();
    } finally {
      request.cleanup();
    }
  }

  async function loadUserHistory(options = {}) {
    if (!isPanelAlive() || !isAuthenticated()) return false;
    markInteracting(1200);
    ensureUserHistoryLayer();
    const history = readUserHistoryState();

    const nextUsername = String(options.username || history.username || '').trim();
    const nextMeta = getHistoryKindMeta(options.fpage || history.fpage || (String(options.source || history.source).toLowerCase() === 'withdraw' ? 'wd' : 'depo'));
    const nextFpage = nextMeta.fpage;
    const nextSource = String(options.source || history.source || nextMeta.source).toLowerCase() === 'withdraw' ? 'withdraw' : nextMeta.source;
    const identityChanged = nextUsername !== history.username || nextFpage !== history.fpage || nextSource !== history.source;

    history.username = nextUsername;
    history.fpage = nextFpage;
    history.source = nextSource;
    history.label = nextMeta.label;
    history.filter = String(options.filter != null ? options.filter : history.filter || 'all') || 'all';
    history.betId = String(options.betId != null ? options.betId : history.betId || '').trim();
    history.page = Math.max(1, parseInt(options.page, 10) || history.page || 1);
    history.open = true;
    syncUserHistoryMeta();
    refs.historyLayer.classList.add('is-open');

    if (history.abortController) {
      try { history.abortController.abort(); } catch (_) {}
    }

    const controller = new AbortController();
    history.abortController = controller;
    history.loading = true;
    const shouldRefreshBrief = options.refreshBrief === true || identityChanged || !history.briefRenderedHtml;

    if (refs.historyLayer) refs.historyLayer.classList.add('is-loading');
    if (refs.historyBody && (!history.renderedHtml || shouldRefreshBrief || options.forceBusy === true)) {
      refs.historyBody.innerHTML = `<div class="pp-userHistoryBodyInner"><div class="pp-userHistorySurface"><div class="pp-loading">${renderSearchLoadingContent(`Loading ${history.label.toLowerCase()} history...`)}</div></div></div>`;
    }

    try {
      const tasks = [
        shouldRefreshBrief ? fetchUserHistoryBriefHtml(history, controller.signal) : Promise.resolve(null),
        fetchUserHistoryHtml(history, controller.signal)
      ];
      const [briefHtml, detailHtml] = await Promise.all(tasks);
      if (history.abortController !== controller) return false;

      if (briefHtml != null) {
        history.briefHtml = String(briefHtml || '');
        history.briefRenderedHtml = sanitizeUserHistoryBriefHtml(history.briefHtml);
      }

      history.detailHtml = String(detailHtml || '');
      const renderedDetail = sanitizeUserHistoryDetailHtml(history.detailHtml);
      history.page = Math.max(1, parseInt(renderedDetail.page, 10) || history.page || 1);
      history.detailRenderedHtml = renderedDetail.html;
      history.html = history.detailHtml;
      history.renderedHtml = renderUserHistoryComposite();
      if (refs.historyBody) refs.historyBody.innerHTML = history.renderedHtml;

      const filterSelect = refs.historyBody && refs.historyBody.querySelector('[data-pp-user-history-filter]');
      if (filterSelect) filterSelect.value = history.filter || 'all';
      const betIdInput = refs.historyBody && refs.historyBody.querySelector('[data-pp-user-history-betid]');
      if (betIdInput) betIdInput.value = history.betId || '';

      syncUserHistoryMeta();
      return true;
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      console.error(`[${PANEL_ID}] user history load failed`, error);
      history.renderedHtml = '<div class="pp-userHistoryBodyInner"><div class="pp-userHistorySurface"><div class="pp-userHistoryError">Gagal memuat history user.</div></div></div>';
      if (refs.historyBody) refs.historyBody.innerHTML = history.renderedHtml;
      showPanelToast('Gagal memuat history user.', 'warn', 1700);
      return false;
    } finally {
      if (refs.historyLayer) refs.historyLayer.classList.remove('is-loading');
      if (history.abortController === controller) history.abortController = null;
      history.loading = false;
    }
  }

  function openUserHistory(options = {}) {
    const username = String(options.username || '').trim();
    if (!username) return;
    const meta = getHistoryKindMeta(options.fpage || options.type);
    loadUserHistory({
      username,
      fpage: meta.fpage,
      source: options.source || meta.source,
      filter: options.filter || 'all',
      betId: options.betId || '',
      page: Math.max(1, parseInt(options.page, 10) || 1),
      refreshBrief: true,
      forceBusy: true
    }).catch(() => {});
  }

  function installUserHistoryGlobalBridge() {
    const globalObj = typeof window !== 'undefined' ? window : globalThis;
    globalObj.showHistoryDepo = function(username, fpage) {
      openUserHistory({ username, fpage: fpage || 'depo', source: 'deposit' });
      return false;
    };
    globalObj.showHistoryWD = function(username, fpage) {
      openUserHistory({ username, fpage: fpage || 'wd', source: 'withdraw' });
      return false;
    };
    globalObj.showHistoryUser = function(username, page, fpage) {
      const history = readUserHistoryState();
      const body = refs && refs.historyBody ? refs.historyBody : null;
      const filterSelect = body && body.querySelector('[data-pp-user-history-filter]');
      const betIdInput = body && body.querySelector('[data-pp-user-history-betid]');
      loadUserHistory({
        username: username || history.username || '',
        fpage: fpage || history.fpage || 'depo',
        source: String((fpage || history.fpage || 'depo')).toLowerCase() === 'wd' ? 'withdraw' : 'deposit',
        filter: String(filterSelect && filterSelect.value || history.filter || 'all'),
        betId: String(betIdInput && betIdInput.value || history.betId || ''),
        page: Math.max(1, parseInt(page, 10) || 1),
        refreshBrief: false,
        forceBusy: false
      }).catch(() => {});
      return false;
    };
    globalObj.showHistoryDefUsers = function(username, fpage, filter, page, source) {
      loadUserHistory({
        username,
        fpage: fpage || ((String(source || '').toLowerCase() === 'withdraw' || String(source || '').toLowerCase() === 'wd') ? 'wd' : 'depo'),
        filter: filter || 'all',
        page: Math.max(1, parseInt(page, 10) || 1),
        source: source || ((String(fpage || '').toLowerCase() === 'wd') ? 'withdraw' : 'deposit'),
        refreshBrief: false,
        forceBusy: false
      }).catch(() => {});
      return false;
    };
    globalObj.searchBet = function() {
      applyUserHistoryLocalFilters();
      return false;
    };
  }

  function bindUserHistoryTriggers(type, tab) {
    if (!tab || tab.__ppUserHistoryTriggersBound) return;
    tab.__ppUserHistoryTriggersBound = true;
    tab.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-pp-history-username]');
      if (!trigger || !tab.contains(trigger)) return;
      event.preventDefault();
      event.stopPropagation();
      markInteracting(240);
      openUserHistory({
        username: trigger.dataset.ppHistoryUsername || '',
        fpage: trigger.dataset.ppHistoryFpage || (type === 'wd' ? 'wd' : 'depo'),
        source: trigger.dataset.ppHistorySource || (type === 'wd' ? 'withdraw' : 'deposit')
      });
    });
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

  function buildPendingEmptyTable(type) {
    if (type === "depo") {
      return `
        <div class="well well-sm" style="margin-bottom:12px;">
          <table class="table table-stripped bg-transparent" style="margin-bottom:0;">
            <thead>
              <tr class="fw-bold">
                <th></th>
                <th>No.</th>
                <th>Tanggal</th>
                <th>Username</th>
                <th>Bank Asal</th>
                <th>Bank Tujuan</th>
                <th style="width:180px;border-top:none">Bonus</th>
                <th style="width:150px;border-top:none">Jumlah</th>
                <th style="width:120px;border-top:none">Note</th>
                <th style="width:112px;border-top:none">Approval</th>
                <th style="width:92px;border-top:none">Action</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>`;
    }
    return `
      <div class="alert alert-danger" style="margin-bottom:12px;border-radius:4px;border-color:#eed3d7;padding:9px 15px 8px;">
        <table class="table table-hover" style="border-color:#cbcbcb;margin-bottom:0;">
          <thead>
            <tr class="fw-bold">
              <th></th>
              <th style="border-top:none;">No</th>
              <th style="width:130px;border-top:none;">Tanggal</th>
              <th style="width:150px;border-top:none;">Username</th>
              <th style="border-top:none;">Bank Tujuan</th>
              <th style="border-top:none;">Bank Asal Transfer</th>
              <th style="width:150px;border-top:none;">Bonus</th>
              <th style="width:110px;border-top:none;">Jumlah</th>
              <th style="width:125px;border-top:none;">Note</th>
              <th style="width:112px;border-top:none;">Auto WD</th>
              <th style="width:92px;border-top:none;">Action</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>`;
  }

  function buildPendingBodyMarkup(type, parsed) {
    const tableHtml = String(parsed && parsed.tableHtml || "").trim();
    const actionHtml = String(parsed && parsed.actionHtml || "").trim();
    const hasTable = /<table\b/i.test(tableHtml);
    const tableBlock = hasTable
      ? `<div class="pp-tableWrap${parsed.visibleTotal ? "" : " pp-tableWrapEmpty"}">${tableHtml}</div>`
      : buildPendingEmptyTable(type);
    return `${actionHtml ? `<div class="pp-actionWrap">${actionHtml}</div>` : ""}${tableBlock}`;
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
    const bodyHtml = buildPendingBodyMarkup(type, parsed);
    const approvedHistoryHtml = isDeposit ? buildDepositApprovedMarkup() : buildWithdrawApprovedMarkup();

    return `
      <div class="pp-mainSection" id="ppSectionMain-${type}">
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
      </div>
      <div class="pp-approvedSection" id="ppSectionApproved-${type}">${approvedHistoryHtml}</div>
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
        markInteracting(720);
        cfg.sortBy = sortSelect.value;
        if (!rerenderSectionFromCache(type)) loadSection(type);
      });
    }

    const showAllInput = tab.querySelector(isDeposit ? "#ppDepoShowAll" : "#ppWdShowAll");
    if (showAllInput) {
      showAllInput.checked = !!cfg.showAll;
      showAllInput.addEventListener("change", () => {
        markInteracting(720);
        cfg.showAll = !!showAllInput.checked;
        if (!rerenderSectionFromCache(type)) loadSection(type);
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
          cfg.queueMode = setWithdrawQueueModeEnabled(!!queueModeInput.checked, { notify: !!queueModeInput.checked });
        });
      }

      const limitSelect = tab.querySelector("#ppWdLimit");
      if (limitSelect) {
        limitSelect.value = cfg.showWDLimit;
        limitSelect.addEventListener("change", () => {
          markInteracting(720);
          cfg.showWDLimit = limitSelect.value;
          if (!rerenderSectionFromCache(type)) loadSection(type);
        });
      }
    }

    const refreshBtn = tab.querySelector(isDeposit ? "#ppDepoRefresh" : "#ppWdRefresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        markInteracting(640);
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
      bindDepositApprovedControls(tab);
    } else {
      bindWithdrawApprovedControls(tab);
    }

    bindBankMenu(type, tab);
    bindScopedBulkActions(type, tab);
    bindScopedHelpers(type, tab);
    bindPendingFastCopyDelegation(type, tab);
    bindUserHistoryTriggers(type, tab);
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
      markInteracting(920);
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
        markInteracting(720);
        boxes.forEach((box) => { box.checked = true; });
        return;
      }
      if (action === "none") {
        markInteracting(720);
        boxes.forEach((box) => { box.checked = false; });
        return;
      }
      if (action === "apply") {
        markInteracting(960);
        const selected = boxes.filter((box) => box.checked).map((box) => box.value);
        const allValues = boxes.map((box) => box.value).filter(Boolean);
        cfg.hasBankSelection = selected.length !== allValues.length;
        cfg.banks = selected;
        menu.classList.remove("is-open");
        document.removeEventListener("mousedown", closeMenu, true);
        if (!rerenderSectionFromCache(type)) loadSection(type, { busyText: "Filtering...", silent: true });
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
      const kind = detectReadonlyCopyKind(input);
      if (!kind) return;
      input.dataset.ppFastCopy = kind;
      input.classList.add("pp-copyable");
      if (!input.getAttribute("aria-label")) input.setAttribute("aria-label", `Klik untuk copy ${kind}`);
      ensureReadonlyQuickCopyBinding(input);
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
      if (wrap) wrap.setAttribute("data-mode-withdraw-locked", "1");
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
      if (wrap) {
        clearWithdrawModeTooltipAttrs(wrap);
        wrap.removeAttribute("data-mode-withdraw-locked");
      }
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

  function showSafeWithdrawNativeAlert() {
    if (!state.wd.queueMode) return false;
    const now = Date.now();
    if (now - (state.lastSafeWithdrawAlertAt || 0) < 1200) return false;
    state.lastSafeWithdrawAlertAt = now;
    return showPanelToast("Mode Safe Withdraw Aktif.", "warn", 1700);
  }

  function getSafeWithdrawCopyLabel(kind) {
    const normalized = String(kind || "").trim().toLowerCase();
    if (normalized === "nominal") return "Nominal";
    if (normalized === "nama rekening") return "nama rekening";
    return "nomor rekening";
  }

  function getFastCopyBufferNode() {
    const copyState = state.copy || (state.copy = { lastKey: "", lastAt: 0, pendingKey: "", pendingAt: 0, lastToastKey: "", lastToastAt: 0, buffer: null, inflightKey: "", inflightPromise: null });
    if (copyState.buffer && document.body.contains(copyState.buffer)) return copyState.buffer;
    try {
      const ta = document.createElement('textarea');
      ta.setAttribute('readonly', 'readonly');
      ta.setAttribute('aria-hidden', 'true');
      ta.tabIndex = -1;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      ta.style.contain = 'strict';
      ta.style.inset = '0 auto auto -9999px';
      ta.style.width = '1px';
      ta.style.height = '1px';
      ta.style.padding = '0';
      ta.style.border = '0';
      ta.style.outline = '0';
      ta.style.boxShadow = 'none';
      ta.style.background = 'transparent';
      document.body.appendChild(ta);
      copyState.buffer = ta;
      return ta;
    } catch (_) {
      return null;
    }
  }

  function fastExecCopyText(text) {
    const value = String(text || '').replace(/\r/g, '').trim();
    if (!value) return false;
    try {
      const ta = getFastCopyBufferNode();
      if (!ta) return false;
      ta.value = value;
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      ta.blur();
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  async function copyPlainTextSafe(text) {
    const value = String(text || '').replace(/\r/g, '').trim();
    if (!value) return false;
    try {
      const globalFn = typeof window !== 'undefined' && window && typeof window.copyPlainText === 'function' ? window.copyPlainText : null;
      if (globalFn && globalFn !== copyPlainTextSafe) {
        const ok = await globalFn(value);
        if (ok) return true;
      }
    } catch (_) {}
    const fastOk = fastExecCopyText(value);
    if (fastOk) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          Promise.resolve(navigator.clipboard.writeText(value)).catch(() => {});
        }
      } catch (_) {}
      return true;
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_) {}
    return false;
  }


  try {
    if (typeof window !== 'undefined' && window) {
      if (typeof window.copyPlainText !== 'function') window.copyPlainText = copyPlainTextSafe;
      window.copyPlainTextSafe = copyPlainTextSafe;
      window.__ppCopyPlainTextSafe = copyPlainTextSafe;
    }
  } catch (_) {}


  function getCopyPlainTextHelper() {
    try {
      if (typeof copyPlainTextSafe === 'function') return copyPlainTextSafe;
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && window) {
        if (typeof window.copyPlainTextSafe === 'function') return window.copyPlainTextSafe;
        if (typeof window.__ppCopyPlainTextSafe === 'function') return window.__ppCopyPlainTextSafe;
        if (typeof window.copyPlainText === 'function') return window.copyPlainText;
      }
    } catch (_) {}
    return null;
  }

  function isLikelyAccountNameValue(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    if (text.length < 3 || text.length > 80) return false;
    if (/^\+?\d{6,24}$/.test(text.replace(/\s+/g, ''))) return false;
    if (/^\(?-?\d[\d.,]*\)?$/.test(text)) return false;
    if (!/[A-Za-z]/.test(text)) return false;
    if (/approve|reject|delete|loading|pending|deposit|withdraw|bonus|refresh|copy|klik|search|logout|clock/i.test(text)) return false;
    if (/(?:bca|bni|bri|bsi|cimb|mandiri|seabank|danamon|jenius|dana|ovo|gopay|linkaja|telkomsel|axiata|antarbank)/i.test(text)) return false;
    if (/\d{3,}/.test(text)) return false;
    const compact = text.replace(/[^A-Za-z]/g, '');
    if (compact.length < 3) return false;
    return /^[A-Za-z][A-Za-z .'-]{1,78}$/.test(text);
  }

  function getReadonlyCopyNodeText(node) {
    return String(node && (node.value != null ? node.value : node.textContent) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getReadonlyCopyContext(input) {
    if (!input) return '';
    const parts = [
      input.getAttribute && input.getAttribute('title') || '',
      input.getAttribute && input.getAttribute('aria-label') || '',
      input.getAttribute && input.getAttribute('placeholder') || '',
      input.getAttribute && input.getAttribute('name') || '',
      input.getAttribute && input.getAttribute('id') || '',
      input.className || '',
      input.dataset ? Object.values(input.dataset || {}).join(' ') : '',
      getReadonlyCopyNodeText(input.previousElementSibling),
      getReadonlyCopyNodeText(input.parentElement),
      getReadonlyCopyNodeText(input.closest && input.closest('label')),
      getReadonlyCopyNodeText(input.closest && input.closest('.row')),
      getReadonlyCopyNodeText(input.closest && input.closest('td'))
    ];
    return parts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function getFastCopyState() {
    if (!state.copy) state.copy = { lastKey: '', lastAt: 0, pendingKey: '', pendingAt: 0, lastToastKey: '', lastToastAt: 0, buffer: null, inflightKey: '', inflightPromise: null };
    if (!('inflightKey' in state.copy)) state.copy.inflightKey = '';
    if (!('inflightPromise' in state.copy)) state.copy.inflightPromise = null;
    return state.copy;
  }

  function buildFastCopyKey(input, kind, value) {
    const rowId = input && input.closest ? String((input.closest('tr[id]') || {}).id || '') : '';
    const inputKey = input ? String(input.name || input.id || input.className || input.type || 'input') : 'input';
    return [String(kind || '').trim().toLowerCase(), rowId, inputKey, String(value || '')].join('|');
  }

  function shouldSkipFastCopy(key, holdMs = 140) {
    const copyState = getFastCopyState();
    const now = Date.now();
    if (copyState.pendingKey && copyState.pendingKey === key && now - Number(copyState.pendingAt || 0) < 820) return true;
    if (copyState.lastKey && copyState.lastKey === key && now - Number(copyState.lastAt || 0) < holdMs) return true;
    return false;
  }

  function notifyFastCopyResult(kind, ok) {
    const copyState = getFastCopyState();
    const mode = ok ? 'success' : 'warn';
    const label = getSafeWithdrawCopyLabel(kind);
    const toastKey = `${String(kind || '').trim().toLowerCase()}|${ok ? '1' : '0'}`;
    const now = Date.now();
    if (copyState.lastToastKey === toastKey && now - Number(copyState.lastToastAt || 0) < 500) return;
    copyState.lastToastKey = toastKey;
    copyState.lastToastAt = now;
    showPanelToast(ok ? `Copy ${label} berhasil` : `Copy ${label} gagal`, mode, 1350);
  }

  async function performFastCopyValue(input, kind, value) {
    const normalizedKind = String(kind || '').trim().toLowerCase();
    const copyValue = String(value || '').trim();
    if (!normalizedKind || !copyValue) {
      notifyFastCopyResult(normalizedKind || kind, false);
      return false;
    }
    const key = buildFastCopyKey(input, normalizedKind, copyValue);
    const copyState = getFastCopyState();
    if (copyState.inflightKey === key && copyState.inflightPromise) {
      return copyState.inflightPromise;
    }
    if (shouldSkipFastCopy(key)) return true;
    copyState.pendingKey = key;
    copyState.pendingAt = Date.now();
    const runner = (async () => {
      let ok = false;
      try {
        ok = fastExecCopyText(copyValue);
        if (!ok) ok = await copyPlainTextSafe(copyValue);
      } catch (_) {
        ok = false;
      }
      if (copyState.pendingKey === key) {
        copyState.pendingKey = '';
        copyState.pendingAt = 0;
      }
      if (ok) {
        copyState.lastKey = key;
        copyState.lastAt = Date.now();
        try { input && input.focus && input.focus({ preventScroll: true }); } catch (_) {}
        try { input && input.select && input.select(); } catch (_) {}
      }
      notifyFastCopyResult(normalizedKind, ok);
      return ok;
    })();
    copyState.inflightKey = key;
    copyState.inflightPromise = runner;
    try {
      return await runner;
    } finally {
      if (copyState.inflightKey === key) {
        copyState.inflightKey = '';
        copyState.inflightPromise = null;
      }
    }
  }

  function normalizeSafeWithdrawCopyValue(input, kind) {
    const raw = String(input && input.value != null ? input.value : "").trim();
    if (!raw) return "";
    const normalizedKind = String(kind || '').trim().toLowerCase();
    if (normalizedKind === "nominal") return raw.replace(/,/g, "").replace(/\s+/g, "").trim();
    if (normalizedKind === "nama rekening") return raw.replace(/\s+/g, ' ').trim();
    return raw.replace(/\s+/g, "").trim();
  }


  function inferPendingCopyKindFromInput(input) {
    if (!input) return '';
    const className = String(input.className || '').toLowerCase();
    const nameAttr = String(input.name || '').toLowerCase();
    const idAttr = String(input.id || '').toLowerCase();
    const valueRaw = String(input.value || input.textContent || '').replace(/\s+/g, ' ').trim();
    const valueCompact = valueRaw.replace(/\s+/g, '');
    const context = getReadonlyCopyContext(input);
    const keyText = `${className} ${nameAttr} ${idAttr} ${context}`;
    if (!valueRaw) return '';
    if (/approval|approve|note|bonus|event|search|filter|sort|username|userid|login|captcha/i.test(keyText)) return '';
    if (/(nominal|jumlah|ribuan|amount)/i.test(keyText)) return 'nominal';
    if (/(rekening|norek|account\s*number|deporek|wdrek)/i.test(keyText)) return 'nomor rekening';
    if (/(nama\s*rekening|atas\s*nama|holder|account\s*name|name)/i.test(keyText) && isLikelyAccountNameValue(valueRaw)) return 'nama rekening';
    if (/^\+?\d{8,24}$/.test(valueCompact)) return 'nomor rekening';
    if (isLikelyAccountNameValue(valueRaw)) return 'nama rekening';
    return '';
  }

  function detectReadonlyCopyKind(input) {
    if (!input) return '';
    const datasetKind = String(input.dataset && (input.dataset.ppSafeCopy || input.dataset.ppFastCopy) || '').trim().toLowerCase();
    if (datasetKind) return datasetKind;
    return inferPendingCopyKindFromInput(input);
  }


  async function handleSafeWithdrawCopyTrigger(input, explicitKind = "") {
    if (!input) return false;
    const kind = String(explicitKind || detectReadonlyCopyKind(input) || "").trim().toLowerCase();
    if (!kind) return false;
    const row = input.closest && input.closest('tr[id^="withdrawPending-"]');
    if (row && row.dataset.ppWdQueueLocked === '1') {
      showSafeWithdrawNativeAlert();
      return false;
    }
    const value = normalizeSafeWithdrawCopyValue(input, kind);
    return performFastCopyValue(input, kind, value);
  }


  function ensureSafeWithdrawCopyBinding(input, kind) {
    if (!input || input.__ppSafeCopyBound) return;
    const trigger = async (event, mode = 'click') => {
      if (!state.wd.queueMode) return;
      if (mode === 'click' && Date.now() - Number(input.__ppSafeCopyPointerAt || 0) < 260) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (mode === 'pointerdown') input.__ppSafeCopyPointerAt = Date.now();
      await handleSafeWithdrawCopyTrigger(input, kind);
    };
    input.__ppSafeCopyBound = true;
    input.__ppSafeCopyHandler = trigger;
    input.addEventListener('pointerdown', (event) => trigger(event, 'pointerdown'), true);
    input.addEventListener('click', (event) => trigger(event, 'click'), true);
    input.addEventListener('keydown', (event) => {
      if (!state.wd.queueMode) return;
      if (!event) return;
      if (event.key === 'Enter' || event.key === ' ') {
        trigger(event, 'key');
      }
    }, true);
  }

  function ensureReadonlyQuickCopyBinding(input) {
    if (!input || input.__ppReadonlyQuickCopyBound) return;
    const trigger = async (event, mode = 'click') => {
      const kind = detectReadonlyCopyKind(input);
      if (!kind) return;
      if (mode === 'click' && Date.now() - Number(input.__ppReadonlyCopyPointerAt || 0) < 260) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (mode === 'pointerdown') input.__ppReadonlyCopyPointerAt = Date.now();
      await copyReadonlyValue(input);
    };
    input.__ppReadonlyQuickCopyBound = true;
    input.addEventListener('pointerdown', (event) => trigger(event, 'pointerdown'), true);
    input.addEventListener('click', (event) => trigger(event, 'click'), true);
    input.addEventListener('keydown', (event) => {
      if (!event) return;
      if (event.key === 'Enter' || event.key === ' ') trigger(event, 'key');
    }, true);
  }


  function bindPendingFastCopyDelegation(type, tab) {
    if (!tab || tab.__ppPendingFastCopyDelegationBound) return;
    tab.__ppPendingFastCopyDelegationBound = true;

    const trigger = async (event, mode = 'click') => {
      const target = event && event.target && event.target.closest ? event.target.closest('input, textarea') : null;
      if (!target || target.disabled || target.readOnly === false && !target.classList.contains('deporekform') && !target.classList.contains('wdrekform')) return;
      const row = target.closest && target.closest(type === 'wd' ? 'tr[id^="withdrawPending-"]' : 'tr[id^="depositPending-"]');
      if (!row) return;
      const kind = detectReadonlyCopyKind(target);
      if (!kind) return;
      const value = normalizeSafeWithdrawCopyValue(target, kind);
      if (!value) return;
      if (type === 'wd' && row.dataset && row.dataset.ppWdQueueLocked === '1') {
        event.preventDefault();
        event.stopPropagation();
        showSafeWithdrawNativeAlert();
        return;
      }
      if (mode === 'click' && Date.now() - Number(target.__ppPendingCopyPointerAt || 0) < 220) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (mode === 'pointerdown') target.__ppPendingCopyPointerAt = Date.now();
      event.preventDefault();
      event.stopPropagation();
      await performFastCopyValue(target, kind, value);
    };

    tab.addEventListener('pointerdown', (event) => { trigger(event, 'pointerdown'); }, true);
    tab.addEventListener('click', (event) => { trigger(event, 'click'); }, true);
    tab.addEventListener('keydown', (event) => {
      if (!event) return;
      if (event.key === 'Enter' || event.key === ' ') trigger(event, 'key');
    }, true);
  }

  function setSafeWithdrawCopyTarget(input, kind, enabled) {
    if (!input) return;
    if (enabled) {
      input.dataset.ppSafeCopy = kind;
      input.dataset.ppFastCopy = kind;
      input.classList.add('pp-safeCopyable');
      input.classList.add('pp-copyable');
      input.style.cursor = 'default';
      input.setAttribute('title', kind === 'nominal' ? 'Klik untuk copy nominal' : 'Klik untuk copy nomor rekening');
      input.setAttribute('aria-label', kind === 'nominal' ? 'Klik untuk copy nominal' : 'Klik untuk copy nomor rekening');
      ensureSafeWithdrawCopyBinding(input, kind);
      return;
    }
    if (input.dataset.ppSafeCopy) delete input.dataset.ppSafeCopy;
    if (input.dataset.ppFastCopy) delete input.dataset.ppFastCopy;
    input.classList.remove('pp-safeCopyable');
    const title = String(input.getAttribute('title') || '');
    if (/Klik untuk copy (?:nominal|nomor rekening)/i.test(title)) input.removeAttribute('title');
    const label = String(input.getAttribute('aria-label') || '');
    if (/Klik untuk copy (?:nominal|nomor rekening)/i.test(label)) input.removeAttribute('aria-label');
  }

  function updateSafeWithdrawQuickCopyTargets(row, targets, enabled) {
    if (!row || !targets) return;
    setSafeWithdrawCopyTarget(targets.nomorInput, 'nomor rekening', !!enabled);
    setSafeWithdrawCopyTarget(targets.jumlahInput, 'nominal', !!enabled);
  }

  function bindSafeWithdrawQuickCopy() {
    const tab = refs.wdTab;
    if (!tab || tab.__ppSafeWithdrawQuickCopyBound) return;
    tab.__ppSafeWithdrawQuickCopyBound = true;
    tab.addEventListener('click', async (event) => {
      if (!state.wd.queueMode || !event || !event.target || !event.target.closest) return;
      const input = event.target.closest('input[data-pp-safe-copy]');
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      const kind = String(input.dataset.ppSafeCopy || '').trim().toLowerCase();
      await handleSafeWithdrawCopyTrigger(input, kind);
    }, true);
    state.cleanupFns.push(() => {
      try { tab.__ppSafeWithdrawQuickCopyBound = false; } catch (_) {}
    });
  }

  function bindSafeWithdrawLockGuard() {
    const tab = refs.wdTab;
    if (!tab || tab.__ppSafeWithdrawLockGuardBound) return;
    tab.__ppSafeWithdrawLockGuardBound = true;
    const onGuard = (event) => {
      if (!state.wd.queueMode || !event || !event.target || !event.target.closest) return;
      const lockedTarget = event.target.closest('[data-mode-withdraw-locked="1"], .pp-wd-lock-tooltip-wrap[data-mode-withdraw-locked="1"]');
      if (!lockedTarget) return;
      event.preventDefault();
      event.stopPropagation();
      showSafeWithdrawNativeAlert();
    };
    ["pointerdown", "mousedown", "touchstart", "click"].forEach((type) => {
      tab.addEventListener(type, onGuard, true);
      state.cleanupFns.push(() => tab.removeEventListener(type, onGuard, true));
    });
  }

  function setWithdrawQueueModeEnabled(enabled, options = {}) {
    const next = saveWithdrawMode(!!enabled);
    const changed = state.wd.queueMode !== next;
    state.wd.queueMode = next;
    const tab = refs.wdTab;
    const toggle = tab ? tab.querySelector("#ppWdQueueMode") : null;
    if (toggle && toggle.checked !== next) toggle.checked = next;
    if (tab && document.body.contains(tab)) {
      applyWithdrawQueueMode(tab);
    }
    if (next && options.notify !== false && (changed || options.forceNotify)) {
      showSafeWithdrawNativeAlert();
    }
    return next;
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
      updateSafeWithdrawQuickCopyTargets(row, targets, enabled && !hidden);
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
    if (!input) return false;
    const kind = detectReadonlyCopyKind(input);
    if (kind) {
      const value = normalizeSafeWithdrawCopyValue(input, kind);
      return performFastCopyValue(input, kind, value);
    }
    const original = String(input.value || "");
    const cleaned = original.replace(/,/g, "").trim();
    return performFastCopyValue(input, 'value', cleaned || original);
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
      showPanelToast("Nominal auto approve harus berupa angka lebih dari 0.", "warn", 1700);
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

    if (!state.loading[type] && Date.now() - (state.lastLoadedAt[type] || 0) > 1200) {
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
    const delays = immediate
      ? (type === "wd" ? [70, 220, 520, 1200] : [40, 160, 420, 980])
      : [0];

    delays.forEach((delay, index) => {
      const timer = window.setTimeout(async () => {
        if (state.refreshRunId[type] !== runId) return;
        if (isInteractionLocked(type)) {
          state.pendingReload[type] = true;
          scheduleDeferredFlush(type);
          return;
        }
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

  function toggleMinimize(forceValue) {
    const next = typeof forceValue === "boolean" ? !!forceValue : !state.minimized;
    if (state.minimized === next) return state.minimized;
    const now = Date.now();
    if (now - Number(state.lastMinimizeToggleAt || 0) < 90) return state.minimized;
    state.lastMinimizeToggleAt = now;
    if (state.minimizeRaf) {
      try { cancelAnimationFrame(state.minimizeRaf); } catch (_) {}
      state.minimizeRaf = 0;
    }
    refs.panel.classList.add("pp-instantToggle");
    state.minimized = next;
    refs.panel.classList.toggle("is-minimized", state.minimized);
    if (refs.minimizeBtn) {
      refs.minimizeBtn.title = state.minimized ? "Show content" : "Hide content";
      refs.minimizeBtn.setAttribute("aria-label", state.minimized ? "Show content" : "Hide content");
    }
    clampPanel();
    state.minimizeRaf = window.requestAnimationFrame(() => {
      clampPanel();
      refs.panel.classList.remove("pp-instantToggle");
      state.minimizeRaf = 0;
    });
    if (!state.minimized && isAuthenticated()) {
      const activeType = state.activeTab;
      if (!state.loading[activeType] && Date.now() - (state.lastLoadedAt[activeType] || 0) > 1200) {
        loadSection(activeType, { busyText: "Syncing...", silent: true });
      }
      if (activeType === "depo" && state.depo.autoApprove) {
        scheduleDepositAutoApprove(120);
      }
    }
    return state.minimized;
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
      if (readUserHistoryState().open) {
        event.preventDefault();
        event.stopPropagation();
        closeUserHistory();
        return;
      }

      const now = Date.now();
      if (now - (state.lastEscShortcutAt || 0) < 140) return;
      state.lastEscShortcutAt = now;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      markInteracting(90);

      if (!isPanelAlive()) return;
      toggleMinimize();
    };

    window.addEventListener("keydown", onWindowKeydown, true);
    state.cleanupFns.push(() => window.removeEventListener("keydown", onWindowKeydown, true));
  }

  function setupDrag() {
    if (state.drag && state.drag.bound) return;
    if (state.drag) state.drag.bound = true;
    const start = (event) => {
      if (!event || (typeof event.button === "number" && event.button !== 0)) return;
      if (!state.minimized) return;
      if (event.target.closest("button, input, select, textarea, label, a")) return;
      const rect = refs.panel.getBoundingClientRect();
      state.drag.active = true;
      state.drag.pointerId = event.pointerId;
      state.drag.startX = event.clientX;
      state.drag.startY = event.clientY;
      state.drag.left = rect.left;
      state.drag.top = rect.top;
      refs.header.style.cursor = "default";
      refs.panel.style.transition = "none";
      try { refs.header.setPointerCapture(event.pointerId); } catch (_) {}
    };

    const move = (event) => {
      if (!state.drag.active || event.pointerId !== state.drag.pointerId) return;
      const metrics = getPanelViewportMetrics();
      const size = getPanelSizeFromViewport(metrics.vw, metrics.vh);
      const maxLeft = Math.max(metrics.gapX, metrics.vw - size.width - metrics.gapX);
      const maxTop = Math.max(metrics.gapY, metrics.vh - size.height - metrics.gapY);
      const nextLeft = Math.min(maxLeft, Math.max(metrics.gapX, state.drag.left + (event.clientX - state.drag.startX)));
      const nextTop = Math.min(maxTop, Math.max(metrics.gapY, state.drag.top + (event.clientY - state.drag.startY)));
      state.panelPosition.mode = "manual";
      state.panelPosition.left = Math.round(nextLeft);
      state.panelPosition.top = Math.round(nextTop);
      refs.panel.style.left = `${state.panelPosition.left}px`;
      refs.panel.style.top = `${state.panelPosition.top}px`;
      refs.panel.style.right = "auto";
      refs.panel.style.transform = "none";
    };

    const end = (event) => {
      if (!state.drag.active || event.pointerId !== state.drag.pointerId) return;
      state.drag.active = false;
      refs.header.style.cursor = "default";
      refs.panel.style.transition = "";
      try { refs.header.releasePointerCapture(event.pointerId); } catch (error) {}
      clampPanel();
    };

    refs.header.addEventListener("pointerdown", start);
    refs.header.addEventListener("pointermove", move);
    refs.header.addEventListener("pointerup", end);
    refs.header.addEventListener("pointercancel", end);
  }

  function clampPanel() {
    const metrics = getPanelViewportMetrics();
    const size = getPanelSizeFromViewport(metrics.vw, metrics.vh);

    refs.panel.style.width = `${size.width}px`;
    refs.panel.style.maxWidth = `${size.maxWidth}px`;
    refs.panel.style.height = `${size.height}px`;
    refs.panel.style.maxHeight = `${size.maxHeight}px`;
    refs.panel.style.left = "0px";
    refs.panel.style.top = "0px";
    refs.panel.style.right = "auto";
    refs.panel.style.bottom = "auto";
    refs.panel.style.transform = "none";
    refs.panel.style.transformOrigin = "top left";
    refs.panel.style.setProperty("--pp-panel-gap-x", `${metrics.gapX}px`);
    refs.panel.style.setProperty("--pp-panel-gap-y", `${metrics.gapY}px`);
    refs.panel.style.setProperty("--pp-panel-zoom", String(metrics.zoom));
    state.panelPosition.mode = "center";
    state.panelPosition.left = 0;
    state.panelPosition.top = 0;
  }

  function destroyPanel(reason) {
    if (state.destroyed) return;
    state.destroyed = true;
    clearApproveContextLocal();
    stopAutoSync();
    if (state.viewportLock && typeof state.viewportLock.release === "function") {
      try { state.viewportLock.release(); } catch (_) {}
      state.viewportLock = null;
    }
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
    clearDepositApprovedRefreshTimer();
    clearDepositApprovedSyncTimers();
    const depoApprovedController = state.depo && state.depo.approved ? state.depo.approved.abortController : null;
    if (depoApprovedController) {
      try { depoApprovedController.abort(); } catch (error) {}
      state.depo.approved.abortController = null;
    }
    clearWithdrawApprovedRefreshTimer();
    clearWithdrawApprovedSyncTimers();
    const historyController = state.history ? state.history.abortController : null;
    if (historyController) {
      try { historyController.abort(); } catch (error) {}
      state.history.abortController = null;
    }
    const approvedController = state.wd && state.wd.approved ? state.wd.approved.abortController : null;
    if (approvedController) {
      try { approvedController.abort(); } catch (error) {}
      state.wd.approved.abortController = null;
    }
    if (state.menuCloseFns.depoAutoApproveLock) {
      document.removeEventListener("mousedown", state.menuCloseFns.depoAutoApproveLock, true);
      state.menuCloseFns.depoAutoApproveLock = null;
    }
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleWindowFocus);
    window.removeEventListener("blur", handleWindowBlur);
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
      pauseMainPanelForAuth();
      showAuthGate();
    }
  };

  function ensureHeaderRefs() {
    refs.tabsWrap = refs.tabsWrap || refs.panel.querySelector("#ppTabs");
    refs.headerMeta = refs.headerMeta || refs.panel.querySelector("#ppHeaderMeta");
    refs.headerUserWrap = refs.headerUserWrap || refs.panel.querySelector("#ppHeaderUserWrap");
    refs.headerClockWrap = refs.headerClockWrap || refs.panel.querySelector("#ppHeaderClockWrap");
    refs.tabs = [...refs.panel.querySelectorAll(".pp-tabButton[data-tab]")];
    refs.depoBadge = refs.panel.querySelector("#ppDepoBadge") || refs.depoBadge;
    refs.wdBadge = refs.panel.querySelector("#ppWdBadge") || refs.wdBadge;
    return refs;
  }

  function getLivePanelTabButtons() {
    ensureHeaderRefs();
    refs.tabs = [...refs.panel.querySelectorAll(".pp-tabButton[data-tab]")];
    return refs.tabs;
  }

  function parseSwitchMenuTarget(value) {
    const raw = String(value || "");
    if (!raw) return "";
    const quoted = raw.match(/switchMenu\(\s*(['\"])([^'\"]+)\1\s*\)/i);
    if (quoted && quoted[2]) return cleanHeaderText(quoted[2]);
    const loose = raw.match(/switchMenu\(\s*([^\)]+)\s*\)/i);
    if (loose && loose[1]) return cleanHeaderText(String(loose[1]).replace(/["'`;]/g, ""));
    return "";
  }

  function getNativeActionTarget(node) {
    if (!node || typeof node.getAttribute !== "function") return "";
    return parseSwitchMenuTarget(node.getAttribute("href")) || parseSwitchMenuTarget(node.getAttribute("onclick"));
  }

  function findNativeHeaderActionNode(target, text = "") {
    const nav = getNativeHeaderNavbar();
    if (!nav) return null;
    const nodes = [
      ...nav.querySelectorAll('.navbar-brand, .navbar-nav .nav-item a, .navbar-nav .nav-item button, .navbar-nav .nav-item [role="button"]')
    ];
    const normalizedText = cleanHeaderText(text);
    if (target) {
      const direct = nodes.find((node) => getNativeActionTarget(node) === target);
      if (direct) return direct;
    }
    if (normalizedText) {
      const byText = nodes.find((node) => cleanHeaderText(node.textContent || "") === normalizedText);
      if (byText) return byText;
    }
    return null;
  }

  function triggerNativeHeaderAction(target, text = "", fallback = null) {
    const normalizedTarget = cleanHeaderText(target);
    if (normalizedTarget && typeof window.switchMenu === "function") {
      try {
        window.switchMenu(normalizedTarget);
        return true;
      } catch (_) {}
    }
    const node = fallback || findNativeHeaderActionNode(normalizedTarget, text);
    if (node) {
      try {
        node.click();
        return true;
      } catch (_) {}
    }
    return false;
  }

  function classifyHeaderNavItem(item) {
    const target = cleanHeaderText(item && item.target);
    const text = cleanHeaderText(item && item.text).toLowerCase();
    if (target === 'menuDeposit' || /\bdeposit\b/.test(text)) return 'depo';
    if (target === 'menuWithdraw' || /\bwithdraw\b/.test(text)) return 'wd';
    if (target === 'menuAllUser' || /\busers?\b/.test(text)) return 'user';
    return 'native';
  }

  function readNativePrimaryNavModel() {
    const nav = getNativeHeaderNavbar();
    const empty = { brandTarget: '', leftItems: [] };
    if (!nav) return empty;
    const brandNode = nav.querySelector('.navbar-brand');
    const leftItems = [...nav.querySelectorAll('.navbar-nav:not(.ms-auto) > .nav-item')]
      .map((item, index) => {
        const actionNode = item.querySelector('a,button,[role="button"]') || item;
        const text = cleanHeaderText(actionNode.textContent || item.textContent || '');
        if (!text) return null;
        const target = getNativeActionTarget(actionNode) || getNativeActionTarget(item);
        return {
          index,
          text,
          target,
          kind: classifyHeaderNavItem({ text, target })
        };
      })
      .filter(Boolean);
    return {
      brandTarget: getNativeActionTarget(brandNode),
      leftItems
    };
  }

  function renderHeaderNavFromNative(model = null, force = false) {
    if (!isPanelAlive()) return false;
    ensureHeaderRefs();
    const wrap = refs.tabsWrap;
    if (!wrap) return false;
    model = model || readNativePrimaryNavModel();
    const items = Array.isArray(model && model.leftItems) ? model.leftItems : [];
    if (!items.length && !force) {
      refs.tabs = getLivePanelTabButtons();
      return false;
    }

    const signature = JSON.stringify(items.map((item) => [item.kind, item.target, item.text]));
    if (!force && signature === String(state.headerNavSignature || '')) {
      refs.tabs = getLivePanelTabButtons();
      refs.depoBadge = wrap.querySelector('#ppDepoBadge') || refs.depoBadge;
      refs.wdBadge = wrap.querySelector('#ppWdBadge') || refs.wdBadge;
      return false;
    }
    state.headerNavSignature = signature;

    const frag = document.createDocumentFragment();
    items.forEach((item) => {
      if (item.kind && state.headerTabText && Object.prototype.hasOwnProperty.call(state.headerTabText, item.kind)) {
        state.headerTabText[item.kind] = item.text;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pp-navItem';
      btn.dataset.nativeNavText = item.text;
      if (item.target) btn.dataset.nativeMenuTarget = item.target;

      if (item.kind === 'depo' || item.kind === 'wd' || item.kind === 'user') {
        btn.classList.add('pp-tabButton');
        btn.dataset.tab = item.kind;
        if (item.kind === state.activeTab) btn.classList.add('is-active');
      } else {
        btn.classList.add('pp-nativeNavButton');
      }

      const label = document.createElement('span');
      label.className = 'pp-navLabel';
      label.textContent = item.text;
      btn.appendChild(label);

      if (item.kind === 'depo' || item.kind === 'wd') {
        const badge = document.createElement('span');
        badge.className = `pp-badge ${item.kind === 'depo' ? 'pp-badgeGreen' : 'pp-badgeAmber'}`;
        badge.id = item.kind === 'depo' ? 'ppDepoBadge' : 'ppWdBadge';
        const currentBadge = item.kind === 'depo' ? refs.depoBadge : refs.wdBadge;
        badge.textContent = cleanHeaderText(currentBadge && currentBadge.textContent) || '0';
        btn.appendChild(document.createTextNode(' '));
        btn.appendChild(badge);
      }

      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (item.kind === 'depo' || item.kind === 'wd') {
          switchTab(item.kind);
          return;
        }
        if (item.kind === 'user') {
          if (typeof openUserTab === 'function') {
            openUserTab();
            return;
          }
        }
        triggerNativeHeaderAction(item.target, item.text);
      });

      frag.appendChild(btn);
    });

    if (!items.length) {
      const depoLabel = escapeHtml(String(cleanHeaderText(state.headerTabText && state.headerTabText.depo) || ''));
      const wdLabel = escapeHtml(String(cleanHeaderText(state.headerTabText && state.headerTabText.wd) || ''));
      wrap.innerHTML = `
        <button type="button" class="pp-navItem pp-tabButton${state.activeTab === 'depo' ? ' is-active' : ''}" data-tab="depo"><span class="pp-navLabel">${depoLabel}</span> <span class="pp-badge pp-badgeGreen" id="ppDepoBadge">${escapeHtml(String(cleanHeaderText(refs.depoBadge && refs.depoBadge.textContent) || '0'))}</span></button>
        <button type="button" class="pp-navItem pp-tabButton${state.activeTab === 'wd' ? ' is-active' : ''}" data-tab="wd"><span class="pp-navLabel">${wdLabel}</span> <span class="pp-badge pp-badgeAmber" id="ppWdBadge">${escapeHtml(String(cleanHeaderText(refs.wdBadge && refs.wdBadge.textContent) || '0'))}</span></button>
      `;
    } else {
      wrap.replaceChildren(frag);
    }

    refs.tabs = getLivePanelTabButtons();
    refs.depoBadge = wrap.querySelector('#ppDepoBadge') || refs.depoBadge;
    refs.wdBadge = wrap.querySelector('#ppWdBadge') || refs.wdBadge;
    if (refs.headerBrand) refs.headerBrand.dataset.nativeMenuTarget = cleanHeaderText(model.brandTarget);
    return true;
  }

  function readNativeHeaderBoxSnapshot() {
    const nav = getNativeHeaderNavbar();
    if (!nav || typeof window.getComputedStyle !== 'function') return null;
    const fluid = nav.querySelector('.container-fluid') || nav;
    const navStyle = window.getComputedStyle(nav);
    const fluidStyle = window.getComputedStyle(fluid);
    const navRect = nav.getBoundingClientRect();
    const fluidRect = fluid.getBoundingClientRect();
    return {
      backgroundColor: navStyle.backgroundColor || '',
      backgroundImage: navStyle.backgroundImage || '',
      borderBottomColor: navStyle.borderBottomColor || '',
      minHeight: `${Math.max(44, Math.round(navRect.height || fluidRect.height || 50))}px`,
      fluidMinHeight: `${Math.max(44, Math.round(fluidRect.height || navRect.height || 50))}px`,
      paddingLeft: fluidStyle.paddingLeft || '',
      paddingRight: fluidStyle.paddingRight || '',
      paddingTop: fluidStyle.paddingTop || '',
      paddingBottom: fluidStyle.paddingBottom || ''
    };
  }

  function applyNativeHeaderBoxSnapshot(snapshot = null) {
    if (!isPanelAlive()) return false;
    snapshot = snapshot || readNativeHeaderBoxSnapshot();
    if (!snapshot) return false;
    const signature = JSON.stringify(snapshot);
    if (signature === String(state.headerBoxSignature || '')) return false;
    state.headerBoxSignature = signature;
    const fluid = refs.panel.querySelector('.pp-headerFluid');
    if (!fluid) return false;

    if (snapshot.backgroundColor) refs.header.style.backgroundColor = snapshot.backgroundColor;
    if (snapshot.backgroundImage && snapshot.backgroundImage !== 'none') refs.header.style.backgroundImage = snapshot.backgroundImage;
    refs.header.style.minHeight = snapshot.minHeight || '';
    fluid.style.minHeight = snapshot.fluidMinHeight || snapshot.minHeight || '';
    fluid.style.paddingLeft = snapshot.paddingLeft || '';
    fluid.style.paddingRight = snapshot.paddingRight || '';
    fluid.style.paddingTop = snapshot.paddingTop || '';
    fluid.style.paddingBottom = snapshot.paddingBottom || '';
    if (snapshot.borderBottomColor) refs.header.style.borderBottomColor = snapshot.borderBottomColor;
    return true;
  }

  function syncHeaderStylesFromNative(snapshot = null) {
    if (!isPanelAlive()) return false;
    ensureHeaderRefs();
    snapshot = snapshot || readNativeHeaderStyleSnapshot();
    if (!snapshot) return false;
    applyNativeHeaderBoxSnapshot();
    const signature = JSON.stringify(snapshot || {});
    if (signature === String(state.headerStyleSignature || '')) return false;
    state.headerStyleSignature = signature;
    applyInlineHeaderTextStyle(refs.headerBrand, snapshot.brandStyle || snapshot.navStyle);
    [...refs.panel.querySelectorAll('#ppTabs .pp-navItem')].forEach((button) => {
      applyInlineHeaderTextStyle(button, snapshot.navStyle);
    });
    applyInlineHeaderTextStyle(refs.headerUserWrap, snapshot.userStyle || snapshot.navStyle);
    applyInlineHeaderTextStyle(refs.headerLogoutBtn, snapshot.logoutStyle || snapshot.userStyle || snapshot.navStyle);
    applyInlineHeaderTextStyle(refs.headerClockWrap, snapshot.clockStyle || snapshot.userStyle || snapshot.navStyle);
    const userTextNodes = [refs.headerUserPrimary, refs.headerUserSecondary, refs.headerUserDivider, refs.headerLogoutText, refs.headerClockText].filter(Boolean);
    userTextNodes.forEach((node) => {
      const source = node === refs.headerClockText ? (snapshot.clockStyle || snapshot.userStyle || snapshot.navStyle) : (snapshot.userStyle || snapshot.navStyle);
      if (!source) return;
      try {
        node.style.fontFamily = source.fontFamily || '';
        node.style.fontSize = source.fontSize || '';
        node.style.fontWeight = source.fontWeight || '';
        node.style.lineHeight = source.lineHeight || '';
        node.style.letterSpacing = source.letterSpacing || '';
        node.style.textTransform = source.textTransform || '';
      } catch (_) {}
    });
    refs.panel.style.setProperty('--pp-native-header-font-family', (snapshot.navStyle && snapshot.navStyle.fontFamily) || 'Ubuntu, sans-serif');
    refs.panel.style.setProperty('--pp-native-header-font-size', (snapshot.navStyle && snapshot.navStyle.fontSize) || '12px');
    refs.panel.style.setProperty('--pp-native-header-weight', (snapshot.navStyle && snapshot.navStyle.fontWeight) || '400');
    return true;
  }

  function syncHeaderFromNative(force = false) {
    if (!isPanelAlive()) return;
    ensureHeaderRefs();
    if (force) {
      state.headerSnapshotSignature = '';
      state.headerStyleSignature = '';
      state.headerNavSignature = '';
      state.headerBoxSignature = '';
    }
    const textSnapshot = readNativeHeaderSnapshot();
    const styleSnapshot = readNativeHeaderStyleSnapshot();
    const navModel = readNativePrimaryNavModel();
    renderHeaderNavFromNative(navModel, force);
    applyHeaderSnapshot(textSnapshot);
    syncHeaderStylesFromNative(styleSnapshot);
  }

  function startHeaderChromeSync() {
    ensureHeaderRefs();
    syncHeaderFromNative(true);

    let rafId = 0;
    const queueSync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        try { syncHeaderFromNative(); } catch (_) {}
      });
    };

    const tick = window.setInterval(queueSync, 700);
    state.cleanupFns.push(() => clearInterval(tick));

    if (typeof MutationObserver === 'function' && document.documentElement) {
      const observer = new MutationObserver((mutations) => {
        const shouldSync = mutations.some((mutation) => {
          const target = mutation && mutation.target;
          return target && (target.nodeType === 1 || target.nodeType === 3);
        });
        if (shouldSync) queueSync();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'href', 'onclick']
      });
      state.cleanupFns.push(() => {
        try { observer.disconnect(); } catch (_) {}
      });
    }

    if (refs.headerBrand && !refs.headerBrand.__ppDynamicHeaderBound) {
      refs.headerBrand.__ppDynamicHeaderBound = true;
      refs.headerBrand.addEventListener('click', (event) => {
        event.preventDefault();
        const target = cleanHeaderText(refs.headerBrand.dataset.nativeMenuTarget) || 'menuProvider';
        if (!triggerNativeHeaderAction(target, cleanHeaderText(refs.headerBrand.textContent || ''))) {
          try {
            if (typeof window.switchMenu === 'function') window.switchMenu('menuProvider');
          } catch (_) {}
        }
      });
    }

    if (refs.headerLogoutBtn && !refs.headerLogoutBtn.__ppDynamicHeaderBound) {
      refs.headerLogoutBtn.__ppDynamicHeaderBound = true;
      refs.headerLogoutBtn.addEventListener('click', (event) => {
        event.preventDefault();
        const node = findNativeHeaderActionNode('', cleanHeaderText(refs.headerLogoutText && refs.headerLogoutText.textContent || 'Logout'));
        if (node) {
          try {
            node.click();
            return;
          } catch (_) {}
        }
        try {
          if (typeof window.logout === 'function') window.logout();
        } catch (_) {}
      });
    }
  }

  function switchTab(type) {
    if (!isAuthenticated()) return;
    state.activeTab = type;
    getLivePanelTabButtons().forEach((button) => button.classList.toggle('is-active', button.dataset.tab === type));
    refs.depoTab.style.display = type === 'depo' ? 'block' : 'none';
    refs.wdTab.style.display = type === 'wd' ? 'block' : 'none';
    if (typeof hideUserTab === 'function') {
      try { hideUserTab(); } catch (_) {}
    }
    syncNativeMenu(type);

    if (!isInteractionLocked(type)) {
      flushDeferredRender(type);
    }

    if (!state.initialized[type] && !state.loading[type]) {
      loadSection(type, { initial: true });
      return;
    }

    if (!state.loading[type] && Date.now() - (state.lastLoadedAt[type] || 0) > 1200) {
      loadSection(type, { busyText: 'Syncing...', silent: true });
    }
    if (type === 'depo') {
      renderDepositAutoApproveUi(refs.depoTab);
      scheduleDepositAutoApprove(state.depo.autoApprove ? 90 : 200);
    } else {
      clearDepositAutoApproveTimer();
    }
  }

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
  const PATCH_CLEANUP_KEY = "__PP_GS_USER_TAB_CLEANUP__";
  const ORIGINAL_NATIVE_KEY = "__PP_GS_NATIVE_ORIGINALS__";
  const WRAP_MARK_KEY = "__ppGsWrappedSignature";
  const RECENT_IDS = new Map();

  if (typeof window[PATCH_CLEANUP_KEY] === "function") {
    try { window[PATCH_CLEANUP_KEY]("reinit"); } catch (error) { console.error("[PP-GS] previous cleanup failed", error); }
  }
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
  const fastLaneInFlight = new Map();
  let flushBusy = false;
  let flushTimer = 0;
  let flushTimerAt = 0;
  let uiStyleInjected = false;
  let wrappedSignature = "";
  let wrapWatchTimer = 0;
  let wrapWatchLifecycleBound = false;
  let bootRetryTimer = 0;
  let bootObserver = null;
  let approveCaptureHandler = null;
  let wrapWatchVisibilityHandler = null;
  let onlineHandler = null;
  let flushVisibilityHandler = null;
  let networkSyncCleanup = null;
  const NET_SYNC_KEY = "__ppGsNetSyncInstalled";
  const NET_SYNC_PATCH_KEY = "__ppGsNetSyncPatch";

  function installApprovalNetworkSync() {
    if (window[NET_SYNC_KEY]) return;
    const originalFetch = typeof window.fetch === "function" ? window.fetch : null;
    const XHR = window.XMLHttpRequest;
    const previousPatch = window[NET_SYNC_PATCH_KEY] || {};
    const originalOpen = previousPatch.originalOpen || (XHR && XHR.prototype ? XHR.prototype.open : null);
    const originalSend = previousPatch.originalSend || (XHR && XHR.prototype ? XHR.prototype.send : null);
    const recent = new Map();

    const shouldRun = (key, holdMs = 220) => {
      const ts = recent.get(key) || 0;
      const nowTs = now();
      if (nowTs - ts < holdMs) return false;
      recent.set(key, nowTs);
      recent.forEach((value, mapKey) => {
        if (nowTs - value > 6000) recent.delete(mapKey);
      });
      return true;
    };

    const looksJsonLike = (value) => /^[\[{]/.test(String(value || "").trim());

    const inspect = (urlValue, methodValue, responseText) => {
      const url = String(urlValue || "");
      const method = String(methodValue || "GET").toUpperCase();
      if (!url || method !== "POST") return;

      if (/\/approveDeposit\b/i.test(url)) {
        if (!shouldRun("approve-deposit")) return;
        queueMicrotask(() => boostPanelRefresh('depo'));
        queueMicrotask(() => window.triggerDepositApprovedHistoryRefreshWave({ forceBusy: false, delays: [50, 160, 420, 900, 1800, 3600] }));
        return;
      }

      if (/\/approveWithdraw\b/i.test(url)) {
        if (!shouldRun("approve-withdraw")) return;
        queueMicrotask(() => boostPanelRefresh('wd'));
        queueMicrotask(() => window.triggerWithdrawApprovedHistoryRefreshWave({ forceBusy: false, delays: [50, 160, 420, 900, 1800, 3600] }));
        return;
      }

      if (/\/depositApproved(?:Content)?\b/i.test(url)) {
        if (!shouldRun("deposit-approved-read")) return;
        queueMicrotask(() => window.triggerDepositApprovedHistoryRefreshWave({ forceBusy: false, delays: [160, 680, 1500] }));
        return;
      }

      if (/\/withdrawApproved(?:Content)?\b/i.test(url)) {
        if (!shouldRun("withdraw-approved-read")) return;
        queueMicrotask(() => window.triggerWithdrawApprovedHistoryRefreshWave({ forceBusy: false, delays: [160, 680, 1500] }));
        return;
      }

      if (/\/(depositPending|withdrawPending)\b/i.test(url) && looksJsonLike(responseText)) {
        return;
      }
    };

    if (originalFetch && !originalFetch.__ppGsNetSyncWrapped) {
      const wrappedFetch = function () {
        const requestInit = arguments[1] || {};
        const skipInspect = (() => {
          try {
            const headers = requestInit && requestInit.headers;
            if (!headers) return false;
            if (typeof Headers !== "undefined" && headers instanceof Headers) {
              return String(headers.get("x-pp-no-observe") || "") === "1";
            }
            if (Array.isArray(headers)) {
              return headers.some((pair) => Array.isArray(pair) && String(pair[0] || "").toLowerCase() === "x-pp-no-observe" && String(pair[1] || "") === "1");
            }
            if (typeof headers === "object") {
              return Object.keys(headers).some((key) => String(key || "").toLowerCase() === "x-pp-no-observe" && String(headers[key] || "") === "1");
            }
          } catch (_) {}
          return false;
        })();
        const result = originalFetch.apply(this, arguments);
        if (skipInspect) return result;
        try {
          Promise.resolve(result).then((response) => {
            try {
              if (!response || !response.ok || !response.clone) return;
              const responseUrl = String(response.url || (arguments[0] && arguments[0].url) || arguments[0] || "");
              const method = String((arguments[1] && arguments[1].method) || (arguments[0] && arguments[0].method) || "GET");
              response.clone().text().then((bodyText) => inspect(responseUrl, method, bodyText)).catch(() => inspect(responseUrl, method, ""));
            } catch (_) {}
          }).catch(() => {});
        } catch (_) {}
        return result;
      };
      wrappedFetch.__ppGsNetSyncWrapped = true;
      wrappedFetch.__ppGsNetSyncOriginal = originalFetch;
      window.fetch = wrappedFetch;
    }

    if (XHR && XHR.prototype && typeof originalOpen === "function" && typeof originalSend === "function" && !XHR.prototype.open.__ppGsNetSyncWrapped) {
      XHR.prototype.open = function (method, url) {
        try {
          this.__ppGsMethod = method;
          this.__ppGsUrl = url;
        } catch (_) {}
        return originalOpen.apply(this, arguments);
      };
      XHR.prototype.open.__ppGsNetSyncWrapped = true;

      XHR.prototype.send = function () {
        if (!this.__ppGsNetSyncBound) {
          this.__ppGsNetSyncBound = true;
          this.addEventListener("loadend", () => {
            try {
              if (this.status < 200 || this.status >= 300) return;
              inspect(this.responseURL || this.__ppGsUrl || "", this.__ppGsMethod || "GET", typeof this.responseText === "string" ? this.responseText : "");
            } catch (_) {}
          });
        }
        return originalSend.apply(this, arguments);
      };
      XHR.prototype.send.__ppGsNetSyncWrapped = true;

      window[NET_SYNC_PATCH_KEY] = { originalOpen, originalSend };
    }

    window[NET_SYNC_KEY] = true;
    networkSyncCleanup = () => {
      try {
        if (originalFetch && window.fetch && window.fetch.__ppGsNetSyncWrapped && window.fetch.__ppGsNetSyncOriginal === originalFetch) {
          window.fetch = originalFetch;
        }
      } catch (_) {}
      try {
        if (XHR && XHR.prototype) {
          if (typeof originalOpen === "function" && XHR.prototype.open && XHR.prototype.open.__ppGsNetSyncWrapped) XHR.prototype.open = originalOpen;
          if (typeof originalSend === "function" && XHR.prototype.send && XHR.prototype.send.__ppGsNetSyncWrapped) XHR.prototype.send = originalSend;
        }
      } catch (_) {}
      window[NET_SYNC_KEY] = false;
      networkSyncCleanup = null;
    };
  }
  const originalNative = window[ORIGINAL_NATIVE_KEY] || {
    approveDeposit: null,
    approveWithdraw: null,
    deleteDeposit: null,
    deleteWithdraw: null
  };
  window[ORIGINAL_NATIVE_KEY] = originalNative;

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

  function showInlineToast(message, mode = "info", holdMs = 1800) {
    try {
      if (typeof window.__ppPanelToast === "function") {
        return !!window.__ppPanelToast(message, mode, holdMs);
      }
    } catch (_) {}
    return false;
  }

  const gsNotifyState = { key: "", at: 0, kind: "" };

  function isAbortLike(error) {
    const msg = String(error && (error.message || error) || "").toLowerCase();
    return !!(error && (error.name === "AbortError" || error.name === "TimeoutError" || error.isTimeout)) || msg.includes("aborted") || msg.includes("abort") || msg.includes("timeout");
  }

  function parseGsResponseBody(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return { raw: "", parsed: null, lower: "" };
    let parsed = null;
    if (/^[\[{]/.test(text)) {
      try { parsed = JSON.parse(text); } catch (_) {}
    }
    return { raw: text, parsed, lower: text.toLowerCase() };
  }

  function pickGsResponseMessage(parsed, raw) {
    if (parsed && typeof parsed === "object") {
      const fields = [parsed.message, parsed.msg, parsed.status, parsed.result, parsed.error, parsed.reason];
      for (const value of fields) {
        const text = String(value == null ? "" : value).trim();
        if (text) return text;
      }
    }
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return "";
    return text.replace(/\s+/g, " ").slice(0, 180);
  }

  function classifyGsResponse(res, rawBody) {
    const status = Number(res && res.status) || 0;
    const body = parseGsResponseBody(rawBody);
    const parsed = body.parsed;
    const lower = body.lower;
    const message = pickGsResponseMessage(parsed, body.raw);
    const busySignal = !!(
      /\bbusy(?:[_\s-]*(?:script|document|sheet|lock))?\b/i.test(message || "") ||
      /\bbusy(?:[_\s-]*(?:script|document|sheet|lock))?\b/i.test(body.raw || "") ||
      lower.includes("busy_script") ||
      lower.includes("busy_document") ||
      lower.includes('"retry":true') ||
      lower.includes('"busy":true')
    );

    const explicitOk = !!(
      (parsed && typeof parsed === "object" && (parsed.ok === true || parsed.success === true || String(parsed.status || "").toLowerCase() === "success" || String(parsed.result || "").toLowerCase() === "success")) ||
      /(ok|success|berhasil|sukses|done|sent)/i.test(body.raw) ||
      lower.includes('"ok":true') ||
      lower.includes('"success":true')
    );

    const explicitFail = !!(
      (parsed && typeof parsed === "object" && (parsed.ok === false || parsed.success === false || /^(fail|failed|error|invalid)$/i.test(String(parsed.status || parsed.result || parsed.error || "")))) ||
      /(fail|failed|gagal|error|invalid|denied|forbidden)/i.test(body.raw) ||
      lower.includes('"ok":false') ||
      lower.includes('"success":false')
    );

    if (!(res && res.ok)) {
      if (busySignal || status === 408 || status === 425 || status === 429) {
        return { kind: "retry", status, message: message || `HTTP ${status || 0}` };
      }
      if (status >= 400 && status < 500) {
        return { kind: "fail", status, message: message || `HTTP ${status}` };
      }
      return { kind: "retry", status, message: message || `HTTP ${status || 0}` };
    }

    if (busySignal) return { kind: "retry", status: status || 200, message: message || `HTTP ${status || 200}` };
    if (explicitFail) return { kind: "fail", status, message: message || `HTTP ${status || 200}` };
    if (explicitOk) return { kind: "success", status, message: message || `HTTP ${status || 200}` };
    if (!body.raw || status === 204) return { kind: "success", status: status || 204, message: message || `HTTP ${status || 204}` };
    return { kind: "success", status: status || 200, message: message || `HTTP ${status || 200}` };
  }

  function createGsFlushSummary() {
    return {
      successRows: 0,
      failRows: 0,
      errorRows: 0,
      successRoutes: new Set(),
      failRoutes: new Set(),
      errorRoutes: new Set(),
      details: []
    };
  }

  function recordGsFlushSummary(summary, kind, route, rowsCount, detail) {
    if (!summary) return;
    const safeKind = kind === "success" || kind === "fail" ? kind : "error";
    const count = Math.max(0, Number(rowsCount) || 0);
    if (safeKind === "success") {
      summary.successRows += count;
      if (route) summary.successRoutes.add(route);
    } else if (safeKind === "fail") {
      summary.failRows += count;
      if (route) summary.failRoutes.add(route);
    } else {
      summary.errorRows += count;
      if (route) summary.errorRoutes.add(route);
    }
    const text = String(detail || "").trim();
    if (text && summary.details.length < 6) summary.details.push(text);
  }

  function formatGsRouteLabel(route) {
    const value = String(route || "").toLowerCase();
    if (value === "deposit") return "deposit";
    if (value === "withdraw") return "withdraw";
    if (value === "ewallet") return "e-wallet";
    if (value === "pulsa") return "pulsa";
    if (value === "dana") return "dana";
    return value || "google sheet";
  }

  function formatGsRouteSummary(routeSet) {
    const list = Array.from(routeSet || []).map((route) => formatGsRouteLabel(route)).filter(Boolean);
    if (!list.length) return "google sheet";
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} & ${list[1]}`;
    return `${list[0]}, ${list[1]} +${list.length - 2}`;
  }

  function emitGsStatusToast(message, kind = "info", holdMs = 2600, dedupeKey = "") {
    const text = String(message || "").trim();
    if (!text) return false;
    const key = String(dedupeKey || `${kind}|${text}`);
    const nowTs = now();
    const minGap = kind === "success" ? 1200 : 700;
    if (gsNotifyState.key === key && nowTs - gsNotifyState.at < minGap) return false;
    gsNotifyState.key = key;
    gsNotifyState.kind = kind;
    gsNotifyState.at = nowTs;
    const mode = kind === "success" ? "success" : (kind === "fail" ? "warn" : (kind === "error" ? "warn" : "info"));
    return showInlineToast(text, mode, holdMs);
  }

  function flushGsStatusToast(summary) {
    if (!summary) return;
    if (summary.errorRows > 0) {
      const routeText = formatGsRouteSummary(summary.errorRoutes);
      const detail = summary.details[0] ? ` (${summary.details[0]})` : "";
      emitGsStatusToast(`Google Sheet error: ${summary.errorRows} row ${routeText} belum terkirim${detail}.`, "error", 3400, `err|${summary.errorRows}|${routeText}|${summary.details[0] || ""}`);
      return;
    }
    if (summary.failRows > 0) {
      const routeText = formatGsRouteSummary(summary.failRoutes);
      const detail = summary.details[0] ? ` (${summary.details[0]})` : "";
      emitGsStatusToast(`Data Gagal: ${summary.failRows} row ${routeText} ditolak endpoint${detail}.`, "fail", 3200, `fail|${summary.failRows}|${routeText}|${summary.details[0] || ""}`);
      return;
    }
    if (summary.successRows > 0) {
      const routeText = formatGsRouteSummary(summary.successRoutes);
      emitGsStatusToast(`Data Berhasil : ${summary.successRows} row ${routeText} terkirim.`, "success", 2200, `ok|${summary.successRows}|${routeText}`);
    }
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

  function saveCfg(next, options = {}) {
    const cfg = {
      enabled: !!next.enabled,
      autoCopy: !!next.autoCopy,
      urls: { ...DEFAULT_CFG.urls, ...(next.urls || {}) },
      colMap: { ...DEFAULT_CFG.colMap, ...(next.colMap || {}) },
      stats: { ...DEFAULT_CFG.stats, ...(next.stats || {}) }
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (_) {}
    if (options.render !== false) {
      queueUserTabRender(typeof options.delay === "number" ? options.delay : 0, { force: !!options.force });
    }
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
    saveCfg(cfg, { render: false });
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

  function getRowFastLaneSig(type, row) {
    return rowSeenSig(type, row) || rowQueueSig(type, row);
  }

  function pruneFastLaneInFlight() {
    const nowTs = now();
    fastLaneInFlight.forEach((value, key) => {
      if (!value || nowTs >= value.expireAt) fastLaneInFlight.delete(key);
    });
  }

  function markFastLaneInFlight(type, rows, holdMs = 12000) {
    const until = now() + Math.max(1500, Number(holdMs) || 0);
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const sig = getRowFastLaneSig(type, row);
      if (!sig) return;
      fastLaneInFlight.set(sig, { expireAt: until });
    });
  }

  function clearFastLaneInFlight(type, rows) {
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const sig = getRowFastLaneSig(type, row);
      if (!sig) return;
      fastLaneInFlight.delete(sig);
    });
  }

  function appendRowsToQueue(rows, type, scheduleDelay = 60) {
    if (!Array.isArray(rows) || !rows.length) return 0;
    const target = memoryQueue[type];
    if (!target) return 0;
    const stored = loadPersistedQueue();
    const existing = new Set();
    target.forEach((row) => existing.add(rowQueueSig(type, row)));
    (stored[type] || []).forEach((row) => existing.add(rowQueueSig(type, row)));
    let added = 0;
    dedupeRowsBySig(rows, type, "queue").forEach((row) => {
      const sig = rowQueueSig(type, row);
      if (sig && existing.has(sig)) return;
      if (sig) existing.add(sig);
      target.push(row);
      added += 1;
    });
    persistMemoryQueue();
    queueUserTabRender(80);
    if (added > 0 && scheduleDelay !== false) scheduleFlush(scheduleDelay === true ? 0 : scheduleDelay);
    return added;
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
    appendRowsToQueue(rows, type, 60);
  }

  async function sendToGSheetFastLane(rows, type, options = {}) {
    if (!isGsOn()) return { sent: 0, queued: 0, skipped: Array.isArray(rows) ? rows.length : 0 };
    const inputRows = Array.isArray(rows) ? rows : [];
    if (!inputRows.length) return { sent: 0, queued: 0, skipped: 0 };

    pruneFastLaneInFlight();

    const seenSet = new Set(loadSeen());
    const deduped = dedupeRowsBySig(inputRows, type, "queue");
    const filtered = [];
    deduped.forEach((row) => {
      const seenSig = rowSeenSig(type, row);
      if (seenSig && seenSet.has(seenSig)) return;
      const sig = getRowFastLaneSig(type, row);
      if (sig && fastLaneInFlight.has(sig)) return;
      filtered.push(row);
    });

    if (!filtered.length) {
      return { sent: 0, queued: 0, skipped: inputRows.length };
    }

    markFastLaneInFlight(type, filtered, options.holdMs || 12000);

    const urls = getGsUrls();
    const cfg = getCfgNetwork();
    const retryCount = Math.max(1, Math.min(2, Number(options.retry) || Math.max(1, cfg.RETRY - 1)));
    const baseDelay = Math.max(120, Math.min(200, Number(options.baseDelay) || cfg.BASE_DELAY || 160));
    const summary = createGsFlushSummary();
    const seenToAppend = [];
    const fallbackRows = [];
    const bucketMap = new Map();

    try {
      filtered.forEach((row) => {
        if (!hasQueuedRowTargetCol(type, row)) {
          return;
        }
        const endpointInfo = resolveEndpointForQueuedRow(type, row, urls);
        if (!endpointInfo.url) {
          fallbackRows.push(row);
          return;
        }
        const bucketKey = `${endpointInfo.route}|${endpointInfo.url}`;
        if (!bucketMap.has(bucketKey)) bucketMap.set(bucketKey, { url: endpointInfo.url, route: endpointInfo.route, rows: [] });
        bucketMap.get(bucketKey).rows.push(row);
      });

      const tasks = [];
      bucketMap.forEach((bucket) => {
        const chunks = chunkRows(bucket.rows, Math.min(cfg.MAX_ROWS, 24), Math.min(cfg.MAX_BYTES, 90000));
        chunks.forEach((chunk) => {
          tasks.push(async () => {
            try {
              const ok = await fetchRetry(bucket.url, chunk, type, retryCount, baseDelay, { route: bucket.route, summary });
              if (ok === true) {
                chunk.map((row) => rowSeenSig(type, row)).filter(Boolean).forEach((sig) => {
                  if (!seenSet.has(sig)) {
                    seenSet.add(sig);
                    seenToAppend.push(sig);
                  }
                });
                return;
              }
            } catch (_) {
              fallbackRows.push(...chunk);
            }
          });
        });
      });

      if (tasks.length) {
        await runPool(tasks, Math.max(1, Math.min(cfg.CONC, 2)));
      }

      if (seenToAppend.length) {
        saveSeen(Array.from(seenSet).slice(-600));
      }

      if (fallbackRows.length) {
        appendRowsToQueue(fallbackRows, type, false);
      }

      flushGsStatusToast(summary);
      persistMemoryQueue();
      queueUserTabRender(60);

      if (fallbackRows.length) {
        scheduleFlush(0);
      }

      return {
        sent: summary.successRows,
        queued: fallbackRows.length,
        skipped: Math.max(0, inputRows.length - filtered.length)
      };
    } finally {
      clearFastLaneInFlight(type, filtered);
    }
  }

  function sendToGSheetBatch(rows, type, options = {}) {
    if (!isGsOn()) return Promise.resolve({ sent: 0, queued: 0, skipped: Array.isArray(rows) ? rows.length : 0 });
    if (options && options.fastLane) {
      return sendToGSheetFastLane(rows, type, options);
    }
    enqueueRows(rows, type);
    return Promise.resolve({ sent: 0, queued: Array.isArray(rows) ? rows.length : 0, skipped: 0 });
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
    const helper = (typeof copyPlainTextSafe === 'function')
      ? copyPlainTextSafe
      : ((typeof window !== 'undefined' && window && typeof window.copyPlainTextSafe === 'function')
          ? window.copyPlainTextSafe
          : ((typeof window !== 'undefined' && window && typeof window.__ppCopyPlainTextSafe === 'function')
              ? window.__ppCopyPlainTextSafe
              : ((typeof window !== 'undefined' && window && typeof window.copyPlainText === 'function') ? window.copyPlainText : null)));
    return helper ? helper(text) : false;
  }

  try {
    if (typeof window !== 'undefined' && window) {
      window.copyPlainText = copyPlainText;
    }
  } catch (_) {}

  function getCopyMatrix(type, rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const arr = Array.isArray(row) ? row : [];
      if (type === "pulsa") {
        return [arr[0] || "", arr[1] || "", arr[2] || "", arr[3] || "", arr[4] || "", arr[5] || "", arr[6] || ""]
          .map((v) => String(v == null ? "" : v));
      }
      if (type === "withdraw") {
        return [arr[0] || "", arr[1] || "", arr[2] || ""]
          .map((v) => String(v == null ? "" : v));
      }
      return [arr[0] || "", arr[1] || "", arr[2] || ""]
        .map((v) => String(v == null ? "" : v));
    }).filter((cells) => cells.some((value) => String(value || "") !== ""));
  }

  function getQueuedRowTargetCol(type, row) {
    const arr = Array.isArray(row) ? row : [];
    const index = type === "pulsa" ? 7 : 6;
    return String(arr[index] == null ? "" : arr[index]).trim();
  }

  function hasQueuedRowTargetCol(type, row) {
    return !!getQueuedRowTargetCol(type, row);
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
    const fallbackCopy = (typeof copyPlainTextSafe === 'function')
      ? copyPlainTextSafe
      : ((typeof window !== 'undefined' && window && typeof window.copyPlainTextSafe === 'function')
          ? window.copyPlainTextSafe
          : ((typeof window !== 'undefined' && window && typeof window.__ppCopyPlainTextSafe === 'function')
              ? window.__ppCopyPlainTextSafe
              : ((typeof window !== 'undefined' && window && typeof window.copyPlainText === 'function') ? window.copyPlainText : null)));
    return fallbackCopy ? fallbackCopy(text) : false;
  }

  async function autoCopyPayload(payload) {
    if (!isAutoCopyOn() || !payload || !Array.isArray(payload.rows) || !payload.rows.length) return false;
    const matrix = getCopyMatrix(payload.type, payload.rows);
    if (!matrix.length) return false;
    const text = buildCopyTextFromMatrix(matrix);
    const ok = await copyStructuredMatrix(matrix);
    void text;
    return ok;
    return ok;
  }

  async function timeoutFetch(url, body, timeoutMs = 9000) {
    const ctrl = window.AbortController ? new AbortController() : null;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { ctrl && ctrl.abort(); } catch (_) {}
    }, timeoutMs);

    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ data: JSON.stringify(body) }),
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
        timeoutError.name = "TimeoutError";
        timeoutError.isTimeout = true;
        throw timeoutError;
      }
      throw error;
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

  async function fetchRetry(url, rows, type, maxRetry, baseDelay, meta = {}) {
    const route = String(meta && meta.route || type || "").trim().toLowerCase();
    const summary = meta && meta.summary;
    let attempt = 0;
    while (true) {
      try {
        const res = await timeoutFetch(url, rows, 9000);
        const rawBody = await res.text().catch(() => "");
        const outcome = classifyGsResponse(res, rawBody);

        if (outcome.kind === "success") {
          updateStats({ okAt: now() });
          recordGsFlushSummary(summary, "success", route, Array.isArray(rows) ? rows.length : 0, outcome.message);
          return true;
        }

        if (outcome.kind === "fail") {
          pushDead(type, rows);
          updateStats({ errAt: now() });
          recordGsFlushSummary(summary, "fail", route, Array.isArray(rows) ? rows.length : 0, outcome.message);
          return null;
        }

        throw new Error(outcome.message || (outcome.status ? `HTTP ${outcome.status}` : "Retry request"));
      } catch (error) {
        updateStats({ errAt: now() });
        attempt += 1;
        if (attempt > maxRetry) {
          recordGsFlushSummary(summary, "error", route, Array.isArray(rows) ? rows.length : 0, isAbortLike(error) ? "timeout" : (error && error.message ? error.message : String(error)));
          throw error;
        }
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
    const flushSummary = createGsFlushSummary();

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
          if (!hasQueuedRowTargetCol(item.type, row)) {
            return;
          }
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
                const ok = await fetchRetry(bucket.url, chunk, item.type, cfg.RETRY, cfg.BASE_DELAY, { route: bucket.route, summary: flushSummary });
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
      flushGsStatusToast(flushSummary);
    } finally {
      flushBusy = false;
      persistMemoryQueue();
      queueUserTabRender(80);
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

    const contextual = upper
      .replace(/SEA\s*BANK/g, "SEABANK")
      .replace(/SYARIAH\s+INDONESIA/g, "BSI")
      .replace(/LINK\s*AJA/g, "LINKAJA");

    const sourceFirst = contextual.match(/\b(BCA|MANDIRI|BNI|BRI|BSI|CIMB|SEABANK|DANAMON|ANTARBANK|JENIUS|DANA|OVO|GOPAY|LINKAJA)\b\s*(?:KE|TO|TRANSFER\s+KE|->|>|\/)/);
    if (sourceFirst && knownKeys.includes(sourceFirst[1])) return sourceFirst[1];

    const fromFirst = contextual.match(/\bFROM\s+(BCA|MANDIRI|BNI|BRI|BSI|CIMB|SEABANK|DANAMON|ANTARBANK|JENIUS|DANA|OVO|GOPAY|LINKAJA)\b/);
    if (fromFirst && knownKeys.includes(fromFirst[1])) return fromFirst[1];

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

    const sourceWrap = row.children && row.children[4] ? row.children[4] : null;
    if (sourceWrap) {
      const visualBank = getBankNameFromRow(sourceWrap) || getBankNameFromRow(row);
      if (visualBank && known.includes(visualBank)) return visualBank;
      const sourceTexts = collectRowStrings(sourceWrap);
      for (const text of sourceTexts) {
        const match = findKnownTransferKey(text, known);
        if (match) return match;
      }
    }

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

    const rowVisualBank = getBankNameFromRow(row);
    if (rowVisualBank && known.includes(rowVisualBank)) return rowVisualBank;

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

  function getExactAccountName(row, username, kind) {
    if (!row) return "";

    const blockPattern = /\b(?:bank(?:\s+(?:tujuan|asal))?|rekening\s+(?:tujuan|asal)|asal\s+transfer|tujuan\s+transfer|sumber\s+dana|metode(?:\s+transfer)?|payment|channel)\b/i;
    const goodLabelPattern = /\b(?:nama(?:\s+rekening)?|atas\s+nama|account\s*name|account\s*holder|holder\s*name)\b/i;

    const normalizeNameCandidate = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isBadNameCandidate = (value) => {
      const txt = normalizeNameCandidate(value);
      if (!txt) return true;
      if (username && txt.toLowerCase() === String(username).toLowerCase()) return true;
      if (!/[A-Za-z]/.test(txt)) return true;
      if (/\d{3,}/.test(txt)) return true;
      if (txt.length < 3 || txt.length > 60) return true;
      if (isLikelyAmountText(txt)) return true;
      if (isLikelyBankTargetText(txt)) return true;
      if (blockPattern.test(txt)) return true;
      if (/approve|delete|reject|show all|sort by|select bank|loading|refresh|pending|deposit|withdraw|bonus|click to copy|manual|otomatis/i.test(txt)) return true;
      return false;
    };

    const rankNameCandidate = (value, context) => {
      const txt = normalizeNameCandidate(value);
      const ctx = normalizeNameCandidate(context);
      if (isBadNameCandidate(txt)) return -Infinity;
      if (blockPattern.test(ctx) && !goodLabelPattern.test(ctx)) return -Infinity;
      let score = 0;
      if (goodLabelPattern.test(ctx)) score += 12;
      if (/\b(?:nama|name)\b/i.test(ctx)) score += 6;
      if (txt === txt.toUpperCase()) score += 2;
      if (/^[A-Za-z .'-]+$/.test(txt)) score += 2;
      const wordCount = txt.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 2 && wordCount <= 5) score += 3;
      if (kind === "withdraw" && /withdraw/i.test(ctx)) score += 2;
      if (kind === "deposit" && /deposit/i.test(ctx)) score += 2;
      score += Math.min(txt.length, 24) / 10;
      return score;
    };

    const inputNodes = [...row.querySelectorAll("td input.form-control[readonly], td input[readonly], td textarea[readonly], input.form-control[readonly], input[readonly], textarea[readonly]")];
    const ranked = [];

    inputNodes.forEach((el) => {
      const value = normalizeNameCandidate(textFromNode(el));
      if (!value) return;

      const contexts = [
        textFromNode(el.closest("td")),
        textFromNode(el.closest(".row")),
        textFromNode(el.parentElement),
        textFromNode(el.previousElementSibling),
        textFromNode(el.parentElement && el.parentElement.previousElementSibling),
        textFromNode(el.parentElement && el.parentElement.parentElement)
      ].filter(Boolean);

      const context = contexts.join(" | ");
      const score = rankNameCandidate(value, context);
      if (!Number.isFinite(score)) return;
      ranked.push({ value: value.toUpperCase(), score });
    });

    if (ranked.length) {
      ranked.sort((a, b) => b.score - a.score || a.value.length - b.value.length);
      return ranked[0].value;
    }

    const fallbacks = collectRowStrings(row)
      .map((txt) => normalizeNameCandidate(txt))
      .filter((txt) => !isBadNameCandidate(txt))
      .filter((txt) => /^[A-Za-z][A-Za-z .'-]{2,59}$/.test(txt))
      .sort((a, b) => b.length - a.length);

    return fallbacks[0] ? fallbacks[0].toUpperCase() : "";
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

  function guessName(row, username, kind) {
    const exact = getExactAccountName(row, username, kind);
    if (exact) return exact;

    const texts = collectRowStrings(row);
    const blockedPattern = /\b(?:bank(?:\s+(?:tujuan|asal))?|rekening\s+(?:tujuan|asal)|asal\s+transfer|tujuan\s+transfer|sumber\s+dana|metode(?:\s+transfer)?|payment|channel)\b/i;

    for (const text of texts) {
      const clean = String(text || "").replace(/\s+/g, " ").trim();
      if (!clean || blockedPattern.test(clean)) continue;
      const m = clean.match(/(?:nama(?:\s+rekening)?|atas\s+nama|account\s*name|account\s*holder|holder\s*name)\s*[:\-]?\s*([A-Za-z][A-Za-z '.-]{2,59})/i);
      if (m) {
        const value = String(m[1] || "").replace(/\s+/g, " ").trim();
        if (value && !isLikelyBankTargetText(value) && !isLikelyAmountText(value)) return value.toUpperCase();
      }
    }

    const preferred = texts
      .map((txt) => String(txt || "").replace(/\s+/g, " ").trim())
      .filter((txt) => /[A-Za-z]/.test(txt))
      .filter((txt) => txt.length >= 4 && txt.length <= 60)
      .filter((txt) => !username || txt.toLowerCase() !== String(username).toLowerCase())
      .filter((txt) => !/approve|delete|reject|show all|sort by|select bank|loading|refresh|pending|deposit|withdraw|bonus|click to copy|manual|otomatis/i.test(txt))
      .filter((txt) => !blockedPattern.test(txt))
      .filter((txt) => !isLikelyAmountText(txt))
      .filter((txt) => !isLikelyBankTargetText(txt))
      .filter((txt) => /^[A-Za-z][A-Za-z .'-]{2,59}$/.test(txt))
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
    const nama = guessName(row, username, "deposit");
    const nominal = getNominalFromRow(row, id);
    const nomorSn = getNumberOrSnFromRow(row);
    const targetCol = pickTargetCol(targetKey || (route === "pulsa" ? "TELKOMSEL" : ""));
    if (!nama || !username || !nominal) return null;

    if (route === "pulsa") {
      const potongan = nominal * 0.05;
      const jumlahDiproses = nominal - potongan;
      return {
        type: "pulsa",
        gsReady: !!targetCol,
        rows: [[nomorSn || "", nama, username, formatNumber(jumlahDiproses), formatNumber(potongan), "", formatNumber(nominal), targetCol]]
      };
    }

    const txKey = "DEP-" + id;
    const nonce = "DEP-N-" + id;
    return {
      type: route,
      gsReady: !!targetCol,
      rows: [[nama, username, formatNumber(nominal), targetKey || sourceKey || "DEPOSIT", txKey, nonce, targetCol]]
    };
  }

  function buildWithdrawPayload(id) {
    const row = document.getElementById("withdrawPending-" + id);
    if (!row) return null;
    const username = guessUsername(row, id, "withdraw");
    const nama = guessName(row, username, "withdraw");
    const nominal = getNominalFromRow(row, id);
    const sourceKey = getWithdrawSourceKey(row, id);
    const targetCol = pickWithdrawTargetCol(sourceKey);
    if (!nama || !username || !nominal) return null;
    const txKey = "WD-" + id;
    const nonce = "WD-N-" + id;
    return {
      type: "withdraw",
      gsReady: !!targetCol,
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

    approveCaptureHandler = (event) => {
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
    };

    panel.addEventListener("click", approveCaptureHandler, true);
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

  const GS_OPTIMISTIC_PENDING_ROWS = { depo: new Map(), wd: new Map() };

  function gsCssEscapeSafe(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value == null ? '' : value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function getPanelRoot() {
    return document.getElementById(PANEL_ID);
  }

  function getPanelTab(type) {
    const panelRoot = getPanelRoot();
    if (!panelRoot) return null;
    return panelRoot.querySelector(type === 'wd' ? '#ppWdTab' : '#ppDepoTab');
  }

  function getPanelInstance() {
    const instance = window[INSTANCE_KEY];
    return instance && typeof instance === 'object' ? instance : null;
  }

  function pruneGsOptimisticPendingRows(type) {
    const key = type === 'wd' ? 'wd' : 'depo';
    const bucket = GS_OPTIMISTIC_PENDING_ROWS[key];
    const nowTs = Date.now();
    bucket.forEach((expireAt, rowId) => {
      if (!expireAt || nowTs >= expireAt) bucket.delete(rowId);
    });
    return bucket;
  }

  function markGsOptimisticPendingRow(type, id, ttlMs = 2600) {
    if (id == null || id === '') return false;
    const bucket = pruneGsOptimisticPendingRows(type);
    bucket.set(String(id), Date.now() + Math.max(900, Number(ttlMs) || 0));
    return true;
  }

  function refreshPendingBadgesFromDom() {
    const panelRoot = getPanelRoot();
    if (!panelRoot) return false;
    const counts = {
      depo: panelRoot.querySelectorAll('#ppDepoTab tr[id^="depositPending-"]:not([data-pp-optimistic-gone="1"])').length,
      wd: panelRoot.querySelectorAll('#ppWdTab tr[id^="withdrawPending-"]:not([data-pp-optimistic-gone="1"])').length
    };
    const depoBadge = panelRoot.querySelector('#ppDepoBadge');
    const wdBadge = panelRoot.querySelector('#ppWdBadge');
    if (depoBadge) depoBadge.textContent = String(counts.depo);
    if (wdBadge) wdBadge.textContent = String(counts.wd);
    return true;
  }

  function updatePendingEmptyState(type) {
    const tab = getPanelTab(type);
    if (!tab) return;
    const rowSelector = type === 'depo' ? 'tr[id^="depositPending-"]:not([data-pp-optimistic-gone="1"])' : 'tr[id^="withdrawPending-"]:not([data-pp-optimistic-gone="1"])';
    const tbody = tab.querySelector('.pp-tableWrap tbody, table tbody');
    if (!tbody) return;
    const hasRows = !!tbody.querySelector(rowSelector);
    const existing = tbody.querySelector('tr.pp-emptyPendingRow');
    if (hasRows) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const table = tbody.closest('table');
    const headCount = table ? table.querySelectorAll('thead tr:last-child th').length : 0;
    const bodyCount = tbody.querySelector('tr') ? tbody.querySelector('tr').children.length : 0;
    const colCount = Math.max(1, headCount || bodyCount || 1);
    const tr = document.createElement('tr');
    tr.className = 'pp-emptyPendingRow';
    tr.innerHTML = `<td colspan="${colCount}" style="text-align:center;padding:14px 10px;color:#7f1d1d;font-size:12px;">Tidak ada pending.</td>`;
    tbody.appendChild(tr);
  }

  function optimisticConsumePendingRow(kind, id) {
    const normalizedKind = kind === 'withdraw' ? 'withdraw' : 'deposit';
    const type = normalizedKind === 'withdraw' ? 'wd' : 'depo';
    const normalizedId = String(id == null ? '' : id).trim();
    markGsOptimisticPendingRow(type, normalizedId, normalizedKind === 'withdraw' ? 2600 : 3200);
    const selector = `#${normalizedKind === 'withdraw' ? 'withdrawPending-' : 'depositPending-'}${gsCssEscapeSafe(normalizedId)}`;
    const row = document.querySelector(selector);
    if (!row || row.dataset.ppOptimisticGone === '1') {
      refreshPendingBadgesFromDom();
      return false;
    }
    row.dataset.ppOptimisticGone = '1';
    row.setAttribute('data-pp-optimistic-gone', '1');
    row.style.pointerEvents = 'none';
    row.style.willChange = 'opacity, transform, height, margin, padding';
    row.style.transition = 'opacity .08s ease, transform .08s ease, height .1s ease, margin .1s ease, padding .1s ease';
    row.style.opacity = '.18';
    row.style.transform = 'translateY(-1px) scale(.995)';
    refreshPendingBadgesFromDom();
    window.setTimeout(() => {
      if (!row.isConnected) return;
      row.style.opacity = '0';
      row.style.transform = 'translateY(-2px) scale(.99)';
      row.style.height = '0px';
      row.style.minHeight = '0px';
      row.style.marginTop = '0px';
      row.style.marginBottom = '0px';
      row.style.paddingTop = '0px';
      row.style.paddingBottom = '0px';
    }, 6);
    window.setTimeout(() => {
      try { if (row.isConnected) row.remove(); } catch (_) {}
      try { refreshPendingBadgesFromDom(); } catch (_) {}
      try { updatePendingEmptyState(type); } catch (_) {}
    }, 72);
    return true;
  }

  function boostPanelRefresh(type) {
    const normalizedType = type === 'wd' ? 'wd' : 'depo';
    const instance = getPanelInstance();
    if (instance && typeof instance.refresh === 'function') {
      try {
        instance.refresh(normalizedType);
        return true;
      } catch (_) {}
    }
    const tab = getPanelTab(normalizedType);
    if (!tab) return false;
    const activeButton = getPanelRoot() && getPanelRoot().querySelector(`.pp-tabButton[data-tab="${normalizedType}"]`);
    if (activeButton && typeof activeButton.click === 'function') {
      try {
        activeButton.click();
        return true;
      } catch (_) {}
    }
    return false;
  }

  function burstPanelRefresh(type, delays = [0, 110, 260, 620]) {
    const normalizedType = type === 'wd' ? 'wd' : 'depo';
    const uniqueDelays = [...new Set((Array.isArray(delays) ? delays : [delays]).map((value) => Math.max(0, Number(value) || 0)))];
    uniqueDelays.forEach((delay) => {
      window.setTimeout(() => {
        if (!getPanelRoot()) return;
        boostPanelRefresh(normalizedType);
      }, delay);
    });
  }

  function waitForPendingRowRemoval(kind, id, timeoutMs = 5000, intervalMs = 80) {
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
    const currentDepo = window.approveDeposit;
    const currentWd = window.approveWithdraw;
    const currentDeleteDepo = window.deleteDeposit;
    const currentDeleteWd = window.deleteWithdraw;

    if (typeof currentDepo === "function" && !currentDepo[WRAP_MARK_KEY]) originalNative.approveDeposit = currentDepo;
    if (typeof currentWd === "function" && !currentWd[WRAP_MARK_KEY]) originalNative.approveWithdraw = currentWd;
    if (typeof currentDeleteDepo === "function" && !currentDeleteDepo[WRAP_MARK_KEY]) originalNative.deleteDeposit = currentDeleteDepo;
    if (typeof currentDeleteWd === "function" && !currentDeleteWd[WRAP_MARK_KEY]) originalNative.deleteWithdraw = currentDeleteWd;
    window[ORIGINAL_NATIVE_KEY] = originalNative;

    const nativeDepo = originalNative.approveDeposit;
    const nativeWd = originalNative.approveWithdraw;
    const nativeDeleteDepo = originalNative.deleteDeposit;
    const nativeDeleteWd = originalNative.deleteWithdraw;
    if (typeof nativeDepo !== "function" || typeof nativeWd !== "function") return;

    const nextSignature = [nativeDepo, nativeWd, nativeDeleteDepo, nativeDeleteWd]
      .map((fn) => typeof fn === "function" ? String(fn) : "")
      .join("||");

    if (
      window[WRAP_LOCK] &&
      wrappedSignature === nextSignature &&
      currentDepo && currentDepo[WRAP_MARK_KEY] === nextSignature &&
      currentWd && currentWd[WRAP_MARK_KEY] === nextSignature &&
      (!nativeDeleteDepo || (currentDeleteDepo && currentDeleteDepo[WRAP_MARK_KEY] === nextSignature)) &&
      (!nativeDeleteWd || (currentDeleteWd && currentDeleteWd[WRAP_MARK_KEY] === nextSignature))
    ) {
      return;
    }

    const wrappedDepo = function () {
      const id = extractApproveId(arguments[0], "deposit");
      const ctx = consumeApproveContext("deposit", id);
      let payload = null;
      try {
        if (id && (isGsOn() || isAutoCopyOn())) {
          payload = buildDepositPayload(id);
        }
      } catch (error) {
        console.error("[PP-GS] buildDepositPayload failed", error);
      }
      const meta = invokeWithConfirmTracking(nativeDepo, this, arguments);
      try {
        const handled = shouldProcessNativeAction(meta);

        if (handled) {
          optimisticConsumePendingRow('deposit', id);
          queueMicrotask(() => burstPanelRefresh('depo', [0, 90, 220, 520, 1200]));
          queueMicrotask(() => window.triggerDepositApprovedHistoryRefreshWave({ forceBusy: false, delays: [60, 160, 420, 1100, 2400, 4200] }));
        }

        if (handled && payload && payload.rows && payload.rows.length) {
          if (isAutoCopyOn()) {
            queueMicrotask(() => autoCopyPayload(payload).catch(() => {}));
          }

          queueMicrotask(async () => {
            try {
              if (recentlyHandled("panel-approve:deposit:" + id, 8000)) return;
              const fastLaneTask = isGsOn() && payload.gsReady !== false
                ? sendToGSheetBatch(payload.rows, payload.type, { fastLane: true, holdMs: ctx && ctx.source === "auto-deposit" ? 14000 : 12000, retry: 2, baseDelay: 140 })
                : Promise.resolve(null);
              const removed = await waitForPendingRowRemoval("deposit", id, ctx && ctx.source === "auto-deposit" ? 2200 : 900, 45);
              if (!removed) {
                burstPanelRefresh('depo', [0, 120, 320, 760, 1600]);
                window.triggerDepositApprovedHistoryRefreshWave({ forceBusy: false, delays: [220, 760, 1800, 3600, 5600] });
              } else {
                clearOptimisticPendingRow('depo', id);
                window.triggerDepositApprovedHistoryRefreshWave({ forceBusy: false, delays: [40, 120, 360, 900, 2200, 4200] });
              }
              await Promise.resolve(fastLaneTask);
            } catch (error) {
              console.error("[PP-GS] deposit queue failed", error);
            }
          });
        }

        if (handled && !(ctx && ctx.source === "auto-deposit")) {
          queueMicrotask(() => schedulePanelRefresh("depo", true));
        }
      } catch (error) {
        console.error("[PP-GS] deposit queue failed", error);
      }
      return meta.result;
    };
    wrappedDepo[WRAP_MARK_KEY] = nextSignature;

    const wrappedWd = function () {
      const id = extractApproveId(arguments[0], "withdraw");
      const ctx = consumeApproveContext("withdraw", id);
      let payload = null;
      try {
        if (id && (isGsOn() || isAutoCopyOn())) {
          payload = buildWithdrawPayload(id);
        }
      } catch (error) {
        console.error("[PP-GS] buildWithdrawPayload failed", error);
      }
      const meta = invokeWithConfirmTracking(nativeWd, this, arguments);
      try {
        const handled = shouldProcessNativeAction(meta);

        if (handled) {
          optimisticConsumePendingRow('withdraw', id);
          queueMicrotask(() => burstPanelRefresh('wd', [0, 90, 220, 520, 1200]));
          queueMicrotask(() => window.triggerWithdrawApprovedHistoryRefreshWave({ forceBusy: false, delays: [60, 160, 420, 1100, 2400, 4200] }));
        }

        if (handled && payload && payload.rows && payload.rows.length) {
          if (isAutoCopyOn()) {
            queueMicrotask(() => autoCopyPayload(payload).catch(() => {}));
          }

          queueMicrotask(async () => {
            try {
              if (recentlyHandled("panel-approve:withdraw:" + id, 8000)) return;
              const fastLaneTask = isGsOn() && payload.gsReady !== false
                ? sendToGSheetBatch(payload.rows, payload.type, { fastLane: true, holdMs: 12000, retry: 2, baseDelay: 140 })
                : Promise.resolve(null);
              const removed = await waitForPendingRowRemoval("withdraw", id, 900, 45);
              if (!removed) {
                burstPanelRefresh('wd', [0, 120, 320, 760, 1600]);
                window.triggerWithdrawApprovedHistoryRefreshWave({ forceBusy: false, delays: [220, 760, 1800, 3600, 5600] });
              } else {
                clearOptimisticPendingRow('wd', id);
                window.triggerWithdrawApprovedHistoryRefreshWave({ forceBusy: false, delays: [40, 120, 360, 900, 2200, 4200] });
              }
              await Promise.resolve(fastLaneTask);
            } catch (error) {
              console.error("[PP-GS] withdraw queue failed", error);
            }
          });
        }

        if (handled) {
          queueMicrotask(() => schedulePanelRefresh("wd", true));
        }
      } catch (error) {
        console.error("[PP-GS] withdraw queue failed", error);
      }
      return meta.result;
    };
    wrappedWd[WRAP_MARK_KEY] = nextSignature;

    window.approveDeposit = wrappedDepo;
    window.approveWithdraw = wrappedWd;

    if (typeof nativeDeleteDepo === "function") {
      const wrappedDeleteDepo = function () {
        const meta = invokeWithConfirmTracking(nativeDeleteDepo, this, arguments);
        if (shouldProcessNativeAction(meta)) {
          queueMicrotask(() => schedulePanelRefresh("depo", true));
        }
        return meta.result;
      };
      wrappedDeleteDepo[WRAP_MARK_KEY] = nextSignature;
      window.deleteDeposit = wrappedDeleteDepo;
    }

    if (typeof nativeDeleteWd === "function") {
      const wrappedDeleteWd = function () {
        const meta = invokeWithConfirmTracking(nativeDeleteWd, this, arguments);
        if (shouldProcessNativeAction(meta)) {
          queueMicrotask(() => schedulePanelRefresh("wd", true));
        }
        return meta.result;
      };
      wrappedDeleteWd[WRAP_MARK_KEY] = nextSignature;
      window.deleteWithdraw = wrappedDeleteWd;
    }

    wrappedSignature = nextSignature;
    window[WRAP_LOCK] = true;
  }

  function stopWrapWatcher() {
    if (wrapWatchTimer) {
      clearTimeout(wrapWatchTimer);
      wrapWatchTimer = 0;
    }
  }

  function startWrapWatcher() {
    if (document.visibilityState === "hidden" || wrapWatchTimer) return;
    if (!wrapWatchLifecycleBound) {
      wrapWatchLifecycleBound = true;
      wrapWatchVisibilityHandler = () => {
        if (document.visibilityState === "hidden") stopWrapWatcher();
        else startWrapWatcher();
      };
      document.addEventListener("visibilitychange", wrapWatchVisibilityHandler, { passive: true });
      window.addEventListener("focus", startWrapWatcher, { passive: true });
      window.addEventListener("pagehide", stopWrapWatcher, { passive: true });
    }
    wrapWatchTimer = window.setTimeout(() => {
      wrapWatchTimer = 0;
      try {
        wrapNativeApprovals();
      } catch (error) {
        console.error("[PP-GS] wrap watcher failed", error);
      }
      startWrapWatcher();
    }, 2400);
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
        setTestStatus(tab, "Test Gagal", "err", detail);
        emitGsStatusToast(`Google Sheet gagal: test ${type} ditolak endpoint.`, "fail", 3200, `test-fail|${type}|${res.status}`);
        return;
      }
      const outcome = classifyGsResponse(res, bodyText);
      const detail = `HTTP ${res.status}
Target Col: ${result.targetCol}
Response: ${snippet}`;
      if (outcome.kind === "retry") {
        setTestStatus(tab, "Test Busy", "", detail);
        emitGsStatusToast(`Google Sheet sibuk: test ${type} belum bisa diproses sekarang.`, "info", 2400, `test-busy|${type}|${outcome.message || ""}`);
        return;
      }
      if (outcome.kind === "fail") {
        setTestStatus(tab, "Test Gagal", "err", detail);
        emitGsStatusToast(`Google Sheet gagal: test ${type} dibalas gagal oleh endpoint.`, "fail", 3200, `test-fail-body|${type}|${outcome.message || ""}`);
        return;
      }
      setTestStatus(tab, "Test Berhasil", "ok", detail);
      emitGsStatusToast(`Google Sheet berhasil: test ${type} terkirim.`, "success", 2200, `test-ok|${type}|${result.targetCol}`);
    } catch (error) {
      const detail = error && error.message ? error.message : String(error);
      if (isAbortLike(error)) {
        setTestStatus(tab, "Test Timeout", "", detail);
        emitGsStatusToast(`Google Sheet error: test ${type} timeout / dibatalkan.`, "error", 3400, `test-timeout|${type}|${detail}`);
      } else {
        setTestStatus(tab, "Test Error", "err", detail);
        emitGsStatusToast(`Google Sheet error: test ${type} bermasalah.`, "error", 3400, `test-err|${type}|${detail}`);
      }
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

  let userTabRenderTimer = 0;
  let lastUserTabRenderSignature = "";

  function getUserTabRenderSignature() {
    const cfg = loadCfg();
    return JSON.stringify({
      enabled: !!cfg.enabled,
      autoCopy: !!cfg.autoCopy,
      urls: cfg.urls || {},
      colMap: cfg.colMap || {}
    });
  }

  function isUserTabBusy(tab) {
    if (!tab) return false;
    const active = document.activeElement;
    if (active && tab.contains(active)) return true;
    try {
      if (typeof tab.matches === "function" && tab.matches(":hover")) return true;
    } catch (_) {}
    try {
      if (tab.querySelector(":hover")) return true;
    } catch (_) {}
    return false;
  }

  function captureUserTabUiState(tab) {
    if (!tab) return null;
    const active = document.activeElement;
    const activeId = active && tab.contains(active) ? (active.id || active.getAttribute("data-col-key") || "") : "";
    const snapshot = {
      scrollTop: tab.scrollTop || 0,
      activeId,
      values: {},
      selectionStart: active && typeof active.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: active && typeof active.selectionEnd === "number" ? active.selectionEnd : null
    };
    tab.querySelectorAll("input, textarea, select").forEach((field) => {
      const key = field.id || field.getAttribute("data-col-key");
      if (!key) return;
      snapshot.values[key] = field.type === "checkbox" ? !!field.checked : String(field.value || "");
    });
    return snapshot;
  }

  function restoreUserTabUiState(tab, snapshot) {
    if (!tab || !snapshot) return;
    tab.querySelectorAll("input, textarea, select").forEach((field) => {
      const key = field.id || field.getAttribute("data-col-key");
      if (!key || !(key in snapshot.values)) return;
      if (field.type === "checkbox") field.checked = !!snapshot.values[key];
      else if (document.activeElement !== field) field.value = String(snapshot.values[key] || "");
    });
    tab.scrollTop = snapshot.scrollTop || 0;
    if (snapshot.activeId) {
      const escapedId = window.CSS && typeof window.CSS.escape === "function" ? CSS.escape(snapshot.activeId) : snapshot.activeId.replace(/[^a-zA-Z0-9_-]/g, "\$&");
      const target = tab.querySelector(`#${escapedId}`) || tab.querySelector(`[data-col-key="${snapshot.activeId.replace(/"/g, '\"')}"]`);
      if (target && typeof target.focus === "function") {
        try {
          target.focus({ preventScroll: true });
          if (typeof snapshot.selectionStart === "number" && typeof target.setSelectionRange === "function") {
            target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd == null ? snapshot.selectionStart : snapshot.selectionEnd);
          }
        } catch (_) {}
      }
    }
  }

  function queueUserTabRender(delay = 60, options = {}) {
    if (userTabRenderTimer) {
      clearTimeout(userTabRenderTimer);
      userTabRenderTimer = 0;
    }
    const wait = Math.max(0, delay || 0);
    userTabRenderTimer = window.setTimeout(() => {
      userTabRenderTimer = 0;
      renderUserTabIfVisible(options || {});
    }, wait);
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
          showInlineToast("Google Sheet berhasil diaktifkan.", "success", 1700);
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
        showInlineToast("Endpoint Google Sheet berhasil disimpan.", "success", 1700);
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
        showInlineToast("Set Kolom Tujuan berhasil disimpan.", "success", 1700);
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
        const helper = (typeof copyPlainTextSafe === 'function')
          ? copyPlainTextSafe
          : ((typeof window !== 'undefined' && window && typeof window.copyPlainTextSafe === 'function')
              ? window.copyPlainTextSafe
              : ((typeof window !== 'undefined' && window && typeof window.__ppCopyPlainTextSafe === 'function')
                  ? window.__ppCopyPlainTextSafe
                  : ((typeof window !== 'undefined' && window && typeof window.copyPlainText === 'function') ? window.copyPlainText : null)));
        const ok = helper ? await helper(fullUrl) : false;
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

  function renderUserTabIfVisible(options = {}) {
    const tab = document.getElementById(USER_TAB_ID);
    if (!tab || tab.style.display === "none") return;

    const signature = getUserTabRenderSignature();
    if (!options.force && signature === lastUserTabRenderSignature) {
      refreshUserConfigState(tab);
      syncTestBankFieldState(tab);
      return;
    }

    if (!options.force && isUserTabBusy(tab)) {
      queueUserTabRender(220, options);
      return;
    }

    const snapshot = captureUserTabUiState(tab);
    tab.innerHTML = buildUserMarkup();
    bindUserTab(tab);
    restoreUserTabUiState(tab, snapshot);
    lastUserTabRenderSignature = signature;
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
    renderUserTabIfVisible({ force: !user.dataset.renderedOnce });
    user.dataset.renderedOnce = "1";
  }

  function bindUserNav(panel) {
    const tabs = panel.querySelector("#ppTabs");
    if (!tabs) return;
    if (panel.__ppGsUserNavBound) return;
    panel.__ppGsUserNavBound = true;
    let userBtn = tabs.querySelector('[data-tab="user"]');
    if (!userBtn) {
      const legacySlot = tabs.querySelector('.pp-staticNav, .pp-nativeNavButton, .pp-navItem');
      userBtn = document.createElement("button");
      userBtn.type = "button";
      userBtn.className = "pp-navItem pp-tabButton";
      userBtn.dataset.tab = "user";
      userBtn.textContent = cleanHeaderText((legacySlot && legacySlot.dataset && legacySlot.dataset.nativeNavText) || (legacySlot && legacySlot.textContent) || "");
      if (legacySlot) legacySlot.replaceWith(userBtn);
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
    queueUserTabRender(0);
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

  function stopBootRetry() {
    if (bootRetryTimer) {
      clearTimeout(bootRetryTimer);
      bootRetryTimer = 0;
    }
    if (bootObserver) {
      try { bootObserver.disconnect(); } catch (_) {}
      bootObserver = null;
    }
  }

  function startBootRetry() {
    if (bootRetryTimer || bootObserver) return;
    const deadlineAt = now() + 15000;
    const retry = () => {
      if (boot()) {
        stopBootRetry();
        return;
      }
      if (now() >= deadlineAt) {
        stopBootRetry();
        return;
      }
      bootRetryTimer = window.setTimeout(retry, document.visibilityState === "hidden" ? 1200 : 420);
    };
    if (typeof MutationObserver === "function" && document.documentElement) {
      bootObserver = new MutationObserver(() => {
        if (boot()) stopBootRetry();
      });
      bootObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    bootRetryTimer = window.setTimeout(retry, 300);
  }

  function boot() {
    const ok = ensurePatchedUi();
    installPanelApproveSourceCapture();
    installApprovalNetworkSync();
    wrapNativeApprovals();
    startWrapWatcher();
    if (ok) scheduleFlush(0);
    return ok;
  }

  hydrateQueueFromStorage();
  onlineHandler = () => scheduleFlush(0);
  flushVisibilityHandler = () => {
    if (document.visibilityState === "visible") scheduleFlush(0);
  };
  window.addEventListener("online", onlineHandler, { passive: true });
  document.addEventListener("visibilitychange", flushVisibilityHandler, { passive: true });

  if (!boot()) {
    startBootRetry();
  }

  window[PATCH_CLEANUP_KEY] = function cleanupUserTabPatch() {
    stopWrapWatcher();
    stopBootRetry();
    if (typeof networkSyncCleanup === "function") {
      try { networkSyncCleanup(); } catch (_) {}
    }
    if (onlineHandler) {
      window.removeEventListener("online", onlineHandler);
      onlineHandler = null;
    }
    if (flushVisibilityHandler) {
      document.removeEventListener("visibilitychange", flushVisibilityHandler);
      flushVisibilityHandler = null;
    }
    if (wrapWatchVisibilityHandler) {
      document.removeEventListener("visibilitychange", wrapWatchVisibilityHandler);
      wrapWatchVisibilityHandler = null;
    }
    window.removeEventListener("focus", startWrapWatcher);
    window.removeEventListener("pagehide", stopWrapWatcher);
    wrapWatchLifecycleBound = false;

    const panel = document.getElementById(PANEL_ID);
    if (panel && approveCaptureHandler) {
      try { panel.removeEventListener("click", approveCaptureHandler, true); } catch (_) {}
      panel.__ppGsApproveCaptureBound = false;
    }
    approveCaptureHandler = null;

    if (originalNative.approveDeposit && window.approveDeposit && window.approveDeposit[WRAP_MARK_KEY]) {
      window.approveDeposit = originalNative.approveDeposit;
    }
    if (originalNative.approveWithdraw && window.approveWithdraw && window.approveWithdraw[WRAP_MARK_KEY]) {
      window.approveWithdraw = originalNative.approveWithdraw;
    }
    if (originalNative.deleteDeposit && window.deleteDeposit && window.deleteDeposit[WRAP_MARK_KEY]) {
      window.deleteDeposit = originalNative.deleteDeposit;
    }
    if (originalNative.deleteWithdraw && window.deleteWithdraw && window.deleteWithdraw[WRAP_MARK_KEY]) {
      window.deleteWithdraw = originalNative.deleteWithdraw;
    }
    window[WRAP_LOCK] = false;
    wrappedSignature = "";
    window.__PP_GS_USER_TAB_PATCH__ = false;
    delete window[PATCH_CLEANUP_KEY];
  };

  window.__PP_GS_USER_TAB_API__ = {
    isGsOn, isAutoCopyOn, setGsOn, setAutoCopyOn, getGsUrls, setGsUrls, getColMap, setColMap, flushSend, sendToGSheetBatch, autoCopyPayload
  };
})();
