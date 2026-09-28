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
function formatTime(value) {
  if (!value) return "-";

  // If it's already a readable time, return it
  if (typeof value === "string" && value.includes(":")) return value;

  // Convert Google Sheets serial time (fraction of a day)
  const serial = Number(value);
  if (isNaN(serial)) return value;

  const totalMinutes = Math.round(serial * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}


/* ============================================================
   RENDER BOARD CARDS
   ============================================================ */

function renderBoardList(rows) {
  const container = document.getElementById("boardList");
  container.innerHTML = "";

  rows.forEach(row => {

    // Must have a game number
    if (!row.game_number) return;

    // A reschedule has started if attempt_started is TRUE
    if (!row.attempt_started || row.attempt_started === "") return;

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
      </div>

      <div class="board-section">
        <strong>HAYSA Decision:</strong>
        <select class="board-approval" data-field="haysa_status">
          <option value="in progress" ${row.haysa_status === "in progress" ? "selected" : ""}>In Progress</option>
          <option value="approved" ${row.haysa_status === "approved" ? "selected" : ""}>Approved</option>
          <option value="rejected" ${row.haysa_status === "rejected" ? "selected" : ""}>Rejected</option>
        </select>
      </div>

      <div class="board-checkbox-row">
        <label><input type="checkbox" data-field="step_2" ${row.step_2 ? "checked" : ""}> Opponent</label>
        <label><input type="checkbox" data-field="step_3" ${row.step_3 ? "checked" : ""}> HAYSA</label>
        <label><input type="checkbox" data-field="step_4" ${row.step_4 ? "checked" : ""}> Sent SSSL</label>
        <label><input type="checkbox" data-field="step_5" ${row.step_5 ? "checked" : ""}> SSSL OK</label>
        <label><input type="checkbox" data-field="calendar_updated" ${row.calendar_updated ? "checked" : ""}> TS Updated</label>
        <label><input type="checkbox" data-field="field_confirmed" ${row.field_confirmed ? "checked" : ""}> Blocked</label>
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

  // Collect checkbox values
  cardElement.querySelectorAll("input[type='checkbox']").forEach(cb => {
    const field = cb.dataset.field;
    updates[field] = cb.checked ? "TRUE" : "FALSE";
  });

  // Collect dropdowns
  cardElement.querySelectorAll("select[data-field]").forEach(sel => {
    const field = sel.dataset.field;
    updates[field] = sel.value;
  });

  // Collect notes
  const notes = cardElement.querySelector("textarea[data-field='haysa_notes']");
  updates["haysa_notes"] = notes.value;

  // JSONP callback
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
