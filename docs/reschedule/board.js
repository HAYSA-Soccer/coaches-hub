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
  const activeContainer = document.getElementById("boardList");
  const completedContainer = document.getElementById("completedList");

  activeContainer.innerHTML = "";
  completedContainer.innerHTML = "";

  rows.forEach(row => {
    if (!row.game_number) return;
    if (!row.attempt_started || row.attempt_started === "") return;

    /* ============================================================
       AUTO-CHECK LOGIC (board can override)
       ============================================================ */

    // Step 4: new time/date/location selected → opponent contacted + new info confirmed
    if (row.step_4) {
      row.board_opponent_contacted = true;
      row.board_new_info_confirmed = true;
    }

    // Step 6: HAYSA overall approval
    if (row.step_6) {
      row.board_haysa_approved = true;
    }

    // Step 7: coach certifies they spoke with opposing coach
    if (row.step_7) {
      row.board_coach_certified = true;
    }

    // Step 8: form printed/saved → email sent
    if (row.step_8) {
      row.board_email_sent = true;
    }

    const statusClass =
      row.haysa_status === "approved" ? "status-approved" :
      row.haysa_status === "rejected" ? "status-rejected" :
      "status-progress";

    const card = document.createElement("div");
    card.className = "board-card";

    card.innerHTML = `
      <div class="case-header ${statusClass}">
        ${row.haysa_status ? row.haysa_status.toUpperCase() : "IN PROGRESS"}
      </div>

      <h3>Game #${row.game_number} — ${row.team_name || ""} vs ${row.opp_town || ""}</h3>

      <div class="timeline">
        <div><strong>Original:</strong> ${formatDate(row.orig_date)} @ ${formatTime(row.orig_time)} • ${row.orig_field || ""}</div>
        <div><strong>Option 1:</strong> ${formatDate(row.proposed_1_date)} @ ${formatTime(row.proposed_1_time)} • ${row.proposed_1_field || "-"}</div>
        <div><strong>Option 2:</strong> ${formatDate(row.proposed_2_date)} @ ${formatTime(row.proposed_2_time)} • ${row.proposed_2_field || "-"}</div>
        <div><strong>Final:</strong> ${formatDate(row.final_date)} @ ${formatTime(row.final_time)} • ${row.final_field || "-"}</div>
      </div>

      <div class="workflow-checkbox-row">

        <label><input type="checkbox" data-field="board_opponent_contacted" ${row.board_opponent_contacted ? "checked" : ""}> Opponent Contacted</label>

        <label><input type="checkbox" data-field="board_new_info_confirmed" ${row.board_new_info_confirmed ? "checked" : ""}> New Info Confirmed</label>

        <label><input type="checkbox" data-field="board_field_hold_entered" ${row.board_field_hold_entered ? "checked" : ""}> Field Hold Entered</label>

        <label><input type="checkbox" data-field="board_haysa_approved" ${row.board_haysa_approved ? "checked" : ""}> HAYSA Approved</label>

        <label><input type="checkbox" data-field="board_coach_certified" ${row.board_coach_certified ? "checked" : ""}> Coach Certified</label>

        <label><input type="checkbox" data-field="board_email_sent" ${row.board_email_sent ? "checked" : ""}> Email Sent</label>

        <label><input type="checkbox" data-field="board_sssl_approved" ${row.board_sssl_approved ? "checked" : ""}> SSSL Approved/Declined</label>

        <label><input type="checkbox" data-field="board_ts_updated" ${row.board_ts_updated ? "checked" : ""}> TS Updated / Temp Hold Removed</label>

      </div>

      <div class="board-section">
        <strong>HAYSA Decision:</strong>
        <select class="board-approval" data-field="haysa_status">
          <option value="in progress" ${row.haysa_status === "in progress" ? "selected" : ""}>In Progress</option>
          <option value="approved" ${row.haysa_status === "approved" ? "selected" : ""}>Approved</option>
          <option value="rejected" ${row.haysa_status === "rejected" ? "selected" : ""}>Rejected</option>
        </select>
      </div>

      <textarea class="board-notes" data-field="haysa_notes" placeholder="Board notes...">${row.haysa_notes || ""}</textarea>

      <button class="board-save-btn" onclick="saveBoardRow('${row.game_number}', this.parentElement)">
        Save Updates
      </button>
    `;

    /* ============================================================
       COMPLETION LOGIC
       ============================================================ */

    const isCompleted =
      row.board_opponent_contacted &&
      row.board_new_info_confirmed &&
      row.board_field_hold_entered &&
      row.board_haysa_approved &&
      row.board_coach_certified &&
      row.board_email_sent &&
      row.board_sssl_approved &&
      row.board_ts_updated;

    if (isCompleted) {
      completedContainer.appendChild(card);
    } else {
      activeContainer.appendChild(card);
    }
  });
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
