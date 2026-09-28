console.log("BOARD.JS VERSION 2026-09-28-01:20");


const BASE_URL = "https://script.google.com/macros/s/AKfycbyHJZ_HOZZFYe8ASTrEKN9axfpXqR0Uu09PG6jgBCXLJCE3jwzYVRqGPSrl3AjwGXoJ/exec";

/* ============================================================
   LOAD BOARD VIEW
   ============================================================ */

document.addEventListener("DOMContentLoaded", loadBoardView);

function loadBoardView() {
  const callbackName = "boardCallback_" + Date.now();

  window[callbackName] = function(result) {
    renderBoardList(result.rows || []);
    delete window[callbackName];
  };

  const url = `${BASE_URL}?action=getAllRows&callback=${callbackName}`;
  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);
}


/* ============================================================
   FORMAT DATE & TIME
   ============================================================ */

function formatDate(value) {
  if (!value) return "-";

  if (typeof value === "string" && value.includes("T")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }

  const d2 = new Date(value);
  if (!isNaN(d2.getTime())) {
    return d2.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const serial = Number(value);
  if (!isNaN(serial)) {
    const base = new Date(1899, 11, 30);
    const ms = serial * 24 * 60 * 60 * 1000;
    const d3 = new Date(base.getTime() + ms);
    return d3.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return value;
}

function extractTimeFromString(value) {
  const m = typeof value === "string" ? value.match(/T(\d{2}):(\d{2})/) : null;
  if (!m) return null;

  let hours = parseInt(m[1], 10);
  const minutes = m[2];
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = (hours % 12) || 12;

  return `${hours}:${minutes} ${ampm}`;
}

function formatTime(value) {
  if (!value) return "-";

  if (typeof value === "string" && value.match(/\d{1,2}:\d{2}/)) {
    if (value.toUpperCase().includes("AM") || value.toUpperCase().includes("PM")) {
      return value;
    }
    const parts = value.split(":");
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    h = (h % 12) || 12;
    return `${h}:${m} ${ampm}`;
  }

  const fromString = extractTimeFromString(value);
  if (fromString) return fromString;

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = (hours % 12) || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  const serial = Number(value);
  if (!isNaN(serial)) {
    const base = new Date(1899, 11, 30);
    const ms = serial * 24 * 60 * 60 * 1000;
    const d2 = new Date(base.getTime() + ms);
    let hours = d2.getHours();
    const minutes = d2.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = (hours % 12) || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  return value;
}


/* ============================================================
   RENDER BOARD CARDS (ACTIVE + COMPLETED)
   ============================================================ */

function renderBoardList(rows) {
  const container = document.getElementById("boardList");
  container.innerHTML = "";

  rows.forEach(row => {

    // Must have a game number
    if (!row.game_number) return;

    // Coach started workflow?
    const coachStarted = !!row.attempt_started;

    // Board review needed?
    const needsBoardReview =
      !row.board_opponent_contacted ||
      !row.board_new_info_confirmed ||
      !row.board_field_hold_entered ||
      !row.board_haysa_approved ||
      !row.board_coach_certified ||
      !row.board_email_sent ||
      !row.board_sssl_approved ||
      !row.board_ts_updated;

    // Show case if coach started OR board needs review
    const showCase = coachStarted || needsBoardReview;
    if (!showCase) return;

    // Visual indicator pill
    const boardIndicator = needsBoardReview
      ? `<div class="board-pill pill-warning">⚠ Board Review Needed</div>`
      : `<div class="board-pill pill-complete">✓ Board Complete</div>`;

    // Build card
    const card = document.createElement("div");
    card.className = "board-card";

    card.innerHTML = `
      <h3>Game #${row.game_number} — ${row.team_name || ""} vs ${row.opp_town || ""}</h3>

      <div class="board-section">
        <strong>Original:</strong> ${row.orig_date || ""} • ${row.orig_time || ""} • ${row.orig_field || ""}
      </div>

      <div class="board-section">
        <strong>Proposed Option 1:</strong> ${row.proposed_1_date || "-"} • ${row.proposed_1_time || "-"} • ${row.proposed_1_field || "-"}
      </div>

      <div class="board-section">
        <strong>Proposed Option 2:</strong> ${row.proposed_2_date || "-"} • ${row.proposed_2_time || "-"} • ${row.proposed_2_field || "-"}
      </div>

      <div class="board-section">
        <strong>Final:</strong> ${row.final_date || "-"} • ${row.final_time || "-"} • ${row.final_field || "-"}
      </div>

      <div class="board-section board-status">
        <strong>Status:</strong> ${row.haysa_status || "In Progress"}
        ${boardIndicator}
      </div>

      <div class="board-checkboxes">
        ${renderBoardCheckbox("board_opponent_contacted", row.board_opponent_contacted, "Opponent Contacted")}
        ${renderBoardCheckbox("board_new_info_confirmed", row.board_new_info_confirmed, "New Info Confirmed")}
        ${renderBoardCheckbox("board_field_hold_entered", row.board_field_hold_entered, "Field Hold Entered")}
        ${renderBoardCheckbox("board_haysa_approved", row.board_haysa_approved, "HAYSA Approved")}
        ${renderBoardCheckbox("board_coach_certified", row.board_coach_certified, "Coach Certified")}
        ${renderBoardCheckbox("board_email_sent", row.board_email_sent, "Email Sent")}
        ${renderBoardCheckbox("board_sssl_approved", row.board_sssl_approved, "SSSL Approved")}
        ${renderBoardCheckbox("board_ts_updated", row.board_ts_updated, "TS Updated")}
      </div>

      <textarea class="board-notes" data-field="haysa_notes" placeholder="Board notes...">${row.haysa_notes || ""}</textarea>

      <button class="board-save-btn" onclick="saveBoardRow('${row.game_number}', this.parentElement)">
        Save Updates
      </button>
    `;

    container.appendChild(card);
  });
}


// Helper to render colored checkbox rows
function renderBoardCheckbox(field, value, label) {
  const cls = value ? "pill-complete" : "pill-pending";
  const icon = value ? "✓" : "!";
  return `
    <label class="board-pill ${cls}">
      <input type="checkbox" data-field="${field}" ${value ? "checked" : ""}>
      ${icon} ${label}
    </label>
  `;
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

  cardElement.querySelectorAll("select[data-field]").forEach(sel => {
    updates[sel.dataset.field] = sel.value;
  });

  const notes = cardElement.querySelector("textarea[data-field='haysa_notes']");
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
