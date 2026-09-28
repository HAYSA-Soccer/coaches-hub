console.log("BOARD.JS VERSION 2026-09-28-03:30 — Corrected Layout + Full Started Cases");

const BASE_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";

/* ============================================================
   LOAD BOARD VIEW
   ============================================================ */

document.addEventListener("DOMContentLoaded", loadBoardView);

function loadBoardView() {
  const callbackName = "boardCallback_" + Date.now();

  window[callbackName] = function(result) {
    const rows = result.rows || [];

    // FIXED: Show ALL started cases (TRUE, "TRUE", 1, "1")
    const started = rows.filter(r =>
      r.attempt_started === true ||
      r.attempt_started === "TRUE" ||
      r.attempt_started === 1 ||
      r.attempt_started === "1"
    );

    const completed = rows.filter(r => r.completed_at);

    renderBoardList(started, "boardList");
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
   RENDER BOARD CARDS
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

    /* ============================================================
       COACH PROGRESS (Compact)
       ============================================================ */
    const coachProgress = `
      <div class="coach-progress">
        <strong>Coach Progress:</strong><br>
        Started: ${row.attempt_started_date || "-"}<br>
        Proposed Options: ${
          (row.proposed_1_date || row.proposed_2_date) ? "Entered" : "None"
        }<br>
        Final Details: ${row.final_date ? "Entered" : "Not yet finalized"}<br>
      </div>
    `;

    /* ============================================================
       BOARD CHECKBOXES (Clickable)
       ============================================================ */
    const boardCheckboxes = `
      <div class="board-checkboxes">
        ${renderBoardCheckbox("board_opponent_contacted", row.board_opponent_contacted, "Opponent Contacted")}
        ${renderBoardCheckbox("board_field_hold_entered", row.board_field_hold_entered, "Field Hold Entered")}
        ${renderBoardCheckbox("board_new_info_confirmed", row.board_new_info_confirmed, "Determined")}
        ${renderBoardCheckbox("board_haysa_approved", row.board_haysa_approved, "HAYSA Approved")}
        ${renderBoardCheckbox("board_coach_certified", row.board_coach_certified, "Coach Certified")}
        ${renderBoardCheckbox("board_email_sent", row.board_email_sent, "SSSL Sent")}
        ${renderBoardCheckbox("board_sssl_approved", row.board_sssl_approved, "SSSL Approved")}
        ${renderBoardCheckbox("board_ts_updated", row.board_ts_updated, "TS Updated")}
      </div>
    `;

    /* ============================================================
       CARD HTML
       ============================================================ */
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

      ${coachProgress}

      ${boardCheckboxes}

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
   BOARD CHECKBOX RENDERER
   ============================================================ */

function renderBoardCheckbox(field, value, label) {
  return `
    <label class="board-checkbox-row">
      <input type="checkbox" data-field="${field}" ${value ? "checked" : ""}>
      ${label}
    </label>
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

  // Save board checkboxes
  cardElement.querySelectorAll("input[type='checkbox']").forEach(cb => {
    const field = cb.dataset.field;
    if (!field) return;
    updates[field] = cb.checked ? "TRUE" : "FALSE";
  });

  // Save notes
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
