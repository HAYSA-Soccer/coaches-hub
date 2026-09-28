console.log("BOARD.JS VERSION 2026-09-28-06:30 — Priority + Filters Enabled");

/* ============================================================
   BASE URL
   ============================================================ */

const BASE_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";

/* ============================================================
   LOAD BOARD VIEW
   ============================================================ */

document.addEventListener("DOMContentLoaded", loadBoardView);

function loadBoardView() {
  const callbackName = "boardCallback_" + Date.now();

  window[callbackName] = function(result) {
    const rows = result.rows || [];

    // ANY non-blank value = started
    const started = rows.filter(r => {
      const val = (r.attempt_started || "").toString().trim();
      return val !== "";
    });

    const completed = rows.filter(r => r.completed_at);

    /* ============================================================
       PRIORITY LOGIC
       ============================================================ */
    function getPriority(row) {
      if (row.completed_at) return 999;

      const boardFields = [
        row.board_opponent_contacted,
        row.board_field_hold_entered,
        row.board_new_info_confirmed,
        row.board_haysa_approved,
        row.board_coach_certified,
        row.board_email_sent,
        row.board_sssl_approved,
        row.board_ts_updated
      ];

      const anyBoardDone = boardFields.some(v => v === "TRUE" || v === true);
      const allBoardDone = boardFields.every(v => v === "TRUE" || v === true);

      if (!allBoardDone && anyBoardDone) return 1;
      if (!anyBoardDone && row.final_date) return 2;

      return 3;
    }

    // SORT ACTIVE RESCHEDULES BY PRIORITY
    started.sort((a, b) => getPriority(a) - getPriority(b));

    /* ============================================================
       TEAM FILTER SETUP
       ============================================================ */
    const teamSelect = document.getElementById("teamFilter");
    const uniqueTeams = [...new Set(started.map(r => r.team_name))];

    uniqueTeams.forEach(team => {
      const opt = document.createElement("option");
      opt.value = team;
      opt.textContent = team;
      teamSelect.appendChild(opt);
    });

    /* ============================================================
       FILTER FUNCTION
       ============================================================ */
    function applyFilters() {
  let filtered = [...started];

  const teamTerm = document.getElementById("teamFilter").value;
  const singleDate = document.getElementById("dateFilter").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  // TEAM FILTER
  if (teamTerm) {
    filtered = filtered.filter(r => r.team_name === teamTerm);
  }

  // DATE MATCH FUNCTION
  function matchDate(rowDate, target) {
    return rowDate === target;
  }

  // RANGE MATCH FUNCTION
  function matchRange(rowDate, start, end) {
    if (start && rowDate < start) return false;
    if (end && rowDate > end) return false;
    return true;
  }

  // DATE SOURCE (final_date preferred)
  function getRowDate(r) {
    const d = (r.final_date || r.orig_date || "").split("T")[0];
    return d;
  }

  // SINGLE DATE FILTER
  if (singleDate) {
    filtered = filtered.filter(r => matchDate(getRowDate(r), singleDate));
  }

  // RANGE FILTER
  if (startDate || endDate) {
    filtered = filtered.filter(r => matchRange(getRowDate(r), startDate, endDate));
  }

  // NO RESULTS MESSAGE
  const activeContainer = document.getElementById("boardList");
  if (filtered.length === 0) {
    activeContainer.innerHTML = `
      <div style="padding:12px; font-size:16px; color:#666;">
        No active reschedules for this date.
      </div>
    `;
  } else {
    renderBoardList(filtered, "boardList", getPriority);
  }
}


/* ============================================================
   DATE/TIME HELPERS
   ============================================================ */

function displayDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

function renderBoardList(rows, containerId, getPriority) {
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
       PRIORITY BADGE
       ============================================================ */
    let priorityBadgeHTML = "";

    if (!row.completed_at) {
      const priority = getPriority(row);
      const priorityLabel =
        priority === 1 ? "Needs Board Action" :
        priority === 2 ? "Coach Completed" :
        "In Progress";

      const priorityClass =
        priority === 1 ? "priority-high" :
        priority === 2 ? "priority-medium" :
        "priority-low";

      priorityBadgeHTML = `<div class="priority-badge ${priorityClass}">${priorityLabel}</div>`;
    }

    /* ============================================================
       COACH PROGRESS
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
       BOARD CHECKBOXES
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

      ${priorityBadgeHTML}

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

  cardElement.querySelectorAll("input[type='checkbox']").forEach(cb => {
    const field = cb.dataset.field;
    if (!field) return;
    updates[field] = cb.checked ? "TRUE" : "FALSE";
  });

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
