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
  
  // STEP_X UPDATE (maps to step_1..step_12)
  async function apiUpdateStep(gameNumber, stepNumber) {
    return apiUpdateField(gameNumber, `step_${stepNumber}`, "completed");
  }
  



function hydrateTimelineFromRow(row) {
  document.querySelectorAll(".timeline-step").forEach(el => {
    const stepNum = Number(el.dataset.step);
    const fieldName = `step_${stepNum}`;

    if (row[fieldName] === true || row[fieldName] === "true") {
      el.classList.add("completed");
    } else {
      el.classList.remove("completed");
    }
  });
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
    return apiUpdateField(currentGameNumber, field, value);
  }
  
function prefillInput(id, field) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = getField(field) || "";
}




async function updateField(gameNumber, fieldName, value) {
  const formData = new FormData();
  formData.append("action", "updateField");
  formData.append("game_number", gameNumber);
  formData.append("field", fieldName);
  formData.append("value", value);

  const response = await fetch(API_URL, {
    method: "POST",
    body: formData
  });

  const result = await response.json();
  return result.updated;
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




function hydrateTimelineFromRow(row) {
  document.querySelectorAll(".timeline-step").forEach(el => {
    const stepNum = Number(el.dataset.step);
    const fieldName = `step_${stepNum}`;

    if (row[fieldName] === true || row[fieldName] === "true") {
      el.classList.add("completed");
    } else {
      el.classList.remove("completed");
    }
  });
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

  // ⭐ NEW: hydrate timeline from saved step flags
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
// TIMELINE + NAVIGATION
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
      if (currentStep < 8) {
        currentStep++;

        // Save step flag
        await updateField(currentGameNumber, `step_${currentStep}`, true);

        // Update local row data
        currentRowData[`step_${currentStep}`] = true;

        // Hydrate timeline
        hydrateTimelineFromRow(currentRowData);

        // Move UI forward
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
}


// ===============================================
// STEP PANELS
// ===============================================

// STEP 1 — Start Attempt (confirm intent)
function renderStep1(panel) {
  panel.innerHTML = `
    <h2>Step 1 — Start Reschedule Attempt</h2>
    <p>You are beginning a reschedule workflow for game <strong>#${currentGameNumber}</strong>.</p>
    <p>This will track all moves and approvals for this game.</p>
    <button id="s1_continue" class="primary-btn">I want to proceed</button>
  `;

  document.getElementById("s1_continue").onclick = async () => {
    await updateField(currentGameNumber, "step_1", true);
    currentStep = 2;
    setActiveTimelineStep(currentStep);
    renderPanelForStep(currentStep);
  };
}

// STEP 2 — Opponent Contact Info
function renderStep2(panel) {
  panel.innerHTML = `
    <h2>Step 2 — Opponent Contact Information</h2>
    <p>Enter or confirm the opposing coach's contact info.</p>

    <label>Opponent Coach Name</label>
    <input type="text" id="s2_opp_name">

    <label>Opponent Coach Email</label>
    <input type="email" id="s2_opp_email">

    <label>Opponent Coach Phone</label>
    <input type="tel" id="s2_opp_phone">

    <button id="s2_save" class="primary-btn">Save Contact Info</button>
  `;

  // prefill from sheet
  prefillInput("s2_opp_name", "opp_coach_name");
  prefillInput("s2_opp_email", "opp_coach_email");
  prefillInput("s2_opp_phone", "opp_coach_phone");

  document.getElementById("s2_save").onclick = async () => {
    const name = document.getElementById("s2_opp_name").value;
    const email = document.getElementById("s2_opp_email").value;
    const phone = document.getElementById("s2_opp_phone").value;
    
    await updateField(currentGameNumber, "opp_coach_name", name);
    await updateField(currentGameNumber, "opp_coach_email", email);
    await updateField(currentGameNumber, "opp_coach_phone", phone);

currentRowData.opp_coach_name = name;
currentRowData.opp_coach_email = email;
currentRowData.opp_coach_phone = phone;

    await updateField(currentGameNumber, "step_2", true);
    currentRowData.step_2 = true;
    hydrateTimelineFromRow(currentRowData);

    alert("Opponent contact info saved.");
  };
}

// STEP 3 — Negotiation (up to 3 attempts)
function renderStep3(panel) {
  panel.innerHTML = `
    <h2>Step 3 — Negotiation Attempts</h2>
    <p>Track up to three proposed dates/times and outcomes.</p>

    <div class="attempt-block">
      <h3>Attempt 1</h3>
      <label>Proposed Date</label>
      <input type="date" id="s3_a1_date">
      <label>Proposed Time</label>
      <input type="time" id="s3_a1_time">
      <label>Outcome / Notes</label>
      <input type="text" id="s3_a1_notes">
    </div>

    <div class="attempt-block">
      <h3>Attempt 2</h3>
      <label>Proposed Date</label>
      <input type="date" id="s3_a2_date">
      <label>Proposed Time</label>
      <input type="time" id="s3_a2_time">
      <label>Outcome / Notes</label>
      <input type="text" id="s3_a2_notes">
    </div>

    <div class="attempt-block">
      <h3>Attempt 3</h3>
      <label>Proposed Date</label>
      <input type="date" id="s3_a3_date">
      <label>Proposed Time</label>
      <input type="time" id="s3_a3_time">
      <label>Outcome / Notes</label>
      <input type="text" id="s3_a3_notes">
    </div>

    <button id="s3_agreement" class="primary-btn">Agreement Reached</button>
  `;

  // prefill from sheet
  prefillInput("s3_a1_date", "opt1_date");
  prefillInput("s3_a1_time", "opt1_time");
  prefillInput("s3_a1_notes", "opt1_notes");

  prefillInput("s3_a2_date", "opt2_date");
  prefillInput("s3_a2_time", "opt2_time");
  prefillInput("s3_a2_notes", "opt2_notes");

  prefillInput("s3_a3_date", "opt3_date");
  prefillInput("s3_a3_time", "opt3_time");
  prefillInput("s3_a3_notes", "opt3_notes");

  document.getElementById("s3_agreement").onclick = async () => {
    await setField("opt1_date", document.getElementById("s3_a1_date").value);
    await setField("opt1_time", document.getElementById("s3_a1_time").value);
    await setField("opt1_notes", document.getElementById("s3_a1_notes").value);

    await setField("opt2_date", document.getElementById("s3_a2_date").value);
    await setField("opt2_time", document.getElementById("s3_a2_time").value);
    await setField("opt2_notes", document.getElementById("s3_a2_notes").value);

    await setField("opt3_date", document.getElementById("s3_a3_date").value);
    await setField("opt3_time", document.getElementById("s3_a3_time").value);
    await setField("opt3_notes", document.getElementById("s3_a3_notes").value);

    await updateField(currentGameNumber, "step_3", true);
    alert("Agreement recorded. Proceed to Field Hold.");
    currentStep = 4;
    setActiveTimelineStep(currentStep);
    renderPanelForStep(currentStep);
  };
}

// STEP 4 — Field Hold (home game)
function renderStep4(panel) {
  panel.innerHTML = `
    <h2>Step 4 — Field Hold</h2>
    <p>If this is a home game, request a field hold for the agreed date/time.</p>

    <label>Field Requested</label>
    <input type="text" id="s4_field">

    <label>Hold Confirmed?</label>
    <select id="s4_confirmed">
      <option value="no">No</option>
      <option value="yes">Yes</option>
    </select>

    <button id="s4_save" class="primary-btn">Save Field Hold Status</button>
  `;

  prefillInput("s4_field", "field_requested");
  const confirmedEl = document.getElementById("s4_confirmed");
  confirmedEl.value = getField("field_confirmed") || "no";

  document.getElementById("s4_save").onclick = async () => {
    await setField("field_requested", document.getElementById("s4_field").value);
    await setField("field_confirmed", document.getElementById("s4_confirmed").value);
    await updateField(currentGameNumber, "step_4", true);
    alert("Field hold status saved.");
  };
}

// STEP 5 — HAYSA Approval
function renderStep5(panel) {
  panel.innerHTML = `
    <h2>Step 5 — HAYSA Approval</h2>
    <p>Request and record HAYSA approval for this reschedule.</p>

    <label>Approval Status</label>
    <select id="s5_status">
      <option value="pending">Pending</option>
      <option value="approved">Approved</option>
      <option value="denied">Denied</option>
    </select>

    <label>Notes</label>
    <input type="text" id="s5_notes">

    <button id="s5_save" class="primary-btn">Save HAYSA Approval</button>
  `;

  const statusEl = document.getElementById("s5_status");
  statusEl.value = getField("haysa_status") || "pending";
  prefillInput("s5_notes", "haysa_notes");

  document.getElementById("s5_save").onclick = async () => {
    const status = document.getElementById("s5_status").value;
    await setField("haysa_status", status);
    await setField("haysa_notes", document.getElementById("s5_notes").value);

    if (status !== "approved") {
      alert("HAYSA has not approved this yet. You should not proceed to SSSL.");
    }
    await updateField(currentGameNumber, "step_5", true);
    alert("HAYSA approval status saved.");
  };
}

// STEP 6 — SSSL Form (uses gameChangeForm + signature)
function renderStep6(panel) {
  panel.innerHTML = `
    <h2>Step 6 — SSSL Form</h2>
    <p>Complete the SSSL reschedule form with the agreed details and signature.</p>
    <p>Use the Game Change Form section below to fill in all required fields.</p>
  `;
}

// STEP 7 — Calendar Update
function renderStep7(panel) {
  panel.innerHTML = `
    <h2>Step 7 — Calendar Update</h2>
    <p>Update your team calendar and any league calendars with the new game date/time.</p>

    <button id="s7_done" class="primary-btn">Mark Calendar Updated</button>
  `;

  document.getElementById("s7_done").onclick = async () => {
    await setField("calendar_updated", "yes");
    await updateField(currentGameNumber, "step_7", true);
    alert("Calendar update recorded.");
  };
}

// STEP 8 — Notify Coaches
function renderStep8(panel) {
  panel.innerHTML = `
    <h2>Step 8 — Notify Coaches</h2>
    <p>Send final confirmation to both coaches with the new game details.</p>

    <button id="s8_email" class="primary-btn">Compose Email</button>
    <button id="s8_done" class="secondary-btn">Mark Notification Complete</button>
  `;

  document.getElementById("s8_email").onclick = () => {
    const subject = encodeURIComponent("Game Reschedule Confirmation");
    const body = encodeURIComponent(
`Game Number: ${currentGameNumber}

Your game has been rescheduled.

Please contact us with any questions.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  document.getElementById("s8_done").onclick = async () => {
    await setField("notify_status", "completed");
    await updateField(currentGameNumber, "step_8", true);
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

    // save form fields via updateField
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

    await apiUpdateStep(currentGameNumber, 6);
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

