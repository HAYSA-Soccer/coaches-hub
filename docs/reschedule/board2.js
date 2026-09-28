async function loadBoardView() {
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

function renderBoardList(rows) {
  const container = document.getElementById("boardList");
  container.innerHTML = "";

  rows.forEach(row => {
    // Only show rows where a reschedule attempt has begun
    if (!row.game_number || !row.step_1_started) return;

    const card = document.createElement("div");
    card.className = "board-card";

    card.innerHTML = `
      <h3>Game #${row.game_number} — ${row.team_name || ""} vs ${row.opp_town || ""}</h3>

      <div class="board-section">
        <strong>Original:</strong> ${row.orig_date || ""} • ${row.orig_time || ""} • ${row.orig_field || ""}
      </div>

      <div class="board-section">
        <strong>Proposed:</strong> ${row.new_date || "-"} • ${row.new_time || "-"} • ${row.new_field || "-"}
      </div>

      <div class="board-section">
        <strong>Status:</strong> ${row.workflow_status || "In Progress"}
      </div>

      <div class="board-checkboxes">
        <label><input type="checkbox" data-field="confirmed_with_opponent" ${row.confirmed_with_opponent ? "checked" : ""}> Confirmed with Opponent</label>
        <label><input type="checkbox" data-field="hay_sa_approved" ${row.hay_sa_approved ? "checked" : ""}> HAYSA Approved</label>
        <label><input type="checkbox" data-field="sent_to_sssl" ${row.sent_to_sssl ? "checked" : ""}> Sent to SSSL</label>
        <label><input type="checkbox" data-field="sssl_approved" ${row.sssl_approved ? "checked" : ""}> SSSL Approved</label>
        <label><input type="checkbox" data-field="updated_in_ts" ${row.updated_in_ts ? "checked" : ""}> Updated in TeamSideline</label>
        <label><input type="checkbox" data-field="block_created" ${row.block_created ? "checked" : ""}> Field Block Created</label>
      </div>

      <textarea class="board-notes" data-field="board_notes" placeholder="Board notes...">${row.board_notes || ""}</textarea>

      <button class="board-save-btn" onclick="saveBoardRow('${row.game_number}', this.parentElement)">
        Save Updates
      </button>
    `;

    container.appendChild(card);
  });
}

function saveBoardRow(gameNumber, cardElement) {
  const updates = {};

  // Collect all checkboxes
  cardElement.querySelectorAll("input[type='checkbox']").forEach(cb => {
    const field = cb.dataset.field;
    updates[field] = cb.checked ? "TRUE" : "FALSE";
  });

  // Collect notes
  const notes = cardElement.querySelector("textarea[data-field='board_notes']");
  updates["board_notes"] = notes.value;

  // Send update to backend
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
