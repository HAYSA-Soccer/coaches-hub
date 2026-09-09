// purge

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
  el.value = getField(field);
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
        await apiUpdateStep(currentGameNumber, currentStep);
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
    await apiUpdateStep(currentGameNumber, 1);
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
    await setField("opp_coach_name", document.getElementById("s2_opp_name").value);
    await setField("opp_coach_email", document.getElementById("s2_opp_email").value);
    await setField("opp_coach_phone", document.getElementById("s2_opp_phone").value);
    await apiUpdateStep(currentGameNumber, 2);
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

    await apiUpdateStep(currentGameNumber, 3);
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
    await apiUpdateStep(currentGameNumber, 4);
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
    await apiUpdateStep(currentGameNumber, 5);
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
    await apiUpdateStep(currentGameNumber, 7);
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
    await apiUpdateStep(currentGameNumber, 8);
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



// NEW CODE FOR MORE ROBUST INTERACTION




/* ---------------------------------------------------------
   WORKFLOW ENGINE — ADD BELOW YOUR EXISTING CODE
--------------------------------------------------------- */

let currentStep = 1;     // Tracks which step you're on
let rowData = null;      // You already set this in your lookup code

/* ---------------------------------------------------------
   START WORKFLOW (Step 1 button)
--------------------------------------------------------- */
function startWorkflow() {
  currentStep = 1;
  renderStep(currentStep);
}

/* ---------------------------------------------------------
   NEXT STEP BUTTON
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const nextBtn = document.getElementById("nextStepBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentStep < 8) {
        currentStep++;
        renderStep(currentStep);
      }
    });
  }

  initSignaturePad();
  initFormSubmit();
});

/* ---------------------------------------------------------
   MAIN STEP RENDERER
--------------------------------------------------------- */
function renderStep(step) {
  highlightTimeline(step);
  renderPanel(step);
  hydrateForm(step);
  animatePanel();
}

/* ---------------------------------------------------------
   TIMELINE HIGHLIGHTING
--------------------------------------------------------- */
function highlightTimeline(step) {
  document.querySelectorAll(".timeline-step").forEach(el => {
    el.classList.remove("active");
    if (parseInt(el.dataset.step, 10) === step) {
      el.classList.add("active");
    }
  });
}

/* ---------------------------------------------------------
   PANEL CONTENT FOR EACH STEP
--------------------------------------------------------- */
function renderPanel(step) {
  const panel = document.getElementById("panelContainer");
  if (!panel || !rowData) return;

  const steps = {
    1: `
      <h2>Step 1 — Start Reschedule Attempt</h2>
      <p>You are beginning a reschedule workflow for game <strong>#${rowData.game_number}</strong>.</p>
      <button class="primary-btn" onclick="startWorkflow()">I want to proceed</button>
    `,
    2: `
      <h2>Step 2 — Opponent Contact</h2>
      <p>Contact the opposing coach:</p>
      <div class="contact-card">
        <strong>${rowData.opp_coach_name || "Opposing Coach"}</strong><br>
        ${rowData.opp_coach_phone || "Phone not available"}
      </div>
    `,
    3: `
      <h2>Step 3 — Negotiation</h2>
      <p>Work with the opposing coach to agree on a new date/time.</p>
    `,
    4: `
      <h2>Step 4 — Field Hold</h2>
      <p>Hold the field with HAYSA for the agreed date/time.</p>
    `,
    5: `
      <h2>Step 5 — HAYSA Approval</h2>
      <p>Submit the new game details to HAYSA for approval.</p>
    `,
    6: `
      <h2>Step 6 — SSSL Form</h2>
      <p>Complete the official SSSL Game Change Form below.</p>
    `,
    7: `
      <h2>Step 7 — Calendar</h2>
      <p>Add the new game date/time to your calendar.</p>
    `,
    8: `
      <h2>Step 8 — Notify</h2>
      <p>Notify your team of the rescheduled game.</p>
    `
  };

  panel.innerHTML = steps[step] || "";
  panel.style.display = "block";

  // Show next-step button except on final step
  const nextContainer = document.getElementById("nextStepContainer");
  if (nextContainer) {
    nextContainer.style.display = step < 8 ? "block" : "none";
  }

  // Show form only on step 6
  const formSection = document.getElementById("formSection");
  if (formSection) {
    formSection.style.display = step === 6 ? "block" : "none";
  }
}

/* ---------------------------------------------------------
   HYDRATE FORM (Step 6)
--------------------------------------------------------- */
function hydrateForm(step) {
  if (step !== 6 || !rowData) return;

  document.getElementById("form_game_number").value = rowData.game_number || "";
  document.querySelector("input[name='team_name']").value = rowData.team_name || "";
  document.querySelector("input[name='orig_date']").value = rowData.orig_date || "";
  document.querySelector("input[name='orig_time']").value = rowData.orig_time || "";
  document.querySelector("input[name='orig_field']").value = rowData.orig_field || "";
  document.querySelector("input[name='coach_name']").value = rowData.coach_name || "";
  document.querySelector("input[name='coach_email']").value = rowData.coach_email || "";
  document.querySelector("input[name='coach_phone']").value = rowData.coach_phone || "";
  document.querySelector("input[name='opp_coach_name']").value = rowData.opp_coach_name || "";
  document.querySelector("input[name='opp_coach_phone']").value = rowData.opp_coach_phone || "";
}

/* ---------------------------------------------------------
   PANEL ANIMATION (POLISH)
--------------------------------------------------------- */
function animatePanel() {
  const panel = document.getElementById("panelContainer");
  if (!panel) return;
  panel.classList.remove("fade-in");
  void panel.offsetWidth; // force reflow
  panel.classList.add("fade-in");
}

/* ---------------------------------------------------------
   SIGNATURE PAD
--------------------------------------------------------- */
let signaturePadCanvas;
let signatureCtx;
let drawing = false;

function initSignaturePad() {
  signaturePadCanvas = document.getElementById("signaturePad");
  if (!signaturePadCanvas) return;

  signatureCtx = signaturePadCanvas.getContext("2d");
  signatureCtx.strokeStyle = "#000";
  signatureCtx.lineWidth = 2;
  signatureCtx.lineCap = "round";

  function getPos(e) {
    const rect = signaturePadCanvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  }

  function startDraw(e) {
    drawing = true;
    const { x, y } = getPos(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(x, y);
  }

  function draw(e) {
    if (!drawing) return;
    const { x, y } = getPos(e);
    signatureCtx.lineTo(x, y);
    signatureCtx.stroke();
  }

  function endDraw() {
    drawing = false;
  }

  signaturePadCanvas.addEventListener("mousedown", startDraw);
  signaturePadCanvas.addEventListener("mousemove", draw);
  signaturePadCanvas.addEventListener("mouseup", endDraw);
  signaturePadCanvas.addEventListener("mouseleave", endDraw);

  signaturePadCanvas.addEventListener("touchstart", e => {
    e.preventDefault();
    startDraw(e);
  }, { passive: false });

  signaturePadCanvas.addEventListener("touchmove", e => {
    e.preventDefault();
    draw(e);
  }, { passive: false });

  signaturePadCanvas.addEventListener("touchend", e => {
    e.preventDefault();
    endDraw();
  }, { passive: false });

  const clearBtn = document.getElementById("clearSignature");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      signatureCtx.clearRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
    });
  }
}

/* ---------------------------------------------------------
   FORM SUBMIT (POST TO YOUR SCRIPT_URL)
--------------------------------------------------------- */
function initFormSubmit() {
  const form = document.getElementById("gameChangeForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    let signatureDataUrl = "";
    if (signaturePadCanvas) {
      signatureDataUrl = signaturePadCanvas.toDataURL("image/png");
    }

    // You already have lookupStatus in your HTML
    const status = document.getElementById("lookupStatus");
    if (status) {
      status.textContent = "Saving form...";
      status.className = "info-text";
    }

    try {
      const resp = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveForm",
          gameNumber: rowData ? rowData.game_number : "",
          form: payload,
          signature: signatureDataUrl
        })
      });

      const result = await resp.json();

      if (status) {
        status.textContent = result.message || "Form saved successfully.";
        status.className = "info-text success";
      }
    } catch (err) {
      console.error(err);
      if (status) {
        status.textContent = "Error saving form. Please try again.";
        status.className = "info-text error";
      }
    }
  });
}

