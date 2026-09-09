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
    <p>You are beginning a reschedule workflow for game #${currentGameNumber}.</p>
    <p>This will track all moves and approvals for this game.</p>

    <button id="s1_proceed" class="primary-btn">I want to proceed</button>
  `;

  document.getElementById("s1_proceed").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 1);
    currentRowData.step_1 = true;
    hydrateTimelineFromRow(currentRowData);
    goToStep(2);
  };
}



// STEP 2 — Original Game Details
function renderStep2(panel) {
  panel.innerHTML = `
    <h2>Step 2 — Original Game Details</h2>
    <p>Enter the current/original game details.</p>

    <label>Original Date</label>
    <input type="date" id="orig_date" value="${getField("orig_date_input") || ""}">

    <label>Original Time</label>
    <input type="time" id="orig_time" value="${getField("orig_time_input") || ""}">

    <label>Original Field</label>
    <input type="text" id="orig_field" value="${getField("orig_field") || ""}">

    <button id="s2_save" class="primary-btn">Save Original Details</button>
  `;

  document.getElementById("s2_save").onclick = async () => {
    await setField("orig_date", document.getElementById("orig_date").value);
    await setField("orig_time", document.getElementById("orig_time").value);
    await setField("orig_field", document.getElementById("orig_field").value);

    await apiUpdateStep(currentGameNumber, 2);
    currentRowData.step_2 = true;
    hydrateTimelineFromRow(currentRowData);

    alert("Original details saved.");
  };
}



// STEP 3 — Opponent Contact Info
function renderStep3(panel) {
  panel.innerHTML = `
    <h2>Step 3 — Opponent Contact</h2>
    <p>Record the opponent coach details.</p>

    <label>Opposing Coach Name</label>
    <input type="text" id="opp_coach_name" value="${getField("opp_coach_name") || ""}">

    <label>Opposing Coach Email</label>
    <input type="email" id="opp_coach_email" value="${getField("opp_coach_email") || ""}">

    <label>Opposing Coach Phone</label>
    <input type="tel" id="opp_coach_phone" value="${getField("opp_coach_phone") || ""}">

    <button id="s3_save" class="primary-btn">Save Opponent Details</button>
  `;

  document.getElementById("s3_save").onclick = async () => {
    await setField("opp_coach_name", document.getElementById("opp_coach_name").value);
    await setField("opp_coach_email", document.getElementById("opp_coach_email").value);
    await setField("opp_coach_phone", document.getElementById("opp_coach_phone").value);

    await apiUpdateStep(currentGameNumber, 3);
    currentRowData.step_3 = true;
    hydrateTimelineFromRow(currentRowData);

    alert("Opponent details saved.");
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
    <p>Record whether the field has been requested and confirmed.</p>

    <label>Field Requested?</label>
    <input type="text" id="field_requested" value="${getField("field_requested") || ""}">

    <label>Field Confirmed?</label>
    <input type="text" id="field_confirmed" value="${getField("field_confirmed") || ""}">

    <button id="s5_save" class="primary-btn">Save Field Hold Status</button>
  `;

  document.getElementById("s5_save").onclick = async () => {
    await setField("field_requested", document.getElementById("field_requested").value);
    await setField("field_confirmed", document.getElementById("field_confirmed").value);

    await apiUpdateStep(currentGameNumber, 5);
    currentRowData.step_5 = true;
    hydrateTimelineFromRow(currentRowData);

    alert("Field hold status saved.");
  };
}





// STEP 6 — HAYSA Approval
function renderStep6(panel) {
  panel.innerHTML = `
    <h2>Step 6 — HAYSA Approval</h2>
    <p>Record the HAYSA approval status.</p>

    <label>HAYSA Status</label>
    <input type="text" id="haysa_status" value="${getField("haysa_status") || ""}">

    <label>HAYSA Notes</label>
    <input type="text" id="haysa_notes" value="${getField("haysa_notes") || ""}">

    <button id="s6_save" class="primary-btn">Save HAYSA Approval</button>
  `;

  document.getElementById("s6_save").onclick = async () => {
    await setField("haysa_status", document.getElementById("haysa_status").value);
    await setField("haysa_notes", document.getElementById("haysa_notes").value);

    await apiUpdateStep(currentGameNumber, 6);
    currentRowData.step_6 = true;
    hydrateTimelineFromRow(currentRowData);

    alert("HAYSA approval saved.");
  };
}




// STEP 7 — SSSL Form (uses gameChangeForm + signature)
function renderStep7(panel) {
  panel.innerHTML = `
    <h2>Step 7 — SSSL Form</h2>
    <p>Complete the SSSL reschedule form below.</p>
  `;

  document.getElementById("formSection").style.display = "block";

  // Auto-fill form fields
  document.querySelector("[name='game_number']").value = currentGameNumber;
  document.querySelector("[name='team_name']").value = getField("team_name") || "";
  document.querySelector("[name='orig_date']").value = getField("orig_date_input") || "";
  document.querySelector("[name='orig_time']").value = getField("orig_time_input") || "";
  document.querySelector("[name='orig_field']").value = getField("orig_field") || "";

  document.querySelector("[name='final_date']").value = getField("final_date_input") || "";
  document.querySelector("[name='final_time']").value = getField("final_time_input") || "";
  document.querySelector("[name='final_field']").value = getField("final_field") || "";

  document.querySelector("[name='coach_name']").value = getField("coach_name") || "";
  document.querySelector("[name='coach_email']").value = getField("coach_email") || "";
  document.querySelector("[name='coach_phone']").value = getField("coach_phone") || "";

  document.querySelector("[name='opp_coach_name']").value = getField("opp_coach_name") || "";
  document.querySelector("[name='opp_coach_phone']").value = getField("opp_coach_phone") || "";

  await apiUpdateStep(currentGameNumber, 7);
  currentRowData.step_7 = true;
  hydrateTimelineFromRow(currentRowData);
}




// STEP 8 — Calendar Update
function renderStep8(panel) {
  panel.innerHTML = `
    <h2>Step 8 — Calendar Update</h2>
    <p>Record whether the calendar has been updated.</p>

    <label>Calendar Updated?</label>
    <input type="text" id="calendar_updated" value="${getField("calendar_updated") || ""}">

    <button id="s8_save" class="primary-btn">Save Calendar Update</button>
  `;

  document.getElementById("s8_save").onclick = async () => {
    await setField("calendar_updated", document.getElementById("calendar_updated").value);

    await apiUpdateStep(currentGameNumber, 8);
    currentRowData.step_8 = true;
    hydrateTimelineFromRow(currentRowData);

    alert("Calendar update saved.");
  };
}





// STEP 9 — Notify Coaches
function renderStep9(panel) {
  panel.innerHTML = `
    <h2>Step 9 — Finalize Request</h2>
    <p>Download the completed form and record any final notes.</p>

    <button id="s9_download" class="primary-btn">Download Completed Form</button>

    <label>Board Notes (optional)</label>
    <input type="text" id="notes" value="${getField("notes") || ""}">

    <button id="s9_save" class="secondary-btn">Mark Request Complete</button>
  `;

  document.getElementById("s9_download").onclick = () => {
    generateReschedulePDF(currentRowData);
  };

  document.getElementById("s9_save").onclick = async () => {
    await setField("notes", document.getElementById("notes").value);

    await apiUpdateStep(currentGameNumber, 9);
    currentRowData.step_9 = true;
    hydrateTimelineFromRow(currentRowData);

    alert("Request marked complete.");
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
