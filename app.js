/* ==========================================================================
   PANAMA PURCHASING PIPELINE - COMPLETE WEB APPLICATION ENGINE
   ========================================================================== */

// ── 1. CONFIGURATION & CONSTANTS ──────────────────────────────────────────
const BUYERS = [
  "Ashley Jaen",
  "Daniel Fung",
  "Jessica Cruz",
  "Jorge Chandeck",
  "Julio Arispe",
  "Marian Rovira"
];

const PRODUCT_RANGES = [
  "Accessories",
  "Alcoholic beverages",
  "Books",
  "Childcare",
  "Children clothing",
  "Cosmetics",
  "Decoration",
  "DIY",
  "DPH",
  "Drinks",
  "EGP",
  "Food",
  "Footwear",
  "Furniture",
  "Garden",
  "Home textile",
  "Household appliances",
  "Hygiene",
  "Kitchenware",
  "Leather & bags",
  "Lingerie",
  "Luggage",
  "Men Clothing",
  "Multi Products",
  "Pet products",
  "Shoes",
  "Socks",
  "Stationery",
  "Toys",
  "Women clothing"
];

const STATUSES = [
  "To Negotiate",
  "To Revalue",
  "Negotiated",
  "Ordered",
  "Lost",
  "Cancelled"
];

// ── 2. STATE MANAGEMENT ───────────────────────────────────────────────────
let allDeals = [];
let filteredDeals = [];
let supabaseClient = null;
let stageChartInstance = null;
let activeView = "dashboard";
let currentTheme = localStorage.getItem("app_theme") || "dark";
let isCompactTable = localStorage.getItem("table_density") === "compact";

// Filter State
let filterPeriod = "All Time";
let filterPeriodVal = "";
let filterBuyerVal = "All";
let filterCategoryVal = "All";
let filterSearchVal = "";
let filterStaleOnlyVal = false;
let filterOngoingOnlyVal = false;
let filterStatusVal = "All";

// ── 3. INITIALIZATION ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initLucide();
  initPINLock();
  initDropdowns();
  initModalsAndDrawer();
  initFilters();

  initSupabase();
  await loadDeals();
  applyFiltersAndRender();
});

function initLucide() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

// ── 4. LIGHT / DARK THEME ENGINE ──────────────────────────────────────────
function initTheme() {
  document.documentElement.setAttribute("data-theme", currentTheme);
  updateThemeIcon();

  const toggleBtn = document.getElementById("btnThemeToggle");
  toggleBtn.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem("app_theme", currentTheme);
    updateThemeIcon();
    renderStageChart(); // Re-draw chart with theme colors
    showToast("Theme Changed", `Switched to ${currentTheme} mode`);
  });
}

function updateThemeIcon() {
  const icon = document.getElementById("themeIcon");
  if (icon) {
    icon.setAttribute("data-lucide", currentTheme === "dark" ? "sun" : "moon");
    initLucide();
  }
}

// ── 5. MULTI-USER ACCESS CONTROL (TOBY, AHMED, CARLOS) ────────────────────
const PIN_TO_USER = {
  "2309": "Toby",
  "0147": "Ahmed",
  "7410": "Carlos"
};

let currentUser = sessionStorage.getItem("pipeline_user") || "Toby";

function isAdmin() {
  return currentUser === "Toby";
}

let globalAuditLogs = JSON.parse(localStorage.getItem("panama_audit_logs") || "[]");

function recordAuditLog(action, supplier, details, dealId = null) {
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const entry = {
    id: Date.now(),
    dealId: dealId,
    timestamp: timeStr,
    user: currentUser || "Unknown",
    action: action,
    supplier: supplier || "Pipeline",
    details: details || ""
  };
  globalAuditLogs.unshift(entry);
  if (globalAuditLogs.length > 500) globalAuditLogs.pop();
  localStorage.setItem("panama_audit_logs", JSON.stringify(globalAuditLogs));
}

function renderGlobalAuditLogs() {
  const container = document.getElementById("globalAuditLogList");
  if (!container) return;

  if (!globalAuditLogs || globalAuditLogs.length === 0) {
    container.innerHTML = `<div class="comments-log-empty">No change logs recorded yet.</div>`;
    return;
  }

  container.innerHTML = globalAuditLogs.map(log => `
    <div class="log-item ${log.dealId ? 'log-item-clickable' : ''}" ${log.dealId ? `onclick="openDealFromLog(${log.dealId})"` : ''} title="${log.dealId ? 'Click to open Detection Details' : ''}">
      <div class="log-item-header">
        <span class="log-author-tag">
          <i data-lucide="${log.user === 'Toby' ? 'crown' : 'user'}"></i>
          <strong>${escapeHtml(log.user)}</strong>
          <span style="font-weight:400; color:var(--text-dim);">· ${escapeHtml(log.action)}</span>
        </span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          ${log.dealId ? `<span class="badge" style="background:var(--primary-light); color:var(--primary); font-size:0.7rem; font-weight:700; display:inline-flex; align-items:center; gap:3px;"><i data-lucide="external-link" style="width:11px; height:11px;"></i>View Deal</span>` : ''}
          <span class="log-timestamp">${escapeHtml(log.timestamp)}</span>
        </div>
      </div>
      <div class="log-item-text" style="font-size:0.88rem; font-weight:700; color:var(--text-main); margin-bottom:2px;">
        ${escapeHtml(log.supplier)}
      </div>
      <div class="log-item-text" style="color:var(--text-muted); font-size:0.8rem;">
        ${escapeHtml(log.details)}
      </div>
    </div>
  `).join("");
  initLucide();
}

window.openDealFromLog = (dealId) => {
  const auditModal = document.getElementById("auditModal");
  if (auditModal) auditModal.classList.remove("open");
  const deal = allDeals.find(d => d.id === dealId);
  if (deal) openDrawer(deal);
};

function updateAdminUI() {
  const userBadge = document.getElementById("activeUserName");
  if (userBadge) {
    userBadge.textContent = isAdmin() ? `👑 ${currentUser} (Admin)` : `👤 ${currentUser}`;
  }

  const deleteBtn = document.getElementById("btnDeleteDrawerDeal");
  if (deleteBtn) {
    deleteBtn.style.display = isAdmin() ? "inline-flex" : "none";
  }

  const clearLogsBtn = document.getElementById("btnClearAuditLogs");
  if (clearLogsBtn) {
    clearLogsBtn.style.display = isAdmin() ? "inline-block" : "none";
  }

  const settingsBtn = document.getElementById("btnOpenSettings");
  if (settingsBtn) {
    if (isAdmin()) {
      settingsBtn.style.opacity = "1";
      settingsBtn.title = "Cloud Database & Settings (Admin)";
    } else {
      settingsBtn.style.opacity = "0.6";
      settingsBtn.title = "Cloud Database & Settings (Admin Only - Toby)";
    }
  }
}

function initPINLock() {
  const pinOverlay = document.getElementById("pinOverlay");
  const pinForm = document.getElementById("pinForm");
  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");
  const btnLockApp = document.getElementById("btnLockApp");

  const isUnlocked = sessionStorage.getItem("pipeline_unlocked") === "true";
  if (isUnlocked && currentUser) {
    pinOverlay.classList.add("unlocked");
    pinOverlay.style.display = "none";
    updateAdminUI();
  }

  function attemptUnlock() {
    const enteredPin = pinInput.value.trim();
    if (!enteredPin) return;

    const matchedUser = PIN_TO_USER[enteredPin];

    if (matchedUser) {
      currentUser = matchedUser;
      sessionStorage.setItem("pipeline_unlocked", "true");
      sessionStorage.setItem("pipeline_user", currentUser);
      updateAdminUI();

      pinOverlay.classList.add("unlocked");
      pinOverlay.style.display = "none";
      pinError.style.display = "none";
      pinInput.value = "";
      showToast("Workspace Unlocked", `Welcome back, ${currentUser}!`);
    } else {
      pinError.textContent = "Incorrect PIN. Please check and try again.";
      pinError.style.display = "block";
      pinInput.value = "";
      pinInput.focus();
    }
  }

  // Handle Enter keypress explicitly
  pinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      attemptUnlock();
    }
  });

  // Auto-submit as soon as 4 digits are typed
  pinInput.addEventListener("input", () => {
    if (pinInput.value.trim().length === 4) {
      attemptUnlock();
    }
  });

  pinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    attemptUnlock();
  });

  btnLockApp.addEventListener("click", () => {
    sessionStorage.removeItem("pipeline_unlocked");
    pinOverlay.classList.remove("unlocked");
    pinOverlay.style.display = "flex";
    pinInput.value = "";
    setTimeout(() => pinInput.focus(), 200);
  });
}

// ── 6. SUPABASE CLOUD SYNC & DATA PERSISTENCE ─────────────────────────────
const DEFAULT_SUPABASE_URL = "https://kcqycpkwtadmyslkyjxx.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjcXljcGt3dGFkbXlzbGt5anh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MjMyNzQsImV4cCI6MjEwMTk5OTI3NH0.AyCa9dowfQZwiiRItFie_liXEBFbD0HWMi2JI9mfh08";

function initSupabase() {
  const url = localStorage.getItem("supabase_url") || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem("supabase_key") || DEFAULT_SUPABASE_KEY;
  const connStatus = document.getElementById("connectionStatus");

  if (url && key && window.supabase) {
    try {
      supabaseClient = supabase.createClient(url, key);
      connStatus.className = "connection-status online";
      connStatus.querySelector(".status-text").textContent = "Cloud Sync Active";

      // Listen for real-time changes
      supabaseClient
        .channel("public:detections")
        .on("postgres_changes", { event: "*", schema: "public", table: "detections" }, async () => {
          await fetchFromSupabase();
          applyFiltersAndRender();
          showToast("Live Sync", "Database synchronized with cloud");
        })
        .subscribe();
    } catch (err) {
      console.error("Supabase init error:", err);
      connStatus.className = "connection-status offline";
      connStatus.querySelector(".status-text").textContent = "Local Mode";
    }
  } else {
    connStatus.className = "connection-status offline";
    connStatus.querySelector(".status-text").textContent = "Local Mode";
  }
}

async function loadDeals() {
  if (supabaseClient) {
    const success = await fetchFromSupabase();
    if (success) return;
  }

  // Fallback: local storage
  const local = localStorage.getItem("panama_pipeline_deals");
  if (local) {
    try {
      allDeals = JSON.parse(local);
      return;
    } catch (e) {}
  }

  // Fallback: initial_data.json
  try {
    const res = await fetch("initial_data.json");
    if (res.ok) {
      allDeals = await res.json();
      localStorage.setItem("panama_pipeline_deals", JSON.stringify(allDeals));
    }
  } catch (err) {
    console.warn("Could not fetch initial_data.json:", err);
    allDeals = [];
  }
}

async function fetchFromSupabase() {
  if (!supabaseClient) return false;
  try {
    const { data, error } = await supabaseClient
      .from("detections")
      .select("*")
      .order("id", { ascending: true });
    
    if (error) throw error;
    if (data) {
      allDeals = data;
      localStorage.setItem("panama_pipeline_deals", JSON.stringify(allDeals));
      return true;
    }
  } catch (e) {
    console.error("Supabase query error:", e);
  }
  return false;
}

async function saveDealRecord(deal) {
  deal.offer_value = parseFloat(deal.offer_value) || 0;
  
  if (deal.id) {
    // Update existing
    const idx = allDeals.findIndex(d => d.id === deal.id);
    if (idx !== -1) {
      allDeals[idx] = { ...allDeals[idx], ...deal };
    }
    
    if (supabaseClient) {
      await supabaseClient.from("detections").update(deal).eq("id", deal.id);
    }
  } else {
    // Create new
    const maxId = allDeals.reduce((max, d) => Math.max(max, d.id || 0), 0);
    deal.id = maxId + 1;
    allDeals.push(deal);

    if (supabaseClient) {
      await supabaseClient.from("detections").insert([deal]);
    }
  }

  localStorage.setItem("panama_pipeline_deals", JSON.stringify(allDeals));
  applyFiltersAndRender();
}

// ── 7. BUSINESS LOGIC (EXCEL EQUIVALENT FORMULAS) ─────────────────────────
function getDaysOpen(d) {
  if (!d.entry_date) return "";
  
  // Closed stages
  if (d.status === "Ordered" || d.status === "Lost" || d.status === "Cancelled" || d.propo_canceled || d.rejected_affair) {
    return "Closed";
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  // If Offer Number & Offer Date exist -> delay from Offer Reception Date
  if (d.offer_number && d.offer_date) {
    const offD = new Date(d.offer_date);
    if (!isNaN(offD)) return Math.max(0, Math.floor((today - offD) / (1000 * 60 * 60 * 24)));
  }

  // Else if Affaire Date exists -> delay from Affaire Creation Date
  if (d.affaire_date) {
    const affD = new Date(d.affaire_date);
    if (!isNaN(affD)) return Math.max(0, Math.floor((today - affD) / (1000 * 60 * 60 * 24)));
  }

  // Fallback: Entry Date
  const entD = new Date(d.entry_date);
  if (!isNaN(entD)) return Math.max(0, Math.floor((today - entD) / (1000 * 60 * 60 * 24)));

  return 0;
}

function getStaleAlert(d) {
  const days = getDaysOpen(d);
  if (days === "Closed" || days === "") return "";

  if (d.offer_received || d.offer_number) {
    return days > 14 ? "⚠ STALE OFFER (>14d)" : "";
  }
  if (d.affaire_created || d.affaire_sent) {
    return days > 5 ? "⚠ STALE AFFAIRE (>5d)" : "";
  }
  return days > 5 ? "⚠ STALE DETECTION (>5d)" : "";
}

function getStageCategory(d) {
  if (d.propo_canceled || d.rejected_affair || d.status === "Lost" || d.status === "Cancelled") {
    return "closed";
  }
  if (d.status === "Ordered") {
    return "ordered";
  }
  if (d.status === "Negotiated") {
    return "forecast";
  }
  if (d.offer_received || d.status === "To Negotiate" || d.status === "To Revalue") {
    return "offer_received";
  }
  if (d.affaire_sent || d.affaire_created) {
    return "affaire_sent";
  }
  return "detection";
}

// ── 8. DROPDOWNS & FILTER INITIALIZATION ──────────────────────────────────
function initDropdowns() {
  const catSelect = document.getElementById("filterCategory");
  const addCatSelect = document.getElementById("addCategory");
  const editCatSelect = document.getElementById("editCategory");

  PRODUCT_RANGES.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);

    addCatSelect.appendChild(opt.cloneNode(true));
    editCatSelect.appendChild(opt.cloneNode(true));
  });
}

function initFilters() {
  const pType = document.getElementById("filterPeriodType");
  const pVal = document.getElementById("filterPeriodValue");
  const bSelect = document.getElementById("filterBuyer");
  const cSelect = document.getElementById("filterCategory");
  const sInput = document.getElementById("searchInput");
  const staleToggle = document.getElementById("filterStaleOnly");

  pType.addEventListener("change", () => {
    filterPeriod = pType.value;
    updatePeriodValueOptions();
    applyFiltersAndRender();
  });

  pVal.addEventListener("change", () => {
    filterPeriodVal = pVal.value;
    applyFiltersAndRender();
  });

  bSelect.addEventListener("change", () => {
    filterBuyerVal = bSelect.value;
    applyFiltersAndRender();
  });

  cSelect.addEventListener("change", () => {
    filterCategoryVal = cSelect.value;
    applyFiltersAndRender();
  });

  sInput.addEventListener("input", (e) => {
    filterSearchVal = e.target.value.toLowerCase().trim();
    const hSearch = document.getElementById("headerSearchInput");
    if (hSearch) hSearch.value = e.target.value;
    applyFiltersAndRender();
  });

  const headerSearchInput = document.getElementById("headerSearchInput");
  if (headerSearchInput) {
    headerSearchInput.addEventListener("input", (e) => {
      filterSearchVal = e.target.value.toLowerCase().trim();
      if (sInput) sInput.value = e.target.value;
      applyFiltersAndRender();
    });
  }

  staleToggle.addEventListener("change", (e) => {
    filterStaleOnlyVal = e.target.checked;
    applyFiltersAndRender();
  });

  const ongoingToggle = document.getElementById("filterOngoingOnly");
  if (ongoingToggle) {
    ongoingToggle.addEventListener("change", (e) => {
      filterOngoingOnlyVal = e.target.checked;
      applyFiltersAndRender();
    });
  }

  const statusSelect = document.getElementById("filterStatus");
  if (statusSelect) {
    statusSelect.addEventListener("change", (e) => {
      filterStatusVal = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Table Density Toggle
  const btnToggleDensity = document.getElementById("btnToggleDensity");
  const tableEl = document.getElementById("mainPipelineTable");
  const densityLabel = document.getElementById("densityLabel");

  if (isCompactTable) {
    tableEl.classList.add("compact");
    densityLabel.textContent = "Comfortable Mode";
  }

  btnToggleDensity.addEventListener("click", () => {
    isCompactTable = !isCompactTable;
    tableEl.classList.toggle("compact", isCompactTable);
    densityLabel.textContent = isCompactTable ? "Comfortable Mode" : "Compact Mode";
    localStorage.setItem("table_density", isCompactTable ? "compact" : "comfortable");
  });
}

function updatePeriodValueOptions() {
  const pVal = document.getElementById("filterPeriodValue");
  pVal.innerHTML = "";

  if (filterPeriod === "All Time") {
    pVal.classList.add("hidden");
    filterPeriodVal = "";
    return;
  }

  pVal.classList.remove("hidden");

  const dates = allDeals.map(d => d.entry_date).filter(Boolean);
  const uniqueVals = new Set();

  dates.forEach(dStr => {
    const d = new Date(dStr);
    if (!isNaN(d)) {
      if (filterPeriod === "Monthly") {
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        uniqueVals.add(ym);
      } else if (filterPeriod === "Weekly") {
        const week = getISOWeek(d);
        uniqueVals.add(`W${String(week).padStart(2, "0")}`);
      }
    }
  });

  const sorted = Array.from(uniqueVals).sort().reverse();
  sorted.forEach(val => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    pVal.appendChild(opt);
  });

  filterPeriodVal = sorted[0] || "";
}

function getISOWeek(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function applyFiltersAndRender() {
  // Calculate ongoing deals count for badge
  const ongoingCount = allDeals.filter(d => getDaysOpen(d) !== "Closed").length;
  const ongoingBadge = document.getElementById("ongoingCountBadge");
  if (ongoingBadge) ongoingBadge.textContent = ongoingCount;

  filteredDeals = allDeals.filter(d => {
    // Period filter
    if (filterPeriod === "Monthly" && filterPeriodVal) {
      if (!d.entry_date || !d.entry_date.startsWith(filterPeriodVal)) return false;
    } else if (filterPeriod === "Weekly" && filterPeriodVal) {
      if (!d.entry_date) return false;
      const w = `W${String(getISOWeek(new Date(d.entry_date))).padStart(2, "0")}`;
      if (w !== filterPeriodVal) return false;
    }

    // Buyer filter
    if (filterBuyerVal !== "All" && d.buyer !== filterBuyerVal) return false;

    // Category filter
    if (filterCategoryVal !== "All" && d.product_range !== filterCategoryVal) return false;

    // Search input
    if (filterSearchVal) {
      const match = (
        (d.supplier && d.supplier.toLowerCase().includes(filterSearchVal)) ||
        (d.product && d.product.toLowerCase().includes(filterSearchVal)) ||
        (d.affaire_number && String(d.affaire_number).includes(filterSearchVal)) ||
        (d.offer_number && String(d.offer_number).includes(filterSearchVal)) ||
        (d.notes && d.notes.toLowerCase().includes(filterSearchVal))
      );
      if (!match) return false;
    }

    // Ongoing only filter (excludes all closed, lost, cancelled)
    if (filterOngoingOnlyVal) {
      if (getDaysOpen(d) === "Closed") return false;
    }

    // Stale filter
    if (filterStaleOnlyVal) {
      if (!getStaleAlert(d)) return false;
    }

    // Status filter
    if (filterStatusVal !== "All") {
      if (filterStatusVal === "Detection") {
        if (d.affaire_created || d.status) return false;
      } else if (filterStatusVal === "Affaire Sent") {
        if (!d.affaire_sent || d.offer_received) return false;
      } else if (filterStatusVal === "Offer Received") {
        if (!d.offer_received || d.status === "Negotiated" || d.status === "Ordered" || d.status === "Lost" || d.status === "Cancelled") return false;
      } else if (filterStatusVal === "propo_canceled") {
        if (!d.propo_canceled) return false;
      } else if (filterStatusVal === "rejected_affair") {
        if (!d.rejected_affair) return false;
      } else {
        if (d.status !== filterStatusVal) return false;
      }
    }

    return true;
  });

  renderDashboard();
  renderTable();
  initLucide();
}

// ── 9. RENDER: DASHBOARD VIEW ─────────────────────────────────────────────
function renderDashboard() {
  let totalDetections = filteredDeals.length;
  let activeValue = 0;
  let forecastValue = 0;
  let forecastDeals = 0;
  let orderedValue = 0;
  let orderedDeals = 0;
  let staleDealsCount = 0;

  filteredDeals.forEach(d => {
    const days = getDaysOpen(d);
    const val = parseFloat(d.offer_value) || 0;

    if (days !== "Closed") {
      activeValue += val;
    }
    if (d.status === "Negotiated") {
      forecastValue += val;
      forecastDeals++;
    }
    if (d.status === "Ordered") {
      orderedValue += val;
      orderedDeals++;
    }
    if (getStaleAlert(d)) {
      staleDealsCount++;
    }
  });

  const elTot = document.getElementById("kpiTotalDetections"); if (elTot) elTot.textContent = totalDetections;
  const elAct = document.getElementById("kpiActiveValue"); if (elAct) elAct.textContent = formatCurrency(activeValue);
  const elFVal = document.getElementById("kpiForecastValue"); if (elFVal) elFVal.textContent = formatCurrency(forecastValue);
  const elFDeals = document.getElementById("kpiForecastDeals"); if (elFDeals) elFDeals.textContent = `${forecastDeals} Forecast Deals`;
  const elOVal = document.getElementById("kpiOrderedValue"); if (elOVal) elOVal.textContent = formatCurrency(orderedValue);
  const elODeals = document.getElementById("kpiOrderedDeals"); if (elODeals) elODeals.textContent = `${orderedDeals} Closed Orders`;
  const elStale = document.getElementById("kpiStaleDeals"); if (elStale) elStale.textContent = staleDealsCount;
  const elBadge = document.getElementById("staleCountBadge"); if (elBadge) elBadge.textContent = staleDealsCount;

  // Buyer Funnel Table
  const tbody = document.getElementById("buyerFunnelBody");
  const tfoot = document.getElementById("buyerFunnelFoot");
  tbody.innerHTML = "";

  let tTot = 0, tAff = 0, tSent = 0, tOff = 0, tProg = 0, tFVal = 0, tOVal = 0, tAVal = 0, tOrd = 0;

  BUYERS.forEach(buyer => {
    const bDeals = filteredDeals.filter(d => d.buyer === buyer);
    const detections = bDeals.length;
    const affaires = bDeals.filter(d => d.affaire_created).length;
    const sent = bDeals.filter(d => d.affaire_sent).length;
    const offers = bDeals.filter(d => d.offer_received).length;
    const inProg = bDeals.filter(d => d.status === "To Negotiate" || d.status === "To Revalue").length;
    const fDeals = bDeals.filter(d => d.status === "Negotiated").length;
    const fVal = bDeals.filter(d => d.status === "Negotiated").reduce((sum, d) => sum + (parseFloat(d.offer_value) || 0), 0);
    const ordDeals = bDeals.filter(d => d.status === "Ordered").length;
    const ordVal = bDeals.filter(d => d.status === "Ordered").reduce((sum, d) => sum + (parseFloat(d.offer_value) || 0), 0);
    const actVal = bDeals.filter(d => getDaysOpen(d) !== "Closed").reduce((sum, d) => sum + (parseFloat(d.offer_value) || 0), 0);
    const rate = detections > 0 ? ((ordDeals / detections) * 100).toFixed(1) + "%" : "0.0%";

    let signal = `<span class="badge badge-navy">⚫ No Offers</span>`;
    if (offers > 0) {
      if (fDeals > 0) {
        signal = `<span class="badge badge-forecast">🔮 ${fDeals} Forecast</span>`;
      } else if (ordDeals > 0) {
        signal = `<span class="badge badge-ordered">🟢 ${ordDeals} Ordered</span>`;
      } else {
        signal = `<span class="badge badge-stale">🟠 ${offers} Recv</span>`;
      }
    }

    tTot += detections;
    tAff += affaires;
    tSent += sent;
    tOff += offers;
    tProg += inProg;
    tFVal += fVal;
    tOVal += ordVal;
    tAVal += actVal;
    tOrd += ordDeals;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${buyer}</strong></td>
      <td class="text-center font-bold">${detections}</td>
      <td class="text-center">${affaires}</td>
      <td class="text-center">${sent}</td>
      <td class="text-center font-bold">${offers}</td>
      <td class="text-center">${inProg}</td>
      <td class="text-center text-green font-bold">${formatCurrency(fVal)}</td>
      <td class="text-center font-bold ${ordDeals > 0 ? 'text-green' : ''}">${ordDeals}</td>
      <td class="text-center text-green font-bold">${formatCurrency(ordVal)}</td>
      <td class="text-center text-green font-bold">${formatCurrency(actVal)}</td>
      <td class="text-center">${rate}</td>
      <td class="text-center">${signal}</td>
    `;
    tbody.appendChild(tr);
  });

  const totRate = tTot > 0 ? ((tOrd / tTot) * 100).toFixed(1) + "%" : "0.0%";
  tfoot.innerHTML = `
    <tr>
      <td>TEAM TOTAL</td>
      <td class="text-center">${tTot}</td>
      <td class="text-center">${tAff}</td>
      <td class="text-center">${tSent}</td>
      <td class="text-center">${tOff}</td>
      <td class="text-center">${tProg}</td>
      <td class="text-center">${formatCurrency(tFVal)}</td>
      <td class="text-center font-bold text-green">${tOrd}</td>
      <td class="text-center">${formatCurrency(tOVal)}</td>
      <td class="text-center">${formatCurrency(tAVal)}</td>
      <td class="text-center">${totRate}</td>
      <td class="text-center">⭐ Team Signal</td>
    </tr>
  `;

  // Status Breakdown
  const statusTbody = document.getElementById("statusBreakdownBody");
  if (statusTbody) {
    statusTbody.innerHTML = "";
    STATUSES.forEach(st => {
      const sDeals = filteredDeals.filter(d => d.status === st);
      const count = sDeals.length;
      const pct = totalDetections > 0 ? ((count / totalDetections) * 100).toFixed(1) + "%" : "0.0%";
      const val = sDeals.reduce((sum, d) => sum + (parseFloat(d.offer_value) || 0), 0);
      
      const activeDays = sDeals.map(getDaysOpen).filter(d => typeof d === "number");
      const avgDays = activeDays.length > 0 ? Math.round(activeDays.reduce((a,b)=>a+b, 0) / activeDays.length) : "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${st}</strong></td>
        <td class="text-center font-bold">${count}</td>
        <td class="text-center">${pct}</td>
        <td class="text-right text-green font-bold">${formatCurrency(val)}</td>
        <td class="text-center">${avgDays}</td>
      `;
      statusTbody.appendChild(tr);
    });
  }

  // Category Performance
  const catTbody = document.getElementById("categoryPerformanceBody");
  if (catTbody) {
    catTbody.innerHTML = "";
    PRODUCT_RANGES.forEach(cat => {
      const cDeals = filteredDeals.filter(d => d.product_range === cat);
      if (cDeals.length === 0) return;

      const det = cDeals.length;
      const off = cDeals.filter(d => d.offer_received).length;
      const ord = cDeals.filter(d => d.status === "Ordered").length;
      const val = cDeals.reduce((sum, d) => sum + (parseFloat(d.offer_value) || 0), 0);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${cat}</strong></td>
        <td class="text-center font-bold">${det}</td>
        <td class="text-center">${off}</td>
        <td class="text-center">${ord}</td>
        <td class="text-right text-green font-bold">${formatCurrency(val)}</td>
      `;
      catTbody.appendChild(tr);
    });
  }

  renderStageChart();
}

function renderStageChart() {
  const canvas = document.getElementById("stageChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  const stageCounts = {
    "Detection": 0,
    "Affaire Sent": 0,
    "Offer Recv": 0,
    "Forecast": 0,
    "Ordered": 0,
    "Closed/Lost": 0
  };

  const stageValues = {
    "Detection": 0,
    "Affaire Sent": 0,
    "Offer Recv": 0,
    "Forecast": 0,
    "Ordered": 0,
    "Closed/Lost": 0
  };

  filteredDeals.forEach(d => {
    const stage = getStageCategory(d);
    const val = parseFloat(d.offer_value) || 0;
    if (stage === "detection") { stageCounts["Detection"]++; stageValues["Detection"] += val; }
    else if (stage === "affaire_sent") { stageCounts["Affaire Sent"]++; stageValues["Affaire Sent"] += val; }
    else if (stage === "offer_received") { stageCounts["Offer Recv"]++; stageValues["Offer Recv"] += val; }
    else if (stage === "forecast") { stageCounts["Forecast"]++; stageValues["Forecast"] += val; }
    else if (stage === "ordered") { stageCounts["Ordered"]++; stageValues["Ordered"] += val; }
    else { stageCounts["Closed/Lost"]++; stageValues["Closed/Lost"] += val; }
  });

  // Populate Stage Metrics Breakdown Table below Chart
  const breakdownTbody = document.getElementById("stageBreakdownBody");
  if (breakdownTbody) {
    const totalDeals = filteredDeals.length;
    breakdownTbody.innerHTML = Object.keys(stageCounts).map(st => {
      const cnt = stageCounts[st];
      const val = stageValues[st];
      const pct = totalDeals > 0 ? ((cnt / totalDeals) * 100).toFixed(1) + "%" : "0.0%";
      return `
        <tr>
          <td><strong>${st}</strong></td>
          <td class="text-center font-bold">${cnt}</td>
          <td class="text-right font-mono" style="font-weight:700; color:var(--accent-green);">${val > 0 ? formatCurrency(val) : "—"}</td>
          <td class="text-center font-mono">${pct}</td>
        </tr>
      `;
    }).join("");
  }

  if (stageChartInstance) {
    stageChartInstance.destroy();
  }

  const isDark = currentTheme === "dark";
  const legendColor = isDark ? "#94A3B8" : "#475569";
  const borderColor = isDark ? "#111827" : "#FFFFFF";

  stageChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(stageCounts),
      datasets: [{
        data: Object.values(stageCounts),
        backgroundColor: [
          "#38BDF8", // Blue
          "#A855F7", // Purple
          "#EC4899", // Pink
          "#818CF8", // Indigo
          "#10B981", // Green
          "#F43F5E"  // Rose
        ],
        borderWidth: 2,
        borderColor: borderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: legendColor, font: { family: "Plus Jakarta Sans", size: 11, weight: "600" } }
        }
      },
      cutout: "68%"
    }
  });
}

// ── 11. RENDER: TABLE GRID VIEW ───────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById("pipelineTableBody");
  tbody.innerHTML = "";

  document.getElementById("tableFilteredCount").textContent = filteredDeals.length;
  document.getElementById("tableTotalCount").textContent = allDeals.length;

  if (filteredDeals.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-state">
          <i data-lucide="inbox"></i>
          <div>No deals found matching your criteria.</div>
        </td>
      </tr>
    `;
    return;
  }

  filteredDeals.forEach((deal, idx) => {
    const days = getDaysOpen(deal);
    const stale = getStaleAlert(deal);
    const isClosed = days === "Closed";

    let delayClass = "badge-green";
    if (isClosed) delayClass = "badge-stale";
    else if (typeof days === "number") {
      if (days > 14) delayClass = "badge-rose";
      else if (days > 7) delayClass = "badge-amber";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="font-mono" style="color:var(--text-dim); font-size:0.75rem;">${idx + 1}</td>
      <td class="font-mono">${escapeHtml(deal.entry_date || "—")}</td>
      <td class="font-semibold">${escapeHtml(deal.buyer)}</td>
      <td class="font-bold">${escapeHtml(deal.supplier)}</td>
      <td>${escapeHtml(deal.product)}</td>
      <td><span class="badge" style="background:var(--bg-card); border:1px solid var(--border-subtle); font-size:0.75rem;">${escapeHtml(deal.product_range || "General")}</span></td>
      <td class="text-center font-mono">${escapeHtml(deal.affaire_number || "—")}</td>
      <td class="text-center font-mono">${escapeHtml(deal.offer_number || "—")}</td>
      <td class="text-right font-mono" style="font-weight:700; color:var(--accent-green);">${deal.offer_value > 0 ? formatCurrency(deal.offer_value) : "—"}</td>
      <td class="text-center">${deal.status ? `<span class="badge badge-primary">${escapeHtml(deal.status)}</span>` : `<span class="badge badge-gray">Draft</span>`}</td>
      <td class="text-center">${stale ? `<span class="badge badge-stale">${stale}</span>` : `<span class="badge ${delayClass}">${days === "Closed" ? "Closed" : days + "d"}</span>`}</td>
      <td class="text-center" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.75rem; color:var(--text-dim);">${escapeHtml(deal.notes || "—")}</td>
    `;
    tr.addEventListener("click", () => openDrawer(deal));
    tbody.appendChild(tr);
  });
}

window.openDrawerById = (id) => {
  const deal = allDeals.find(d => d.id === id);
  if (deal) openDrawer(deal);
};

// ── 12. TAB SWITCHING & MODALS / DRAWER ────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      activeView = tab.dataset.view;
      document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
      
      if (activeView === "dashboard") document.getElementById("viewDashboard").classList.add("active");
      else if (activeView === "kanban") document.getElementById("viewKanban").classList.add("active");
      else if (activeView === "table") document.getElementById("viewTable").classList.add("active");

      initLucide();
    });
  });
}

function initModalsAndDrawer() {
  const addModal = document.getElementById("addDetectionModal");
  const addForm = document.getElementById("addDetectionForm");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const settingsModal = document.getElementById("settingsModal");

  // 1. Add Detection (Excel Rules Alignment)
  document.getElementById("btnOpenAddModal").addEventListener("click", () => {
    addForm.reset();
    document.getElementById("addEntryDate").value = new Date().toISOString().split("T")[0];
    addModal.classList.add("open");
    initLucide();
  });

  document.getElementById("btnCloseAddModal").addEventListener("click", () => addModal.classList.remove("open"));
  document.getElementById("btnCancelAddModal").addEventListener("click", () => addModal.classList.remove("open"));

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Matching Excel rules: creates clean draft detection
    const newDeal = {
      id: null,
      entry_date: document.getElementById("addEntryDate").value,
      buyer: document.getElementById("addBuyer").value,
      supplier: document.getElementById("addSupplier").value.trim(),
      product: document.getElementById("addProduct").value.trim(),
      product_range: document.getElementById("addCategory").value,
      notes: document.getElementById("addNotes").value.trim(),
      
      // Auto-initialized fields
      propo_canceled: false,
      affaire_created: false,
      affaire_date: null,
      affaire_number: null,
      rejected_affair: false,
      affaire_sent: false,
      offer_received: false,
      offer_date: null,
      offer_number: null,
      offer_value: 0,
      status: ""
    };

    await saveDealRecord(newDeal);
    recordAuditLog("Created Deal", newDeal.supplier, `New detection added by ${currentUser} · Buyer: ${newDeal.buyer}`, newDeal.id);
    addModal.classList.remove("open");
    showToast("Detection Created", `${newDeal.supplier} added to pipeline.`);
  });

  // 2. Slide-Over Detail & Edit Drawer
  document.getElementById("btnCloseDrawer").addEventListener("click", () => drawerOverlay.classList.remove("open"));
  document.getElementById("btnCancelDrawer").addEventListener("click", () => drawerOverlay.classList.remove("open"));

  // Checkbox auto-date stamping & inline fields in drawer
  const editAffaireCreated = document.getElementById("editAffaireCreated");
  const editAffaireDate = document.getElementById("editAffaireDate");
  const editAffaireNumber = document.getElementById("editAffaireNumber");
  const affaireInlineFields = document.getElementById("affaireInlineFields");

  editAffaireCreated.addEventListener("change", () => {
    if (editAffaireCreated.checked) {
      if (affaireInlineFields) affaireInlineFields.style.display = "block";
      if (!editAffaireDate.value) {
        editAffaireDate.value = new Date().toISOString().split("T")[0];
      }
      setTimeout(() => editAffaireNumber.focus(), 150);
    } else {
      if (affaireInlineFields) affaireInlineFields.style.display = "none";
    }
  });

  const editOfferReceived = document.getElementById("editOfferReceived");
  const editOfferDate = document.getElementById("editOfferDate");
  const editOfferNumber = document.getElementById("editOfferNumber");
  const offerInlineFields = document.getElementById("offerInlineFields");

  editOfferReceived.addEventListener("change", () => {
    if (editOfferReceived.checked) {
      if (offerInlineFields) offerInlineFields.style.display = "block";
      if (!editOfferDate.value) {
        editOfferDate.value = new Date().toISOString().split("T")[0];
      }
      setTimeout(() => editOfferNumber.focus(), 150);
    } else {
      if (offerInlineFields) offerInlineFields.style.display = "none";
    }
  });

  // Comments / Activity Log Posting
  const btnAddComment = document.getElementById("btnAddComment");
  const newCommentInput = document.getElementById("newCommentInput");

  btnAddComment.addEventListener("click", () => {
    const text = newCommentInput.value.trim();
    if (!text || !currentDrawerDeal) return;

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().substring(0, 5);
    const logHeader = `[${dateStr} ${timeStr} · ${currentUser}]`;
    const newEntry = `${logHeader}: ${text}`;

    if (currentDrawerDeal.notes && currentDrawerDeal.notes.trim()) {
      currentDrawerDeal.notes = `${currentDrawerDeal.notes.trim()}\n${newEntry}`;
    } else {
      currentDrawerDeal.notes = newEntry;
    }

    newCommentInput.value = "";
    renderCommentLogs(currentDrawerDeal.notes);
    recordAuditLog("Added Comment", currentDrawerDeal.supplier, `Note: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`, currentDrawerDeal.id);
    showToast("Comment Logged", `Added log by ${currentUser}`);
  });

  // Save drawer edits
  document.getElementById("btnSaveDrawer").addEventListener("click", async () => {
    const id = parseInt(document.getElementById("editDealId").value);
    const deal = allDeals.find(d => d.id === id);
    if (!deal) return;

    const affCreated = document.getElementById("editAffaireCreated").checked;
    const affNum = document.getElementById("editAffaireNumber").value.trim();
    const offRecv = document.getElementById("editOfferReceived").checked;
    const offNum = document.getElementById("editOfferNumber").value.trim();

    if (affCreated && !affNum) {
      alert("⚠️ Mandatory: Please enter the Affaire Number before saving.");
      const progTab = document.querySelector('.drawer-tab[data-drawer-tab="tabProgression"]');
      if (progTab) progTab.click();
      document.getElementById("editAffaireNumber").focus();
      return;
    }

    if (offRecv && !offNum) {
      alert("⚠️ Mandatory: Please enter the Offer Number before saving.");
      const offTab = document.querySelector('.drawer-tab[data-drawer-tab="tabFinancials"]');
      if (offTab) offTab.click();
      document.getElementById("editOfferNumber").focus();
      return;
    }

    deal.entry_date = document.getElementById("editEntryDate").value;
    deal.buyer = document.getElementById("editBuyer").value;
    deal.supplier = document.getElementById("editSupplier").value.trim();
    deal.product = document.getElementById("editProduct").value.trim();
    deal.product_range = document.getElementById("editCategory").value;

    deal.affaire_created = affCreated;
    deal.affaire_sent = document.getElementById("editAffaireSent").checked;
    deal.offer_received = offRecv;
    deal.propo_canceled = document.getElementById("editPropoCanceled").checked;
    deal.rejected_affair = document.getElementById("editRejectedAffair").checked;

    deal.affaire_number = affNum || null;
    deal.affaire_date = document.getElementById("editAffaireDate").value || null;
    deal.offer_number = offNum || null;
    deal.offer_date = document.getElementById("editOfferDate").value || null;
    deal.offer_value = parseFloat(document.getElementById("editOfferValue").value) || 0;
    deal.status = document.getElementById("editStatus").value;

    await saveDealRecord(deal);
    recordAuditLog("Updated Deal", deal.supplier, `Stage: ${getDealStage(deal)} · Value: $${deal.offer_value || 0} by ${currentUser}`, deal.id);
    drawerOverlay.classList.remove("open");
    showToast("Changes Saved", `${deal.supplier} updated successfully.`);
  });

  // Admin Delete Deal button
  const btnDeleteDrawer = document.getElementById("btnDeleteDrawerDeal");
  if (btnDeleteDrawer) {
    btnDeleteDrawer.addEventListener("click", async () => {
      if (!isAdmin()) {
        showToast("Unauthorized", "Only Toby (Admin) can delete pipeline records.");
        return;
      }
      const id = parseInt(document.getElementById("editDealId").value);
      const deal = allDeals.find(d => d.id === id);
      if (!deal) return;

      if (confirm(`Are you sure you want to permanently delete "${deal.supplier}" from the pipeline?`)) {
        const supplierName = deal.supplier;
        allDeals = allDeals.filter(d => d.id !== id);
        localStorage.setItem("panama_pipeline_deals", JSON.stringify(allDeals));

        if (supabaseClient) {
          try {
            await supabaseClient.from("detections").delete().eq("id", id);
          } catch (err) {
            console.error("Supabase delete error:", err);
          }
        }

        recordAuditLog("Deleted Deal", supplierName, `Deal #${id} deleted by Admin (${currentUser}).`);
        drawerOverlay.classList.remove("open");
        applyFiltersAndRender();
        showToast("Deal Deleted", `"${supplierName}" removed from pipeline.`);
      }
    });
  }

  // 3. Settings Modal (Admin Only)
  document.getElementById("btnOpenSettings").addEventListener("click", () => {
    if (!isAdmin()) {
      showToast("Admin Restricted", "Cloud Database & Settings are restricted to Toby.");
      return;
    }
    const urlEl = document.getElementById("cfgSupabaseUrl");
    const keyEl = document.getElementById("cfgSupabaseKey");
    if (urlEl) urlEl.value = localStorage.getItem("supabase_url") || "";
    if (keyEl) keyEl.value = localStorage.getItem("supabase_key") || "";
    settingsModal.classList.add("open");
    initLucide();
  });

  document.getElementById("btnCloseSettings").addEventListener("click", () => settingsModal.classList.remove("open"));

  document.getElementById("btnSaveSettings").addEventListener("click", () => {
    if (!isAdmin()) return;
    const urlEl = document.getElementById("cfgSupabaseUrl");
    const keyEl = document.getElementById("cfgSupabaseKey");
    const url = urlEl ? urlEl.value.trim() : "";
    const key = keyEl ? keyEl.value.trim() : "";

    localStorage.setItem("supabase_url", url);
    localStorage.setItem("supabase_key", key);

    initSupabase();
    recordAuditLog("Settings Update", "Cloud DB", `Supabase connection parameters updated by Admin (${currentUser}).`);
    settingsModal.classList.remove("open");
    showToast("Settings Saved", "Cloud database configuration updated.");
  });

  document.getElementById("btnResetToLocal").addEventListener("click", async () => {
    if (!isAdmin()) return;
    if (confirm("Reset local changes and reload initial dataset?")) {
      localStorage.removeItem("panama_pipeline_deals");
      await loadDeals();
      applyFiltersAndRender();
      recordAuditLog("System Reset", "Database", `Data baseline reloaded by Admin (${currentUser}).`);
      settingsModal.classList.remove("open");
      showToast("Reset Complete", "Data baseline restored.");
    }
  });

  // Team Change Logs Modal
  const auditModal = document.getElementById("auditModal");
  const btnOpenAuditLogs = document.getElementById("btnOpenAuditLogs");
  if (btnOpenAuditLogs) {
    btnOpenAuditLogs.addEventListener("click", () => {
      renderGlobalAuditLogs();
      auditModal.classList.add("open");
      initLucide();
    });
  }
  const btnCloseAudit = document.getElementById("btnCloseAuditModal");
  if (btnCloseAudit) {
    btnCloseAudit.addEventListener("click", () => auditModal.classList.remove("open"));
  }
  const btnClearAudit = document.getElementById("btnClearAuditLogs");
  if (btnClearAudit) {
    btnClearAudit.addEventListener("click", () => {
      if (!isAdmin()) return;
      if (confirm("Clear all team activity logs?")) {
        globalAuditLogs = [];
        localStorage.removeItem("panama_audit_logs");
        renderGlobalAuditLogs();
        showToast("Logs Cleared", "Audit history reset.");
      }
    });
  }

  // Drawer tab switching
  const drawerTabs = document.querySelectorAll(".drawer-tab");
  drawerTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      drawerTabs.forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".drawer-tab-content").forEach(c => c.classList.remove("active"));

      tab.classList.add("active");
      const targetId = tab.dataset.drawerTab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");
      initLucide();
    });
  });

  // 4. CSV Exports
  document.getElementById("btnExportCSV").addEventListener("click", exportCSV);
  document.getElementById("btnExportTableCSV").addEventListener("click", exportCSV);
}

let currentDrawerDeal = null;

function renderCommentLogs(notes) {
  const container = document.getElementById("commentsLogList");
  if (!container) return;
  container.innerHTML = "";

  if (!notes || !notes.trim()) {
    container.innerHTML = `<div class="comments-log-empty">No comment logs recorded yet.</div>`;
    return;
  }

  const lines = notes.split("\n").map(l => l.trim()).filter(Boolean);
  
  lines.forEach(line => {
    const match = line.match(/^\[(.*?)\s*·\s*(.*?)\]:\s*(.*)$/);
    const item = document.createElement("div");
    item.className = "log-item";

    if (match) {
      const timeStr = match[1];
      const author = match[2];
      const text = match[3];
      item.innerHTML = `
        <div class="log-item-header">
          <span class="log-author-tag"><i data-lucide="user"></i> ${escapeHtml(author)}</span>
          <span class="log-timestamp">${escapeHtml(timeStr)}</span>
        </div>
        <div class="log-item-text">${escapeHtml(text)}</div>
      `;
    } else {
      item.innerHTML = `
        <div class="log-item-header">
          <span class="log-author-tag"><i data-lucide="file-text"></i> Note</span>
        </div>
        <div class="log-item-text">${escapeHtml(line)}</div>
      `;
    }
    container.appendChild(item);
  });
  initLucide();
}

function openDrawer(deal) {
  currentDrawerDeal = deal;
  document.getElementById("editDealId").value = deal.id;
  document.getElementById("drawerSupplierTitle").textContent = deal.supplier || `Deal #${deal.id}`;
  document.getElementById("drawerBuyerBadge").textContent = `👤 ${deal.buyer}`;
  document.getElementById("drawerCategoryBadge").textContent = `🏷️ ${deal.product_range || "General"}`;

  const authorBadge = document.getElementById("commentAuthorBadge");
  if (authorBadge) authorBadge.textContent = currentUser;

  const days = getDaysOpen(deal);
  document.getElementById("drawerDelayBadge").textContent = days === "Closed" ? "🚫 Closed" : `⏱️ ${days}d open`;

  let statusText = deal.status || "Detection (Draft)";
  if (deal.status === "Negotiated") statusText = "🔮 Forecast";
  else if (deal.status === "Ordered") statusText = "🟢 Ordered";
  document.getElementById("drawerStatusBadge").textContent = statusText;

  document.getElementById("editEntryDate").value = deal.entry_date || "";
  document.getElementById("editBuyer").value = deal.buyer || "";
  document.getElementById("editSupplier").value = deal.supplier || "";
  document.getElementById("editProduct").value = deal.product || "";
  document.getElementById("editCategory").value = deal.product_range || "";

  document.getElementById("editAffaireCreated").checked = !!deal.affaire_created;
  document.getElementById("editAffaireSent").checked = !!deal.affaire_sent;
  document.getElementById("editOfferReceived").checked = !!deal.offer_received;
  document.getElementById("editPropoCanceled").checked = !!deal.propo_canceled;
  document.getElementById("editRejectedAffair").checked = !!deal.rejected_affair;

  document.getElementById("editAffaireNumber").value = deal.affaire_number || "";
  document.getElementById("editAffaireDate").value = deal.affaire_date || "";
  document.getElementById("editOfferNumber").value = deal.offer_number || "";
  document.getElementById("editOfferDate").value = deal.offer_date || "";
  document.getElementById("editOfferValue").value = deal.offer_value || "";
  document.getElementById("editStatus").value = deal.status || "";

  // Show/hide inline fields based on state
  const affInline = document.getElementById("affaireInlineFields");
  if (affInline) affInline.style.display = deal.affaire_created ? "block" : "none";

  const offInline = document.getElementById("offerInlineFields");
  if (offInline) offInline.style.display = deal.offer_received ? "block" : "none";

  // Render Activity / Comment logs
  renderCommentLogs(deal.notes);
  updateAdminUI();

  // Reset to first tab
  document.querySelectorAll(".drawer-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".drawer-tab-content").forEach(c => c.classList.remove("active"));
  const firstTab = document.querySelector('.drawer-tab[data-drawer-tab="tabOverview"]');
  if (firstTab) firstTab.classList.add("active");
  const firstContent = document.getElementById("tabOverview");
  if (firstContent) firstContent.classList.add("active");

  document.getElementById("drawerOverlay").classList.add("open");
  initLucide();
}

// ── 13. CSV EXPORT (BLOB + UTF-8 EXCEL COMPATIBILITY) ─────────────────────
function exportCSV() {
  const dealsToExport = (filteredDeals && filteredDeals.length > 0) ? filteredDeals : allDeals;

  if (!dealsToExport || dealsToExport.length === 0) {
    alert("No records found to export.");
    return;
  }

  const headers = [
    "ID", "Entry Date", "Buyer", "Supplier", "Product", "Category",
    "Propo Canceled", "Affaire Created", "Affaire Date", "Affaire Number",
    "Rejected Affair", "Affaire Sent", "Offer Received", "Offer Date",
    "Offer Number", "Offer Value ($)", "Status", "Notes", "Days Open", "Stale Alert"
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
    return `"${str}"`;
  };

  const rows = dealsToExport.map(d => [
    d.id || "",
    d.entry_date || "",
    escapeCSV(d.buyer),
    escapeCSV(d.supplier),
    escapeCSV(d.product),
    escapeCSV(d.product_range),
    d.propo_canceled ? "TRUE" : "FALSE",
    d.affaire_created ? "TRUE" : "FALSE",
    d.affaire_date || "",
    escapeCSV(d.affaire_number),
    d.rejected_affair ? "TRUE" : "FALSE",
    d.affaire_sent ? "TRUE" : "FALSE",
    d.offer_received ? "TRUE" : "FALSE",
    d.offer_date || "",
    escapeCSV(d.offer_number),
    parseFloat(d.offer_value) || 0,
    escapeCSV(d.status),
    escapeCSV(d.notes),
    escapeCSV(getDaysOpen(d)),
    escapeCSV(getStaleAlert(d))
  ]);

  const csvRows = [headers.join(",")];
  rows.forEach(r => csvRows.push(r.join(",")));
  const csvString = "\uFEFF" + csvRows.join("\r\n"); // UTF-8 BOM for Excel

  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Panama_Purchasing_Pipeline_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast("Export Ready", `Exported ${dealsToExport.length} records to CSV.`);
}

// ── 14. HELPERS ───────────────────────────────────────────────────────────
function formatCurrency(num) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(num || 0);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(title, message) {
  const toast = document.getElementById("toast");
  toast.innerHTML = `<i data-lucide="check-circle" style="color:var(--accent-green);"></i> <div><strong>${title}</strong>: ${message}</div>`;
  initLucide();
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}
