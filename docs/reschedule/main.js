// ===============================
// API LAYER
// ===============================

// Fetch a single game row by game number
async function apiGetGame(gameNumber) {
  const url = `https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec?action=getRow&game_number=${gameNumber}`;

  

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return null;

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("apiGetGame error:", err);
    return null;
  }
}

// Fetch ALL rows for landing page
async function apiGetAllRows() {
  const url = `https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec?action=getAllRows`;

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



// ===============================================
// INIT
// ===============================================
document.addEventListener("DOMContentLoaded", () => {

  // Hide workflow UI on landing page
  document.getElementById("workflowPage").style.display = "none";
  document.getElementById("timelineContainer").style.display = "none";
  document.getElementById("panelContainer").style.display = "none";
  document.getElementById("nextStepContainer").style.display = "none";
  document.getElementById("backToListContainer").style.display = "none";
  document.getElementById("formSection").style.display = "none";

  initTimeline();
  loadSubmittedRequests();
});




function formatTime(t) {
  if (!t) return "";
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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



// ===============================================
// CONFIG
// ===============================================
const API_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";

// =========================
// Helpers
// =========================

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

function getHighestCompletedStep(row) {
  // your existing logic
}



// ===============================================
// API HELPERS
// ===============================================
function apiGetRow(gameNumber) {
  return new Promise((resolve, reject) => {
    const callbackName = "haysaWorkflowCallback_" + gameNumber;
    const script = document.createElement("script");

    window[callbackName] = function (data) {
      delete window[callbackName];
      script.remove();
      resolve(data);
    };

    script.src = `${API_URL}?action=getRow&game_number=${encodeURIComponent(gameNumber)}&callback=${encodeURIComponent(callbackName)}`;
    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error("Failed to load workflow data"));
    };

    document.body.appendChild(script);
  });
}


async function apiGetAllRows() {
  const url = `https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec?action=getAllRows`;

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






async function loadSubmittedRequests() {
  const rows = await apiGetAllRows();
  const list = document.getElementById("submittedList");

  list.innerHTML = "";

  rows.forEach(row => {
    if (row.game_number) {

      // Determine next incomplete step
      let nextStep = 2;
      for (let s = 2; s <= 9; s++) {
        if (!isStepComplete(s)) {
          nextStep = s;
          break;
        }
      }

      const div = document.createElement("div");
      div.className = "submitted-item";
      div.innerHTML = `
        <strong>Game #${row.game_number}</strong> — Next Step ${nextStep}
        <button class="primary-btn" onclick="resumeGame('${row.game_number}')">Resume</button>
      `;
      list.appendChild(div);
    }
  });

  document.getElementById("submittedListContainer").style.display = "block";
}




async function apiCreateRow(gameNumber) {
  const form = new FormData();
  form.append("action", "createRow");
  form.append("game_number", gameNumber);
  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}



async function downloadSSSLForm() {
  const form = new FormData();
  form.append("action", "generateSSSLForm");
  form.append("game_number", currentGameNumber);

  const res = await fetch(API_URL, {
    method: "POST",
    body: form
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `SSSL-Reschedule-${currentGameNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}



async function downloadSSSLForm() {
  const form = new FormData();
  form.append("action", "generateSSSLForm");
  form.append("game_number", currentGameNumber);

  const res = await fetch(API_URL, {
    method: "POST",
    body: form
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `SSSL-Reschedule-${currentGameNumber}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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


// ===============================================
// STATE + FIELD HELPERS
// ===============================================
let currentGameNumber = null;
let currentRowData = null;
let currentStep = 1;

function getField(field) {
  if (!currentRowData) return "";
  return currentRowData[field] == null ? "" : currentRowData[field];
}

async function setField(field, value) {
  if (!currentRowData) currentRowData = {};
  currentRowData[field] = value;
  await apiUpdateField(currentGameNumber, field, value);
}

function prefillInput(id, field) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = getField(field) || "";
}


// ===============================================
// TIMELINE HYDRATION
// ===============================================
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

  mark(2, isStepComplete(2));
  mark(3, isStepComplete(3));
  mark(4, isStepComplete(4));
  mark(5, isStepComplete(5));
  mark(6, isStepComplete(6));
  mark(7, isStepComplete(7));
  mark(8, isStepComplete(8));
  mark(9, isStepComplete(9));
}



async function resumeGame(gameNumber) {
  const row = await apiGetGame(gameNumber);

  if (!row) {
    alert("Game not found.");
    return;
  }

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

  showWorkflowUI();   // ← REQUIRED

  hydrateTimelineFromRow(row);
  goToStep(nextStep);
}


function hydrateFieldsFromRow(row) {
  console.log("hydrateFieldsFromRow called with:", row);
}



async function lookupGameNumber() {
  const gameNumber = document.getElementById("lookupGameNumber").value.trim();
  if (!gameNumber) {
    alert("Please enter a game number.");
    return;
  }

  const row = await apiGetGame(gameNumber);

  if (!row) {
    alert("Game not found.");
    return;
  }

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

  showWorkflowUI();   // ← REQUIRED

  hydrateTimelineFromRow(row);
  goToStep(nextStep);
}




function hideLandingPage() {
  document.getElementById("submittedListContainer").style.display = "none";
  document.getElementById("lookupContainer").style.display = "none";
}



async function startNewWorkflow(gameNumber) {
  const res = await apiCreateRow(gameNumber);
  if (!res || (!res.success && !res.created)) {
    alert("Error creating workflow row.");
    return;
  }
  currentRowData = res.data || {};
  beginWorkflow();
}

function beginWorkflow() {
  // Hide lookup card
  document.getElementById("lookupContainer").style.display = "none";
  
  // Show workflow UI (horizontal timeline)
  document.getElementById("timelineContainer").style.display = "flex";
  document.getElementById("panelContainer").style.display = "block";
  document.getElementById("nextStepContainer").style.display = "block";


  // Determine highest completed step
  let highestCompleted = 1;
  for (let s = 1; s <= 9; s++) {
    if (currentRowData[`step_${s}`] === "completed") {
      highestCompleted = s;
    }
  }

  currentStep = highestCompleted;

  // Hydrate AFTER determining correct step
  hydrateTimelineFromRow(currentRowData);
  setActiveTimelineStep(currentStep);
  renderPanelForStep(currentStep);

  // Prefill form fields
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




// ===============================================
// TIMELINE + NAVIGATION (HORIZONTAL)
// ===============================================
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

function renderPanelForStep(step) {
  const panel = document.getElementById("panelContainer");
  if (!panel) return;

  switch (step) {
    case 1:
      renderStep1(panel);
      break;
    case 2:
      renderStep2(panel);
      break;
    case 3:
      renderStep3(panel);
      break;
    case 4:
      renderStep4(panel);
      break;
    case 5:
      renderStep5(panel);
      break;
    case 6:
      renderStep6(panel);
      break;
    case 7:
      renderStep7(panel);
      break;
    case 8:
      renderStep8(panel);
      break;
    case 9:
      renderStep9(panel);
      break;
    default:
      panel.innerHTML = "<p>Select a step above.</p>";
  }
}

function isStepComplete(step) {
  const f = (name) => getField(name);

  switch (step) {

    case 2:
      return (
        f("age_division") &&
        f("team_name") &&
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
        f("is_haysa_home_final") &&
        f("final_date") &&
        f("final_time") &&
        f("final_field")
      );

    case 5:
      return f("field_hold_status") === "completed";

    case 6:
      return f("haysa_approval") === "approved";

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

  switch (step) {
    case 2: renderStep2(panel); break;
    case 3: renderStep3(panel); break;
    case 4: renderStep4(panel); break;
    case 5: renderStep5(panel); break;
    case 6: renderStep6(panel); break;
    case 7: renderStep7(panel); break;
    case 8: renderStep8(panel); break;
    case 9: renderStep9(panel); break;
  }

  highlightStepInTimeline(step);
}


function showWorkflowUI() {
  document.getElementById("workflowPage").style.display = "block";
  document.getElementById("timelineContainer").style.display = "flex";
  document.getElementById("panelContainer").style.display = "block";
  document.getElementById("nextStepContainer").style.display = "block";
  document.getElementById("backToListContainer").style.display = "block";
}





// ===============================================
// STEP PANELS
// ===============================================

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
    <input type="date" id="orig_date" value="${getField("orig_date") || ""}">

    <label>Original Time</label>
    <input type="time" id="orig_time" value="${getField("orig_time") || ""}">

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

    const origDate = document.getElementById("orig_date").value;
    const origTime = document.getElementById("orig_time").value;
    const origField = document.getElementById("orig_field").value.trim();

    if (!ageGroup || !gender || !division || !coachLast || !isHome ||
        !origDate || !origTime || !origField) {
      alert("Please complete all fields before saving.");
      return;
    }

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

    // ⭐ Prevent marking complete if fields are missing
    if (!coachName || !coachEmail || !coachPhone ||
        !oppName || !oppEmail || !oppPhone ||
        !awayTeam || !oppTown) {
      alert("Please complete all fields before saving.");
      return;
    }

    await apiUpdateField(currentGameNumber, "coach_name", coachName);
    await apiUpdateField(currentGameNumber, "coach_email", coachEmail);
    await apiUpdateField(currentGameNumber, "coach_phone", coachPhone);

    await apiUpdateField(currentGameNumber, "opp_coach_name", oppName);
    await apiUpdateField(currentGameNumber, "opp_coach_email", oppEmail);
    await apiUpdateField(currentGameNumber, "opp_coach_phone", oppPhone);

    await apiUpdateField(currentGameNumber, "away_team", awayTeam);
    await apiUpdateField(currentGameNumber, "opp_town", oppTown);

    await apiUpdateStep(currentGameNumber, 3);
    currentRowData.step_3 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Contact details saved.");
  };
}


// STEP 4 — Final Game Details (New Schedule) + Clean Comparison + Auto-Fill
function renderStep4(panel) {

  const origDateDisplay = getField("orig_date") || "(none)";
  const origTimeDisplay = getField("orig_time") || "(none)";
  const origFieldDisplay = getField("orig_field") || "(none)";

  const finalDateDisplay = getField("final_date") || "(none)";
  const finalTimeDisplay = getField("final_time") || "(none)";
  const finalFieldDisplay = getField("final_field") || "(none)";

  const finalDateInput = getField("final_date") || "";
  const finalTimeInput = getField("final_time") || "";
  const finalFieldInput = getField("final_field") || "";

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

      <p class="comparison-note">Changes will be highlighted when different from the original.</p>

      <h3>New Game Details</h3>

      <label>New Date</label>
      <input type="date" id="final_date" value="${finalDateInput}">

      <label>New Time</label>
      <input type="time" id="final_time" value="${finalTimeInput}">

      <label>New Field</label>
      <input type="text" id="final_field" value="${finalFieldInput}">

      <button id="s4_save" class="primary-btn">Save New Game Details</button>

    </div>
  `;

  function updateChangeHighlights() {
    const newDate = document.getElementById("final_date").value || finalDateDisplay;
    const newTime = document.getElementById("final_time").value || finalTimeDisplay;
    const newField = document.getElementById("final_field").value || finalFieldDisplay;

    const fdSpan = document.getElementById("cmp_final_date");
    const ftSpan = document.getElementById("cmp_final_time");
    const ffSpan = document.getElementById("cmp_final_field");

    fdSpan.textContent = newDate || "(none)";
    ftSpan.textContent = newTime || "(none)";
    ffSpan.textContent = newField || "(none)";

    fdSpan.classList.toggle("changed", newDate !== origDateDisplay);
    ftSpan.classList.toggle("changed", newTime !== origTimeDisplay);
    ffSpan.classList.toggle("changed", newField !== origFieldDisplay);
  }

  document.getElementById("final_date").addEventListener("input", updateChangeHighlights);
  document.getElementById("final_time").addEventListener("input", updateChangeHighlights);
  document.getElementById("final_field").addEventListener("input", updateChangeHighlights);

  updateChangeHighlights();

  document.getElementById("s4_save").onclick = async () => {
    const newDate = document.getElementById("final_date").value;
    const newTime = document.getElementById("final_time").value;
    const newField = document.getElementById("final_field").value;

    if (!newDate || !newTime || !newField) {
      alert("Please complete all new game details before saving.");
      return;
    }

    await setField("final_date", newDate);
    await setField("final_time", newTime);
    await setField("final_field", newField);

    await apiUpdateStep(currentGameNumber, 4);
    currentRowData.step_4 = "completed";
    hydrateTimelineFromRow(currentRowData);

    updateChangeHighlights();
    alert("New game details saved.");
  };
}



// STEP 5 — Field Hold (home game)
function renderStep5(panel) {

  const status = getField("field_hold_status") || "";

  panel.innerHTML = `
    <h2>Step 5 — Field Hold</h2>
    <p>If required, request a field hold for the new game location.</p>

    <label>Field Hold Status</label>
    <select id="field_hold_status">
      <option value="">Select…</option>
      <option value="not_needed" ${status==="not_needed"?"selected":""}>Not Needed</option>
      <option value="requested" ${status==="requested"?"selected":""}>Requested</option>
      <option value="completed" ${status==="completed"?"selected":""}>Completed</option>
    </select>

    <button id="s5_save" class="primary-btn">Save Field Hold Status</button>
  `;

  document.getElementById("s5_save").onclick = async () => {
    const newStatus = document.getElementById("field_hold_status").value;

    if (!newStatus) {
      alert("Please select a field hold status.");
      return;
    }

    await setField("field_hold_status", newStatus);

    if (newStatus === "completed") {
      await apiUpdateStep(currentGameNumber, 5);
      currentRowData.step_5 = "completed";
      hydrateTimelineFromRow(currentRowData);
    }

    alert("Field hold status saved.");
  };
}



// STEP 6 — HAYSA Approval
function renderStep6(panel) {

  const approval = getField("haysa_approval") || "";

  panel.innerHTML = `
    <h2>Step 6 — HAYSA Approval</h2>
    <p>The HAYSA board must approve this reschedule request.</p>

    <label>Approval Status</label>
    <select id="haysa_approval">
      <option value="">Select…</option>
      <option value="approved" ${approval==="approved"?"selected":""}>Approved</option>
      <option value="denied" ${approval==="denied"?"selected":""}>Denied</option>
    </select>

    <button id="s6_save" class="primary-btn">Save Approval Status</button>
  `;

  document.getElementById("s6_save").onclick = async () => {
    const newStatus = document.getElementById("haysa_approval").value;

    if (!newStatus) {
      alert("Please select an approval status.");
      return;
    }

    await setField("haysa_approval", newStatus);

    if (newStatus === "approved") {
      await apiUpdateStep(currentGameNumber, 6);
      currentRowData.step_6 = "completed";
      hydrateTimelineFromRow(currentRowData);
    }

    alert("Approval status saved.");
  };
}




// STEP 7 — SSSL Form (uses gameChangeForm + signature)
function renderStep7(panel) {

  const fd = (name) => getField(name) || "";

  const isHomeOriginal = fd("is_haysa_home") === "true";
  const isHomeFinal = fd("is_haysa_home_final") === "true";

  const oppTown = fd("opp_town");
  const awayTeam = fd("away_team");
  const teamName = fd("team_name");

  // Determine home/away for original
  const homeTeamOriginal = isHomeOriginal ? teamName : awayTeam;
  const awayTeamOriginal = isHomeOriginal ? awayTeam : teamName;

  // Determine home/away for final
  const homeTeamFinal = isHomeFinal ? teamName : awayTeam;
  const awayTeamFinal = isHomeFinal ? awayTeam : teamName;

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
      "is_haysa_home_final",
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

  // ⭐ Download DOCX
  document.getElementById("s9_download").onclick = () => {
    downloadSSSLForm();
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


// ===============================================
// SIGNATURE PAD + PDF + FORM SAVE
// ===============================================
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

