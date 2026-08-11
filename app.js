/* ==========================================================================
   PANAMA PURCHASING PIPELINE - WEB APPLICATION LOGIC
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

// Filter State
let filterPeriod = "All Time";
let filterPeriodVal = "";
let filterBuyerVal = "All";
let filterCategoryVal = "All";
let filterSearchVal = "";
let filterStaleOnlyVal = false;

// ── 3. INITIALIZATION ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initLucide();
  initPINLock();
  initDropdowns();
  initTabs();
  initModals();
  initFilters();
  initDragAndDrop();

  // Try loading Supabase connection or local cache
  initSupabase();
  await loadDeals();
  applyFiltersAndRender();
});

function initLucide() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

// ── 4. PIN ACCESS CONTROL ─────────────────────────────────────────────────
function initPINLock() {
  const pinOverlay = document.getElementById("pinOverlay");
  const pinForm = document.getElementById("pinForm");
  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");
  const btnLockApp = document.getElementById("btnLockApp");

  const storedPin = localStorage.getItem("team_pin") || "0000";
  const isUnlocked = sessionStorage.getItem("pipeline_unlocked") === "true";

  if (isUnlocked) {
    pinOverlay.classList.add("unlocked");
  }

  pinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const entered = pinInput.value.trim();
    const currentPin = localStorage.getItem("team_pin") || "0000";

    if (entered === currentPin) {
      sessionStorage.setItem("pipeline_unlocked", "true");
      pinOverlay.classList.add("unlocked");
      pinError.style.display = "none";
      pinInput.value = "";
      showToast("Workspace Unlocked", "Welcome back!");
    } else {
      pinError.style.display = "block";
      pinInput.value = "";
      pinInput.focus();
    }
  });

  btnLockApp.addEventListener("click", () => {
    sessionStorage.removeItem("pipeline_unlocked");
    pinOverlay.classList.remove("unlocked");
    pinInput.focus();
  });
}

// ── 5. SUPABASE CLOUD & DATA LOADER ───────────────────────────────────────
function initSupabase() {
  const url = localStorage.getItem("supabase_url");
  const key = localStorage.getItem("supabase_key");
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
          showToast("Live Update", "Database synchronized with cloud");
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

  // Fallback: load from localStorage or embedded initial data
  const local = localStorage.getItem("panama_pipeline_deals");
  if (local) {
    try {
      allDeals = JSON.parse(local);
      return;
    } catch (e) {}
  }

  // Fallback to initial_data.json
  try {
    const res = await fetch("initial_data.json");
    if (res.ok) {
      allDeals = await res.json();
      localStorage.setItem("panama_pipeline_deals", JSON.stringify(allDeals));
    }
  } catch (err) {
    console.warn("Could not fetch initial_data.json, starting empty:", err);
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

// ── 6. BUSINESS LOGIC & FORMULA EQUIVALENTS ──────────────────────────────
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

  // Fallback to Entry Date
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

// ── 7. FILTERS & PERIOD CONTROLS ──────────────────────────────────────────
function initDropdowns() {
  const catSelect = document.getElementById("filterCategory");
  const formCatSelect = document.getElementById("formCategory");

  PRODUCT_RANGES.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);

    const formOpt = opt.cloneNode(true);
    formCatSelect.appendChild(formOpt);
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
    applyFiltersAndRender();
  });

  staleToggle.addEventListener("change", (e) => {
    filterStaleOnlyVal = e.target.checked;
    applyFiltersAndRender();
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

    // Stale only filter
    if (filterStaleOnlyVal) {
      if (!getStaleAlert(d)) return false;
    }

    return true;
  });

  renderDashboard();
  renderKanban();
  renderTable();
  initLucide();
}

// ── 8. RENDER: DASHBOARD VIEW ─────────────────────────────────────────────
function renderDashboard() {
  // KPI Calculations
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

  document.getElementById("kpiTotalDetections").textContent = totalDetections;
  document.getElementById("kpiActiveValue").textContent = formatCurrency(activeValue);
  document.getElementById("kpiForecastValue").textContent = formatCurrency(forecastValue);
  document.getElementById("kpiForecastDeals").textContent = `${forecastDeals} Forecast Deals`;
  document.getElementById("kpiOrderedValue").textContent = formatCurrency(orderedValue);
  document.getElementById("kpiOrderedDeals").textContent = `${orderedDeals} Closed Orders`;
  document.getElementById("kpiStaleDeals").textContent = staleDealsCount;
  document.getElementById("staleCountBadge").textContent = staleDealsCount;

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

    // Offer Signal
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
      <td class="text-center">${formatCurrency(tOVal)}</td>
      <td class="text-center">${formatCurrency(tAVal)}</td>
      <td class="text-center">${totRate}</td>
      <td class="text-center">⭐ Team Signal</td>
    </tr>
  `;

  // Status Breakdown
  const statusTbody = document.getElementById("statusBreakdownBody");
  statusTbody.innerHTML = "";
  STATUSES.forEach(st => {
    const sDeals = filteredDeals.filter(d => d.status === st);
    const count = sDeals.length;
    const pct = totalDetections > 0 ? ((count / totalDetections) * 100).toFixed(1) + "%" : "0.0%";
    const val = sDeals.reduce((sum, d) => sum + (parseFloat(d.offer_value) || 0), 0);
    
    // Average days open
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

  // Category Performance
  const catTbody = document.getElementById("categoryPerformanceBody");
  catTbody.innerHTML = "";
  PRODUCT_RANGES.forEach(cat => {
    const cDeals = filteredDeals.filter(d => d.product_range === cat);
    if (cDeals.length === 0) return; // Only show active categories

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

  // Stage Breakdown Chart
  renderStageChart();
}

function renderStageChart() {
  const ctx = document.getElementById("stageChart").getContext("2d");
  
  const stageCounts = {
    "Detection": 0,
    "Affaire Sent": 0,
    "Offer Recv": 0,
    "Forecast": 0,
    "Ordered": 0,
    "Closed/Lost": 0
  };

  filteredDeals.forEach(d => {
    const stage = getStageCategory(d);
    if (stage === "detection") stageCounts["Detection"]++;
    else if (stage === "affaire_sent") stageCounts["Affaire Sent"]++;
    else if (stage === "offer_received") stageCounts["Offer Recv"]++;
    else if (stage === "forecast") stageCounts["Forecast"]++;
    else if (stage === "ordered") stageCounts["Ordered"]++;
    else stageCounts["Closed/Lost"]++;
  });

  if (stageChartInstance) {
    stageChartInstance.destroy();
  }

  stageChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(stageCounts),
      datasets: [{
        data: Object.values(stageCounts),
        backgroundColor: [
          "#38BDF8", // Blue (Detection)
          "#A855F7", // Purple (Affaire Sent)
          "#EC4899", // Pink (Offer Recv)
          "#818CF8", // Indigo (Forecast)
          "#10B981", // Green (Ordered)
          "#F43F5E"  // Rose (Closed)
        ],
        borderWidth: 2,
        borderColor: "#111827"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#94A3B8", font: { family: "Plus Jakarta Sans", size: 11 } }
        }
      },
      cutout: "68%"
    }
  });
}

// ── 9. RENDER: KANBAN BOARD VIEW ──────────────────────────────────────────
function renderKanban() {
  const cols = {
    detection: document.getElementById("cardsDetection"),
    affaire_sent: document.getElementById("cardsAffaire"),
    offer_received: document.getElementById("cardsOffer"),
    forecast: document.getElementById("cardsForecast"),
    ordered: document.getElementById("cardsOrdered"),
    closed: document.getElementById("cardsClosed")
  };

  const counts = {
    detection: 0,
    affaire_sent: 0,
    offer_received: 0,
    forecast: 0,
    ordered: 0,
    closed: 0
  };

  Object.values(cols).forEach(el => el.innerHTML = "");

  filteredDeals.forEach(deal => {
    const stage = getStageCategory(deal);
    counts[stage]++;

    const card = document.createElement("div");
    card.className = "deal-card";
    card.draggable = true;
    card.dataset.id = deal.id;

    const days = getDaysOpen(deal);
    const stale = getStaleAlert(deal);
    if (stale) card.classList.add("stale-card");

    const valStr = deal.offer_value > 0 ? formatCurrency(deal.offer_value) : "";

    card.innerHTML = `
      <div class="deal-card-header">
        <div class="deal-supplier">${escapeHtml(deal.supplier)}</div>
        <span class="deal-buyer">${escapeHtml(deal.buyer)}</span>
      </div>
      <div class="deal-product">${escapeHtml(deal.product)}</div>
      ${stale ? `<div class="badge badge-stale" style="margin-bottom:0.4rem;">${stale}</div>` : ""}
      <div class="deal-card-footer">
        <span class="deal-value">${valStr}</span>
        <span class="deal-delay"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${days === "Closed" ? "Closed" : days + "d open"}</span>
      </div>
    `;

    card.addEventListener("click", () => openEditModal(deal));

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", deal.id);
      card.style.opacity = "0.5";
    });

    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
    });

    cols[stage].appendChild(card);
  });

  document.getElementById("countDetection").textContent = counts.detection;
  document.getElementById("countAffaire").textContent = counts.affaire_sent;
  document.getElementById("countOffer").textContent = counts.offer_received;
  document.getElementById("countForecast").textContent = counts.forecast;
  document.getElementById("countOrdered").textContent = counts.ordered;
  document.getElementById("countClosed").textContent = counts.closed;
}

function initDragAndDrop() {
  const dropzones = document.querySelectorAll(".kanban-cards");
  dropzones.forEach(zone => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.style.background = "rgba(99, 102, 241, 0.08)";
    });

    zone.addEventListener("dragleave", () => {
      zone.style.background = "transparent";
    });

    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.style.background = "transparent";
      const dealId = parseInt(e.dataTransfer.getData("text/plain"));
      const targetStage = zone.parentElement.dataset.stage;

      const deal = allDeals.find(d => d.id === dealId);
      if (!deal) return;

      const todayStr = new Date().toISOString().split("T")[0];

      // Auto-update fields according to target stage
      if (targetStage === "detection") {
        deal.affaire_created = false;
        deal.affaire_sent = false;
        deal.offer_received = false;
        deal.status = "";
      } else if (targetStage === "affaire_sent") {
        deal.affaire_created = true;
        deal.affaire_sent = true;
        if (!deal.affaire_date) deal.affaire_date = todayStr;
      } else if (targetStage === "offer_received") {
        deal.affaire_created = true;
        deal.affaire_sent = true;
        deal.offer_received = true;
        if (!deal.offer_date) deal.offer_date = todayStr;
        if (!deal.status || deal.status === "Ordered" || deal.status === "Lost") {
          deal.status = "To Negotiate";
        }
      } else if (targetStage === "forecast") {
        deal.affaire_created = true;
        deal.offer_received = true;
        deal.status = "Negotiated";
      } else if (targetStage === "ordered") {
        deal.affaire_created = true;
        deal.offer_received = true;
        deal.status = "Ordered";
      } else if (targetStage === "closed") {
        if (!deal.status || deal.status === "Negotiated" || deal.status === "Ordered") {
          deal.status = "Lost";
        }
      }

      await saveDealRecord(deal);
      showToast("Status Updated", `${deal.supplier} moved to ${targetStage}`);
    });
  });
}

// ── 10. RENDER: TABLE GRID VIEW ───────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById("pipelineTableBody");
  tbody.innerHTML = "";

  document.getElementById("tableFilteredCount").textContent = filteredDeals.length;
  document.getElementById("tableTotalCount").textContent = allDeals.length;

  filteredDeals.forEach((deal, idx) => {
    const days = getDaysOpen(deal);
    const stale = getStaleAlert(deal);

    let statusBadge = `<span class="badge badge-navy">Draft</span>`;
    if (deal.status === "Negotiated") statusBadge = `<span class="badge badge-forecast">Forecast</span>`;
    else if (deal.status === "Ordered") statusBadge = `<span class="badge badge-ordered">Ordered</span>`;
    else if (deal.status === "Lost" || deal.status === "Cancelled") statusBadge = `<span class="badge badge-closed">${deal.status}</span>`;
    else if (deal.status) statusBadge = `<span class="badge badge-navy">${deal.status}</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="text-muted">${idx + 1}</span></td>
      <td>${deal.entry_date || "-"}</td>
      <td><strong>${escapeHtml(deal.buyer)}</strong></td>
      <td>${escapeHtml(deal.supplier)}</td>
      <td>${escapeHtml(deal.product)}</td>
      <td><span class="badge badge-navy">${escapeHtml(deal.product_range)}</span></td>
      <td class="text-center font-mono">${deal.affaire_number || "-"}</td>
      <td class="text-center font-mono">${deal.offer_number || "-"}</td>
      <td class="text-right text-green font-bold">${deal.offer_value > 0 ? formatCurrency(deal.offer_value) : "-"}</td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-center font-bold">${days === "Closed" ? "<span class='text-rose'>Closed</span>" : days + " d"}</td>
      <td class="text-center">${stale ? `<span class="badge badge-stale">${stale}</span>` : "-"}</td>
      <td class="text-center">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.editDealById(${deal.id})">
          <i data-lucide="edit-2" style="width:14px;height:14px;"></i> Edit
        </button>
      </td>
    `;
    tr.addEventListener("click", () => openEditModal(deal));
    tbody.appendChild(tr);
  });
}

window.editDealById = (id) => {
  const deal = allDeals.find(d => d.id === id);
  if (deal) openEditModal(deal);
};

// ── 11. MODALS & FORMS ────────────────────────────────────────────────────
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

function initModals() {
  const detModal = document.getElementById("detectionModal");
  const settingsModal = document.getElementById("settingsModal");
  const detForm = document.getElementById("detectionForm");

  document.getElementById("btnOpenAddModal").addEventListener("click", () => openAddModal());
  document.getElementById("btnCloseModal").addEventListener("click", () => detModal.classList.remove("open"));
  document.getElementById("btnCancelModal").addEventListener("click", () => detModal.classList.remove("open"));

  document.getElementById("btnOpenSettings").addEventListener("click", () => openSettingsModal());
  document.getElementById("btnCloseSettings").addEventListener("click", () => settingsModal.classList.remove("open"));

  detForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dealId = document.getElementById("formDealId").value;
    
    const deal = {
      id: dealId ? parseInt(dealId) : null,
      entry_date: document.getElementById("formEntryDate").value,
      buyer: document.getElementById("formBuyer").value,
      supplier: document.getElementById("formSupplier").value,
      product: document.getElementById("formProduct").value,
      product_range: document.getElementById("formCategory").value,
      status: document.getElementById("formStatus").value,
      propo_canceled: document.getElementById("formPropoCanceled").checked,
      affaire_created: document.getElementById("formAffaireCreated").checked,
      affaire_date: document.getElementById("formAffaireDate").value || null,
      affaire_number: document.getElementById("formAffaireNumber").value || null,
      rejected_affair: document.getElementById("formRejectedAffair").checked,
      affaire_sent: document.getElementById("formAffaireSent").checked,
      offer_received: document.getElementById("formOfferReceived").checked,
      offer_date: document.getElementById("formOfferDate").value || null,
      offer_number: document.getElementById("formOfferNumber").value || null,
      offer_value: parseFloat(document.getElementById("formOfferValue").value) || 0,
      notes: document.getElementById("formNotes").value || ""
    };

    await saveDealRecord(deal);
    detModal.classList.remove("open");
    showToast("Detection Saved", `${deal.supplier} (${deal.product}) updated successfully.`);
  });

  // Settings Save
  document.getElementById("btnSaveSettings").addEventListener("click", () => {
    const url = document.getElementById("cfgSupabaseUrl").value.trim();
    const key = document.getElementById("cfgSupabaseKey").value.trim();
    const pin = document.getElementById("cfgTeamPin").value.trim() || "0000";

    localStorage.setItem("supabase_url", url);
    localStorage.setItem("supabase_key", key);
    localStorage.setItem("team_pin", pin);

    initSupabase();
    settingsModal.classList.remove("open");
    showToast("Settings Saved", "Cloud configuration updated.");
  });

  // Reset to local data
  document.getElementById("btnResetToLocal").addEventListener("click", async () => {
    if (confirm("Reset local changes and reload initial dataset?")) {
      localStorage.removeItem("panama_pipeline_deals");
      await loadDeals();
      applyFiltersAndRender();
      settingsModal.classList.remove("open");
      showToast("Reset Complete", "Local data restored to baseline.");
    }
  });

  // CSV Exports
  document.getElementById("btnExportCSV").addEventListener("click", exportCSV);
  document.getElementById("btnExportTableCSV").addEventListener("click", exportCSV);
}

function openAddModal() {
  const form = document.getElementById("detectionForm");
  form.reset();
  document.getElementById("formDealId").value = "";
  document.getElementById("modalTitle").innerHTML = `<i data-lucide="sparkle"></i> Add New Detection`;
  document.getElementById("formEntryDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("detectionModal").classList.add("open");
  initLucide();
}

function openEditModal(deal) {
  document.getElementById("formDealId").value = deal.id;
  document.getElementById("modalTitle").innerHTML = `<i data-lucide="edit-2"></i> Edit Detection #${deal.id}`;
  document.getElementById("formEntryDate").value = deal.entry_date || "";
  document.getElementById("formBuyer").value = deal.buyer || "";
  document.getElementById("formSupplier").value = deal.supplier || "";
  document.getElementById("formProduct").value = deal.product || "";
  document.getElementById("formCategory").value = deal.product_range || "";
  document.getElementById("formStatus").value = deal.status || "";

  document.getElementById("formPropoCanceled").checked = !!deal.propo_canceled;
  document.getElementById("formAffaireCreated").checked = !!deal.affaire_created;
  document.getElementById("formAffaireDate").value = deal.affaire_date || "";
  document.getElementById("formAffaireNumber").value = deal.affaire_number || "";
  document.getElementById("formRejectedAffair").checked = !!deal.rejected_affair;
  document.getElementById("formAffaireSent").checked = !!deal.affaire_sent;
  document.getElementById("formOfferReceived").checked = !!deal.offer_received;
  document.getElementById("formOfferDate").value = deal.offer_date || "";
  document.getElementById("formOfferNumber").value = deal.offer_number || "";
  document.getElementById("formOfferValue").value = deal.offer_value || "";
  document.getElementById("formNotes").value = deal.notes || "";

  document.getElementById("detectionModal").classList.add("open");
  initLucide();
}

function openSettingsModal() {
  document.getElementById("cfgSupabaseUrl").value = localStorage.getItem("supabase_url") || "";
  document.getElementById("cfgSupabaseKey").value = localStorage.getItem("supabase_key") || "";
  document.getElementById("cfgTeamPin").value = localStorage.getItem("team_pin") || "0000";
  document.getElementById("settingsModal").classList.add("open");
  initLucide();
}

// ── 12. CSV EXPORT ────────────────────────────────────────────────────────
function exportCSV() {
  if (filteredDeals.length === 0) {
    alert("No records to export.");
    return;
  }

  const headers = [
    "ID", "Entry Date", "Buyer", "Supplier", "Product", "Category",
    "Propo Canceled", "Affaire Created", "Affaire Date", "Affaire #",
    "Rejected Affair", "Affaire Sent", "Offer Received", "Offer Date",
    "Offer #", "Offer Value ($)", "Status", "Notes", "Days Open", "Stale Alert"
  ];

  const rows = filteredDeals.map(d => [
    d.id,
    d.entry_date,
    `"${(d.buyer || "").replace(/"/g, '""')}"`,
    `"${(d.supplier || "").replace(/"/g, '""')}"`,
    `"${(d.product || "").replace(/"/g, '""')}"`,
    `"${(d.product_range || "").replace(/"/g, '""')}"`,
    d.propo_canceled ? "TRUE" : "FALSE",
    d.affaire_created ? "TRUE" : "FALSE",
    d.affaire_date || "",
    d.affaire_number || "",
    d.rejected_affair ? "TRUE" : "FALSE",
    d.affaire_sent ? "TRUE" : "FALSE",
    d.offer_received ? "TRUE" : "FALSE",
    d.offer_date || "",
    d.offer_number || "",
    d.offer_value || 0,
    d.status || "",
    `"${(d.notes || "").replace(/"/g, '""')}"`,
    getDaysOpen(d),
    getStaleAlert(d)
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Panama_Pipeline_Export_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("Export Ready", "CSV file generated and downloaded.");
}

// ── 13. HELPERS ───────────────────────────────────────────────────────────
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
