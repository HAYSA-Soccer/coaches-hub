// ===============================================
// CONFIG
// ===============================================
const API_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";


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
  document.querySelectorAll(".timeline-step").forEach(el => {
    const stepNum = Number(el.dataset.step);
    const fieldName = `step_${stepNum}`;

    if (row[fieldName] === true || row[fieldName] === "true" || row[fieldName] === "completed") {
      el.classList.add("completed");
    } else {
      el.classList.remove("completed");
    }
  });
}


// ===============================================
// LOOKUP FLOW (ONE GAME NUMBER PER ROW)
// ===============================================
async function lookupGameNumber() {
  const gameNumber = document.getElementById("lookupGameNumber").value.trim();
  const statusEl = document.getElementById("lookupStatus");

  if (!gameNumber) {
    statusEl.textContent = "Please enter a game number.";
    return;
  }

  statusEl.textContent = "Looking up game…";

  try {
    const row = await apiGetRow(gameNumber);
    currentGameNumber = gameNumber;
    document.getElementById("form_game_number").value = gameNumber;

    if (row.exists) {
      currentRowData = row.data || {};
      statusEl.innerHTML = `
        <p>Existing request found for Game #${gameNumber}.</p>
        <button class="primary-btn" onclick="beginWorkflow()">Continue Request</button>
      `;
    } else {
      statusEl.innerHTML = `
        <p>No existing request found for Game #${gameNumber}.</p>
        <button class="primary-btn" onclick="startNewWorkflow('${gameNumber}')">Start New Request</button>
      `;
    }
  } catch (err) {
    statusEl.textContent = "Error loading game. Please try again.";
  }
}

async function startNewWorkflow(gameNumber) {
  const res = await apiCreateRow(gameNumber);
  if (!res || !res.success) {
    alert("Error creating workflow row.");
    return;
  }
  currentRowData = res.data || {};
  beginWorkflow();
}

function beginWorkflow() {
  document.getElementById("lookupContainer").style.display = "none";
  document.getElementById("timelineContainer").style.display = "block";
  document.getElementById("panelContainer").style.display = "block";
  document.getElementById("nextStepContainer").style.display = "block";

  currentStep = 1;
  setActiveTimelineStep(currentStep);
  renderPanelForStep(currentStep);

  hydrateTimelineFromRow(currentRowData);

  // prefill Game Change Form from row data if available
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

        await apiUpdateStep(currentGameNumber, currentStep);
        currentRowData[`step_${currentStep}`] = "completed";

        hydrateTimelineFromRow(currentRowData);
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


// ===============================================
// STEP PANELS
// ===============================================

// STEP 1 — Start Reschedule Attempt
function renderStep1(panel) {
  panel.innerHTML = `
    <h2>Step 1 — Start Reschedule Attempt</h2>
    <p>You are beginning a reschedule workflow for game <strong>#${currentGameNumber}</strong>.</p>
    <p>This will track all moves and approvals for this game.</p>
    <button id="s1_continue" class="primary-btn">I want to proceed</button>
  `;

  document.getElementById("s1_continue").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 1);
    currentRowData.step_1 = "completed";
    hydrateTimelineFromRow(currentRowData);

    currentStep = 2;
    setActiveTimelineStep(currentStep);
    renderPanelForStep(currentStep);
  };
}

// STEP 2 — Original Game Details
function renderStep2(panel) {
  panel.innerHTML = `
    <h2>Step 2 — Original Game Details</h2>
    <p>Enter the current/original game details.</p>

    <label>Original Date</label>
    <input type="date" id="orig_date">

    <label>Original Time</label>
    <input type="time" id="orig_time">

    <label>Original Field</label>
    <input type="text" id="orig_field">

    <button id="s2_save" class="primary-btn">Save Original Details</button>
  `;

  prefillInput("orig_date", "orig_date");
  prefillInput("orig_time", "orig_time");
  prefillInput("orig_field", "orig_field");

  document.getElementById("s2_save").onclick = async () => {
    const origDate = document.getElementById("orig_date").value;
    const origTime = document.getElementById("orig_time").value;
    const origField = document.getElementById("orig_field").value;

    await setField("orig_date", origDate);
    await setField("orig_time", origTime);
    await setField("orig_field", origField);

    await apiUpdateStep(currentGameNumber, 2);
    currentRowData.step_2 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Original game details saved.");
  };
}

// STEP 3 — Opponent Contact Info
function renderStep3(panel) {
  panel.innerHTML = `
    <h2>Step 3 — Opponent Contact Information</h2>
    <p>Enter or confirm the opposing coach's contact info.</p>

    <label>Opponent Coach Name</label>
    <input type="text" id="s3_opp_name">

    <label>Opponent Coach Email</label>
    <input type="email" id="s3_opp_email">

    <label>Opponent Coach Phone</label>
    <input type="tel" id="s3_opp_phone">

    <button id="s3_save" class="primary-btn">Save Contact Info</button>
  `;

  prefillInput("s3_opp_name", "opp_coach_name");
  prefillInput("s3_opp_email", "opp_coach_email");
  prefillInput("s3_opp_phone", "opp_coach_phone");

  document.getElementById("s3_save").onclick = async () => {
    const name = document.getElementById("s3_opp_name").value;
    const email = document.getElementById("s3_opp_email").value;
    const phone = document.getElementById("s3_opp_phone").value;

    await setField("opp_coach_name", name);
    await setField("opp_coach_email", email);
    await setField("opp_coach_phone", phone);

    await apiUpdateStep(currentGameNumber, 3);
    currentRowData.step_3 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Opponent contact info saved.");
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

  const finalDateInput = getField("final_date_input") || "";
  const finalTimeInput = getField("final_time_input") || "";
  const finalFieldInput = getField("final_field") || "";

  panel.innerHTML = `
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
  `;

  // --- CHANGE HIGHLIGHT LOGIC ---
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

  // --- SAVE BUTTON ---
  document.getElementById("s4_save").onclick = async () => {
    const newDate = document.getElementById("final_date").value;
    const newTime = document.getElementById("final_time").value;
    const newField = document.getElementById("final_field").value;

    await setField("final_date", newDate);
    await setField("final_time", newTime);
    await setField("final_field", newField);

    await apiUpdateStep(currentGameNumber, 4);
    currentRowData.step_4 = true;
    hydrateTimelineFromRow(currentRowData);

    updateChangeHighlights();
    alert("New game details saved.");
  };
}

// STEP 5 — Field Hold (home game)
function renderStep5(panel) {
  panel.innerHTML = `
    <h2>Step 5 — Field Hold</h2>
    <p>If this is a home game, request a field hold for the agreed date/time.</p>

    <label>Field Requested</label>
    <input type="text" id="s5_field">

    <label>Hold Confirmed?</label>
    <select id="s5_confirmed">
      <option value="no">No</option>
      <option value="yes">Yes</option>
    </select>

    <button id="s5_save" class="primary-btn">Save Field Hold Status</button>
  `;

  prefillInput("s5_field", "field_requested");
  const confirmedEl = document.getElementById("s5_confirmed");
  confirmedEl.value = getField("field_confirmed") || "no";

  document.getElementById("s5_save").onclick = async () => {
    await setField("field_requested", document.getElementById("s5_field").value);
    await setField("field_confirmed", document.getElementById("s5_confirmed").value);

    await apiUpdateStep(currentGameNumber, 5);
    currentRowData.step_5 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Field hold status saved.");
  };
}

// STEP 6 — HAYSA Approval
function renderStep6(panel) {
  panel.innerHTML = `
    <h2>Step 6 — HAYSA Approval</h2>
    <p>Request and record HAYSA approval for this reschedule.</p>

    <label>Approval Status</label>
    <select id="s6_status">
      <option value="pending">Pending</option>
      <option value="approved">Approved</option>
      <option value="denied">Denied</option>
    </select>

    <label>Notes</label>
    <input type="text" id="s6_notes">

    <button id="s6_save" class="primary-btn">Save HAYSA Approval</button>
  `;

  const statusEl = document.getElementById("s6_status");
  statusEl.value = getField("haysa_status") || "pending";
  prefillInput("s6_notes", "haysa_notes");

  document.getElementById("s6_save").onclick = async () => {
    const status = document.getElementById("s6_status").value;
    await setField("haysa_status", status);
    await setField("haysa_notes", document.getElementById("s6_notes").value);

    if (status !== "approved") {
      alert("HAYSA has not approved this yet. You should not proceed to SSSL.");
    }

    await apiUpdateStep(currentGameNumber, 6);
    currentRowData.step_6 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("HAYSA approval status saved.");
  };
}

// STEP 7 — SSSL Form (uses gameChangeForm + signature)
function renderStep7(panel) {
  panel.innerHTML = `
    <h2>Step 7 — SSSL Form</h2>
    <p>Complete the SSSL reschedule form with the agreed details and signature.</p>
    <p>Use the Game Change Form section below to fill in all required fields.</p>
  `;
}

// STEP 8 — Calendar Update
function renderStep8(panel) {
  panel.innerHTML = `
    <h2>Step 8 — Calendar Update</h2>
    <p>Update your team calendar and any league calendars with the new game date/time.</p>

    <button id="s8_done" class="primary-btn">Mark Calendar Updated</button>
  `;

  document.getElementById("s8_done").onclick = async () => {
    await setField("calendar_updated", "yes");
    await apiUpdateStep(currentGameNumber, 8);
    currentRowData.step_8 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Calendar update recorded.");
  };
}

// STEP 9 — Notify Coaches
function renderStep9(panel) {
  panel.innerHTML = `
    <h2>Step 9 — Notify Coaches</h2>
    <p>Send final confirmation to both coaches with the new game details.</p>

    <button id="s9_email" class="primary-btn">Compose Email</button>
    <button id="s9_done" class="secondary-btn">Mark Notification Complete</button>
  `;

  document.getElementById("s9_email").onclick = () => {
    const subject = encodeURIComponent("Game Reschedule Confirmation");
    const body = encodeURIComponent(
`Game Number: ${currentGameNumber}

Your game has been rescheduled.

Please contact us with any questions.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  document.getElementById("s9_done").onclick = async () => {
    await setField("notify_status", "completed");
    await apiUpdateStep(currentGameNumber, 9);
    currentRowData.step_9 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Notification marked complete.");
  };
}


// ===============================================
// SIGNATURE PAD + PDF + FORM SAVE
// ===============================================
function initGameChangeForm() {
  const form = document.getElementById("gameChangeForm");
  if (!form) return;

  const canvas = document.getElementById("signaturePad");
  const clearBtn = document.getElementById("clearSignature");
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
      "game_number",
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

    await apiUpdateStep(currentGameNumber, 7); // SSSL Form step
    currentRowData.step_7 = "completed";
    hydrateTimelineFromRow(currentRowData);

    alert("Form saved.");
  };
}


// ===============================================
// INIT
// ===============================================
document.addEventListener("DOMContentLoaded", () => {
  initTimeline();
  initGameChangeForm();
});
