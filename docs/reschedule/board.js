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

  // If it's an ISO datetime string like "2026-11-07T05:00:00.000Z"
  if (typeof value === "string" && value.includes("T")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }

  // Fallback: try normal Date
  const d2 = new Date(value);
  if (!isNaN(d2.getTime())) {
    return d2.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return value;
}

function extractTimeFromString(value) {
  // Handles "1899-12-30T19:00:00.000Z" or "2026-11-07T05:00:00.000Z"
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

  // If already looks like "7:30 PM" or "17:30"
  if (typeof value === "string" && value.match(/\d{1,2}:\d{2}/)) {
    // If it already has AM/PM, just return
    if (value.toUpperCase().includes("AM") || value.toUpperCase().includes("PM")) {
      return value;
    }
    // Otherwise assume 24h and convert
    const parts = value.split(":");
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    h = (h % 12) || 12;
    return `${h}:${m} ${ampm}`;
  }

  // Try to extract from "YYYY-MM-DDTHH:MM:SS.000Z"
  const fromString = extractTimeFromString(value);
  if (fromString) return fromString;

  // Fallback: try Date
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = (hours % 12) || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  return value;
}


/* ============================================================
   RENDER BOARD CARDS
   ============================================================ */

function renderBoardList(rows) {
  const container = document.getElementById("boardList");
  container.innerHTML = "";

  rows.forEach(row => {

    if (!row.game_number) return;
    if (!row.attempt_started || row.attempt_started === "") return;

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
        <label><input type="checkbox" data-field="step_2" ${row.step_2 ? "checked" : ""}> Opponent Contacted</label>
        <label><input type="checkbox" data-field="step_newinfo" ${row.step_newinfo ? "checked" : ""}> New Info Confirmed</label>
        <label><input type="checkbox" data-field="step_3" ${row.step_3 ? "checked" : ""}> HAYSA Approved</label>
        <label><input type="checkbox" data-field="step_4" ${row.step_4 ? "checked" : ""}> Sent to SSSL</label>
        <label><input type="checkbox" data-field="step_5" ${row.step_5 ? "checked" : ""}> SSSL Approved</label>
        <label><input type="checkbox" data-field="calendar_updated" ${row.calendar_updated ? "checked" : ""}> TS Updated</label>
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

    container.appendChild(card);
  });
}


/* ============================================================
   SAVE BOARD UPDATES
   ============================================================ */

function saveBoardRow(gameNumber, cardElement) {
  const updates = {};

  cardElement.querySelectorAll("input[type='checkbox']").forEach(cb => {
    updates[cb.dataset.field] = cb.checked ? "TRUE" : "FALSE";
  });

  cardElement.querySelectorAll("select[data-field]").forEach(sel => {
    updates[sel.dataset.field] = sel.value;
  });

  updates["haysa_notes"] = cardElement.querySelector("textarea[data-field='haysa_notes']").value;

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
