// ===============================================
// CONFIG — your Google Apps Script WebApp endpoint
// ===============================================
const API_URL = "YOUR_WEBAPP_URL_HERE"; 
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
    // Create new row
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
// SLOT PROPOSAL FORM (OPTION ENTRY)
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

    const opt2 = {}; // You can expand later
    const opt3 = {}; // You can expand later

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
// GAME CHANGE FORM SIGNATURE PAD (unchanged)
// ===============================================

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
