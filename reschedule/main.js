// ===============================================
// CONFIG — your Google Apps Script WebApp endpoint
// ===============================================
const API_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";


// ===============================================
// API HELPERS
// ===============================================

// ⭐ JSONP version (replaces fetch-based apiGetRow)
function apiGetRow(gameNumber) {
  return new Promise((resolve, reject) => {
    const callbackName = "haysaWorkflowCallback_" + gameNumber;

    // Create script tag FIRST so callback cleanup works
    const script = document.createElement("script");

    // Define callback on window
    window[callbackName] = function (data) {
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      resolve(data);
    };

    // Build JSONP URL
    const url =
      `${API_URL}?action=getRow&game_number=${encodeURIComponent(gameNumber)}&callback=${encodeURIComponent(callbackName)}`;

    script.src = url;

    script.onerror = function () {
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(new Error("Failed to load workflow data"));
    };

    document.body.appendChild(script);
  });
}

// ⭐ NEW: JSONP lookup by Event ID
function apiGetRowByEventId(eventId) {
  return new Promise((resolve, reject) => {
    const callbackName = "haysaWorkflowEventCallback_" + eventId;

    // Create script tag FIRST so callback cleanup works
    const script = document.createElement("script");

    // Define callback on window
    window[callbackName] = function (data) {
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      resolve(data);
    };

    // Build JSONP URL
    const url =
      `${API_URL}?action=getRowByEventId&event_id=${encodeURIComponent(eventId)}&callback=${encodeURIComponent(callbackName)}`;

    script.src = url;

    script.onerror = function () {
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(new Error("Failed to load workflow data"));
    };

    document.body.appendChild(script);
  });
}

// ⭐ POST requests DO NOT need JSONP — keep them as-is
async function apiCreateRow(gameNumber) {
  const form = new FormData();
  form.append("action", "createRow");
  form.append("game_number", gameNumber);
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

async function apiUpdateGameChangeForm(payload) {
  const form = new FormData();
  form.append("action", "updateGameChangeForm");
  form.append("game_number", payload.game_number);
  form.append("team_name", payload.team_name || "");
  form.append("orig_date", payload.orig_date || "");
  form.append("orig_time", payload.orig_time || "");
  form.append("orig_field", payload.orig_field || "");
  form.append("final_date", payload.final_date || "");
  form.append("final_time", payload.final_time || "");
  form.append("final_field", payload.final_field || "");
  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}


// ===============================================
// STATE
// ===============================================
let currentGameNumber = null;
let currentRowData = null;
let currentStep = 1;
let isNewGame = false;


// ===============================================
// TIMELINE + PANEL HELPERS
// ===============================================

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
    default:
      panel.innerHTML = "<p>Select a step above.</p>";
  }
}


// ===============================================
// STEP PANELS
// ===============================================

// STEP 1 — ORIGINAL GAME DETAILS
function renderStep1(panel) {
  panel.innerHTML = `
    <h2>Step 1 — Original Game Details</h2>
    <p>Enter or confirm the original game information.</p>

    <label>Game Number</label>
    <input type="text" id="s1_game" value="${currentGameNumber || ""}" readonly>

    <label>Team Name</label>
    <input type="text" id="s1_team">

    <label>Original Date</label>
    <input type="date" id="s1_date">

    <label>Original Time</label>
    <input type="time" id="s1_time">

    <label>Original Field</label>
    <input type="text" id="s1_field">

    <button id="s1_save" class="primary-btn">Save Original Details</button>
    <button id="s1_done" class="secondary-btn">Mark Step Complete</button>
  `;

  document.getElementById("s1_save").onclick = async () => {
    const team = document.getElementById("s1_team").value.trim();
    const date = document.getElementById("s1_date").value;
    const time = document.getElementById("s1_time").value;
    const field = document.getElementById("s1_field").value.trim();

    if (!team || !date || !time || !field) {
      alert("Please fill all fields.");
      return;
    }

    await apiUpdateGameChangeForm({
      game_number: currentGameNumber,
      team_name: team,
      orig_date: date,
      orig_time: time,
      orig_field: field
    });

    alert("Original details saved.");
  };

  document.getElementById("s1_done").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 1);
    alert("Step 1 complete.");
  };
}


// STEP 2 — OPPONENT
function renderStep2(panel) {
  panel.innerHTML = `
    <h2>Step 2 — Opponent Coordination</h2>
    <p>Record opponent coach details (not stored).</p>

    <label>Opponent Coach Name</label>
    <input type="text" id="s2_name">

    <label>Opponent Coach Phone</label>
    <input type="tel" id="s2_phone">

    <label>Notes</label>
    <textarea id="s2_notes" rows="3"></textarea>

    <button id="s2_done" class="primary-btn">Mark Step Complete</button>
  `;

  document.getElementById("s2_done").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 2);
    alert("Step 2 complete.");
  };
}


// STEP 3 — MOVE THE GAME
function renderStep3(panel) {
  panel.innerHTML = `
    <h2>Step 3 — Move the Game</h2>
    <p>Choose the new date, time, and field.</p>

    <label>New Date</label>
    <input type="date" id="s3_date">

    <label>New Time</label>
    <input type="time" id="s3_time">

    <label>New Field</label>
    <input type="text" id="s3_field">

    <button id="s3_save" class="primary-btn">Save New Slot</button>
    <button id="s3_done" class="secondary-btn">Mark Step Complete</button>
  `;

  document.getElementById("s3_save").onclick = async () => {
    const date = document.getElementById("s3_date").value;
    const time = document.getElementById("s3_time").value;
    const field = document.getElementById("s3_field").value.trim();

    if (!date || !time || !field) {
      alert("Please fill all fields.");
      return;
    }

    await apiUpdateGameChangeForm({
      game_number: currentGameNumber,
      final_date: date,
      final_time: time,
      final_field: field
    });

    alert("New slot saved.");
  };

  document.getElementById("s3_done").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 3);
    alert("Step 3 complete.");
  };
}


// STEP 4 — SSSL FORM
function renderStep4(panel) {
  const url = `form.html?game_number=${currentGameNumber}`;

  panel.innerHTML = `
    <h2>Step 4 — SSSL Game Change Form</h2>
    <p>Open the SSSL form, fill it out, sign, and download the PDF.</p>

    <a href="${url}" class="primary-btn">Open SSSL Form</a>
    <button id="s4_done" class="secondary-btn">Mark Step Complete</button>
  `;

  document.getElementById("s4_done").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 4);
    alert("Step 4 complete.");
  };
}


// STEP 5 — APPROVAL
function renderStep5(panel) {
  panel.innerHTML = `
    <h2>Step 5 — SSSL Approval</h2>
    <p>Track approval status.</p>

    <label>Approval Notes</label>
    <textarea id="s5_notes" rows="3"></textarea>

    <button id="s5_done" class="primary-btn">Mark Step Complete</button>
  `;

  document.getElementById("s5_done").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 5);
    alert("Step 5 complete.");
  };
}


// STEP 6 — CALENDAR
function renderStep6(panel) {
  panel.innerHTML = `
    <h2>Step 6 — Calendar Update</h2>
    <p>Confirm the new game details are updated in the calendar.</p>

    <button id="s6_done" class="primary-btn">Mark Step Complete</button>
  `;

  document.getElementById("s6_done").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 6);
    alert("Step 6 complete.");
  };
}


// STEP 7 — NOTIFY
function renderStep7(panel) {
  panel.innerHTML = `
    <h2>Step 7 — Notify Coaches</h2>
    <p>Send final confirmation email.</p>

    <button id="s7_email" class="primary-btn">Compose Email</button>
    <button id="s7_done" class="secondary-btn">Mark Step Complete</button>
  `;

  document.getElementById("s7_email").onclick = () => {
    const subject = encodeURIComponent("Game Reschedule Confirmation");
    const body = encodeURIComponent(
`Game Number: ${currentGameNumber}

Your game has been rescheduled.

Please contact us with any questions.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  document.getElementById("s7_done").onclick = async () => {
    await apiUpdateStep(currentGameNumber, 7);
    alert("Step 7 complete.");
  };
}


// ===============================================
// WORKFLOW INIT
// ===============================================

async function loadGameWorkflow(gameNumber) {
  const msg = document.getElementById("gameLoadMessage");

  const row = await apiGetRow(gameNumber);

  if (!row.exists) {
    await apiCreateRow(gameNumber);
    isNewGame = true;
    msg.textContent = "New game created. Enter original details in Step 1.";
  } else {
    isNewGame = false;
    currentRowData = row.data;
    msg.textContent = "Game loaded. Review details in Step 1.";
  }

  currentStep = 1;
  setActiveTimelineStep(1);
  renderPanelForStep(1);
}

function initGameNumberUI() {
  document.getElementById("loadGameBtn").onclick = async () => {
    const gameNumber = document.getElementById("gameNumberInput").value.trim();
    if (!gameNumber) {
      alert("Enter a game number.");
      return;
    }
    currentGameNumber = gameNumber;
    await loadGameWorkflow(gameNumber);
  };

  document.getElementById("clearGameBtn").onclick = () => {
    currentGameNumber = null;
    currentRowData = null;
    currentStep = 1;
    isNewGame = false;
    document.getElementById("gameLoadMessage").textContent = "";
    document.getElementById("panelContainer").innerHTML = "<p>Enter a game number above to begin.</p>";
    document.querySelectorAll(".timeline-step").forEach(el => el.classList.remove("active"));
  };
}

function initTimeline() {
  document.querySelectorAll(".timeline-step").forEach(el => {
    el.onclick = () => {
      currentStep = Number(el.dataset.step);
      setActiveTimelineStep(currentStep);
      renderPanelForStep(currentStep);
    };
  });

  document.getElementById("nextStepBtn").onclick = () => {
    if (currentStep < 7) {
      currentStep++;
      setActiveTimelineStep(currentStep);
      renderPanelForStep(currentStep);
    }
  };
}


// ===============================================
// FORM.HTML SIGNATURE + PDF
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

    await apiUpdateGameChangeForm({
      game_number: fd.get("game_number"),
      team_name: fd.get("team_name"),
      orig_date: fd.get("orig_date"),
      orig_time: fd.get("orig_time"),
      orig_field: fd.get("orig_field"),
      final_date: fd.get("final_date"),
      final_time: fd.get("final_time"),
      final_field: fd.get("final_field")
    });

    alert("Form saved.");
  };
}


// ===============================================
// INIT EVERYTHING
// ===============================================

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("panelContainer")) {
    initGameNumberUI();
    initTimeline();
  }
  initGameChangeForm();
});
