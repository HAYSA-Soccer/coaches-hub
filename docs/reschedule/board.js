console.log("BOARD.JS VERSION 2026-09-28-02:00 — Compact Board Layout Enabled");

const BASE_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";

/* ============================================================
   LOAD BOARD VIEW
   ============================================================ */

document.addEventListener("DOMContentLoaded", loadBoardView);

function loadBoardView() {
  const callbackName = "boardCallback_" + Date.now();

  window[callbackName] = function(result) {
    const rows = result.rows || [];
    const active = rows.filter(r => !r.completed_at);
    const completed = rows.filter(r => r.completed_at);

    renderBoardList(active, "boardList");
    renderBoardList(completed, "completedList");

    delete window[callbackName];
  };

  const url = `${BASE_URL}?action=getAllRows&callback=${callbackName}`;
  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);
}

/* ============================================================
   DATE/TIME HELPERS
   ============================================================ */

function displayDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return value;
}

function displayTime(value) {
  if (!value) return "-";

  if (typeof value === "string" && value.match(/\d{1,2}:\d{2}/)) {
    if (value.toUpperCase().includes("AM") || value.toUpperCase().includes("PM")) {
      return value;
    }
    const [hStr, m] = value.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = (h % 12) || 12;
    return `${h}:${m} ${ampm}`;
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = (h % 12) || 12;
    return `${h}:${m} ${ampm}`;
  }

  return value;
}

/* ============================================================
   RENDER BOARD CARDS (COMPACT LAYOUT)
   ============================================================ */

function renderBoardList(rows, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  rows.forEach(row => {
    if (!row.game_number) return;

    const card = document.createElement("div");
    card.className = "board-card";

    const origDetails = `${displayDate(row.orig_date)} • ${displayTime(row.orig_time)} • ${row.orig_field}`;
    const finalDetails = row.final_date
      ? `${displayDate(row.final_date)} • ${displayTime(row.final_time)} • ${row.final_field}`
      : "Not yet finalized";

    const statusText = row.completed_at ? "Completed" : (row.haysa_status || "In Progress");

    card.innerHTML = `
      <div class="board-header">
        <div class="board-title">${row.team_name} vs ${row.opp_town}</div>
        <div class="board-game-number">#${row.game_number}</div>
      </div>

      <div class="board-grid">
        <div><strong>Original:</strong> ${origDetails}</div>
        <div><strong>Final:</strong> ${finalDetails}</div>
        <div><strong>Status:</strong> ${statusText}</div>
      </div>

      <div class="board-progress-bar">
        ${renderBoardPill("Opp Cnct", row.board_opponent_contacted)}
        ${renderBoardPill("Field Hold", row.board_field_hold_entered)}
        ${renderBoardPill("Determined", row.board_new_info_confirmed)}
        ${renderBoardPill("HAYSA Appr", row.board_haysa_approved)}
        ${renderBoardPill("Coach Cert", row.board_coach_certified)}
        ${renderBoardPill("SSSL Sent", row.board_email_sent)}
        ${renderBoardPill("SSSL Appr", row.board_sssl_approved)}
        ${renderBoardPill("TS Updated", row.board_ts_updated)}
      </div>


      <div class="board-notes">
        <div class="notes-toggle" onclick="toggleNotes(this)">Board Notes ▼</div>
        <div class="notes-body" style="display:none;">
          <textarea id="notes_${row.game_number}" class="board-notes-text">${row.haysa_notes || ""}</textarea>
          <button class="primary-btn" onclick="saveBoardRow('${row.game_number}', this.parentElement)">
            Save Updates
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

/* ============================================================
   PILL RENDERER
   ============================================================ */

function renderBoardPill(label, value) {
  const cls = value ? "pill-complete" : "pill-pending";
  const icon = value ? "✓" : "•";

  return `
    <div class="board-pill-row">
      <div class="board-pill ${cls}">${icon}</div>
      <span class="board-pill-label">${label}</span>
    </div>
  `;
}


/* ============================================================
   NOTES TOGGLE
   ============================================================ */

function toggleNotes(el) {
  const body = el.nextElementSibling;
  const open = body.style.display === "block";
  body.style.display = open ? "none" : "block";
  el.textContent = open ? "Board Notes ▼" : "Board Notes ▲";
}

/* ============================================================
   SAVE BOARD UPDATES
   ============================================================ */

function saveBoardRow(gameNumber, cardElement) {
  const updates = {};

  const notes = cardElement.querySelector("textarea");
  if (notes) {
    updates["haysa_notes"] = notes.value;
  }

  const callbackName = "updateCallback_" + Date.now();
  window[callbackName] = function(result) {
    alert(`Saved updates for game #${gameNumber}`);
    delete window[callbackName];
  };

  const url = `${BASE_URL}?action=updateBoardFields&game_number=${gameNumber}&updates=${encodeURIComponent(JSON.stringify(updates))}&callback=${callbackName}`;

  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);
}
