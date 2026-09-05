// ================================
// GAME NUMBER WORKFLOW TRACKING
// ================================

let currentGameNumber = null;

/**
 * Update the status panel showing:
 * - Completed steps
 * - Pending steps
 * - Last updated timestamp
 */
function updateStatusPanel(saved) {
  const statusDiv = document.getElementById("gameStatus");

  if (!currentGameNumber) {
    statusDiv.textContent = "";
    return;
  }

  const steps = document.querySelectorAll("li[data-step]");
  let completed = 0;

  steps.forEach(li => {
    const step = li.getAttribute("data-step");
    if (saved[step]) completed++;
  });

  const total = steps.length;

  statusDiv.innerHTML = `
    <strong>Game #${currentGameNumber}</strong><br>
    Completed: ${completed} / ${total}<br>
    Pending: ${total - completed}<br>
    Last Updated: ${saved.lastUpdated || "Never"}
  `;
}

/**
 * Load workflow state for a specific game number
 */
function loadGameWorkflow(gameNumber) {
  currentGameNumber = gameNumber;

  const key = "rescheduleSteps_" + gameNumber;
  const saved = JSON.parse(localStorage.getItem(key) || "{}");

  document.querySelectorAll("li[data-step]").forEach(li => {
    const step = li.getAttribute("data-step");
    const statusEl = li.querySelector(".step-status");

    if (saved[step]) {
      statusEl.textContent = "Completed";
      statusEl.classList.add("step-completed");
    } else {
      statusEl.textContent = "Pending";
      statusEl.classList.remove("step-completed");
    }
  });

  updateStatusPanel(saved);
}

/**
 * Initialize Game Number UI
 */
function initGameNumberUI() {
  const loadBtn = document.getElementById("loadGameBtn");
  const clearBtn = document.getElementById("clearGameBtn");

  loadBtn.addEventListener("click", () => {
    const gameNumber = document.getElementById("gameNumberInput").value.trim();

    if (!gameNumber) {
      alert("Please enter a valid SSSL Game Number.");
      return;
    }

    loadGameWorkflow(gameNumber);
  });

  clearBtn.addEventListener("click", () => {
    if (!currentGameNumber) {
      alert("No game loaded.");
      return;
    }

    const key = "rescheduleSteps_" + currentGameNumber;
    localStorage.removeItem(key);

    loadGameWorkflow(currentGameNumber);
  });
}

// ================================
// CHECKLIST COMPLETION LOGIC
// ================================

function initRescheduleChecklist() {
  const checklist = document.getElementById("rescheduleChecklist");
  if (!checklist) return;

  document.querySelectorAll(".step-complete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!currentGameNumber) {
        alert("Please enter your SSSL Game Number first.");
        return;
      }

      const li = btn.closest("li");
      const step = li.getAttribute("data-step");
      const statusEl = li.querySelector(".step-status");

      statusEl.textContent = "Completed";
      statusEl.classList.add("step-completed");

      const key = "rescheduleSteps_" + currentGameNumber;
      const saved = JSON.parse(localStorage.getItem(key) || "{}");

      saved[step] = true;
      saved.lastUpdated = new Date().toLocaleString();

      localStorage.setItem(key, JSON.stringify(saved));

      updateStatusPanel(saved);
    });
  });
}

// ================================
// SLOT PROPOSAL FORM
// ================================

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

  form.addEventListener("submit", e => {
    e.preventDefault();

    const field = fieldSelect.value;
    const date = document.getElementById("slotDate").value;
    const start = document.getElementById("slotStart").value;
    const end = document.getElementById("slotEnd").value;
    const notes = document.getElementById("slotNotes").value;

    if (!field || !date || !start || !end) {
      alert("Please complete field, date, start, and end time.");
      return;
    }

    console.log("Slot proposed:", { field, date, start, end, notes });

    const stepLi = document.querySelector('li[data-step="4"]');
    if (stepLi) {
      const statusEl = stepLi.querySelector(".step-status");
      if (statusEl) {
        statusEl.textContent = "Slot Proposed (Pending Board Review)";
        statusEl.classList.add("step-pending-review");
      }
    }

    alert("Slot proposed. Board will review manually.");
    form.reset();
  });
}

// ================================
// FIELD HOLD EMAIL LINK
// ================================

function initFieldHoldEmailLink() {
  const link = document.getElementById("fieldHoldEmailLink");
  if (!link) return;

  link.addEventListener("click", e => {
    e.preventDefault();

    const to = "webmaster@haysa.org,coachcoordinator.haysa@gmail.com";
    const subject = encodeURIComponent("Temporary Field Hold Request");

    const body = encodeURIComponent(
`Please review and confirm a temporary field hold:

Team Name:
Coach Name:
Field:
Date:
Start Time:
End Time:
Reason / Notes:

(Confirmed against the HAYSA field calendar.)`
    );

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}

// ================================
// GAME CHANGE FORM + SIGNATURE PAD
// ================================

function initGameChangeForm() {
  const form = document.getElementById("gameChangeForm");
  const canvas = document.getElementById("signaturePad");
  const clearBtn = document.getElementById("clearSignature");

  if (!form || !canvas || !clearBtn) return;

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

  // Mouse events
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

  // Touch events
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
}

// ================================
// INITIALIZE EVERYTHING
// ================================

document.addEventListener("DOMContentLoaded", () => {
  initGameNumberUI();
  initRescheduleChecklist();
  initSlotProposalForm();
  initFieldHoldEmailLink();
  initGameChangeForm();
});
