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
      allRows = data.rows || data; // adapt to your payload
      renderBoardDashboard();
    })
    .catch(err => {
      console.error("Error loading board data", err);
    });
}

function setFilter(filter) {
  currentFilter = filter;
  renderBoardDashboard();
}

function computeBoardStatus(row) {
  const step = {
    s1: row.step_1,
    s2: row.step_2,
    s3: row.step_3,
    s4: row.step_4,
    s5: row.step_5,
    s6: row.step_6,
    s7: row.step_7,
    s8: row.step_8,
    s9: row.step_9
  };

  const haysa = (row.haysa_status || "").toLowerCase();
  const certified = String(row.certified || "").toLowerCase() === "true";
  const calendarUpdated = String(row.calendar_updated || "").toLowerCase() === "true";

  // Completed / closed out
  if (step.s9 === "completed") {
    return {
      label: "Completed",
      detail: "SSSL approved and workflow closed",
      bucket: "completed",
      pillClass: "completed"
    };
  }

  // Pending SSSL (sent but not finalized)
  if (step.s7 === "completed" && step.s9 !== "completed") {
    return {
      label: "Pending SSSL",
      detail: "Sent to SSSL, awaiting approval",
      bucket: "pending_sssl",
      pillClass: "pending"
    };
  }

  // Ready for SSSL (HAYSA approved, not yet sent)
  if (haysa === "approved" && step.s7 !== "completed") {
    return {
      label: "Ready for SSSL",
      detail: "HAYSA approved — board should send to SSSL",
      bucket: "ready_sssl",
      pillClass: "ready"
    };
  }

  // Coach submitted, needs HAYSA review
  if (step.s3 === "completed" && haysa === "") {
    return {
      label: "Needs HAYSA Review",
      detail: "Coach has submitted; board/HAYSA must review",
      bucket: "needs_action",
      pillClass: "needs"
    };
  }

  // In progress / coach still working
  if (step.s1 === "completed" || step.s2 === "completed" || step.s3 !== "completed") {
    return {
      label: "In Progress",
      detail: "Coach still working through steps",
      bucket: "needs_action",
      pillClass: "needs"
    };
  }

  return {
    label: "Unknown",
    detail: "Status could not be determined",
    bucket: "needs_action",
    pillClass: "needs"
  };
}

function passesFilter(statusBucket) {
  if (currentFilter === "all") return true;
  if (currentFilter === "needs_action") return statusBucket === "needs_action";
  if (currentFilter === "pending_sssl") return statusBucket === "pending_sssl";
  if (currentFilter === "ready_sssl") return statusBucket === "ready_sssl";
  if (currentFilter === "completed") return statusBucket === "completed";
  return true;
}

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

    const notes = row.notes || "";

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
        <div class="board-sub">Certified: ${row.certified || "FALSE"} | Calendar: ${row.calendar_updated || "FALSE"}</div>
        <div class="board-sub">HAYSA: ${row.haysa_status || "—"}</div>
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

// Opens the coach workflow page for that game
function resumeGame(gameNumber) {
  // If you have a query-param based loader, adapt this:
  window.location.href = `index.html?game=${encodeURIComponent(gameNumber)}`;
}

// Simple prompt-based notes editor using `notes` column
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
