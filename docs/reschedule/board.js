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

  // If it's already readable (HH:MM or HH:MM AM/PM)
  if (typeof value === "string" && value.match(/\d{1,2}:\d{2}/)) {
    return value;
  }

  // Detect the Google Sheets "1899-12-30T..." datetime string
  if (typeof value === "string" && value.startsWith("1899-12-30T")) {
    const d = new Date(value);
    let hours = d.getUTCHours();
    let minutes = d.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = (hours % 12) || 12;
    return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  }

  // Detect ISO datetime (real game dates)
  const iso = new Date(value);
  if (!isNaN(iso.getTime())) {
    let hours = iso.getHours();
    let minutes = iso.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = (hours % 12) || 12;
    return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  }

  // Detect Google Sheets serial (number)
  const serial = Number(value);
  if (!isNaN(serial)) {
    const base = new Date(1899, 11, 30);
    const ms = serial * 24 * 60 * 60 * 1000;
    const d = new Date(base.getTime() + ms);

    let hours = d.getHours();
    let minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = (hours % 12) || 12;

    return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  }

  return value;
}



function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // Google Sheets serial date
  const serial = Number(value);
  if (!isNaN(serial)) {
    const base = new Date(1899, 11, 30);
    const ms = serial * 24 * 60 * 60 * 1000;
    const d2 = new Date(base.getTime() + ms);
    return d2.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

      <div class="workflow">
        <span class="${row.step_2 ? "wf-done" : "wf-pending"}">Opponent</span>
        <span class="${row.step_3 ? "wf-done" : "wf-pending"}">HAYSA</span>
        <span class="${row.step_4 ? "wf-done" : "wf-pending"}">Sent SSSL</span>
        <span class="${row.step_5 ? "wf-done" : "wf-pending"}">SSSL OK</span>
        <span class="${row.calendar_updated ? "wf-done" : "wf-pending"}">TS Updated</span>
        <span class="${row.field_confirmed ? "wf-done" : "wf-blocked"}">Blocked</span>
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
