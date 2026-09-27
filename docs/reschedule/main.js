console.log("MAIN.JS LOADED 3:24PM");

// ===============================
// CONFIG + STATE
// ===============================
const API_URL =
  "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";

const BASE_URL = API_URL; // if you have a different BASE_URL, replace this

let currentGameNumber = "";
let currentRowData = null;
let currentStep = 1;


async function apiGetGame(gameNumber) {
  const url = `${API_URL}?action=getRow&game_number=${encodeURIComponent(gameNumber)}`;

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return null;
    return await response.json();   // { exists, data }
  } catch (err) {
    console.error("apiGetGame error:", err);
    return null;
  }
}

function showLoading(container) {
  container.innerHTML = `
    <div class="loading-banner">Searching… please wait</div>
  `;
}

function renderMatches(container, matches) {
  container.innerHTML = ""; // clear loading banner

  matches.forEach(m => {
    container.appendChild(renderMatchCard(m));
  });
}


// ===============================
// DATE/TIME HELPERS
// ===============================
function normalizeDateForInput(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function normalizeTimeForInput(value) {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) return value;

  const m = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  let [, hh, mm, ap] = m;
  hh = parseInt(hh, 10);

  if (ap.toUpperCase() === "PM" && hh < 12) hh += 12;
  if (ap.toUpperCase() === "AM" && hh === 12) hh = 0;

  return `${String(hh).padStart(2, "0")}:${mm}`;
}

function formatDateForStorage(htmlDate) {
  if (!htmlDate) return "";
  const [yyyy, mm, dd] = htmlDate.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

function formatTimeForStorage(htmlTime) {
  if (!htmlTime) return "";
  const [hh, mm] = htmlTime.split(":");
  let h = parseInt(hh, 10);
  let ap = "AM";

  if (h >= 12) {
    ap = "PM";
    if (h > 12) h -= 12;
  } else if (h === 0) {
    h = 12;
  }

  return `${h}:${mm} ${ap}`;
}

function displayDate(value) {
  if (!value) return "—";

  // Already MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return value;

  // Convert YYYY-MM-DD → MM/DD/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split("-");
    return `${mm}/${dd}/${yyyy}`;
  }

  return value;
}

function displayTime(t) {
  if (!t) return "—";
  t = t.trim();

  // Case 1: "15:00" (24-hour)
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    let [h, m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    h = (h % 12) || 12;
    return `${h}:${m.toString().padStart(2, "0")} ${suffix}`;
  }

  // Case 2: "3 PM" or "3 pm"
  if (/^\d{1,2}\s*(AM|PM)$/i.test(t)) {
    return t.toUpperCase();
  }

  // Case 3: "3pm" or "3am"
  if (/^\d{1,2}(am|pm)$/i.test(t)) {
    const h = parseInt(t);
    const suffix = t.toUpperCase().includes("PM") ? "PM" : "AM";
    return `${h}:00 ${suffix}`;
  }

  // Case 4: "3:00 PM" or "3:00 pm"
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(t)) {
    return t.toUpperCase();
  }

  // Case 5: "3:00" (ambiguous)
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = (h % 12) || 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`;
  }

  // Fallback — show raw value
  return t;
}




async function useThisGame(gameNumber) {
  const rowResult = await apiGetGame(gameNumber);
  if (!rowResult?.exists) {
    alert("Unable to load game data.");
    return;
  }

  currentRowData = rowResult.data;
  hydrateFieldsFromRow(currentRowData);

  // EXACTLY what lookupGameNumber does:
  beginWorkflow();
  showWorkflowUI();
  hideLandingPage();
}

function renderMatchCard(m) {
  const div = document.createElement("div");
  div.className = "match-card";

  div.innerHTML = `
    <div class="sr-line"><strong>Team:</strong> ${m.team_name || "—"}</div>
    <div class="sr-line"><strong>Opponent:</strong> ${m.opp_town || "—"}</div>
    <div class="sr-line"><strong>Date:</strong> ${displayDate(m.orig_date)}</div>
    <div class="sr-line"><strong>Time:</strong> ${displayTime(m.orig_time)}</div>
    <div class="sr-line"><strong>Field:</strong> ${m.orig_field || "—"}</div>
    <div class="sr-line"><strong>Game #:</strong> ${m.game_number}</div>

    <button class="primary-btn" onclick="loadGameWithoutStartingWorkflow('${m.game_number}')">
      Use This Game
    </button>
  `;

  return div;
}



function toggleCollapse(el) {
  const body = el.nextElementSibling;
  body.style.display = body.style.display === "block" ? "none" : "block";
}

function hideSearchUI() {
  const searchSection = document.getElementById("searchSection");
  const listSection = document.getElementById("listSection");
  const workflowPage = document.getElementById("workflowPage");

  if (searchSection) searchSection.style.display = "none";
  if (listSection) listSection.style.display = "none";
  if (workflowPage) workflowPage.style.display = "block";
}



async function startRescheduleFromSearch(gameNumber) {
  console.log("Starting reschedule from search:", gameNumber);

  // ⭐ Scroll IMMEDIATELY — before browser auto-scrolls to button
  const wf = document.getElementById("workflowPage");
  if (wf) wf.scrollIntoView({ behavior: "instant", block: "start" });

  const result = await apiGetGame(gameNumber);
  if (!result || !result.exists) {
    alert("Game not found.");
    return;
  }

  currentGameNumber = gameNumber;
  currentRowData = result.data;

  // Hydrate fields
  hydrateFieldsFromRow(result.data);

  // Hide search UI
  hideSearchUI();

  // Show workflow UI
  showWorkflowUI();

  // Jump to correct step
  const nextStep = findNextIncompleteStepSkippingStep1(currentRowData);
  goToStep(nextStep);
}




function getField(name) {
  if (!currentRowData) return "";
  return currentRowData[name] == null ? "" : currentRowData[name];
}

async function setField(name, value) {
  if (!currentRowData) currentRowData = {};
  currentRowData[name] = value;

  const form = new FormData();
  form.append("action", "updateField");
  form.append("game_number", currentGameNumber);
  form.append("field", name);
  form.append("value", value == null ? "" : value);

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}



// ===============================
// API HELPERS (assumes backend already supports these actions)
// ===============================
async function apiUpdateRow(gameNumber, updates) {
  const form = new FormData();
  form.append("action", "updateRow");
  form.append("game_number", gameNumber);
  form.append("updates", JSON.stringify(updates));

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

async function apiUpdateStep(gameNumber, step) {
  const form = new FormData();
  form.append("action", "updateStep");
  form.append("game_number", gameNumber);
  form.append("step", step);

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}


async function apiUpdateFinal(gameNumber, date, time, field) {
  const form = new FormData();
  form.append("action", "updateFinal");
  form.append("game_number", gameNumber);
  form.append("date", date);
  form.append("time", time);
  form.append("field", field);

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}


async function apiUpdateGameChangeForm(payload) {
  const form = new FormData();
  form.append("action", "updateGameChangeForm");

  Object.keys(payload).forEach(key => {
    form.append(key, payload[key] || "");
  });

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

async function apiUpdateGameChangeForm(payload) {
  const form = new FormData();
  form.append("action", "updateGameChangeForm");

  Object.keys(payload).forEach(key => {
    form.append(key, payload[key] || "");
  });

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}


async function apiUpdateOptions(gameNumber, optionNumber, date, time, field) {
  const form = new FormData();
  form.append("action", "updateOptions");
  form.append("game_number", gameNumber);
  form.append("option_number", optionNumber);
  form.append("date", date);
  form.append("time", time);
  form.append("field", field);

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}


async function loadSubmittedRequests() {
  const rows = await apiGetAllRows();
  const list = document.getElementById("submittedList");
  if (!list) return;

  list.innerHTML = "";

  // Filter rows that have ANY workflow progress
  const submitted = rows.filter(r =>
    r.step_1 === "completed" ||
    r.step_2 === "completed" ||
    r.step_3 === "completed" ||
    r.step_4 === "completed" ||
    r.step_5 === "completed" ||
    r.step_6 === "completed" ||
    r.step_7 === "completed" ||
    r.step_8 === "completed" ||
    r.attempt_started === "true"
  );

  if (submitted.length === 0) {
    list.innerHTML = `<p>No submitted reschedule requests yet.</p>`;
    return;
  }

  submitted.forEach(item => {
    const div = document.createElement("div");
    div.className = "submitted-item";

    div.innerHTML = `
      <div class="reschedule-card">
      
        <div class="card-header">
          <div class="game-number">Game #${item.game_number}</div>
          <button type="button" class="primary-btn" onclick="resumeGame('${item.game_number}')">Resume</button>
        </div>
      
        <div class="card-body">
      
          <div class="left">
            <div class="team">
              <strong>${item.team_name}</strong><br>
              ${item.age_group} ${item.gender} ${item.division}
            </div>
      
            <div class="next-action">
              <strong>Next Action:</strong> ${item.workflow_status || "Complete"}
            </div>
      
            <div class="status">
              <strong>Status:</strong>
              Certified: ${item.certified ? "Yes" : "No"} •
              Calendar: ${item.calendar_updated ? "Yes" : "No"} •
              HAYSA: ${item.haysa_status || "—"}
            </div>
          </div>
      
          <div class="right">
            <table class="dates-table">
              <tr>
                <th>Original</th>
                <th>Final</th>
              </tr>
              <tr>
                <td>${item.orig_date_display} — ${item.orig_time_display}</td>
                <td>${item.final_date_display || "—"} — ${item.final_time_display || ""}</td>
              </tr>
              <tr>
                <td>${item.orig_field}</td>
                <td>${item.final_field || ""}</td>
              </tr>
            </table>
          </div>
      
        </div>
      
      </div>
    `;

    list.appendChild(div);
  });

  const container = document.getElementById("submittedListContainer");
  if (container) container.style.display = "block";
}


// ===============================
// WORKFLOW LOAD / RESUME
// ===============================
async function loadGameWithoutStartingWorkflow(gameNumber) {

  hideLandingPage();   // ⭐ THIS is the missing piece

  console.log("Loading game without starting workflow:", gameNumber);

  currentGameNumber = gameNumber;

  const rowResult = await apiGetGame(gameNumber);

  if (!rowResult?.exists) {
    alert("Unable to load game data.");
    return;
  }

  currentRowData = rowResult.data;
  hydrateFieldsFromRow(currentRowData);

  const row = rowResult.data;

  if (!row.attempt_started) {
    const today = new Date().toISOString().split("T")[0];

    await apiUpdateRow(gameNumber, {
      attempt_started: true,
      attempt_started_date: today
    });

    currentRowData.attempt_started = true;
    currentRowData.attempt_started_date = today;
  }

  if (row.opt1_status === "approved") autoMoveApprovedOption(1);
  if (row.opt2_status === "approved") autoMoveApprovedOption(2);

  hideSearchUI();
  showWorkflowUI();

  const wf = document.getElementById("workflowPage");
  if (wf) wf.scrollIntoView({ behavior: "smooth" });

  showWorkflowWithoutStarting();
}



async function apiGetAllRows() {
  const url = `${API_URL}?action=getAllRows`;

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return [];
    const data = await response.json();
    return data.rows || [];
  } catch (err) {
    console.error("apiGetAllRows error:", err);
    return [];
  }
}


async function lookupGameNumber() {
  const input = document.getElementById("lookupGameNumber");
  const statusEl = document.getElementById("lookupStatus");
  if (!input) return;

  const gameNumber = input.value.trim();
  if (!gameNumber) {
    alert("Please enter a game number.");
    return;
  }

  const result = await apiGetGame(gameNumber);

  if (result && result.exists) {
    const row = result.data;

    currentGameNumber = gameNumber;
    hydrateFieldsFromRow(row);

    if (row.opt1_status === "approved") autoMoveApprovedOption(1);
    if (row.opt2_status === "approved") autoMoveApprovedOption(2);

    let nextStep = 1;
    for (let s = 1; s <= 8; s++) {
      if (!isStepCompleteRow(row, s)) {
        nextStep = s;
        break;
      }
    }

    hideLandingPage();
    showWorkflowUI();
    hydrateTimelineFromRow(row);
    goToStep(nextStep);

    const wf = document.getElementById("workflowPage");
    if (wf) wf.scrollIntoView({ behavior: "smooth" });

    return;
  }

  const confirmCreate = confirm(
    "No matching game was found.\n\n" +
    "Would you like to create a NEW reschedule case using this game number?"
  );

  if (!confirmCreate) {
    statusEl.innerText = "Game not found.";
    return;
  }

  await startNewWorkflow(gameNumber);
}

// ===============================
// MULTI-MATCH GAME SELECTION
// ===============================
function showGameSelection(matches) {
  const container = document.getElementById("gameSelectionContainer");
  if (!container) return;

  // Show loading banner immediately
  container.innerHTML = `<div class="loading-banner">Loading matches…</div>`;

  // ⭐ CLEAR THE LOADING BANNER BEFORE RENDERING CARDS
  container.innerHTML = `
    <h3>Select the correct game</h3>
    <p>Multiple games match your search. Choose the one you want to reschedule.</p>
  `;

  matches.forEach(m => {
    container.appendChild(renderMatchCard(m));
  });
}




function displayDate(d) {
  return d ? new Date(d).toLocaleDateString("en-US") : "(none)";
}

function displayTime(t) {
  return t
    ? new Date(t).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
      })
    : "(none)";
}


function generateSSSLEmailSummary(row) {
  const homeOriginal = row.is_haysa_home === "true" ? row.team_name : row.opp_town;
  const awayOriginal = row.is_haysa_home === "true" ? row.opp_town : row.team_name;

  const homeFinal = homeOriginal;
  const awayFinal = awayOriginal;

  return `
Subject: Reschedule Request – Game #${row.game_number}

Attached is the completed reschedule form for:

Game Number: ${row.game_number}
Teams: ${row.team_name} vs ${row.opp_town}

Original Game:
- Date: ${row.orig_date}
- Time: ${row.orig_time}
- Field: ${row.orig_field}
- Home: ${homeOriginal}
- Away: ${awayOriginal}

New Game:
- Date: ${row.final_date}
- Time: ${row.final_time}
- Field: ${row.final_field}
- Home: ${homeFinal}
- Away: ${awayFinal}

Coach Certification:
- Certified: ${row.certified}
- Signed Name: ${row.signed_name}
`.trim();
}



// ===============================
// COACH SEARCH (critical)
// ===============================
async function searchByCoach() {
  const last = document.getElementById("coach_search").value.trim();
  const url = `${BASE_URL}?action=searchRows&coach_last_name=${encodeURIComponent(last)}`;

  console.log("Coach search URL:", url);

  const searchResults = document.getElementById("search_results");
  searchResults.innerHTML = `<div class="loading-banner">Searching… please wait</div>`;

  try {
    const response = await fetch(url);
    const result = await response.json();

    const matches = result.rows || [];

    // ⭐ THIS LINE WAS MISSING — it clears the loading banner
    searchResults.innerHTML = "";

    if (matches.length === 0) {
      searchResults.innerHTML = "<div>No matching games found.</div>";
      return;
    }

    matches.forEach(m => {
      searchResults.appendChild(renderMatchCard(m));
    });

  } catch (err) {
    console.error("Coach search error:", err);
    searchResults.innerHTML = "<div>Error searching. Check console.</div>";
  }
}
   // ← FIXED




// ===============================
// SEARCH FORM → START RESCHEDULE
// ===============================
async function startRescheduleFromForm() {
  console.log("Search button clicked");

  const age_group = document.getElementById("sr_age_group").value.trim();
  const gender = document.getElementById("sr_gender").value.trim();
  const division = document.getElementById("sr_division").value.trim();
  const orig_date = document.getElementById("sr_orig_date").value.trim();
  const orig_time = document.getElementById("sr_orig_time").value.trim();
  const opp_town = document.getElementById("sr_opp_town").value.trim();

  const params = new URLSearchParams({
    action: "searchRows",
    age_group,
    gender,
    division,
    orig_date,
    orig_time,
    opp_town
  });

  const url = `${BASE_URL}?${params.toString()}`;
  console.log("Search URL:", url);

  const searchStatus = document.getElementById("searchStatus");
  const gameSelectionContainer = document.getElementById("gameSelectionContainer");

  searchStatus.textContent = "";
  gameSelectionContainer.innerHTML = `<div class="loading-banner">Searching… please wait</div>`;

  const response = await fetch(url);
  const result = await response.json();
  console.log("Search result:", result);

  const matches = result.rows || [];

  // ⭐ CLEAR THE LOADING BANNER BEFORE RENDERING CARDS
  gameSelectionContainer.innerHTML = "";

  if (matches.length === 0) {
    searchStatus.textContent = "No matching games found.";
    return;
  }

  matches.forEach(m => {
    gameSelectionContainer.appendChild(renderMatchCard(m));
  });
}



// ===============================
// CREATE WORKFLOW FROM SEARCH FIELDS
// ===============================
async function createWorkflowFromSearchFields(fields) {
  const res = await apiCreateRow("");

  if (!res?.created) {
    alert("Unable to create workflow row.");
    return;
  }

  currentGameNumber = "";

  currentRowData = {
    game_number: "",
    age_group: fields.age_group,
    gender: fields.gender,
    division: fields.division,
    opp_town: fields.opp_town,
    orig_date: formatDateForStorage(fields.orig_date),
    orig_time: formatTimeForStorage(fields.orig_time),
    orig_field: "(Unknown)",
    step_1: "",
    step_2: "",
    step_3: "",
    step_4: "",
    step_5: "",
    step_6: "",
    step_7: "",
    step_8: ""
  };

  await setField("age_group", fields.age_group);
  await setField("gender", fields.gender);
  await setField("division", fields.division);
  await setField("opp_town", fields.opp_town);

  await setField("orig_date", formatDateForStorage(fields.orig_date));
  await setField("orig_time", formatTimeForStorage(fields.orig_time));
  await setField("orig_field", "(Unknown)");

  beginWorkflow();
}

async function resumeGame(gameNumber) {
  await loadGameWithoutStartingWorkflow(gameNumber);
}

async function startNewWorkflow(gameNumber) {
  const result = await apiCreateRow(gameNumber);

  currentRowData = result.row;
  currentGameNumber = gameNumber;

  hydrateTimelineFromRow(currentRowData);
  showWorkflowPage();
  renderStep(1);
}

// ===============================
// WORKFLOW PAGE SHOW/HIDE
// ===============================
function showWorkflowWithoutStarting() {
  console.log("Showing workflow without starting step progression");

  const lookup = document.getElementById("lookupContainer");
  const search = document.getElementById("searchContainer");
  const submitted = document.getElementById("submittedListContainer");

  if (lookup) lookup.style.display = "none";
  if (search) search.style.display = "none";
  if (submitted) submitted.style.display = "none";

  const page = document.getElementById("workflowPage");
  if (!page) {
    console.error("workflowPage not found in DOM");
    return;
  }
  page.style.display = "block";

  const timeline = document.getElementById("timelineContainer");
  if (timeline) timeline.style.display = "flex";

  const panel = document.getElementById("panelContainer");
  if (panel) panel.style.display = "block";

  const nextStep = findNextIncompleteStepSkippingStep1(currentRowData);
  goToStep(nextStep);

  setTimeout(() => {
    page.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

function findNextIncompleteStepSkippingStep1(row) {
  const source = row || currentRowData || {};
  for (let s = 2; s <= 8; s++) {
    if (!isStepCompleteRow(source, s)) {
      return s;
    }
  }
  return 8;
}


function beginWorkflow() {
  hideLandingPage();
  showWorkflowUI();

  let highestCompleted = 1;

  if (currentRowData) {
    for (let s = 1; s <= 8; s++) {
      if (isStepCompleteRow(currentRowData, s)) {
        highestCompleted = s;
      } else {
        break;
      }
    }
  }

  currentStep = highestCompleted;
  goToStep(currentStep);

  const workflow = document.getElementById("workflowPage");
  if (workflow) {
    workflow.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function hydrateFieldsFromRow(row) {
  console.log("hydrateFieldsFromRow called with:", row);

  currentRowData = { ...row };

  currentRowData.orig_date_input = normalizeDateForInput(row.orig_date);
  currentRowData.orig_time_input = normalizeTimeForInput(row.orig_time);
  currentRowData.final_date_input = normalizeDateForInput(row.final_date);
  currentRowData.final_time_input = normalizeTimeForInput(row.final_time);
}

// ===============================
// LANDING PAGE
// ===============================
function showLandingPage() {
  const start = document.getElementById("startContainer");
  const submitted = document.getElementById("submittedListContainer");
  const workflow = document.getElementById("workflowPage");
  const timeline = document.getElementById("timelineContainer");
  const panel = document.getElementById("panelContainer");
  const back = document.getElementById("backToListContainer");

  if (start) start.style.display = "block";
  if (submitted) submitted.style.display = "block";

  if (workflow) workflow.style.display = "none";
  if (timeline) timeline.style.display = "none";
  if (panel) panel.style.display = "none";
  if (back) back.style.display = "none";
}


function hideLandingPage() {
  const start = document.getElementById("startContainer");
  const submitted = document.getElementById("submittedListContainer");

  if (start) start.style.display = "none";
  if (submitted) submitted.style.display = "none";
}



function backToList() {
  showLandingPage();
}

// ===============================
// WORKFLOW UI
// ===============================
function showWorkflowUI() {
  const wf = document.getElementById("workflowPage");
  const tl = document.getElementById("timelineContainer");
  const panel = document.getElementById("panelContainer");
  const next = document.getElementById("nextStepContainer");
  const back = document.getElementById("backToListContainer");

  if (wf) wf.style.display = "block";
  if (tl) tl.style.display = "flex";
  if (panel) panel.style.display = "block";
  if (next) next.style.display = "block";
  if (back) back.style.display = "block";
}

// ===============================
// TIMELINE + NAVIGATION
// ===============================
function initTimeline() {
  document.querySelectorAll(".timeline-step").forEach(el => {
    el.onclick = () => {
      const step = Number(el.dataset.step);
      goToStep(step);
    };
  });

  const nextBtn = document.getElementById("nextStepBtn");
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentStep < 8) {
        goToStep(currentStep + 1);
      }
    };
  }

  const prevBtn = document.getElementById("prevStepBtn");
  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentStep > 1) {
        goToStep(currentStep - 1);
      }
    };
  }
}

function hydrateTimelineFromRow(row) {
  const source = row || currentRowData || {};

  function mark(step, complete) {
    const el = document.getElementById(`step_${step}`);
    if (!el) return;

    el.classList.remove("completed", "locked", "current");

    if (complete) {
      el.classList.add("completed");
    } else if (step === currentStep) {
      el.classList.add("current");
    } else {
      el.classList.add("locked");
    }
  }

  for (let s = 1; s <= 8; s++) {
    const complete = isStepCompleteRow(source, s);
    mark(s, complete);
  }
}

// ROW-based completeness
function isStepCompleteRow(r, step) {
  switch (step) {
    case 2:
      return (
        r.age_group &&
        r.gender &&
        r.division &&
        r.coach_last_name &&
        r.is_haysa_home &&
        r.orig_date &&
        r.orig_time &&
        r.orig_field
      );
    case 3:
      return r.coach_name && r.opp_coach_name && r.opp_town;
    case 4:
      return r.final_date && r.final_time && r.final_field;
    case 5:
      return r.step_5 === "completed";
    case 6:
      return r.haysa_status === "approved";
    case 7:
      return (
        (r.certified === "true" ||
         r.certified === "TRUE" ||
         r.certified === true) &&
        r.signed_name
      );
    case 8:
      return r.step_8 === "completed";
    default:
      return false;
  }
}



// FIELD-based completeness (for goToStep guard)
function isStepComplete(step) {
  const f = name => getField(name);

  switch (step) {
    case 2:
      return (
        f("age_group") &&
        f("gender") &&
        f("division") &&
        f("coach_last_name") &&
        f("is_haysa_home") &&
        f("orig_date") &&
        f("orig_time") &&
        f("orig_field")
      );
    case 3:
      return f("coach_name") && f("opp_coach_name") && f("opp_town");
    case 4:
      return f("final_date") && f("final_time") && f("final_field");
    case 5:
      return f("step_5") === "completed";
    case 6:
      return f("haysa_status") === "approved";
    case 7:
      return (
        (f("certified") === "true" ||
         f("certified") === "TRUE" ||
         f("certified") === true) &&
        f("signed_name")
      );
    case 8:
      return f("step_8") === "completed";
    default:
      return false;
  }
}



function goToStep(step) {
  for (let s = 2; s < step; s++) {
    if (!isStepComplete(s)) {
      alert(`You must complete Step ${s} before continuing.`);
      return;
    }
  }

  currentStep = step;

  renderPanelForStep(step);
  hydrateTimelineFromRow(currentRowData);

  const panel = document.getElementById("panelContainer");
  if (panel) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ===============================
// PANEL RENDER DISPATCH
// ===============================
function renderPanelForStep(step) {
  const panel = document.getElementById("panelContainer");
  if (!panel) return;

  panel.innerHTML = "";

  switch (step) {
    case 1: renderStep1(panel); break;
    case 2: renderStep2(panel); break;
    case 3: renderStep3(panel); break;
    case 4: renderStep4(panel); break;
    case 5: renderStep5(panel); break;
    case 6: renderStep6(panel); break;
    case 7: renderStep7(panel); break;
    case 8: renderStep8(panel); break;
  }

  const backBtn = document.getElementById("backToListContainer");
  if (backBtn) backBtn.style.display = "block";
}

// ===============================
// STEP 1
// ===============================
function renderStep1(panel) {
  panel.innerHTML = `
    <h2>Step 1 — Start Reschedule Attempt</h2>
    <p>You are beginning a reschedule workflow for game #${currentGameNumber}.</p>
    <p>This will track all moves and approvals for this game.</p>

    <button id="s1_proceed" class="primary-btn">I want to proceed</button>
  `;

  document.getElementById("s1_proceed").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 1);
    currentRowData.step_1 = "completed";
    hydrateTimelineFromRow(currentRowData);
    goToStep(2);
  };
}

// ===============================
// STEP 2
// ===============================
function renderStep2(panel) {
  const origDateInput =
    currentRowData.orig_date_input ||
    normalizeDateForInput(getField("orig_date"));

  const origTimeInput =
    currentRowData.orig_time_input ||
    normalizeTimeForInput(getField("orig_time"));

  panel.innerHTML = `
    <h2>Step 2 — Original Game Details</h2>
    <p>Enter the current/original game details.</p>

    <h3>Team Identity</h3>

    <label>Age Group (e.g., 5/6, 7/8)</label>
    <input type="text" id="age_group" value="${getField("age_group") || ""}">

    <label>Gender</label>
    <select id="gender">
      <option value="">Select…</option>
      <option value="Girls" ${getField("gender")==="Girls"?"selected":""}>Girls</option>
      <option value="Boys" ${getField("gender")==="Boys"?"selected":""}>Boys</option>
    </select>

    <label>Division (Presidents, 6.2, etc.)</label>
    <input type="text" id="division" value="${getField("division") || ""}">

    <label>Coach Last Name</label>
    <input type="text" id="coach_last_name" value="${getField("coach_last_name") || ""}">

    <label>Is HAYSA the Home Team?</label>
    <select id="is_haysa_home">
      <option value="">Select…</option>
      <option value="true" ${getField("is_haysa_home")==="true"?"selected":""}>Home</option>
      <option value="false" ${getField("is_haysa_home")==="false"?"selected":""}>Away</option>
    </select>

    <h3>Original Game Details</h3>

    <label>Original Date</label>
    <input type="date" id="orig_date" value="${origDateInput}">

    <label>Original Time</label>
    <input type="time" id="orig_time" value="${origTimeInput}">

    <label>Original Field</label>
    <input type="text" id="orig_field" value="${getField("orig_field") || ""}">
    
    <div id="s2_missing" class="required-note"></div>
    
    <button id="s2_save" class="primary-btn">Save Original Details</button>
  `;

  document.getElementById("s2_save").onclick = async () => {
    const ageGroup = document.getElementById("age_group").value.trim();
    const gender = document.getElementById("gender").value;
    const division = document.getElementById("division").value.trim();
    const coachLast = document.getElementById("coach_last_name").value.trim();
    const isHome = document.getElementById("is_haysa_home").value;

    const origDateRaw = document.getElementById("orig_date").value;
    const origTimeRaw = document.getElementById("orig_time").value;
    const origField = document.getElementById("orig_field").value.trim();

    const missing = [];
    function check(id, value, label) {
      const el = document.getElementById(id);
      if (!value) {
        el.classList.add("required-missing");
        missing.push(label);
      } else {
        el.classList.remove("required-missing");
      }
    }

    check("age_group", ageGroup, "Age Group");
    check("gender", gender, "Gender");
    check("division", division, "Division");
    check("coach_last_name", coachLast, "Coach Last Name");
    check("is_haysa_home", isHome, "Home/Away");
    check("orig_date", origDateRaw, "Original Date");
    check("orig_time", origTimeRaw, "Original Time");
    check("orig_field", origField, "Original Field");

    const warningBox = document.getElementById("s2_missing");
    warningBox.innerHTML = missing.length
      ? `⚠ Missing required fields: ${missing.join(", ")}`
      : "";

    const origDate = formatDateForStorage(origDateRaw);
    const origTime = formatTimeForStorage(origTimeRaw);

    const ageDivision = `${ageGroup} ${gender} ${division}`;
    const teamName = `${ageGroup} ${gender} (${coachLast})`;

    await setField("age_group", ageGroup);
    await setField("gender", gender);
    await setField("division", division);
    await setField("coach_last_name", coachLast);

    await setField("age_division", ageDivision);
    await setField("team_name", teamName);

    await setField("is_haysa_home", isHome);

    await setField("orig_date", origDate);
    await setField("orig_time", origTime);
    await setField("orig_field", origField);

    if (
      ageGroup &&
      gender &&
      division &&
      coachLast &&
      isHome &&
      origDateRaw &&
      origTimeRaw &&
      origField
    ) {
      await apiUpdateStep(currentGameNumber, 2);
      currentRowData.step_2 = "completed";
    }

    hydrateTimelineFromRow(currentRowData);
    alert("Information saved.");
  };
}

// ===============================
// STEP 3
// ===============================
function renderStep3(panel) {
  panel.innerHTML = `
    <h2>Step 3 — Coach & Opponent Contact</h2>
    <p>Record your contact details and the opponent coach details.</p>

    <h3>Your Contact Info</h3>

    <label>Your Name</label>
    <input type="text" id="coach_name" value="${getField("coach_name") || ""}">

    <h3>Opposing Coach Info</h3>

    <label>Opposing Coach Name</label>
    <input type="text" id="opp_coach_name" value="${getField("opp_coach_name") || ""}">

    <h3>Opponent Team Info</h3>

    <label>Opponent Town</label>
    <input type="text" id="opp_town" value="${getField("opp_town") || ""}">

    <button id="s3_save" class="primary-btn">Save Contact Details</button>
  `;

  document.getElementById("s3_save").onclick = async () => {
    const coachName = document.getElementById("coach_name").value.trim();
    const oppName = document.getElementById("opp_coach_name").value.trim();
    const oppTown = document.getElementById("opp_town").value.trim();

    await setField("coach_name", coachName);
    await setField("opp_coach_name", oppName);
    await setField("opp_town", oppTown);

    if (coachName && oppName && oppTown) {
      await apiUpdateStep(currentGameNumber, 3);
      currentRowData.step_3 = "completed";
    }

    hydrateTimelineFromRow(currentRowData);
    alert("Information saved.");
  };
}

// ===============================
// STEP 4
// ===============================
function renderStep4(panel) {
  const origField = getField("orig_field") || "Unknown Field";
  const origHomeAway = getField("is_haysa_home") === "true" ? "Home" : "Away";

  panel.innerHTML = `
    <h2>Step 4 — Choose & Confirm New Game Time</h2>

    <p class="info-text">
      Confirm the final agreed date, time, and field. If the field is not changing,
      you may keep the original field.
    </p>

    <div class="section">
      <h3>Final Agreed Game Details</h3>

      <label>Final Date</label>
      <input type="date" id="final_date">

      <label>Final Time</label>
      <input type="time" id="final_time">

      <div class="field-change-block">
        <p><strong>Original Field:</strong> ${origField} (${origHomeAway})</p>

        <label>Is the field changing?</label>
        <div class="radio-group">
          <label><input type="radio" name="field_change" value="no"> No — keep original field</label>
          <label><input type="radio" name="field_change" value="yes"> Yes — change field</label>
        </div>
      </div>

      <div id="field_change_ui" style="display:none; margin-top:12px;">
        <label>Will the rescheduled game be:</label>
        <div class="radio-group">
          <label><input type="radio" name="new_homeaway" value="home"> Home</label>
          <label><input type="radio" name="new_homeaway" value="away"> Away</label>
        </div>

        <div id="home_field_ui" style="display:none; margin-top:12px;">
          <label>Select new home field</label>
          <select id="final_field_home">
            <option value="">Select a field…</option>
            <option value="Holbrook HS Turf">Holbrook HS Turf</option>
            <option value="Sumner/Sean Joyce Fields">Sumner/Sean Joyce Fields</option>
            <option value="Brookville Fields">Brookville Fields</option>
            <option value="Avon Butler Fields">Avon Butler Fields</option>
          </select>
        </div>

        <div id="away_field_ui" style="display:none; margin-top:12px;">
          <label>Enter new away field</label>
          <input type="text" id="final_field_away" placeholder="Enter away field">
        </div>
      </div>

      <button class="primary-btn" onclick="saveFinalDetails()">Save Final Details</button>
    </div>

    <hr>

    <div class="section">
      <h3>Check Field Availability</h3>
      <p>Use the calendar below to find open field slots for your proposed reschedule.</p>

      <iframe
        src="https://haysa-soccer.github.io/haysa-scheduler-ui/"
        class="calendar-embed">
      </iframe>
    </div>

    <hr>

    <div class="section">
      <h3>Proposed Options (Board Approval Required)</h3>
      <p>Propose up to two possible date/time/field options. The board will approve or reject each.</p>

      <div class="option-block">
        <h4>Option 1</h4>
        <label>Date</label>
        <input type="date" id="opt1_date">

        <label>Time</label>
        <input type="time" id="opt1_time">

        <label>Field</label>
        <input type="text" id="opt1_field">

        <button class="secondary-btn" onclick="saveOption(1)">
          Save Option 1
        </button>
      </div>

      <div class="option-block">
        <h4>Option 2</h4>
        <label>Date</label>
        <input type="date" id="opt2_date">

        <label>Time</label>
        <input type="time" id="opt2_time">

        <label>Field</label>
        <input type="text" id="opt2_field">

        <button class="secondary-btn" onclick="saveOption(2)">
          Save Option 2
        </button>
      </div>
    </div>
  `;

  hydrateStep4();
}

function hydrateStep4() {
  console.log("hydrateStep4 running");

  const finalDateEl = document.getElementById("final_date");
  if (finalDateEl) {
    const raw = getField("final_date");
    finalDateEl.value = raw ? normalizeDateForInput(raw) : "";
  }

  const finalTimeEl = document.getElementById("final_time");
  if (finalTimeEl) {
    const raw = getField("final_time");
    finalTimeEl.value = raw ? normalizeTimeForInput(raw) : "";
  }

  const fieldChange = getField("field_change");
  const fieldChangeRadios = document.getElementsByName("field_change");
  const fieldChangeUI = document.getElementById("field_change_ui");

  if (fieldChangeRadios && fieldChangeRadios.length > 0) {
    fieldChangeRadios.forEach(r => {
      if (r.value === fieldChange) r.checked = true;
      r.onchange = () => {
        fieldChangeUI.style.display = r.value === "yes" ? "block" : "none";
      };
    });

    fieldChangeUI.style.display = fieldChange === "yes" ? "block" : "none";
  }

  const newHomeAway = getField("new_homeaway");
  const homeAwayRadios = document.getElementsByName("new_homeaway");
  const homeUI = document.getElementById("home_field_ui");
  const awayUI = document.getElementById("away_field_ui");

  if (homeAwayRadios && homeAwayRadios.length > 0) {
    homeAwayRadios.forEach(r => {
      if (r.value === newHomeAway) r.checked = true;
      r.onchange = () => {
        homeUI.style.display = r.value === "home" ? "block" : "none";
        awayUI.style.display = r.value === "away" ? "block" : "none";
      };
    });

    homeUI.style.display = newHomeAway === "home" ? "block" : "none";
    awayUI.style.display = newHomeAway === "away" ? "block" : "none";
  }

  const finalFieldHomeEl = document.getElementById("final_field_home");
  if (finalFieldHomeEl && newHomeAway === "home") {
    const raw = getField("final_field");
    finalFieldHomeEl.value = raw || "";
  }

  const finalFieldAwayEl = document.getElementById("final_field_away");
  if (finalFieldAwayEl && newHomeAway === "away") {
    const raw = getField("final_field");
    finalFieldAwayEl.value = raw || "";
  }

  const opt1DateEl = document.getElementById("opt1_date");
  const opt1TimeEl = document.getElementById("opt1_time");
  const opt1FieldEl = document.getElementById("opt1_field");

  if (opt1DateEl) {
    const raw = getField("opt1_date");
    opt1DateEl.value = raw ? normalizeDateForInput(raw) : "";
  }
  if (opt1TimeEl) {
    const raw = getField("opt1_time");
    opt1TimeEl.value = raw ? normalizeTimeForInput(raw) : "";
  }
  if (opt1FieldEl) {
    opt1FieldEl.value = getField("opt1_field") || "";
  }

  const opt2DateEl = document.getElementById("opt2_date");
  const opt2TimeEl = document.getElementById("opt2_time");
  const opt2FieldEl = document.getElementById("opt2_field");

  if (opt2DateEl) {
    const raw = getField("opt2_date");
    opt2DateEl.value = raw ? normalizeDateForInput(raw) : "";
  }
  if (opt2TimeEl) {
    const raw = getField("opt2_time");
    opt2TimeEl.value = raw ? normalizeTimeForInput(raw) : "";
  }
  if (opt2FieldEl) {
    opt2FieldEl.value = getField("opt2_field") || "";
  }

  console.log("hydrateStep4 complete");
}

// ===============================
// STEP 5
// ===============================
function renderStep5(panel) {
  const finalField = (getField("final_field") || "").toLowerCase();

  const HOME_KEYWORDS = [
    "holbrook",
    "haysa",
    "sumner",
    "sean joyce",
    "brookville",
    "avon",
    "butler"
  ];

  const isHome = HOME_KEYWORDS.some(keyword =>
    finalField.includes(keyword)
  );

  let message = "";
  if (isHome) {
    message = `
      <p>
        A field hold request has been automatically sent to the board based on
        the final game details you entered in Step 4.
      </p>
      <p>
        The board will temporarily reserve the field until SSSL approves the
        reschedule and it is officially updated in TeamSideline.
      </p>
    `;
  } else {
    message = `
      <p>
        No field hold is required because the rescheduled game will be played
        at an away location.
      </p>
    `;
  }

  panel.innerHTML = `
    <h2>Step 5 — Field Hold</h2>
    ${message}
    <p class="info-text">
      This step is informational only. No action is required from the coach.
    </p>
  `;

  if (currentRowData.step_5 !== "completed") {
    apiUpdateStep(currentGameNumber, 5);
    currentRowData.step_5 = "completed";
    hydrateTimelineFromRow(currentRowData);
  }
}

// ===============================
// STEP 6
// ===============================
function renderStep6(panel) {
  const approval = getField("haysa_status") || "";
  const notes = getField("haysa_notes") || "";

  panel.innerHTML = `
    <h2>Step 6 — HAYSA Approval</h2>
    <p>The HAYSA board must approve this reschedule request.</p>

    <label>Approval Status</label>
    <select id="haysa_status">
      <option value="">Select…</option>
      <option value="approved" ${approval==="approved"?"selected":""}>Approved</option>
      <option value="denied" ${approval==="denied"?"selected":""}>Denied</option>
    </select>

    <label>Board Notes (optional)</label>
    <input type="text" id="haysa_notes" value="${notes}">

    <button id="s6_save" class="primary-btn">Save Approval Status</button>
  `;

  document.getElementById("s6_save").onclick = async () => {
    const newStatus = document.getElementById("haysa_status").value;
    const newNotes = document.getElementById("haysa_notes").value.trim();

    if (!newStatus) {
      alert("Please select an approval status.");
      return;
    }

    await setField("haysa_status", newStatus);
    await setField("haysa_notes", newNotes);

    if (newStatus === "approved") {
      await apiUpdateStep(currentGameNumber, 6);
      currentRowData.step_6 = "completed";
      hydrateTimelineFromRow(currentRowData);
    }

    alert("Approval status saved.");
  };
}

// ===============================
// STEP 7
// ===============================
function renderStep7(panel) {
  const fd = name => getField(name) || "";

  const isHomeOriginal = fd("is_haysa_home") === "true";
  const oppTown = fd("opp_town");
  const awayTeam = oppTown;
  const teamName = fd("team_name");

  const homeTeamOriginal = isHomeOriginal ? teamName : awayTeam;
  const awayTeamOriginal = isHomeOriginal ? awayTeam : teamName;

  const homeTeamFinal = homeTeamOriginal;
  const awayTeamFinal = awayTeamOriginal;

  panel.innerHTML = `
    <h2>Step 7 — SSSL Form Auto‑Fill</h2>
    <p>Review and confirm the SSSL reschedule form details.</p>

    <h3>Team Information</h3>
    <div class="sssl-field">Age/Gender/Division: <strong>${fd("age_division")}</strong></div>
    <div class="sssl-field">Team Name: <strong>${teamName}</strong></div>

    <h3>Original Game</h3>
    <div class="sssl-field">Home Team: <strong>${homeTeamOriginal}</strong></div>
    <div class="sssl-field">Away Team: <strong>${awayTeamOriginal}</strong></div>
    <div class="sssl-field">Date: <strong>${fd("orig_date")}</strong></div>
    <div class="sssl-field">Time: <strong>${fd("orig_time")}</strong></div>
    <div class="sssl-field">Location: <strong>${fd("orig_field")}</strong></div>

    <h3>New Game</h3>
    <div class="sssl-field">Home Team: <strong>${homeTeamFinal}</strong></div>
    <div class="sssl-field">Away Team: <strong>${awayTeamFinal}</strong></div>
    <div class="sssl-field">Date: <strong>${fd("final_date")}</strong></div>
    <div class="sssl-field">Time: <strong>${fd("final_time")}</strong></div>
    <div class="sssl-field">Location: <strong>${fd("final_field")}</strong></div>

    <h3>Coach Information</h3>
    <div class="sssl-field">
      Coach Name:
      <strong>${fd("coach_name")}</strong>
    </div>
    
    <h3>Opponent Information</h3>
    <div class="sssl-field">
      Opposing Coach Name:
      <strong>${fd("opp_coach_name")}</strong>
    </div>
    
    <div class="sssl-field">
      Opponent Town:
      <strong>${fd("opp_town")}</strong>
    </div>

    <h3>Certification</h3>
    <label>
      <input
        type="checkbox"
        id="certified"
        ${fd("certified")==="true" || fd("certified")==="TRUE" ? "checked" : ""}
      >
      I certify the opposing coach agreed to this change.
    </label>


    <label>Signed Name</label>
    <input type="text" id="signed_name" value="${fd("signed_name")}">

    <button id="s7_save" class="primary-btn">Save SSSL Form Details</button>
  `;

  document.getElementById("s7_save").onclick = async () => {
    const certified = document.getElementById("certified").checked;
    const signedName = document.getElementById("signed_name").value.trim();

    if (!certified) {
      alert("You must certify that the opposing coach agreed.");
      return;
    }

    if (!signedName) {
      alert("Signed name is required.");
      return;
    }

    await setField("certified", certified ? "true" : "false");
    await setField("signed_name", signedName);

    await apiUpdateStep(currentGameNumber, 7);
    currentRowData.step_7 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("SSSL form details saved.");
  };
}

// ===============================
// STEP 8
// ===============================
function renderStep8(panel) {
  const row = currentRowData;

  function isComplete() {
    const required = [
      "age_division",
      "team_name",
      "is_haysa_home",
      "orig_date",
      "orig_time",
      "orig_field",
      "final_date",
      "final_time",
      "final_field",
      "coach_name",
      "coach_phone",
      "opp_coach_name",
      "opp_coach_email",
      "opp_coach_phone",
      "certified",
      "signed_name"
    ];

    return required.every(f => row[f] && row[f] !== "" && row[f] !== "TBD");
  }

  const summaryText = generateSSSLEmailSummary(row);

  panel.innerHTML = `
    <h2>Step 8 — Finalize Request</h2>
    <p>
      Download the completed form and record any final notes.
      Private contact information entered below is used only
      for generating the SSSL form and is not stored.
    </p>
    
    <h3>Private Contact Information</h3>

    <p>
      This information is used only for generating the SSSL form.
      It is not stored in the workflow.
    </p>
    
    <label>Your Contact Information</label>
    <input type="text" id="coach_contact_temp" placeholder="Phone number or email">
    
    <label>Opponent Coach Contact Information</label>
    <input type="text" id="opp_coach_contact_temp" placeholder="Phone number or email">

    <button id="s8_download" class="primary-btn">Download Completed Form</button>

    <h3>SSSL Email Summary</h3>
    <pre id="sssl_summary_box" class="summary-box">${summaryText}</pre>
    <button id="s8_summary" class="secondary-btn">Copy SSSL Summary</button>

    <label>Board Notes (optional)</label>
    <input type="text" id="notes" value="${getField("notes") || ""}">

    <button id="s8_save" class="secondary-btn">Mark Request Complete</button>
  `;

  document.getElementById("s8_download").onclick = () => {
    const coachContact = document
      .getElementById("coach_contact_temp")
      .value.trim();
    const oppCoachContact = document
      .getElementById("opp_coach_contact_temp")
      .value.trim();

    if (!coachContact || !oppCoachContact) {
      alert("Contact information is required for both coaches.");
      return;
    }

    window.open(
      `${API_URL}?action=previewSSSLForm` +
        `&game_number=${row.game_number}` +
        `&coach_contact=${encodeURIComponent(coachContact)}` +
        `&opp_coach_contact=${encodeURIComponent(oppCoachContact)}`,
      "_blank"
    );
  };

  document.getElementById("s8_summary").onclick = () => {
    copyToClipboard(summaryText);
    alert("SSSL summary copied to clipboard.");
  };

  document.getElementById("s8_save").onclick = async () => {
    if (!isComplete()) {
      alert(
        "Some required fields are missing. Please review all steps before finalizing."
      );
      return;
    }

    await setField("notes", document.getElementById("notes").value);

    await apiUpdateStep(currentGameNumber, 8);
    currentRowData.step_8 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Request marked complete.");
  };
}

// ===============================
// SIGNATURE PAD + FORM SAVE
// ===============================
function initGameChangeForm() {
  const form = document.getElementById("gameChangeForm");
  const canvas = document.getElementById("signaturePad");
  const clearBtn = document.getElementById("clearSignature");

  if (!form || !canvas || !clearBtn) {
    console.warn("Game Change Form not fully present — skipping init.");
    return;
  }

  const ctx = canvas.getContext("2d");
  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function startDraw(x, y) {
    drawing = true;
    lastX = x;
    lastY = y;
  }

  function drawLine(x, y) {
    if (!drawing) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  }

  canvas.onmousedown = e => {
    const r = canvas.getBoundingClientRect();
    startDraw(e.clientX - r.left, e.clientY - r.top);
  };
  canvas.onmousemove = e => {
    const r = canvas.getBoundingClientRect();
    drawLine(e.clientX - r.left, e.clientY - r.top);
  };
  canvas.onmouseup = () => (drawing = false);
  canvas.onmouseleave = () => (drawing = false);

  canvas.ontouchstart = e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    startDraw(t.clientX - r.left, t.clientY - r.top);
  };
  canvas.ontouchmove = e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    drawLine(t.clientX - r.left, t.clientY - r.top);
  };
  canvas.ontouchend = () => (drawing = false);

  clearBtn.onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

  form.onsubmit = async e => {
    e.preventDefault();

    const fd = new FormData(form);
    const signatureData = canvas.toDataURL();

    if (typeof generateReschedulePDF === "function") {
      try {
        await generateReschedulePDF({
          game_number: fd.get("game_number"),
          team_name: fd.get("team_name"),
          orig_date: fd.get("orig_date"),
          orig_time: fd.get("orig_time"),
          orig_field: fd.get("orig_field"),
          final_date: fd.get("final_date"),
          final_time: fd.get("final_time"),
          final_field: fd.get("final_field"),
          coach_name: fd.get("coach_name"),
          coach_email: fd.get("coach_email"),
          coach_phone: fd.get("coach_phone"),
          opp_coach_name: fd.get("opp_coach_name"),
          opp_coach_phone: fd.get("opp_coach_phone"),
          signature_data: signatureData
        });
      } catch (err) {
        console.warn("PDF generation skipped or failed:", err);
      }
    }

    const fieldsToSave = [
      "team_name",
      "orig_date",
      "orig_time",
      "orig_field",
      "final_date",
      "final_time",
      "final_field",
      "coach_name",
      "coach_email",
      "coach_phone",
      "opp_coach_name",
      "opp_coach_phone"
    ];

    for (const name of fieldsToSave) {
      const val = fd.get(name);
      await setField(name, val);
    }

    await apiUpdateStep(currentGameNumber, 7);
    currentRowData.step_7 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Form saved.");
  };
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  initTimeline();

  const backBtn = document.getElementById("backToListBtn");
  if (backBtn) backBtn.onclick = backToList;

  initGameChangeForm();
});
