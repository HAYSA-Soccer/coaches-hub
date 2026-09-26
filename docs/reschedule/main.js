console.log("MAIN.JS LOADED");

// =============================================================
// CONFIG
// =============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";

// =============================================================
// STATE
// =============================================================
let currentGameNumber = null;
let currentRow = null;
let currentStep = 1;

// =============================================================
// UTILITIES — DATE/TIME NORMALIZATION
// =============================================================
function normalizeDateForInput(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function toggleCollapse(el) {
  const container = el.closest(".collapsible");
  const body = container.querySelector(".collapsible-body");

  const isOpen = body.style.display === "block";
  body.style.display = isOpen ? "none" : "block";

  const label = el.textContent.replace(/^▶\s|^▼\s/, "");
  el.textContent = (isOpen ? "▶ " : "▼ ") + label;
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

// =============================================================
// API LAYER
// =============================================================
async function apiGetAllRows() {
  const res = await fetch(`${API_URL}?action=getAllRows`);
  const data = await res.json();
  return data.rows || [];
}

async function apiGetRow(gameNumber) {
  const res = await fetch(`${API_URL}?action=getRow&game_number=${encodeURIComponent(gameNumber)}`);
  return res.json();
}

async function apiCreateRow(gameNumber) {
  const form = new FormData();
  form.append("action", "createRow");
  form.append("game_number", gameNumber);
  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

async function apiUpdateField(gameNumber, field, value) {
  const form = new FormData();
  form.append("action", "updateField");
  form.append("game_number", gameNumber);
  form.append("field", field);
  form.append("value", value ?? "");
  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

async function apiUpdateStep(gameNumber, step) {
  return apiUpdateField(gameNumber, `step_${step}`, "completed");
}

// =============================================================
// WORKFLOW ENGINE — STEP COMPLETENESS
// =============================================================
function isStepComplete(step) {
  return currentRow[`step_${step}`] === "completed";
}

function firstIncompleteStep(row) {
  for (let s = 1; s <= 8; s++) {
    if (row[`step_${s}`] !== "completed") return s;
  }
  return 8;
}

// =============================================================
// WORKFLOW ENGINE — NAVIGATION
// =============================================================
function goToStep(step) {
  if (step > 1 && !isStepComplete(step - 1)) {
    alert(`Step ${step - 1} must be completed first.`);
    return;
  }

  currentStep = step;
  renderPanel(step);
  renderTimeline();
}

function renderTimeline() {
  for (let s = 1; s <= 8; s++) {
    const el = document.getElementById(`step_${s}`);
    if (!el) continue;

    el.classList.remove("completed", "current", "locked");

    if (isStepComplete(s)) el.classList.add("completed");
    else if (s === currentStep) el.classList.add("current");
    else el.classList.add("locked");
  }
}

// =============================================================
// WORKFLOW ENGINE — LOAD / RESUME
// =============================================================
async function loadGame(gameNumber) {
  const result = await apiGetRow(gameNumber);

  if (!result.exists) {
    alert("Game not found.");
    return;
  }

  currentGameNumber = gameNumber;
  currentRow = result.row;

  hydrateFields();

  hideLandingPage();
  showWorkflowUI();

  const nextStep = firstIncompleteStep(currentRow);
  goToStep(nextStep);
}

function hydrateFields() {
  currentRow.orig_date_input = normalizeDateForInput(currentRow.orig_date);
  currentRow.orig_time_input = normalizeTimeForInput(currentRow.orig_time);
  currentRow.final_date_input = normalizeDateForInput(currentRow.final_date);
  currentRow.final_time_input = normalizeTimeForInput(currentRow.final_time);
}

// =============================================================
// LANDING PAGE
// =============================================================
async function loadSubmittedRequests() {
  const rows = await apiGetAllRows();
  const list = document.getElementById("submittedList");
  list.innerHTML = "";

  rows.forEach(row => {
    const div = document.createElement("div");
    div.className = "submitted-item";

    div.innerHTML = `
      <div class="reschedule-card ultra">
        <div class="row-top">
          <span class="game">#${row.game_number}</span>
          <span class="team">${row.team_name}</span>
          <button class="primary-btn" onclick="loadGame('${row.game_number}')">Resume</button>
        </div>
        <div class="row-mid">
          <strong>Orig:</strong> ${row.orig_date} • ${row.orig_time} • ${row.orig_field}
        </div>
      </div>
    `;

    list.appendChild(div);
  });
}

function hideLandingPage() {
  document.getElementById("startContainer").style.display = "none";
  document.getElementById("submittedListContainer").style.display = "none";
}

function showLandingPage() {
  document.getElementById("startContainer").style.display = "block";
  document.getElementById("submittedListContainer").style.display = "block";

  document.getElementById("workflowPage").style.display = "none";
  document.getElementById("timelineContainer").style.display = "none";
  document.getElementById("panelContainer").style.display = "none";
}

// =============================================================
// WORKFLOW UI
// =============================================================
function showWorkflowUI() {
  document.getElementById("workflowPage").style.display = "block";
  document.getElementById("timelineContainer").style.display = "flex";
  document.getElementById("panelContainer").style.display = "block";
}

// =============================================================
// STEP PANELS
// =============================================================
function renderPanel(step) {
  const panel = document.getElementById("panelContainer");
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
}

// =============================================================
// STEP 1
// =============================================================
function renderStep1(panel) {
  panel.innerHTML = `
    <h2>Step 1 — Start Reschedule Attempt</h2>
    <p>You are beginning a reschedule workflow for game #${currentGameNumber}.</p>
    <button id="s1_proceed" class="primary-btn">I want to proceed</button>
  `;

  document.getElementById("s1_proceed").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 1);
    currentRow.step_1 = "completed";
    goToStep(2);
  };
}

// =============================================================
// STEP 2
// =============================================================
function renderStep2(panel) {
  panel.innerHTML = `
    <h2>Step 2 — Original Game Details</h2>

    <label>Age Group</label>
    <input id="age_group" value="${currentRow.age_group || ""}">

    <label>Gender</label>
    <select id="gender">
      <option value="">Select…</option>
      <option value="Girls" ${currentRow.gender==="Girls"?"selected":""}>Girls</option>
      <option value="Boys" ${currentRow.gender==="Boys"?"selected":""}>Boys</option>
    </select>

    <label>Division</label>
    <input id="division" value="${currentRow.division || ""}">

    <label>Coach Last Name</label>
    <input id="coach_last_name" value="${currentRow.coach_last_name || ""}">

    <label>Original Date</label>
    <input type="date" id="orig_date" value="${currentRow.orig_date_input || ""}">

    <label>Original Time</label>
    <input type="time" id="orig_time" value="${currentRow.orig_time_input || ""}">

    <label>Original Field</label>
    <input id="orig_field" value="${currentRow.orig_field || ""}">

    <button id="s2_save" class="primary-btn">Save</button>
  `;

  document.getElementById("s2_save").onclick = async () => {
    const age = document.getElementById("age_group").value.trim();
    const gender = document.getElementById("gender").value;
    const division = document.getElementById("division").value.trim();
    const coachLast = document.getElementById("coach_last_name").value.trim();
    const d = document.getElementById("orig_date").value;
    const t = document.getElementById("orig_time").value;
    const field = document.getElementById("orig_field").value.trim();

    await apiUpdateField(currentGameNumber, "age_group", age);
    await apiUpdateField(currentGameNumber, "gender", gender);
    await apiUpdateField(currentGameNumber, "division", division);
    await apiUpdateField(currentGameNumber, "coach_last_name", coachLast);
    await apiUpdateField(currentGameNumber, "orig_date", formatDateForStorage(d));
    await apiUpdateField(currentGameNumber, "orig_time", formatTimeForStorage(t));
    await apiUpdateField(currentGameNumber, "orig_field", field);

    await apiUpdateStep(currentGameNumber, 2);
    currentRow.step_2 = "completed";

    alert("Saved.");
  };
}

// =============================================================
// STEP 3
// =============================================================
function renderStep3(panel) {
  panel.innerHTML = `
    <h2>Step 3 — Coach & Opponent Contact</h2>

    <label>Your Name</label>
    <input id="coach_name" value="${currentRow.coach_name || ""}">

    <label>Opposing Coach Name</label>
    <input id="opp_coach_name" value="${currentRow.opp_coach_name || ""}">

    <label>Opponent Town</label>
    <input id="opp_town" value="${currentRow.opp_town || ""}">

    <button id="s3_save" class="primary-btn">Save</button>
  `;

  document.getElementById("s3_save").onclick = async () => {
    const coach = document.getElementById("coach_name").value.trim();
    const opp = document.getElementById("opp_coach_name").value.trim();
    const town = document.getElementById("opp_town").value.trim();

    await apiUpdateField(currentGameNumber, "coach_name", coach);
    await apiUpdateField(currentGameNumber, "opp_coach_name", opp);
    await apiUpdateField(currentGameNumber, "opp_town", town);

    await apiUpdateStep(currentGameNumber, 3);
    currentRow.step_3 = "completed";

    alert("Saved.");
  };
}

// =============================================================
// STEP 4
// =============================================================
function renderStep4(panel) {
  panel.innerHTML = `
    <h2>Step 4 — Final Game Details</h2>

    <label>Final Date</label>
    <input type="date" id="final_date" value="${currentRow.final_date_input || ""}">

    <label>Final Time</label>
    <input type="time" id="final_time" value="${currentRow.final_time_input || ""}">

    <label>Final Field</label>
    <input id="final_field" value="${currentRow.final_field || ""}">

    <button id="s4_save" class="primary-btn">Save</button>
  `;

  document.getElementById("s4_save").onclick = async () => {
    const d = document.getElementById("final_date").value;
    const t = document.getElementById("final_time").value;
    const f = document.getElementById("final_field").value.trim();

    await apiUpdateField(currentGameNumber, "final_date", formatDateForStorage(d));
    await apiUpdateField(currentGameNumber, "final_time", formatTimeForStorage(t));
    await apiUpdateField(currentGameNumber, "final_field", f);

    await apiUpdateStep(currentGameNumber, 4);
    currentRow.step_4 = "completed";

    alert("Saved.");
  };
}

// =============================================================
// STEP 5
// =============================================================
function renderStep5(panel) {
  panel.innerHTML = `
    <h2>Step 5 — Field Hold</h2>
    <p>This step is informational only.</p>
  `;

  if (!isStepComplete(5)) {
    apiUpdateStep(currentGameNumber, 5);
    currentRow.step_5 = "completed";
  }
}

// =============================================================
// STEP 6
// =============================================================
function renderStep6(panel) {
  panel.innerHTML = `
    <h2>Step 6 — HAYSA Approval</h2>

    <label>Approval Status</label>
    <select id="haysa_status">
      <option value="">Select…</option>
      <option value="approved" ${currentRow.haysa_status==="approved"?"selected":""}>Approved</option>
      <option value="denied" ${currentRow.haysa_status==="denied"?"selected":""}>Denied</option>
    </select>

    <button id="s6_save" class="primary-btn">Save</button>
  `;

  document.getElementById("s6_save").onclick = async () => {
    const status = document.getElementById("haysa_status").value;

    await apiUpdateField(currentGameNumber, "haysa_status", status);

    if (status === "approved") {
      await apiUpdateStep(currentGameNumber, 6);
      currentRow.step_6 = "completed";
    }

    alert("Saved.");
  };
}

// =============================================================
// STEP 7
// =============================================================
function renderStep7(panel) {
  panel.innerHTML = `
    <h2>Step 7 — Certification</h2>

    <label><input type="checkbox" id="certified" ${currentRow.certified==="true"?"checked":""}> I certify the opponent agreed</label>

    <label>Signed Name</label>
    <input id="signed_name" value="${currentRow.signed_name || ""}">

    <button id="s7_save" class="primary-btn">Save</button>
  `;

  document.getElementById("s7_save").onclick = async () => {
    const cert = document.getElementById("certified").checked;
    const name = document.getElementById("signed_name").value.trim();

    if (!cert) return alert("Certification required.");
    if (!name) return alert("Signed name required.");

    await apiUpdateField(currentGameNumber, "certified", cert ? "true" : "false");
    await apiUpdateField(currentGameNumber, "signed_name", name);

    await apiUpdateStep(currentGameNumber, 7);
    currentRow.step_7 = "completed";

    alert("Saved.");
  };
}

// =============================================================
// STEP 8
// =============================================================
function renderStep8(panel) {
  panel.innerHTML = `
    <h2>Step 8 — Finalize</h2>

    <label>Board Notes</label>
    <input id="notes" value="${currentRow.notes || ""}">

    <button id="s8_save" class="primary-btn">Mark Complete</button>
  `;

  document.getElementById("s8_save").onclick = async () => {
    await apiUpdateField(currentGameNumber, "notes", document.getElementById("notes").value);

    await apiUpdateStep(currentGameNumber, 8);
    currentRow.step_8 = "completed";

    alert("Request marked complete.");
  };
}

// =============================================================
// INIT
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
  loadSubmittedRequests();
});
