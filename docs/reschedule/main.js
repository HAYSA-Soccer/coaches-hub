// ===============================
// CONFIG / API LAYER
// ===============================

const API_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";
const BASE_URL = API_URL;


// Convert "MM/dd/yyyy" -> "yyyy-MM-dd" for <input type="date">
function normalizeDateForInput(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}


function showSingleMatchConfirmation(match) {
  const container = document.getElementById("gameSelectionContainer");
  container.innerHTML = `
    <div class="match-card">
      <h3>We found a matching game</h3>

      <div><strong>Team:</strong> ${match.team_name}</div>
      <div><strong>Opponent:</strong> ${match.opp_town}</div>
      <div><strong>Original Date:</strong> ${match.orig_date}</div>
      <div><strong>Original Time:</strong> ${match.orig_time}</div>
      <div><strong>Field:</strong> ${match.orig_field}</div>
      <div><strong>Game #:</strong> ${match.game_number}</div>

      <div class="button-row">
        <button class="primary-btn" onclick="useExistingOrStartNew('${match.game_number}')">
          Use This Game
        </button>

        <button class="secondary-btn" onclick="createNewFromSearchInputs()">
          Create New Case Instead
        </button>
      </div>
    </div>
  `;
}


function createNewFromSearchInputs() {
  const age_group = document.getElementById("sr_age_group").value.trim();
  const gender = document.getElementById("sr_gender").value.trim();
  const division = document.getElementById("sr_division").value.trim();
  const orig_date = document.getElementById("sr_orig_date").value.trim();
  const orig_time = document.getElementById("sr_orig_time").value.trim();
  const opp_town = document.getElementById("sr_opp_town").value.trim();

  createWorkflowFromSearchFields({
    age_group,
    gender,
    division,
    orig_date,
    orig_time,
    opp_town
  });
}


function showSingleMatchConfirmation(match) {
  const container = document.getElementById("gameSelectionContainer");

  container.innerHTML = `
    <div class="match-card">
      <h3>We found a matching game</h3>

      <div><strong>Team:</strong> ${match.team_name}</div>
      <div><strong>Opponent:</strong> ${match.opp_town}</div>
      <div><strong>Original Date:</strong> ${normalizeDateForInput(match.orig_date)}</div>
      <div><strong>Original Time:</strong> ${normalizeTimeForInput(match.orig_time)}</div>
      <div><strong>Field:</strong> ${match.orig_field}</div>
      <div><strong>Game #:</strong> ${match.game_number}</div>

      <div class="button-row">
        <button class="primary-btn" onclick="useExistingOrStartNew('${match.game_number}')">
          Use This Game
        </button>

        <button class="secondary-btn" onclick="createNewFromSearchInputs()">
          Create New Case Instead
        </button>
      </div>
    </div>
  `;
}



async function resumeWorkflow(gameNumber) {
  const result = await apiGetRow(gameNumber);

  if (!result || !result.exists) {
    alert("Unable to load workflow row.");
    return;
  }

  currentRowData = result.row;   // ← CRITICAL

  hydrateTimelineFromRow(currentRowData);

  showWorkflowPage();

  renderStep(currentRowData.current_step || 1);
}





function useExistingOrStartNew(gameNumber) {
  if (workflowExists(gameNumber)) {
    resumeWorkflow(gameNumber);
  } else {
    startNewWorkflow(gameNumber);
  }
}

async function apiGetRow(gameNumber) {
  const form = new FormData();
  form.append("action", "getRow");
  form.append("game_number", gameNumber);

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}


function createNewFromSearchInputs() {
  const age_group = document.getElementById("sr_age_group").value.trim();
  const gender = document.getElementById("sr_gender").value.trim();
  const division = document.getElementById("sr_division").value.trim();
  const orig_date = document.getElementById("sr_orig_date").value.trim();
  const orig_time = document.getElementById("sr_orig_time").value.trim();
  const opp_town = document.getElementById("sr_opp_town").value.trim();

  createWorkflowFromSearchFields({
    age_group,
    gender,
    division,
    orig_date,
    orig_time,
    opp_town
  });
}




// Convert "h:mm AM/PM" -> "HH:mm" for <input type="time">
function normalizeTimeForInput(value) {
  if (!value) return "";

  // Already HH:mm
  if (/^\d{2}:\d{2}$/.test(value)) return value;

  // ISO timestamp from Sheets
  if (value.includes("T")) {
    const d = new Date(value);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // h:mm AM/PM
  const m = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  let [, hh, mm, ap] = m;
  hh = parseInt(hh, 10);

  ap = ap.toUpperCase();
  if (ap === "PM" && hh < 12) hh += 12;
  if (ap === "AM" && hh === 12) hh = 0;

  return `${String(hh).padStart(2, "0")}:${mm}`;
}


// Convert "yyyy-MM-dd" -> "MM/dd/yyyy" for storage in sheet
function formatDateForStorage(value) {
  if (!value) return "";
  const [yyyy, mm, dd] = value.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

// Convert "HH:mm" -> "h:mm AM/PM" for storage in sheet
function formatTimeForStorage(value) {
  if (!value) return "";
  const [hh, mm] = value.split(":");
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


// Generate Email Summary =======================================

function generateSSSLEmailSummary(row) {
  return `
Subject: Reschedule Request – Game #${row.game_number}

Attached is the completed reschedule form for:

Game Number: ${row.game_number}
Teams: ${row.team_name} vs ${row.opp_town}
Original: ${row.orig_date} at ${row.orig_time} (${row.orig_field})
New: ${row.final_date} at ${row.final_time} (${row.final_field})
  `.trim();
}


function showSSSLEmailSummary(row) {
  const text = generateSSSLEmailSummary(row);
  window.prompt("Copy the SSSL email summary:", text);
}


// ---------------------------------------------------------------
// =================== BOARD SUMMARY VIEW ========================
// ---------------------------------------------------------------

function renderBoardDashboard(rows) {
  const container = document.getElementById("boardDashboard");
  container.innerHTML = "";

  rows.forEach(row => {
    const status = computeBoardStatus(row);

    const div = document.createElement("div");
    div.className = "submitted-grid";

    div.innerHTML = `
      <div class="sg-col">
        <div class="sg-label">Game #</div>
        <div class="sg-value">${row.game_number}</div>
      </div>

      <div class="sg-col">
        <div class="sg-label">Team</div>
        <div class="sg-value">${row.team_name}</div>
        <div class="sg-sub">${row.age_group} ${row.gender} — ${row.division}</div>
      </div>

      <div class="sg-col">
        <div class="sg-label">Original</div>
        <div class="sg-value">${row.orig_date} @ ${row.orig_time}</div>
        <div class="sg-sub">${row.orig_field}</div>
      </div>

      <div class="sg-col">
        <div class="sg-label">Status</div>
        <div class="sg-value">${status.label}</div>
        <div class="sg-sub">${status.detail}</div>
      </div>

      <div class="sg-action">
        <button class="primary-btn" onclick="resumeGame('${row.game_number}')">
          Open
        </button>
      </div>
    `;

    container.appendChild(div);
  });
}

function computeBoardStatus(row) {
  // Finalized
  if (row.step_8 === "completed") {
    return { label: "Complete", detail: "SSSL approved — no further action" };
  }

  // Sent to SSSL
  if (row.step_7 === "completed") {
    return { label: "Pending SSSL", detail: "Awaiting SSSL approval" };
  }

  // HAYSA approved
  if (row.step_6 === "completed") {
    return { label: "Ready to Send", detail: "HAYSA approved — send packet to SSSL" };
  }

  // Options approved
  if (row.opt1_status === "approved" || row.opt2_status === "approved") {
    return { label: "HAYSA Review", detail: "Option approved — waiting for HAYSA final check" };
  }

  // Coach submitted
  if (row.step_3 === "completed") {
    return { label: "Coach Submitted", detail: "Board review required" };
  }

  return { label: "In Progress", detail: "Coach still entering details" };
}

// ===========================================



// ===============================
// STATE
// ===============================
let currentGameNumber = null;
let currentRowData = null;
let currentStep = 1;

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  // Hide workflow UI on landing page
  const wf = document.getElementById("workflowPage");
  const tl = document.getElementById("timelineContainer");
  const panel = document.getElementById("panelContainer");
  const back = document.getElementById("backToListContainer");
  const formSection = document.getElementById("formSection");

  const backBtn = document.getElementById("backToListBtn");
  if (backBtn) {
    backBtn.onclick = backToList;
  }

  if (wf) wf.style.display = "none";
  if (tl) tl.style.display = "none";
  if (panel) panel.style.display = "none";
  if (back) back.style.display = "none";
  if (formSection) formSection.style.display = "none";

  initTimeline();
  loadSubmittedRequests();
  initGameChangeForm();
});

// ===============================
// API FUNCTIONS
// ===============================



async function createNewFromLookup() {
  const gameNumber =
    document.getElementById("lookupGameNumber").value.trim();

  if (!gameNumber) {
    alert("Enter a game number.");
    return;
  }

  startNewWorkflow(gameNumber);
}


// Fetch a single game row by game number
async function apiGetGame(gameNumber) {
  const url = `${BASE_URL}?action=getRow&game_number=${encodeURIComponent(gameNumber)}`;

  console.log("apiGetGame sending:", gameNumber);
  console.log("Full URL:", url);

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return null;

    return await response.json(); // expect { exists: true/false, data: {...} }
  } catch (err) {
    console.error("apiGetGame error:", err);
    return null;
  }
}

// Fetch ALL rows for landing page
async function apiGetAllRows() {
  const url = `${BASE_URL}?action=getAllRows`;

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

// Create a new workflow row
async function apiCreateRow(gameNumber) {
  const form = new FormData();
  form.append("action", "createRow");
  form.append("game_number", gameNumber);
  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

// UNIVERSAL FIELD UPDATE
async function apiUpdateField(gameNumber, field, value) {
  const form = new FormData();
  form.append("action", "updateField");
  form.append("game_number", gameNumber);
  form.append("field", field);
  form.append("value", value == null ? "" : value);
  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

// STEP_X UPDATE (maps to step_1..step_8)
async function apiUpdateStep(gameNumber, stepNumber) {
  return apiUpdateField(gameNumber, `step_${stepNumber}`, "completed");
}

// SSSL form download — avoid CORS by letting browser navigate
function apiDownloadSSSLForm(gameNumber) {
  const url = `${BASE_URL}?action=generateSSSLForm&game_number=${encodeURIComponent(gameNumber)}`;
  window.open(url, "_blank");
}



function autoMoveApprovedOption(optionNumber) {
  const row = currentRowData;

  const date = row[`opt${optionNumber}_date`];
  const time = row[`opt${optionNumber}_time`];
  const field = row[`opt${optionNumber}_field`];

  // Auto-fill final section
  document.getElementById("final_date").value = date;
  document.getElementById("final_time").value = time;
  document.getElementById("final_field").value = field;

  // Save final details
  saveFinalDetails();
}



// ===============================
// HELPERS
// ===============================

// =============== Update step 4 button =========================
async function apiUpdateFinal(gameNumber, finalDate, finalTime, finalField) {
  const form = new FormData();
  form.append("action", "updateFinal");
  form.append("game_number", gameNumber);
  form.append("final_date", finalDate);
  form.append("final_time", finalTime);
  form.append("final_field", finalField);

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

// =========================================================
function convertToHtmlDate(mmddyyyy) {
  if (!mmddyyyy) return "";
  const [mm, dd, yyyy] = mmddyyyy.split("/");
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function convertToHtmlTime(timeStr) {
  if (!timeStr) return "";
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":");

  if (modifier === "PM" && hours !== "12") {
    hours = String(Number(hours) + 12);
  }
  if (modifier === "AM" && hours === "12") {
    hours = "00";
  }

  return `${hours}:${minutes}`;
}

//============= REVERSE TIMEDATE CONVERTERS =================

function convertFromHtmlDate(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [yyyy, mm, dd] = yyyy_mm_dd.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

function convertFromHtmlTime(hhmm) {
  if (!hhmm) return "";
  let [hours, minutes] = hhmm.split(":");
  let modifier = "AM";

  if (Number(hours) >= 12) {
    modifier = "PM";
    if (Number(hours) > 12) {
      hours = String(Number(hours) - 12);
    }
  } else if (Number(hours) === 0) {
    hours = "12";
  }

  return `${hours}:${minutes} ${modifier}`;
}

// ========================================================


async function saveFinalDetails() {
  const dateHtml = document.getElementById("final_date").value;
  const timeHtml = document.getElementById("final_time").value;

  const finalDate = convertFromHtmlDate(dateHtml);
  const finalTime = convertFromHtmlTime(timeHtml);

  const select = document.getElementById("final_field_select");
  const custom = document.getElementById("final_field_custom");

  const finalField =
    select.value === "__custom__" ? custom.value : select.value;

  // Save to Google Sheet
  await apiUpdateFinal(currentGameNumber, finalDate, finalTime, finalField);

  // ⭐ Save to local workflow object (THIS WAS MISSING)
  currentRowData.final_date = finalDate;
  currentRowData.final_time = finalTime;
  currentRowData.final_field = finalField;
  currentRowData.step_4 = "completed";

  // Refresh timeline
  hydrateTimelineFromRow(currentRowData);

  // Auto-complete Step 5
  if (currentRowData.step_5 !== "completed") {
    await apiUpdateStep(currentGameNumber, 5);
    currentRowData.step_5 = "completed";
    hydrateTimelineFromRow(currentRowData);
  }

  alert("Final details saved.");
}




function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

function formatTime(t) {
  if (!t) return "";
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getHighestCompletedStep(row) {
  let highest = 1;
  for (let s = 1; s <= 8; s++) {
    if (isStepComplete(row, s)) {
      highest = s;
    }
  }
  return highest;
}

function computeStatus(row) {
  const highest = getHighestCompletedStep(row);

  if (highest >= 8) return "Finalized";
  if (highest >= 7) return "SSSL Form Ready";          // Step 7
  if (highest >= 6) return "Awaiting HAYSA Approval";  // Step 6
  if (highest >= 4) return "Awaiting Opponent";        // Step 4
  return "Drafting Options";
}

function getField(field) {
  if (!currentRowData) return "";
  return currentRowData[field] == null ? "" : currentRowData[field];
}

async function setField(field, value) {
  if (!currentRowData) currentRowData = {};
  currentRowData[field] = value;
  await apiUpdateField(currentGameNumber, field, value);
}


function getWorkflowStatus(row) {

  if (row.step_8 === "completed") {
    return "✅ Complete";
  }

  if (
    row.proposed_1_status === "pending" ||
    row.proposed_2_status === "pending"
  ) {
    return "🟡 Awaiting Board Approval";
  }

  if (
    row.proposed_1_status === "approved" ||
    row.proposed_2_status === "approved"
  ) {
    return "🔵 Awaiting Coach Agreement";
  }

  if (
    row.final_date &&
    row.final_time &&
    row.final_field &&
    !String(row.certified).toLowerCase().includes("true")
  ) {
    return "🟣 Awaiting Certification";
  }

  if (
    String(row.certified).toLowerCase() === "true"
  ) {
    return "🟢 Ready For SSSL Submission";
  }

  return "⚪ In Progress";
}


function buildQuickView(row) {

  // Normalize date
  const fmtDate = (d) => {
    if (!d) return "—";
    if (d === "1969-12-31") return "—"; // Google default
    if (d.includes("T")) return new Date(d).toLocaleDateString();
    return d;
  };

  // Normalize time
  const fmtTime = (t) => {
    if (!t) return "";
    if (t.includes("T")) {
      const d = new Date(t);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return t;
  };

  return {
    game_number: row.game_number,
    team_name: row.team_name,
    age_group: row.age_group,
    gender: row.gender,
    division: row.division,

    workflow_status: getWorkflowStatus(row),

    orig: {
      date: fmtDate(row.orig_date),
      time: fmtTime(row.orig_time),
      field: row.orig_field || "—"
    },

    final: {
      date: fmtDate(row.final_date),
      time: fmtTime(row.final_time),
      field: row.final_field || "—"
    },

    status: {
      certified: String(row.certified).toLowerCase() === "true",
      calendar_updated: String(row.calendar_updated).toLowerCase() === "true",
      haysa_status: row.haysa_status || "—"
    },

    notes: row.notes && row.notes.trim() !== "" ? row.notes : "—"
  };
}



// ===============================
// LANDING PAGE
// ===============================
async function loadSubmittedRequests() {
  const rows = await apiGetAllRows();
  const list = document.getElementById("submittedList");
  if (!list) return;

  list.innerHTML = "";

  rows
    .filter(r => r.game_number)               // only valid rows
    .map(buildQuickView)                      // normalize + format
    .forEach(item => {

      const div = document.createElement("div");
      div.className = "submitted-item";

      div.innerHTML = `
        <div class="reschedule-card ultra">
      
          <div class="row-top">
            <span class="game">#${item.game_number}</span>
            <span class="team">${item.team_name} — ${item.age_group} ${item.gender} ${item.division}</span>
            <button type="button" class="primary-btn resume-btn" onclick="resumeGame('${item.game_number}')">Resume</button>
          </div>
      
          <div class="row-mid">
            <span class="orig"><strong>Orig:</strong> ${item.orig.date} • ${item.orig.time} • ${item.orig.field}</span>
            <span class="final"><strong>Final:</strong> ${item.final.date || "—"} • ${item.final.time || ""} • ${item.final.field || ""}</span>
          </div>
      
          <div class="row-bottom">
            <span class="next"><strong>Next:</strong> ${item.workflow_status}</span>
          
            <span class="status">
              <strong>Status:</strong>
              C:${item.status.certified ? "Y" : "N"} • 
              Cal:${item.status.calendar_updated ? "Y" : "N"} • 
              H:${item.status.haysa_status || "—"}
            </span>
          
            <span class="notes">
              <strong>Notes:</strong> ${item.notes || "—"}
            </span>
          </div>

      
        </div>
      `;

      list.appendChild(div);
    });

  const container = document.getElementById("submittedListContainer");
  if (container) container.style.display = "block";
}

function hideLandingPage() {
  const submitted =
    document.getElementById("submittedListContainer");

  const lookup =
    document.getElementById("lookupContainer");

  if (submitted) submitted.style.display = "none";
  if (lookup) lookup.style.display = "none";
}

function backToList() {
  showLandingPage();
}


// ===============================
// LOOKUP / RESUME / NEW WORKFLOW
// ===============================
async function loadGameWithoutStartingWorkflow(gameNumber) {
  console.log("Loading game without starting workflow:", gameNumber);

  currentGameNumber = gameNumber;

  const rowResult = await apiGetGame(gameNumber);

  if (!rowResult?.exists) {
    alert("Unable to load game data.");
    return;
  }

  hydrateFieldsFromRow(rowResult.data);

  // Detect board approval
  const row = rowResult.data;
  if (row.opt1_status === "approved") autoMoveApprovedOption(1);
  if (row.opt2_status === "approved") autoMoveApprovedOption(2);
  
  // Show workflow UI
  showWorkflowWithoutStarting();

}



async function loadGameWithoutStartingWorkflow(gameNumber) {
  console.log("Loading game without starting workflow:", gameNumber);

  currentGameNumber = gameNumber;

  const rowResult = await apiGetGame(gameNumber);

  if (!rowResult?.exists) {
    alert("Unable to load game data.");
    return;
  }

  // ⭐ Hide all landing page content
  hideLandingPage();

  // ⭐ Show workflow page + timeline container
  showWorkflowUI();

  // Load row data
  currentRowData = rowResult.data;
  hydrateFieldsFromRow(currentRowData);

  // Show workflow without auto-starting Step 1
  showWorkflowWithoutStarting();

  // Scroll into workflow cleanly
  const wf = document.getElementById("workflowPage");
  if (wf) wf.scrollIntoView({ behavior: "smooth" });
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

  // CASE 1 — FOUND → resume workflow
  if (result && result.exists) {
    const row = result.data;

    currentGameNumber = gameNumber;
    hydrateFieldsFromRow(row);
    
    // Detect board approval
    if (row.opt1_status === "approved") autoMoveApprovedOption(1);
    if (row.opt2_status === "approved") autoMoveApprovedOption(2);


    // First incomplete step
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

  // CASE 2 — NOT FOUND → ask to create new case
  const confirmCreate = confirm(
    "No matching game was found.\n\n" +
    "Would you like to create a NEW reschedule case using this game number?"
  );

  if (!confirmCreate) {
    statusEl.innerText = "Game not found.";
    return;
  }

  // Create new workflow row using the game number
  await startNewWorkflow(gameNumber);
}


function showGameSelection(matches) {
  const container = document.getElementById("gameSelectionContainer");

  container.innerHTML = `
    <h3>Select the correct game</h3>
    <p>Multiple games match your search. Choose the one you want to reschedule.</p>
  `;

  matches.forEach(m => {
    const div = document.createElement("div");
    div.className = "match-card";

    div.innerHTML = `
      <div><strong>Team:</strong> ${m.team_name}</div>
      <div><strong>Opponent:</strong> ${m.opp_town}</div>
      <div><strong>Date:</strong> ${displayDate(m.orig_date)}</div>
      <div><strong>Time:</strong> ${displayTime(m.orig_time)}</div>
      <div><strong>Field:</strong> ${m.orig_field}</div>
      <div><strong>Game #:</strong> ${m.game_number}</div>

      <button class="primary-btn" onclick="loadGameWithoutStartingWorkflow('${m.game_number}')">
        Use This Game
      </button>
    `;

    container.appendChild(div);
  });
}

function displayDate(d) {
  return d ? new Date(d).toLocaleDateString("en-US") : "(none)";
}

function displayTime(t) {
  return t ? new Date(t).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }) : "(none)";
}

// Hook up Back to List button
const backBtn = document.getElementById("backToListBtn");
if (backBtn) backBtn.onclick = backToList;

// BACK TO LIST BUTTON HOOKUP
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.getElementById("backToListBtn");
  if (backBtn) backBtn.onclick = backToList;
});




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

  const response = await fetch(url);
  const result = await response.json();
  console.log("Search result:", result);

  const matches = result.rows || [];

  // CASE 1 — EXACT MATCH
  if (matches.length === 1) {
    showSingleMatchConfirmation(matches[0]);
    return;
  }


  // CASE 2 — MULTIPLE MATCHES
  if (matches.length > 1) {
    showGameSelection(matches);
    return;
  }

  // CASE 3 — NO MATCHES FOUND
  const confirmCreate = confirm(
    "No matching game was found.\n\n" +
    "Would you like to create a NEW reschedule case using the details you entered?"
  );

  if (!confirmCreate) {
    document.getElementById("searchStatus").innerText =
      "No matches found. Please adjust your search.";
    return;
  }

  await createWorkflowFromSearchFields({
    age_group,
    gender,
    division,
    orig_date,
    orig_time,
    opp_town
  });
}


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

  currentRowData = result.row;   // MUST exist

  hydrateTimelineFromRow(currentRowData);

  showWorkflowPage();

  renderStep(1);
}



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

  // Determine next step (skip Step 1)
  const nextStep = findNextIncompleteStepSkippingStep1(currentRowData);

  // Unified navigation
  goToStep(nextStep);

  setTimeout(() => {
    page.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}





function findNextIncompleteStepSkippingStep1(row) {
  for (let s = 2; s <= 8; s++) {
    if (row[`step_${s}`] !== "completed") {
      return s;
    }
  }
  return 8; // fallback
}



function beginWorkflow() {

  // Hide ALL landing page content
  hideLandingPage();

  // Show workflow
  showWorkflowUI();

  // Highest completed step based on ROW data
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

  // ⭐ Unified navigation — replaces ALL old timeline + panel calls
  goToStep(currentStep);

  // Scroll workflow into view
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

  currentRowData.orig_date_input  = normalizeDateForInput(row.orig_date);
  currentRowData.orig_time_input  = normalizeTimeForInput(row.orig_time);
  currentRowData.final_date_input = normalizeDateForInput(row.final_date);
  currentRowData.final_time_input = normalizeTimeForInput(row.final_time);
}


function showLandingPage() {
  // Show unified start card + submitted list
  document.getElementById("startContainer").style.display = "block";
  document.getElementById("submittedListContainer").style.display = "block";

  // Hide workflow UI
  document.getElementById("workflowPage").style.display = "none";
  document.getElementById("timelineContainer").style.display = "none";
  document.getElementById("panelContainer").style.display = "none";
  document.getElementById("nextStepContainer").style.display = "none";
  document.getElementById("backToListContainer").style.display = "none";
}

function hideLandingPage() {
  // Hide unified start card + submitted list
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
  // Clicking timeline steps still works
  document.querySelectorAll(".timeline-step").forEach(el => {
    el.onclick = () => {
      const step = Number(el.dataset.step);
      goToStep(step);
    };
  });

  // Unified NEXT button
  const nextBtn = document.getElementById("nextStepBtn");
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentStep < 8) {
        goToStep(currentStep + 1);
      }
    };
  }

  // Unified BACK button
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
      el.classList.add("completed");   // green
    } else if (step === currentStep) {
      el.classList.add("current");     // blue
    } else {
      el.classList.add("locked");      // gray
    }
  }

  for (let s = 1; s <= 8; s++) {
    const complete = isStepCompleteRow(source, s);
    mark(s, complete);
  }
}

// ROW-BASED completeness (for timeline, lookup, resume, beginWorkflow)
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
      return (
        r.coach_name &&
        r.opp_coach_name &&
        r.opp_town
      );

    case 4:
      return (
        r.final_date &&
        r.final_time &&
        r.final_field
      );

    case 5:
      return r.step_5 === "completed";

    case 6:
      return r.haysa_status === "approved";

    case 7:
      return (
        (r.certified === "true" || r.certified === true) &&
        r.signed_name
      );

    case 8:
      return r.step_8 === "completed";

    default:
      return false;
  }
}

// FIELD-BASED completeness (for no-skipping guard in goToStep)
function isStepComplete(step) {
  const f = (name) => getField(name);

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
      return (
        f("coach_name") &&
        f("opp_coach_name") &&
        f("opp_town")
      );

    case 4:
      return (
        f("final_date") &&
        f("final_time") &&
        f("final_field")
      );

    case 5:
      return f("step_5") === "completed";

    case 6:
      return f("haysa_status") === "approved";

    case 7:
      return (
        (f("certified") === "true" || f("certified") === true) &&
        f("signed_name")
      );

    case 8:
      return f("step_8") === "completed";

    default:
      return false;
  }
}

function goToStep(step) {
  // Prevent skipping ahead based on current form fields
  for (let s = 2; s < step; s++) {
    if (!isStepComplete(s)) {
      alert(`You must complete Step ${s} before continuing.`);
      return;
    }
  }

  currentStep = step;
  const panel = document.getElementById("panelContainer");
  if (!panel) return;

  renderPanelForStep(step);
  hydrateTimelineFromRow(currentRowData);
}

function renderPanelForStep(step) {
  const panel = document.getElementById("panelContainer");
  if (!panel) return;

  switch (step) {
    case 1: renderStep1(panel); break;
    case 2: renderStep2(panel); break;
    case 3: renderStep3(panel); break;
    case 4: renderStep4(panel); break;
    case 5: renderStep5(panel); break;
    case 6: renderStep6(panel); break;
    case 7: renderStep7(panel); break;
    case 8: renderStep8(panel); break;
    default:
      panel.innerHTML = "<p>Select a step above.</p>";
  }


  // Always show Back button
  document.getElementById("backToListContainer").style.display = "block";
}


// ===============================
// STEP PANELS
// ===============================
// STEP 1 — Start Reschedule Attempt
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



// STEP 2 — Original Game Details
function renderStep2(panel) {

  // Normalize sheet values for HTML inputs
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


    // Convert HTML input formats → sheet formats
    const origDate = formatDateForStorage(origDateRaw);
    const origTime = formatTimeForStorage(origTimeRaw);

    // Auto-build composite fields
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



// STEP 3 — Coach + Opponent Contact Info
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
    
    const coachName =
      document.getElementById("coach_name").value.trim();
    
    const oppName =
      document.getElementById("opp_coach_name").value.trim();
    
    const oppTown =
      document.getElementById("opp_town").value.trim();
    

    await setField("coach_name", coachName);

    await setField("opp_coach_name", oppName);

    await setField("opp_town", oppTown);

    if (
      coachName &&
      oppName &&
      oppTown
    ) {
      await apiUpdateStep(currentGameNumber, 3);
      currentRowData.step_3 = "completed";
    }
    
    hydrateTimelineFromRow(currentRowData);
    
    alert("Information saved.");

      
      };
    }


// STEP 4 — Final Game Details (New Schedule) + Comparison
// ===============================
// STEP 4 — RENDER + SAVE
// ===============================

function renderStep4(panel) {
  panel.innerHTML = `
    <h2>Step 4 — Choose & Confirm New Game Time</h2>

    <p class="info-text">
      If both coaches already agreed on a new date/time/field, enter it below.
      If you're still exploring options, use the calendar to find availability
      and propose up to two possible options for board approval.
    </p>

    <!-- FINAL AGREED DETAILS -->
    <div class="section">
      <h3>Final Agreed Game Details</h3>
      <p>Enter the final agreed date, time, and field once both coaches approve.</p>

      <label>Final Date</label>
      <input type="date" id="final_date">

      <label>Final Time</label>
      <input type="time" id="final_time">

      <label>Final Field</label>

      <select id="final_field_select">
        <option value="">Select a field category…</option>

        <option value="Holbrook HS Turf">Holbrook HS Turf</option>
        <option value="Sumner/Sean Joyce Fields">Sumner/Sean Joyce Fields</option>
        <option value="Brookville Fields">Brookville Fields</option>
        <option value="Avon Butler Fields">Avon Butler Fields</option>

        <option value="__custom__">Other (Away Game)</option>
      </select>

      <input
        type="text"
        id="final_field_custom"
        placeholder="Enter away field"
        style="display:none; margin-top:8px;"
      >

      <button class="primary-btn" onclick="saveFinalDetails()">
        Save Final Details
      </button>
    </div>

    <hr>

    <!-- CALENDAR -->
    <div class="section">
      <h3>Check Field Availability</h3>
      <p>Use the calendar below to find open field slots for your proposed reschedule.</p>

      <iframe
        src="https://haysa-soccer.github.io/haysa-scheduler-ui/"
        class="calendar-embed">
      </iframe>
    </div>

    <hr>

    <!-- PROPOSED OPTIONS -->
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

  // ===============================
  // HYDRATE FINAL FIELD SELECT
  // ===============================
  const savedField = getField("final_field") || "";
  const select = document.getElementById("final_field_select");
  const custom = document.getElementById("final_field_custom");

  if (
    savedField === "Holbrook HS Turf" ||
    savedField === "Sumner/Sean Joyce Fields" ||
    savedField === "Brookville Fields" ||
    savedField === "Avon Butler Fields"
  ) {
    select.value = savedField;
  } else if (savedField) {
    select.value = "__custom__";
    custom.style.display = "block";
    custom.value = savedField;
  }

  select.onchange = () => {
    const sel = select.value;
    custom.style.display = sel === "__custom__" ? "block" : "none";
  };

  // ===============================
  // HYDRATE FINAL DATE/TIME
  // ===============================
  document.getElementById("final_date").value =
    convertToHtmlDate(getField("final_date"));

  document.getElementById("final_time").value =
    convertToHtmlTime(getField("final_time"));

  // ===============================
  // HYDRATE PROPOSED OPTIONS
  // ===============================
  document.getElementById("opt1_date").value =
    convertToHtmlDate(getField("opt1_date"));
  document.getElementById("opt1_time").value =
    convertToHtmlTime(getField("opt1_time"));
  document.getElementById("opt1_field").value =
    getField("opt1_field") || "";

  document.getElementById("opt2_date").value =
    convertToHtmlDate(getField("opt2_date"));
  document.getElementById("opt2_time").value =
    convertToHtmlTime(getField("opt2_time"));
  document.getElementById("opt2_field").value =
    getField("opt2_field") || "";
}


// ===============================
// SAVE FINAL DETAILS
// ===============================
async function saveFinalDetails() {
  const dateHtml = document.getElementById("final_date").value;
  const timeHtml = document.getElementById("final_time").value;

  const finalDate = convertFromHtmlDate(dateHtml);
  const finalTime = convertFromHtmlTime(timeHtml);

  const select = document.getElementById("final_field_select");
  const custom = document.getElementById("final_field_custom");

  const finalField =
    select.value === "__custom__" ? custom.value : select.value;

  // Save Step 4 final details
  await apiUpdateFinal(currentGameNumber, finalDate, finalTime, finalField);

  // ===============================
  // AUTO-COMPLETE STEP 5 IMMEDIATELY
  // ===============================
  // Step 5 is ALWAYS informational-only and ALWAYS complete
  if (currentRowData.step_5 !== "completed") {
    await apiUpdateStep(currentGameNumber, 5);
    currentRowData.step_5 = "completed";
    hydrateTimelineFromRow(currentRowData);
  }

  alert("Final details saved.");
}


// ===============================
// SAVE OPTION 1 / OPTION 2
// ===============================
async function saveOption(optionNumber) {
  const dateHtml = document.getElementById(`opt${optionNumber}_date`).value;
  const timeHtml = document.getElementById(`opt${optionNumber}_time`).value;
  const field = document.getElementById(`opt${optionNumber}_field`).value;

  const dateSheet = convertFromHtmlDate(dateHtml);
  const timeSheet = convertFromHtmlTime(timeHtml);

  const opt1 = {
    date: optionNumber === 1 ? dateSheet : getField("opt1_date"),
    time: optionNumber === 1 ? timeSheet : getField("opt1_time"),
    field: optionNumber === 1 ? field : getField("opt1_field"),
    status: getField("opt1_status") || ""
  };

  const opt2 = {
    date: optionNumber === 2 ? dateSheet : getField("opt2_date"),
    time: optionNumber === 2 ? timeSheet : getField("opt2_time"),
    field: optionNumber === 2 ? field : getField("opt2_field"),
    status: getField("opt2_status") || ""
  };

  await apiUpdateOptions(currentGameNumber, opt1, opt2, {});

  alert(`Option ${optionNumber} saved.`);
}



// STEP 5 — Field Hold (auto-handled)
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

  // Step 5 should ALWAYS be complete
  if (currentRowData.step_5 !== "completed") {
    apiUpdateStep(currentGameNumber, 5);
    currentRowData.step_5 = "completed";
    hydrateTimelineFromRow(currentRowData);
  }
}





// STEP 6 — HAYSA Approval
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



// STEP 7 — SSSL Form (auto-fill)
function renderStep7(panel) {

  const fd = (name) => getField(name) || "";

  const isHomeOriginal = fd("is_haysa_home") === "true";
  const oppTown = fd("opp_town");
  const awayTeam =  oppTown;
  const teamName = fd("team_name");

  // Determine home/away (same home flag for original + final)
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
    <label><input type="checkbox" id="certified" ${fd("certified")==="true"?"checked":""}> I certify the opposing coach agreed to this change.</label>

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


// STEP 8 — Finalize Request
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

    <!-- ⭐ NEW: SSSL Summary Preview + Copy Button -->
    <h3>SSSL Email Summary</h3>
    <pre id="sssl_summary_box" class="summary-box">${summaryText}</pre>
    <button id="s8_summary" class="secondary-btn">Copy SSSL Summary</button>

    <label>Board Notes (optional)</label>
    <input type="text" id="notes" value="${getField("notes") || ""}">

    <button id="s8_save" class="secondary-btn">Mark Request Complete</button>
  `;

  document.getElementById("s8_download").onclick = () => {

    const coachContact = document.getElementById("coach_contact_temp").value.trim();
    const oppCoachContact = document.getElementById("opp_coach_contact_temp").value.trim();
  
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

  // ⭐ Copy-to-Clipboard handler
  document.getElementById("s8_summary").onclick = () => {
    copyToClipboard(summaryText);
    alert("SSSL summary copied to clipboard.");
  };

  document.getElementById("s8_save").onclick = async () => {

    if (!isComplete()) {
      alert("Some required fields are missing. Please review all steps before finalizing.");
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

  // Mouse events
  canvas.onmousedown = e => {
    const r = canvas.getBoundingClientRect();
    startDraw(e.clientX - r.left, e.clientY - r.top);
  };
  canvas.onmousemove = e => {
    const r = canvas.getBoundingClientRect();
    drawLine(e.clientX - r.left, e.clientY - r.top);
  };
  canvas.onmouseup = () => drawing = false;
  canvas.onmouseleave = () => drawing = false;

  // Touch events
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
  canvas.ontouchend = () => drawing = false;

  clearBtn.onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

  // FORM SUBMIT
  form.onsubmit = async e => {
    e.preventDefault();

    const fd = new FormData(form);
    const signatureData = canvas.toDataURL();

    // If you have a backend PDF generator, call it here.
    // If not, this safely does nothing.
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

    // Fields to save back to sheet
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

    // Mark Step 7 complete (signature form)
    await apiUpdateStep(currentGameNumber, 7);
    currentRowData.step_7 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Form saved.");
  };
}
