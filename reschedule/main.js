// ===============================================
// CONFIG — your Google Apps Script WebApp endpoint
// ===============================================
const API_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec"; 
// Example: https://script.google.com/macros/s/AKfjsdf.../exec

// ===============================================
// API HELPERS
// ===============================================

async function apiGetRow(gameNumber) {
  const url = `${API_URL}?action=getRow&game_number=${encodeURIComponent(gameNumber)}`;
  const res = await fetch(url);
  return res.json();
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

async function apiUpdateOptions(gameNumber, opt1, opt2, opt3) {
  const form = new FormData();
  form.append("action", "updateOptions");
  form.append("game_number", gameNumber);
  form.append("opt1", JSON.stringify(opt1));
  form.append("opt2", JSON.stringify(opt2));
  form.append("opt3", JSON.stringify(opt3));

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

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

async function apiDeleteRow(gameNumber) {
  const form = new FormData();
  form.append("action", "deleteRow");
  form.append("game_number", gameNumber);

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

// NEW: safe game change form update
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
let currentStep = 1; // 1–7 timeline
let isNewGame = false;


// ===============================================
// TIMELINE + PANEL HELPERS
// ===============================================

function setActiveTimelineStep(step) {
  const steps = document.querySelectorAll(".timeline-step");
  steps.forEach(s => {
    const sStep = Number(s.getAttribute("data-step"));
    if (sStep === step) {
      s.classList.add("active");
    } else {
      s.classList.remove("active");
    }
  });
}

function getPanelContainer() {
  return document.getElementById("panelContainer");
}

function renderPanelForStep(step) {
  const panel = getPanelContainer();
  if (!panel) return;

  switch (step) {
    case 1:
      renderOriginalGamePanel(panel);
      break;
    case 2:
      renderOpponentPanel(panel);
      break;
    case 3:
      renderMoveGamePanel(panel);
      break;
    case 4:
      renderSSSLFormPanel(panel);
      break;
    case 5:
      renderApprovalPanel(panel);
      break;
    case 6:
      renderCalendarPanel(panel);
      break;
    case 7:
      renderNotifyPanel(panel);
      break;
    default:
      panel.innerHTML = "<p>Select a step in the timeline above.</p>";
  }
}


// ===============================================
// PANEL RENDERERS
// ===============================================

function renderOriginalGamePanel(panel) {
  const gameNum = currentGameNumber || "";
  panel.innerHTML = `
    <h2>Step 1 — Original Game Details</h2>
    <p>Enter or confirm the original game information.</p>

    <div class="field-group">
      <label>SSSL Game Number</label>
      <input type="text" id="orig_game_number" value="${gameNum}" readonly>
    </div>

    <div class="field-group">
      <label>Team Name</label>
      <input type="text" id="team_name_input" placeholder="Example: 5/6 Girls (Baird-Miller)">
    </div>

    <div class="field-group">
      <label>Original Game Date</label>
      <input type="date" id="orig_date_input">
    </div>

    <div class="field-group">
      <label>Original Game Time</label>
      <input type="time" id="orig_time_input">
    </div>

    <div class="field-group">
      <label>Original Game Field</label>
      <input type="text" id="orig_field_input" placeholder="Example: Turf Field">
    </div>

    <button id="saveOriginalBtn" class="primary-btn">Save Original Details</button>
    <button id="markStep1CompleteBtn" class="secondary-btn">Mark Step 1 Complete</button>
  `;

  const saveBtn = document.getElementById("saveOriginalBtn");
  const completeBtn = document.getElementById("markStep1CompleteBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }

      const teamName = document.getElementById("team_name_input").value.trim();
      const origDate = document.getElementById("orig_date_input").value;
      const origTime = document.getElementById("orig_time_input").value;
      const origField = document.getElementById("orig_field_input").value.trim();

      if (!teamName || !origDate || !origTime || !origField) {
        alert("Please fill in all original game details.");
        return;
      }

      try {
        await apiUpdateGameChangeForm({
          game_number: currentGameNumber,
          team_name: teamName,
          orig_date: origDate,
          orig_time: origTime,
          orig_field: origField
        });
        alert("Original game details saved.");
      } catch (err) {
        console.error(err);
        alert("There was a problem saving original game details.");
      }
    });
  }

  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }
      try {
        await apiUpdateStep(currentGameNumber, 1);
        alert("Step 1 marked complete.");
      } catch (err) {
        console.error(err);
        alert("There was a problem marking Step 1 complete.");
      }
    });
  }
}

function renderOpponentPanel(panel) {
  panel.innerHTML = `
    <h2>Step 2 — Opponent Coordination</h2>
    <p>Record details about contacting the opposing coach.</p>

    <div class="field-group">
      <label>Opponent Coach Name</label>
      <input type="text" id="opp_name_input" placeholder="Opponent coach name">
    </div>

    <div class="field-group">
      <label>Opponent Coach Phone</label>
      <input type="tel" id="opp_phone_input" placeholder="Opponent coach phone">
    </div>

    <div class="field-group">
      <label>Notes</label>
      <textarea id="opp_notes_input" rows="3" placeholder="Agreement details, preferred dates, etc."></textarea>
    </div>

    <p class="info-text">These details are not stored in the sheet; they are for your reference while working.</p>

    <button id="markStep2CompleteBtn" class="primary-btn">Mark Step 2 Complete</button>
  `;

  const completeBtn = document.getElementById("markStep2CompleteBtn");
  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }
      try {
        await apiUpdateStep(currentGameNumber, 2);
        alert("Step 2 marked complete.");
      } catch (err) {
        console.error(err);
        alert("There was a problem marking Step 2 complete.");
      }
    });
  }
}

function renderMoveGamePanel(panel) {
  panel.innerHTML = `
    <h2>Step 3 — Move the Game</h2>
    <p>Choose the new date, time, and field for this game.</p>

    <div class="field-group">
      <label>New Game Date</label>
      <input type="date" id="final_date_input">
    </div>

    <div class="field-group">
      <label>New Game Time</label>
      <input type="time" id="final_time_input">
    </div>

    <div class="field-group">
      <label>New Game Field</label>
      <input type="text" id="final_field_input" placeholder="Example: Turf Field">
    </div>

    <button id="saveNewSlotBtn" class="primary-btn">Save New Game Slot</button>
    <button id="markStep3CompleteBtn" class="secondary-btn">Mark Step 3 Complete</button>
  `;

  const saveBtn = document.getElementById("saveNewSlotBtn");
  const completeBtn = document.getElementById("markStep3CompleteBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }

      const finalDate = document.getElementById("final_date_input").value;
      const finalTime = document.getElementById("final_time_input").value;
      const finalField = document.getElementById("final_field_input").value.trim();

      if (!finalDate || !finalTime || !finalField) {
        alert("Please fill in all new game details.");
        return;
      }

      try {
        await apiUpdateGameChangeForm({
          game_number: currentGameNumber,
          final_date: finalDate,
          final_time: finalTime,
          final_field: finalField
        });
        await apiUpdateFinal(currentGameNumber, finalDate, finalTime, finalField);
        alert("New game slot saved.");
      } catch (err) {
        console.error(err);
        alert("There was a problem saving the new game slot.");
      }
    });
  }

  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }
      try {
        await apiUpdateStep(currentGameNumber, 3);
        alert("Step 3 marked complete.");
      } catch (err) {
        console.error(err);
        alert("There was a problem marking Step 3 complete.");
      }
    });
  }
}

function renderSSSLFormPanel(panel) {
  const gameNum = currentGameNumber || "";
  const formUrl = gameNum
    ? `form.html?game_number=${encodeURIComponent(gameNum)}`
    : `form.html`;

  panel.innerHTML = `
    <h2>Step 4 — SSSL Game Change Form</h2>
    <p>Generate the official SSSL Game Change Form PDF.</p>

    <p class="info-text">
      When you click the button below, the SSSL form page will open.
      Fill in any remaining details, sign, and download the PDF.
    </p>

    <a href="${formUrl}" class="primary-btn" id="openFormLink">Open SSSL Game Change Form</a>

    <button id="markStep4CompleteBtn" class="secondary-btn">Mark Step 4 Complete</button>
  `;

  const completeBtn = document.getElementById("markStep4CompleteBtn");
  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }
      try {
        await apiUpdateStep(currentGameNumber, 4);
        alert("Step 4 marked complete.");
      } catch (err) {
        console.error(err);
        alert("There was a problem marking Step 4 complete.");
      }
    });
  }
}

function renderApprovalPanel(panel) {
  panel.innerHTML = `
    <h2>Step 5 — SSSL Approval</h2>
    <p>Track when SSSL approves the game change.</p>

    <div class="field-group">
      <label>Approval Notes</label>
      <textarea id="approval_notes_input" rows="3" placeholder="Approval email, notes, etc."></textarea>
    </div>

    <button id="markStep5CompleteBtn" class="primary-btn">Mark Step 5 Complete</button>
  `;

  const completeBtn = document.getElementById("markStep5CompleteBtn");
  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }
      try {
        await apiUpdateStep(currentGameNumber, 5);
        alert("Step 5 marked complete.");
      } catch (err) {
        console.error(err);
        alert("There was a problem marking Step 5 complete.");
      }
    });
  }
}

function renderCalendarPanel(panel) {
  panel.innerHTML = `
    <h2>Step 6 — Calendar Update</h2>
    <p>Confirm that the new game date/time/field have been updated in the HAYSA calendar.</p>

    <button id="markStep6CompleteBtn" class="primary-btn">Mark Step 6 Complete</button>
  `;

  const completeBtn = document.getElementById("markStep6CompleteBtn");
  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }
      try {
        await apiUpdateStep(currentGameNumber, 6);
        alert("Step 6 marked complete.");
      } catch (err) {
        console.error(err);
        alert("There was a problem marking Step 6 complete.");
      }
    });
  }
}

function renderNotifyPanel(panel) {
  panel.innerHTML = `
    <h2>Step 7 — Notify Coaches</h2>
    <p>Send final confirmation to both coaches with the new game details.</p>

    <button id="sendNotifyEmailBtn" class="primary-btn">Compose Confirmation Email</button>
    <button id="markStep7CompleteBtn" class="secondary-btn">Mark Step 7 Complete</button>
  `;

  const sendBtn = document.getElementById("sendNotifyEmailBtn");
  const completeBtn = document.getElementById("markStep7CompleteBtn");

  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }

      const subject = encodeURIComponent("Game Reschedule Confirmation");
      const body = encodeURIComponent(
`This email confirms the reschedule of your SSSL game.

Game Number: ${currentGameNumber || ""}

New Date:
New Time:
New Field:

Please reply if you have any questions.`
      );

      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    });
  }

  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter and load a game number first.");
        return;
      }
      try {
        await apiUpdateStep(currentGameNumber, 7);
        alert("Step 7 marked complete.");
      } catch (err) {
        console.error(err);
        alert("There was a problem marking Step 7 complete.");
      }
    });
  }
}


// ===============================================
// WORKFLOW INIT (INDEX.HTML)
// ===============================================

async function loadGameWorkflow(gameNumber) {
  currentGameNumber = gameNumber;
  const msgEl = document.getElementById("gameLoadMessage");

  try {
    const row = await apiGetRow(gameNumber);

    if (!row.exists) {
      await apiCreateRow(gameNumber);
      isNewGame = true;
      currentRowData = null;
      if (msgEl) {
        msgEl.textContent = "New game created. Please enter original details in Step 1.";
      }
    } else {
      isNewGame = false;
      currentRowData = row.data;
      if (msgEl) {
        msgEl.textContent = "Game loaded. Review details in Step 1.";
      }
    }

    currentStep = 1;
    setActiveTimelineStep(currentStep);
    renderPanelForStep(currentStep);
  } catch (err) {
    console.error(err);
    if (msgEl) {
      msgEl.textContent = "There was a problem loading this game.";
    }
  }
}

function initGameNumberUI() {
  const loadBtn = document.getElementById("loadGameBtn");
  const clearBtn = document.getElementById("clearGameBtn");

  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      const gameNumber = document.getElementById("gameNumberInput").value.trim();

      if (!gameNumber) {
        alert("Please enter a valid SSSL Game Number.");
        return;
      }

      await loadGameWorkflow(gameNumber);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      currentGameNumber = null;
      currentRowData = null;
      currentStep = 1;
      isNewGame = false;

      const msgEl = document.getElementById("gameLoadMessage");
      if (msgEl) msgEl.textContent = "";

      const panel = getPanelContainer();
      if (panel) panel.innerHTML = "<p>Enter a game number above to begin.</p>";

      const steps = document.querySelectorAll(".timeline-step");
      steps.forEach(s => s.classList.remove("active"));
    });
  }
}

function initTimeline() {
  const steps = document.querySelectorAll(".timeline-step");
  steps.forEach(stepEl => {
    stepEl.addEventListener("click", () => {
      const step = Number(stepEl.getAttribute("data-step"));
      currentStep = step;
      setActiveTimelineStep(step);
      renderPanelForStep(step);
    });
  });

  const nextBtn = document.getElementById("nextStepBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentStep < 7) {
        currentStep += 1;
        setActiveTimelineStep(currentStep);
        renderPanelForStep(currentStep);
      }
    });
  }

  // Initial panel
  const panel = getPanelContainer();
  if (panel) {
    panel.innerHTML = "<p>Enter a game number above to begin.</p>";
  }
}


// ===============================================
// GAME CHANGE FORM PAGE (form.html)
// ===============================================

function initGameChangeForm() {
  const form = document.getElementById("gameChangeForm");
  const canvas = document.getElementById("signaturePad");
  const clearBtn = document.getElementById("clearSignature");

  if (!form || !canvas || !clearBtn) return;

  // Signature pad
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

  function stopDraw() {
    drawing = false;
  }

  canvas.addEventListener("mousedown", e => {
    const rect = canvas.getBoundingClientRect();
    startDraw(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    drawLine(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);

  canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    startDraw(touch.clientX - rect.left, touch.clientY - rect.top);
  });

  canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    drawLine(touch.clientX - rect.left, touch.clientY - rect.top);
  });

  canvas.addEventListener("touchend", e => {
    e.preventDefault();
    stopDraw();
  });

  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Form submit → PDF + safe sheet update
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const gameNumber = formData.get("game_number");
    const teamName = formData.get("team_name");
    const origDate = formData.get("orig_date");
    const origTime = formData.get("orig_time");
    const origField = formData.get("orig_field");
    const finalDate = formData.get("final_date");
    const finalTime = formData.get("final_time");
    const finalField = formData.get("final_field");

    const coachName = formData.get("coach_name");
    const coachEmail = formData.get("coach_email");
    const coachPhone = formData.get("coach_phone");
    const oppCoachName = formData.get("opp_coach_name");
    const oppCoachPhone = formData.get("opp_coach_phone");

    const signatureData = canvas.toDataURL();

    // PDF
    await generateReschedulePDF({
      game_number: gameNumber,
      team_name: teamName,
      orig_date: origDate,
      orig_time: origTime,
      orig_field: origField,
      final_date: finalDate,
      final_time: finalTime,
      final_field: finalField,
      coach_name: coachName,
      coach_email: coachEmail,
      coach_phone: coachPhone,
      opp_coach_name: oppCoachName,
      opp_coach_phone: oppCoachPhone,
      signature_data: signatureData,
    });

    // Safe sheet update
    try {
      await apiUpdateGameChangeForm({
        game_number: gameNumber,
        team_name: teamName,
        orig_date: origDate,
        orig_time: origTime,
        orig_field: origField,
        final_date: finalDate,
        final_time: finalTime,
        final_field: finalField,
      });

      alert("Your Game Change Form has been saved.");
    } catch (err) {
      console.error(err);
      alert("There was a problem saving your form.");
    }
  });
}


// ===============================================
// INIT EVERYTHING
// ===============================================

document.addEventListener("DOMContentLoaded", () => {
  // If we're on the workflow page
  if (document.getElementById("panelContainer")) {
    initGameNumberUI();
    initTimeline();
  }

  // If we're on the SSSL form page
  initGameChangeForm();
});


// ===============================================
// API HELPERS
// ===============================================

async function apiGetRow(gameNumber) {
  const url = `${API_URL}?action=getRow&game_number=${encodeURIComponent(gameNumber)}`;
  const res = await fetch(url);
  return res.json();
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

async function apiUpdateOptions(gameNumber, opt1, opt2, opt3) {
  const form = new FormData();
  form.append("action", "updateOptions");
  form.append("game_number", gameNumber);
  form.append("opt1", JSON.stringify(opt1));
  form.append("opt2", JSON.stringify(opt2));
  form.append("opt3", JSON.stringify(opt3));

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

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

async function apiDeleteRow(gameNumber) {
  const form = new FormData();
  form.append("action", "deleteRow");
  form.append("game_number", gameNumber);

  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}

// ===============================================
// ⭐ NEW: UPDATE GAME CHANGE FORM (SAFE FIELDS ONLY)
// ===============================================

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


// ===============================================
// UI HELPERS
// ===============================================

function updateStatusPanel() {
  const statusDiv = document.getElementById("gameStatus");

  if (!currentRowData) {
    statusDiv.textContent = "";
    return;
  }

  const steps = currentRowData.slice(16, 28); // step_1 through step_12
  const completed = steps.filter(s => s === true).length;
  const total = steps.length;

  const lastUpdated = currentRowData[28] || "Never";

  statusDiv.innerHTML = `
    <strong>Game #${currentGameNumber}</strong><br>
    Completed: ${completed} / ${total}<br>
    Pending: ${total - completed}<br>
    Last Updated: ${lastUpdated}
  `;
}

function applyRowToChecklist() {
  const steps = currentRowData.slice(16, 28);

  document.querySelectorAll("li[data-step]").forEach(li => {
    const step = Number(li.getAttribute("data-step"));
    const statusEl = li.querySelector(".step-status");

    if (steps[step - 1] === true) {
      statusEl.textContent = "Completed";
      statusEl.classList.add("step-completed");
    } else {
      statusEl.textContent = "Pending";
      statusEl.classList.remove("step-completed");
    }
  });

  updateStatusPanel();
}


// ===============================================
// LOAD WORKFLOW
// ===============================================

async function loadGameWorkflow(gameNumber) {
  currentGameNumber = gameNumber;

  const row = await apiGetRow(gameNumber);

  if (!row.exists) {
    await apiCreateRow(gameNumber);
    currentRowData = (await apiGetRow(gameNumber)).data;
  } else {
    currentRowData = row.data;
  }

  applyRowToChecklist();
}


// ===============================================
// INIT GAME NUMBER UI
// ===============================================

function initGameNumberUI() {
  const loadBtn = document.getElementById("loadGameBtn");
  const clearBtn = document.getElementById("clearGameBtn");

  loadBtn.addEventListener("click", async () => {
    const gameNumber = document.getElementById("gameNumberInput").value.trim();

    if (!gameNumber) {
      alert("Please enter a valid SSSL Game Number.");
      return;
    }

    await loadGameWorkflow(gameNumber);
  });

  clearBtn.addEventListener("click", async () => {
    if (!currentGameNumber) {
      alert("No game loaded.");
      return;
    }

    await apiDeleteRow(currentGameNumber);
    currentRowData = null;
    currentGameNumber = null;

    document.getElementById("gameStatus").textContent = "";
    document.querySelectorAll(".step-status").forEach(el => {
      el.textContent = "Pending";
      el.classList.remove("step-completed");
    });

    alert("Workflow deleted.");
  });
}


// ===============================================
// CHECKLIST COMPLETION
// ===============================================

function initRescheduleChecklist() {
  document.querySelectorAll(".step-complete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!currentGameNumber) {
        alert("Please enter your SSSL Game Number first.");
        return;
      }

      const li = btn.closest("li");
      const step = Number(li.getAttribute("data-step"));

      await apiUpdateStep(currentGameNumber, step);

      currentRowData = (await apiGetRow(currentGameNumber)).data;
      applyRowToChecklist();
    });
  });
}


// ===============================================
// SLOT PROPOSAL FORM
// ===============================================

function initSlotProposalForm() {
  const form = document.getElementById("slotProposalForm");
  const fieldSelect = document.getElementById("slotField");

  if (!form || !fieldSelect) return;

  const fields = [
    "Turf Field",
    "Sumner Field",
    "Brookville Field",
    "Butler Field"
  ];

  fields.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    fieldSelect.appendChild(opt);
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();

    if (!currentGameNumber) {
      alert("Load a game number first.");
      return;
    }

    const opt1 = {
      date: document.getElementById("slotDate").value,
      time: document.getElementById("slotStart").value + "-" + document.getElementById("slotEnd").value,
      field: document.getElementById("slotField").value
    };

    const opt2 = {};
    const opt3 = {};

    await apiUpdateOptions(currentGameNumber, opt1, opt2, opt3);

    currentRowData = (await apiGetRow(currentGameNumber)).data;
    updateStatusPanel();

    alert("Option saved. Board will review manually.");
    form.reset();
  });
}


// ===============================================
// FIELD HOLD EMAIL LINK
// ===============================================

function initFieldHoldEmailLink() {
  const link = document.getElementById("fieldHoldEmailLink");
  if (!link) return;

  link.addEventListener("click", e => {
    e.preventDefault();

    const to = "webmaster@haysa.org,coachcoordinator.haysa@gmail.com";
    const subject = encodeURIComponent("Temporary Field Hold Request");

    const body = encodeURIComponent(
`Please review and confirm a temporary field hold:

Field:
Date:
Start Time:
End Time:
Notes:

(Confirmed against the HAYSA field calendar.)`
    );

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}


// ===============================================
// GAME CHANGE FORM — SIGNATURE PAD + SUBMIT
// ===============================================

function initGameChangeForm() {
  const form = document.getElementById("gameChangeForm");
  const canvas = document.getElementById("signaturePad");
  const clearBtn = document.getElementById("clearSignature");

  if (!form || !canvas || !clearBtn) return;

  // -------------------------
  // Signature Pad
  // -------------------------
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

  function stopDraw() {
    drawing = false;
  }

  canvas.addEventListener("mousedown", e => {
    const rect = canvas.getBoundingClientRect();
    startDraw(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    drawLine(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);

  canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    startDraw(touch.clientX - rect.left, touch.clientY - rect.top);
  });

  canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    drawLine(touch.clientX - rect.left, touch.clientY - rect.top);
  });

  canvas.addEventListener("touchend", e => {
    e.preventDefault();
    stopDraw();
  });

  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // -------------------------
  // ⭐ NEW: FORM SUBMIT HANDLER
  // -------------------------

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    // SAFE fields (stored in sheet)
    const gameNumber = formData.get("game_number");
    const teamName = formData.get("team_name");
    const origDate = formData.get("orig_date");
    const origTime = formData.get("orig_time");
    const origField = formData.get("orig_field");
    const finalDate = formData.get("final_date");
    const finalTime = formData.get("final_time");
    const finalField = formData.get("final_field");

    // PRIVATE fields (NOT stored)
    const coachName = formData.get("coach_name");
    const coachEmail = formData.get("coach_email");
    const coachPhone = formData.get("coach_phone");
    const oppCoachName = formData.get("opp_coach_name");
    const oppCoachPhone = formData.get("opp_coach_phone");

    // Signature (canvas → PNG)
    const signatureData = canvas.toDataURL();

    // 1) Generate PDF (private)
    await generateReschedulePDF({
      game_number: gameNumber,
      team_name: teamName,
      orig_date: origDate,
      orig_time: origTime,
      orig_field: origField,
      final_date: finalDate,
      final_time: finalTime,
      final_field: finalField,

      coach_name: coachName,
      coach_email: coachEmail,
      coach_phone: coachPhone,
      opp_coach_name: oppCoachName,
      opp_coach_phone: oppCoachPhone,
      signature_data: signatureData,
    });

    // 2) Save ONLY safe fields to Google Sheets
    try {
      await apiUpdateGameChangeForm({
        game_number: gameNumber,
        team_name: teamName,
        orig_date: origDate,
        orig_time: origTime,
        orig_field: origField,
        final_date: finalDate,
        final_time: finalTime,
        final_field: finalField,
      });

      alert("Your Game Change Form has been saved!");
    } catch (err) {
      console.error(err);
      alert("There was a problem saving your form.");
    }
  });
}


// ===============================================
// INIT EVERYTHING
// ===============================================

document.addEventListener("DOMContentLoaded", () => {
  initGameNumberUI();
  initRescheduleChecklist();
  initSlotProposalForm();
  initFieldHoldEmailLink();
  initGameChangeForm();
});
