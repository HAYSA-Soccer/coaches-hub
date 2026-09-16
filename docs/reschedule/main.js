// ===============================
// CONFIG / API LAYER
// ===============================

const API_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";
const BASE_URL = API_URL;


// Convert sheet or ISO date → yyyy-MM-dd
function normalizeDateForInput(value) {
  if (!value) return "";

  // Already correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // MM/dd/yyyy
  const m1 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const [, mm, dd, yyyy] = m1;
    return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }

  // ISO format
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

// Convert sheet or ISO time → HH:mm
function normalizeTimeForInput(value) {
  if (!value) return "";

  // Already correct
  if (/^\d{2}:\d{2}/.test(value)) return value;

  // h:mm AM/PM
  const m1 = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m1) {
    let [, hh, mm, ap] = m1;
    hh = parseInt(hh, 10);
    ap = ap.toUpperCase();
    if (ap === "PM" && hh < 12) hh += 12;
    if (ap === "AM" && hh === 12) hh = 0;
    return `${String(hh).padStart(2,"0")}:${mm}`;
  }

  // ISO format
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }

  return "";
}

// Convert yyyy-MM-dd → MM/dd/yyyy
function formatDateForStorage(value) {
  if (!value) return "";
  const [yyyy, mm, dd] = value.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

// Convert HH:mm → h:mm AM/PM
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
  const next = document.getElementById("nextStepContainer");
  const back = document.getElementById("backToListContainer");
  const formSection = document.getElementById("formSection");

  if (wf) wf.style.display = "none";
  if (tl) tl.style.display = "none";
  if (panel) panel.style.display = "none";
  if (next) next.style.display = "none";
  if (back) back.style.display = "none";
  if (formSection) formSection.style.display = "none";

  initTimeline();
  loadSubmittedRequests();
  initGameChangeForm();
});

// ===============================
// API FUNCTIONS
// ===============================

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

// STEP_X UPDATE (maps to step_1..step_9)
async function apiUpdateStep(gameNumber, stepNumber) {
  return apiUpdateField(gameNumber, `step_${stepNumber}`, "completed");
}

// DOCX download via base64 from backend
async function apiDownloadSSSLForm(gameNumber) {
  const url = `${BASE_URL}?action=generateSSSLForm&game_number=${encodeURIComponent(gameNumber)}`;

  const response = await fetch(url);
  const base64 = await response.text();

  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  const blob = new Blob([byteArray], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `SSSL-Reschedule-${gameNumber}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// ===============================
// HELPERS
// ===============================
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
  for (let s = 1; s <= 9; s++) {
    if (row[`step_${s}`] === "completed") {
      highest = s;
    }
  }
  return highest;
}

function computeStatus(row) {
  const highest = getHighestCompletedStep(row);

  if (highest >= 9) return "Finalized";
  if (highest >= 8) return "Calendar Updated";
  if (highest >= 7) return "SSSL Form Ready";
  if (highest >= 6) return "Awaiting HAYSA Approval";
  if (highest >= 4) return "Awaiting Opponent";
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

function buildQuickView(row) {
  return {
    game_number: row.game_number,
    team_name: row.team_name,
    age_group: row.age_group,
    gender: row.gender,
    division: row.division,
    coach_last_name: row.coach_last_name,

    orig: {
      date: row.orig_date,
      time: row.orig_time,
      field: row.orig_field
    },

    final: {
      date: row.final_date,
      time: row.final_time,
      field: row.final_field
    },

    progress: {
      steps_completed: [
        row.step_1,
        row.step_2,
        row.step_3,
        row.step_4,
        row.step_5,
        row.step_6,
        row.step_7,
        row.step_8,
        row.step_9
      ].filter(v => v === "completed").length
    },

    status: {
      certified: row.certified === "true",
      calendar_updated: row.calendar_updated === "true",
      haysa_status: row.haysa_status
    }
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
    .map(buildQuickView)                      // normalize
    .forEach(item => {

      const div = document.createElement("div");
      div.className = "submitted-item";

      div.innerHTML = `
        <div class="submitted-header">
          <strong>Game #${item.game_number}</strong>
          <button class="primary-btn" onclick="resumeGame('${item.game_number}')">Resume</button>
        </div>

        <div class="submitted-team">
          ${item.team_name} — ${item.age_group} ${item.gender} ${item.division}
        </div>

        <div class="submitted-orig">
          <strong>Original:</strong>
          ${item.orig.date} @ ${item.orig.time} — ${item.orig.field}
        </div>

        <div class="submitted-final">
          <strong>Final:</strong>
          ${item.final.date} @ ${item.final.time} — ${item.final.field}
        </div>

        <div class="submitted-progress">
          <strong>Progress:</strong> ${item.progress.steps_completed}/9
        </div>

        <div class="submitted-status">
          Certified: ${item.status.certified ? "Yes" : "No"} |
          Calendar Updated: ${item.status.calendar_updated ? "Yes" : "No"} |
          HAYSA Status: ${item.status.haysa_status || "—"}
        </div>
      `;

      list.appendChild(div);
    });

  const container = document.getElementById("submittedListContainer");
  if (container) container.style.display = "block";
}

function hideLandingPage() {
  const submitted = document.getElementById("submittedListContainer");
  const lookup = document.getElementById("lookupContainer");
  if (submitted) submitted.style.display = "none";
  if (lookup) lookup.style.display = "none";
}

// ===============================
// LOOKUP / RESUME / NEW WORKFLOW
// ===============================
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

  if (!result || !result.exists) {
    if (statusEl) statusEl.innerText = "Game not found.";
    return;
  }

  const row = result.data;

  currentGameNumber = gameNumber;
  currentRowData = row;

  hydrateFieldsFromRow(row);

  let nextStep = 2;
  for (let s = 2; s <= 9; s++) {
    if (!isStepComplete(s)) {
      nextStep = s;
      break;
    }
  }

  showWorkflowUI();
  hydrateTimelineFromRow(row);
  goToStep(nextStep);
}

async function resumeGame(gameNumber) {
  const result = await apiGetGame(gameNumber);
  const statusEl = document.getElementById("lookupStatus");

  if (!result || !result.exists) {
    if (statusEl) statusEl.innerText = "Game not found.";
    return;
  }

  const row = result.data;

  currentGameNumber = gameNumber;
  currentRowData = row;

  hydrateFieldsFromRow(row);

  let nextStep = 2;
  for (let s = 2; s <= 9; s++) {
    if (!isStepComplete(s)) {
      nextStep = s;
      break;
    }
  }

  showWorkflowUI();
  hydrateTimelineFromRow(row);
  goToStep(nextStep);
}

async function startNewWorkflow(gameNumber) {
  const res = await apiCreateRow(gameNumber);
  if (!res || (!res.success && !res.created)) {
    alert("Error creating workflow row.");
    return;
  }
  currentGameNumber = gameNumber;
  currentRowData = res.data || {};
  beginWorkflow();
}

function beginWorkflow() {
  const lookup = document.getElementById("lookupContainer");
  if (lookup) lookup.style.display = "none";

  showWorkflowUI();

  // Determine highest completed step
  let highestCompleted = getHighestCompletedStep(currentRowData || {});
  currentStep = highestCompleted;

  // Hydrate AFTER determining correct step
  hydrateTimelineFromRow(currentRowData || {});
  setActiveTimelineStep(currentStep);
  renderPanelForStep(currentStep);

  // Prefill form fields (if gameChangeForm present)
  const form = document.getElementById("gameChangeForm");
  if (form && currentRowData) {
    const map = {
      game_number: "game_number",
      team_name: "team_name",
      orig_date: "orig_date",
      orig_time: "orig_time",
      orig_field: "orig_field",
      final_date: "final_date",
      final_time: "final_time",
      final_field: "final_field",
      coach_name: "coach_name",
      coach_email: "coach_email",
      coach_phone: "coach_phone",
      opp_coach_name: "opp_coach_name",
      opp_coach_phone: "opp_coach_phone"
    };
    Object.keys(map).forEach(name => {
      const el = form.querySelector(`[name='${name}']`);
      if (el) el.value = getField(map[name]);
    });
  }
}

function hydrateFieldsFromRow(row) {
  console.log("hydrateFieldsFromRow called with:", row);
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
      currentStep = Number(el.dataset.step);
      setActiveTimelineStep(currentStep);
      renderPanelForStep(currentStep);
    };
  });

  const nextBtn = document.getElementById("nextStepBtn");
  if (nextBtn) {
    nextBtn.onclick = async () => {
      if (currentStep < 9) {
        currentStep++;
        setActiveTimelineStep(currentStep);
        renderPanelForStep(currentStep);
      }
    };
  }
}

function setActiveTimelineStep(step) {
  document.querySelectorAll(".timeline-step").forEach(el => {
    el.classList.toggle("active", Number(el.dataset.step) === step);
  });
}

function highlightStepInTimeline(step) {
  const steps = document.querySelectorAll(".timeline-step");

  steps.forEach(el => {
    const s = parseInt(el.getAttribute("data-step"), 10);

    if (s === step) {
      el.classList.add("active-step");
    } else {
      el.classList.remove("active-step");
    }
  });
}

function hydrateTimelineFromRow(row) {
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

  for (let s = 2; s <= 9; s++) {
    const complete = row[`step_${s}`] === "completed";
    mark(s, complete);
  }
}

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
        f("coach_email") &&
        f("coach_phone") &&
        f("opp_coach_name") &&
        f("opp_coach_email") &&
        f("opp_coach_phone") &&
        f("away_team") &&
        f("opp_town")
      );

    case 4:
      return (
        f("final_date") &&
        f("final_time") &&
        f("final_field")
      );

    case 5:
      return f("field_confirmed") === "true";

    case 6:
      return f("haysa_status") === "approved";

    case 7:
      return (
        f("certified") === "true" &&
        f("signed_name")
      );

    case 8:
      return f("calendar_updated") === "true";

    case 9:
      return f("step_9") === "completed";

    default:
      return false;
  }
}

function goToStep(step) {
  // Prevent skipping ahead
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
  highlightStepInTimeline(step);
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
    case 9: renderStep9(panel); break;
    default:
      panel.innerHTML = "<p>Select a step above.</p>";
  }
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
  const origDateInput = normalizeDateForInput(getField("orig_date"));
  const origTimeInput = normalizeTimeForInput(getField("orig_time"));

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

    if (!ageGroup || !gender || !division || !coachLast || !isHome ||
        !origDateRaw || !origTimeRaw || !origField) {
      alert("Please complete all fields before saving.");
      return;
    }

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

    await apiUpdateStep(currentGameNumber, 2);
    currentRowData.step_2 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Original details saved.");
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

    <label>Your Email</label>
    <input type="email" id="coach_email" value="${getField("coach_email") || ""}">

    <label>Your Phone</label>
    <input type="tel" id="coach_phone" value="${getField("coach_phone") || ""}">

    <h3>Opposing Coach Info</h3>

    <label>Opposing Coach Name</label>
    <input type="text" id="opp_coach_name" value="${getField("opp_coach_name") || ""}">

    <label>Opposing Coach Email</label>
    <input type="email" id="opp_coach_email" value="${getField("opp_coach_email") || ""}">

    <label>Opposing Coach Phone</label>
    <input type="tel" id="opp_coach_phone" value="${getField("opp_coach_phone") || ""}">

    <h3>Opponent Team Info</h3>

    <label>Away Team Name (as shown in SSSL schedule)</label>
    <input type="text" id="away_team" value="${getField("away_team") || ""}">

    <label>Opponent Town</label>
    <input type="text" id="opp_town" value="${getField("opp_town") || ""}">

    <button id="s3_save" class="primary-btn">Save Contact Details</button>
  `;

  document.getElementById("s3_save").onclick = async () => {

    const coachName = document.getElementById("coach_name").value.trim();
    const coachEmail = document.getElementById("coach_email").value.trim();
    const coachPhone = document.getElementById("coach_phone").value.trim();

    const oppName = document.getElementById("opp_coach_name").value.trim();
    const oppEmail = document.getElementById("opp_coach_email").value.trim();
    const oppPhone = document.getElementById("opp_coach_phone").value.trim();

    const awayTeam = document.getElementById("away_team").value.trim();
    const oppTown = document.getElementById("opp_town").value.trim();

    if (!coachName || !coachEmail || !coachPhone ||
        !oppName || !oppEmail || !oppPhone ||
        !awayTeam || !oppTown) {
      alert("Please complete all fields before saving.");
      return;
    }

    await setField("coach_name", coachName);
    await setField("coach_email", coachEmail);
    await setField("coach_phone", coachPhone);

    await setField("opp_coach_name", oppName);
    await setField("opp_coach_email", oppEmail);
    await setField("opp_coach_phone", oppPhone);

    await setField("away_team", awayTeam);
    await setField("opp_town", oppTown);

    await apiUpdateStep(currentGameNumber, 3);
    currentRowData.step_3 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Contact details saved.");
  };
}

// STEP 4 — Final Game Details (New Schedule) + Comparison
// STEP 4 — Final Game Details (New Schedule) + Comparison
function renderStep4(panel) {

  // Normalize sheet or ISO values for HTML inputs
  const finalDateInput = normalizeDateForInput(getField("final_date"));
  const finalTimeInput = normalizeTimeForInput(getField("final_time"));

  const origDateDisplay = getField("orig_date") || "(none)";
  const origTimeDisplay = getField("orig_time") || "(none)";
  const origFieldDisplay = getField("orig_field") || "(none)";

  const finalDateDisplay = getField("final_date") || "(none)";
  const finalTimeDisplay = getField("final_time") || "(none)";
  const finalFieldDisplay = getField("final_field") || "(none)";

  panel.innerHTML = `
    <div class="step-content">

      <h2>Step 4 — Final Game Details (New Schedule)</h2>
      <p>Enter the agreed new game date, time, and field.</p>

      <h3>Original vs New</h3>

      <div class="comparison-row">
        <div>Original Date:</div>
        <div>${origDateDisplay}</div>
        <div>New Date:</div>
        <div id="cmp_final_date">${finalDateDisplay}</div>
      </div>

      <div class="comparison-row">
        <div>Original Time:</div>
        <div>${origTimeDisplay}</div>
        <div>New Time:</div>
        <div id="cmp_final_time">${finalTimeDisplay}</div>
      </div>

      <div class="comparison-row">
        <div>Original Field:</div>
        <div>${origFieldDisplay}</div>
        <div>New Field:</div>
        <div id="cmp_final_field">${finalFieldDisplay}</div>
      </div>

      <h3>New Game Details</h3>

      <label>New Date</label>
      <input type="date" id="final_date" value="${finalDateInput}">

      <label>New Time</label>
      <input type="time" id="final_time" value="${finalTimeInput}">

      <label>New Field</label>
      <input type="text" id="final_field" value="${getField("final_field") || ""}">

      <button id="s4_save" class="primary-btn">Save New Game Details</button>

    </div>
  `;

  document.getElementById("s4_save").onclick = async () => {
    const newDateRaw = document.getElementById("final_date").value;
    const newTimeRaw = document.getElementById("final_time").value;
    const newField = document.getElementById("final_field").value.trim();

    if (!newDateRaw || !newTimeRaw || !newField) {
      alert("Please complete all new game details before saving.");
      return;
    }

    // Convert HTML input formats → sheet formats
    const newDate = formatDateForStorage(newDateRaw);
    const newTime = formatTimeForStorage(newTimeRaw);

    await setField("final_date", newDate);
    await setField("final_time", newTime);
    await setField("final_field", newField);

    await apiUpdateStep(currentGameNumber, 4);
    currentRowData.step_4 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("New game details saved.");
  };
}

// STEP 5 — Field Hold (home game)
function renderStep5(panel) {

  const requested = getField("field_requested") || "";
  const confirmed = getField("field_confirmed") || "";

  let status = "";
  if (confirmed === "true") status = "confirmed";
  else if (requested === "true") status = "requested";

  panel.innerHTML = `
    <h2>Step 5 — Field Hold</h2>
    <p>If required, request a field hold for the new game location.</p>

    <label>Field Hold Status</label>
    <select id="field_hold_status">
      <option value="">Select…</option>
      <option value="not_needed" ${status===""?"selected":""}>Not Needed</option>
      <option value="requested" ${status==="requested"?"selected":""}>Requested</option>
      <option value="confirmed" ${status==="confirmed"?"selected":""}>Confirmed</option>
    </select>

    <button id="s5_save" class="primary-btn">Save Field Hold Status</button>
  `;

  document.getElementById("s5_save").onclick = async () => {
    const newStatus = document.getElementById("field_hold_status").value;

    if (!newStatus) {
      alert("Please select a field hold status.");
      return;
    }

    if (newStatus === "not_needed") {
      await setField("field_requested", "");
      await setField("field_confirmed", "");
    } else if (newStatus === "requested") {
      await setField("field_requested", "true");
      await setField("field_confirmed", "");
    } else if (newStatus === "confirmed") {
      await setField("field_requested", "true");
      await setField("field_confirmed", "true");
    }

    if (newStatus === "confirmed") {
      await apiUpdateStep(currentGameNumber, 5);
      currentRowData.step_5 = "completed";
      hydrateTimelineFromRow(currentRowData);
    }

    alert("Field hold status saved.");
  };
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
  const awayTeam = fd("away_team");
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

    <h3>Coach Contact</h3>
    <div class="sssl-field">Coach Name: <strong>${fd("coach_name")}</strong></div>
    <div class="sssl-field">Coach Phone: <strong>${fd("coach_phone")}</strong></div>

    <h3>Opposing Coach Contact</h3>
    <div class="sssl-field">Opposing Coach Name: <strong>${fd("opp_coach_name")}</strong></div>
    <div class="sssl-field">Opposing Coach Email: <strong>${fd("opp_coach_email")}</strong></div>
    <div class="sssl-field">Opposing Coach Phone: <strong>${fd("opp_coach_phone")}</strong></div>

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

// STEP 8 — Calendar Update
function renderStep8(panel) {

  const updated = getField("calendar_updated") || "";

  panel.innerHTML = `
    <h2>Step 8 — Calendar Update</h2>
    <p>Confirm that the new game date/time/location has been added to your calendar.</p>

    <label>Calendar Updated?</label>
    <select id="calendar_updated">
      <option value="">Select…</option>
      <option value="true" ${updated==="true"?"selected":""}>Yes</option>
      <option value="false" ${updated==="false"?"selected":""}>No</option>
    </select>

    <button id="s8_save" class="primary-btn">Save Calendar Update Status</button>
  `;

  document.getElementById("s8_save").onclick = async () => {
    const newStatus = document.getElementById("calendar_updated").value;

    if (!newStatus) {
      alert("Please select a calendar update status.");
      return;
    }

    await setField("calendar_updated", newStatus);

    if (newStatus === "true") {
      await apiUpdateStep(currentGameNumber, 8);
      currentRowData.step_8 = "completed";
      hydrateTimelineFromRow(currentRowData);
    }

    alert("Calendar update status saved.");
  };
}

// STEP 9 — Finalize Request
function renderStep9(panel) {

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

  panel.innerHTML = `
    <h2>Step 9 — Finalize Request</h2>
    <p>Download the completed form and record any final notes.</p>

    <button id="s9_download" class="primary-btn">Download Completed Form</button>

    <label>Board Notes (optional)</label>
    <input type="text" id="notes" value="${getField("notes") || ""}">

    <button id="s9_save" class="secondary-btn">Mark Request Complete</button>
  `;

  document.getElementById("s9_download").onclick = () => {
    apiDownloadSSSLForm(row.game_number);
  };

  document.getElementById("s9_save").onclick = async () => {

    if (!isComplete()) {
      alert("Some required fields are missing. Please review all steps before finalizing.");
      return;
    }

    await setField("notes", document.getElementById("notes").value);

    await apiUpdateStep(currentGameNumber, 9);
    currentRowData.step_9 = "completed";
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
  canvas.onmouseup = () => drawing = false;
  canvas.onmouseleave = () => drawing = false;

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

  form.onsubmit = async e => {
    e.preventDefault();

    const fd = new FormData(form);
    const signatureData = canvas.toDataURL();

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
