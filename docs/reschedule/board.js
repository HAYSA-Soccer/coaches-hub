const API_BASE =
  "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";

let allRows = [];
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  loadBoardData();
});

function loadBoardData() {
  fetch(`${API_BASE}?action=getAllRows`)
    .then(r => r.json())
    .then(data => {
      allRows = data.rows || data;
      renderBoardDashboard();
    })
    .catch(err => console.error("Error loading board data", err));
}

function setFilter(filter) {
  currentFilter = filter;
  renderBoardDashboard();
}

/* ---------------------------------------------------------
   STATUS ENGINE — matches your real workflow
--------------------------------------------------------- */
function computeBoardStatus(row) {
  const status = {};

  // 1. Registrar contacted (pre-step)
  status.registrar_contacted =
    String(row.field_requested).toLowerCase() === "true";

  // 2. Opponent contacted
  status.opponent_contacted =
    row.step_1 === "completed" || row.step_2 === "completed";

  // 3. Agreement reached
  status.agreement_reached = row.step_3 === "completed";

  // 4. HAYSA approval
  const haysa = (row.haysa_status || "").toLowerCase();
  status.haysa_approved = haysa === "approved";
  status.haysa_rejected = haysa === "rejected";

  // 5. Field hold (home games only)
  status.field_hold =
    String(row.field_confirmed).toLowerCase() === "true";

  // 6. Sent to SSSL
  status.sent_to_sssl = row.step_7 === "completed";

  // 7. SSSL approval
  status.sssl_approved = row.step_9 === "completed";

  // 8. TeamSideline updated
  status.ts_updated =
    String(row.calendar_updated).toLowerCase() === "true";

  // Determine bucket
  if (status.sssl_approved && status.ts_updated) {
    status.bucket = "completed";
    status.label = "Completed";
    status.detail = "Fully approved and updated in TS";
    status.pillClass = "completed";
  }
  else if (status.sent_to_sssl && !status.sssl_approved) {
    status.bucket = "pending_sssl";
    status.label = "Pending SSSL";
    status.detail = "Awaiting SSSL approval";
    status.pillClass = "pending";
  }
  else if (status.haysa_approved && !status.sent_to_sssl) {
    status.bucket = "ready_sssl";
    status.label = "Ready for SSSL";
    status.detail = "HAYSA approved — board must send to SSSL";
    status.pillClass = "ready";
  }
  else if (status.agreement_reached && !status.haysa_approved) {
    status.bucket = "needs_action";
    status.label = "Needs HAYSA Review";
    status.detail = "Coach submitted — HAYSA must review";
    status.pillClass = "needs";
  }
  else {
    status.bucket = "needs_action";
    status.label = "In Progress";
    status.detail = "Coach still working through steps";
    status.pillClass = "needs";
  }

  return status;
}

function passesFilter(bucket) {
  return (
    currentFilter === "all" ||
    currentFilter === bucket
  );
}

/* ---------------------------------------------------------
   RENDER DASHBOARD
--------------------------------------------------------- */
function renderBoardDashboard() {
  const active = document.getElementById("boardDashboard");
  const completed = document.getElementById("boardCompleted");

  active.innerHTML = "";
  completed.innerHTML = "";

  allRows.forEach(row => {
    const status = computeBoardStatus(row);
    if (!passesFilter(status.bucket)) return;

    const div = document.createElement("div");
    div.className = "board-row";

    const origDate = row.orig_date || "";
    const origTime = row.orig_time || "";
    const origField = row.orig_field || "";

    const finalDate = row.final_date || "";
    const finalTime = row.final_time || "";
    const finalField = row.final_field || "";

    div.innerHTML = `
      <div>
        <div class="board-label">Game #</div>
        <div class="board-value">${row.game_number}</div>
      </div>

      <div>
        <div class="board-label">Team</div>
        <div class="board-value">${row.team_name}</div>
        <div class="board-sub">${row.age_group} ${row.gender} — ${row.division}</div>
      </div>

      <div>
        <div class="board-label">Original</div>
        <div class="board-value">${origDate} — ${origTime}</div>
        <div class="board-sub">${origField}</div>
      </div>

      <div>
        <div class="board-label">Final</div>
        <div class="board-value">${finalDate || "—"} ${finalTime || ""}</div>
        <div class="board-sub">${finalField || ""}</div>
      </div>

      <div>
        <div class="board-label">Status</div>
        <span class="status-pill ${status.pillClass}">${status.label}</span>
        <div class="board-sub">${status.detail}</div>

        <div class="checklist">
          ${renderChecklist(status)}
        </div>
      </div>

      <div class="board-action">
        <button class="primary-btn" onclick="resumeGame('${row.game_number}')">
          Resume
        </button>
        <button class="secondary-btn" onclick="editBoardNotes('${row.game_number}')">
          Edit Notes
        </button>
      </div>
    `;

    if (status.bucket === "completed") {
      completed.appendChild(div);
    } else {
      active.appendChild(div);
    }
  });
}

/* ---------------------------------------------------------
   CHECKLIST RENDERER
--------------------------------------------------------- */
function renderChecklist(status) {
  function item(label, value, type = "warn") {
    const cls =
      value ? "check-ok" :
      type === "bad" ? "check-bad" :
      "check-warn";

    const symbol =
      value ? "✔" :
      type === "bad" ? "✖" :
      "—";

    return `
      <div class="check-item">
        <div class="check-label">${label}</div>
        <div class="check-status ${cls}">${symbol}</div>
      </div>
    `;
  }

  return `
    ${item("Registrar Contacted", status.registrar_contacted)}
    ${item("Opponent Contacted", status.opponent_contacted)}
    ${item("Agreement Reached", status.agreement_reached)}
    ${item("HAYSA Approved", status.haysa_approved, status.haysa_rejected ? "bad" : "warn")}
    ${item("Field Hold Placed", status.field_hold)}
    ${item("Sent to SSSL", status.sent_to_sssl)}
    ${item("SSSL Approved", status.sssl_approved)}
    ${item("TS Updated", status.ts_updated)}
  `;
}

/* ---------------------------------------------------------
   ACTIONS
--------------------------------------------------------- */
function resumeGame(gameNumber) {
  window.location.href = `index.html?game=${encodeURIComponent(gameNumber)}`;
}

function editBoardNotes(gameNumber) {
  const row = allRows.find(r => String(r.game_number) === String(gameNumber));
  const current = row ? (row.notes || "") : "";
  const updated = window.prompt("Board notes for this game:", current);
  if (updated === null) return;

  fetch(`${API_BASE}?action=updateNotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_number: gameNumber,
      notes: updated
    })
  })
    .then(r => r.json())
    .then(() => loadBoardData())
    .catch(err => console.error("Error updating notes", err));
}
