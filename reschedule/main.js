// ===============================================
// CONFIG — Google Apps Script WebApp endpoint
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
// GAME NUMBER LOOKUP (NEW ENTRY POINT)
// ===============================================
async function lookupGameNumber() {
  const gameNumber = document.getElementById("lookupGameNumber").value.trim();
  if (!gameNumber) {
    document.getElementById("lookupStatus").innerHTML = "<p>Please enter a game number.</p>";
    return;
  }

  const row = await apiGetRow(gameNumber);
  currentGameNumber = gameNumber;

  if (row.exists) {
    currentRowData = row.data;
    isNewGame = false;

    document.getElementById("lookupStatus").innerHTML = `
      <p>Existing request found for Game #${gameNumber}.</p>
      <button onclick="beginWorkflow()">Continue Request</button>
    `;
  } else {
    isNewGame = true;

    document.getElementById("lookupStatus").innerHTML = `
      <p>No existing request found for Game #${gameNumber}.</p>
      <button onclick="createNewWorkflow('${gameNumber}')">Start New Request</button>
    `;
  }
}

async function createNewWorkflow(gameNumber) {
  const res = await apiCreateRow(gameNumber);
  if (res.exists) {
    currentRowData = res.data;
    beginWorkflow();
  } else {
    alert("Error creating workflow row.");
  }
}

function beginWorkflow() {
  document.getElementById("lookupContainer").style.display = "none";

  document.getElementById("timelineContainer").style.display = "block";
  document.getElementById("panelContainer").style.display = "block";
  document.getElementById("nextStepContainer").style.display = "block";   // ⭐ ADD THIS

  currentStep = 1;
  setActiveTimelineStep(currentStep);
  renderPanelForStep(currentStep);
}



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
// STEP PANELS (YOUR EXISTING PANELS)
// ===============================================

// (Your Step 1–6 panels remain exactly as you wrote them)

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
  initTimeline();
  initGameChangeForm();
});
