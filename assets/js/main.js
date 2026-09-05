// ================================
// RESCHEDULE WORKFLOW BOOTSTRAP
// ================================

document.addEventListener("DOMContentLoaded", () => {
  initRescheduleChecklist();
  initSlotProposalForm();
  initFieldHoldEmailLink();
  initGameChangeForm();
});

// ================================
// RESCHEDULE CHECKLIST
// ================================

function initRescheduleChecklist() {
  const checklist = document.getElementById("rescheduleChecklist");
  if (!checklist) return;

  checklist.querySelectorAll(".step-complete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("li");
      if (!li) return;
      const statusEl = li.querySelector(".step-status");
      if (statusEl) {
        statusEl.textContent = "Completed";
        statusEl.classList.add("step-completed");
      }
      // Future: send non-sensitive status to backend if desired.
    });
  });
}

// ================================
// SLOT PROPOSAL FORM
// ================================

function initSlotProposalForm() {
  const form = document.getElementById("slotProposalForm");
  const fieldSelect = document.getElementById("slotField");
  if (!form || !fieldSelect) return;

  // Static field list for now; can be wired to calendar snapshot later.
  const fields = [
    "Turf Field",
    "Sumner Field",
    "Brookville Field",
    "Butler Field"
  ];

  fields.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    fieldSelect.appendChild(opt);
  });

  form.addEventListener("submit", e => {
    e.preventDefault();

    const field = fieldSelect.value;
    const date = document.getElementById("slotDate").value;
    const start = document.getElementById("slotStart").value;
    const end = document.getElementById("slotEnd").value;
    const notes = document.getElementById("slotNotes").value;

    if (!field || !date || !start || !end) {
      alert("Please complete field, date, start, and end time.");
      return;
    }

    console.log("Slot proposed:", { field, date, start, end, notes });

    const stepLi = document.querySelector('li[data-step="4"]');
    if (stepLi) {
      const statusEl = stepLi.querySelector(".step-status");
      if (statusEl) {
        statusEl.textContent = "Slot Proposed (Pending Board Review)";
        statusEl.classList.add("step-pending-review");
      }
    }

    alert("Slot proposed. Board will review manually.");
    form.reset();
  });
}

// ================================
// FIELD HOLD EMAIL LINK
// ================================

function initFieldHoldEmailLink() {
  const link = document.getElementById("fieldHoldEmailLink");
  if (!link) return;

  link.addEventListener("click", e => {
    e.preventDefault();

    const to = "webmaster@haysa.org,coachcoordinator.haysa@gmail.com";
    const subject = encodeURIComponent("Temporary Field Hold Request");

    const body = encodeURIComponent(
`Please review and confirm a temporary field hold:

Team Name:
Coach Name:
Field:
Date:
Start Time:
End Time:
Reason / Notes:

(Confirmed against the HAYSA field calendar.)`
    );

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}

// ================================
// GAME CHANGE FORM + SIGNATURE PAD
// ================================

function initGameChangeForm() {
  const form = document.getElementById("gameChangeForm");
  const canvas = document.getElementById("signaturePad");
  const clearBtn = document.getElementById("clearSignature");

  if (!form || !canvas || !clearBtn) return;

  const ctx = canvas.getContext("2d");
  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function startDraw(x, y) {
    drawing = true;
    lastX = x;
    lastY = y;
  }

  function drawLine(x, y) {
    if (!drawing) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  }

  function stopDraw() {
    drawing = false;
  }

  // Mouse events
  canvas.addEventListener("mousedown", e => {
    const rect = canvas.getBoundingClientRect();
    startDraw(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    drawLine(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);

  // Touch events
  canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    startDraw(touch.clientX - rect.left, touch.clientY - rect.top);
  });

  canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    drawLine(touch.clientX - rect.left, touch.clientY - rect.top);
  });

  canvas.addEventListener("touchend", e => {
    e.preventDefault();
    stopDraw();
  });

  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  form.addEventListener("submit", e => {
    e.preventDefault();

    const teamName   = document.getElementById("teamName").value;
    const coachName  = document.getElementById("coachName").value;
    const coachEmail = document.getElementById("coachEmail").value;
    const coachPhone = document.getElementById("coachPhone").value;

    const origDate   = document.getElementById("origDate").value;
    const origTime   = document.getElementById("origTime").value;
    const origField  = document.getElementById("origField").value;
    const opponent   = document.getElementById("opponent").value;

    const newDate    = document.getElementById("newDate").value;
    const newTime    = document.getElementById("newTime").value;
    const newField   = document.getElementById("newField").value;
    const reason     = document.getElementById("reason").value;

    if (!teamName || !coachName || !coachEmail || !coachPhone ||
        !origDate || !origTime || !origField || !opponent ||
        !newDate || !newTime || !newField || !reason) {
      alert("Please complete all required fields.");
      return;
    }

    const signatureDataUrl = canvas.toDataURL("image/png");

    const win = window.open("", "_blank");
    if (!win) {
      alert("Popup blocked. Please allow popups to generate the PDF.");
      return;
    }

    win.document.write(`
      <html>
      <head>
        <title>SSSL Reschedule of Game Form - ${teamName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            line-height: 1.5;
          }
          h1 {
            text-align: center;
            font-size: 24px;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          h2 {
            font-size: 18px;
            margin-top: 25px;
            border-bottom: 2px solid #000;
            padding-bottom: 4px;
          }
          .section {
            margin-bottom: 20px;
          }
          .label {
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          td {
            padding: 6px;
            border-bottom: 1px solid #ccc;
          }
          .signature-block {
            margin-top: 20px;
          }
          .signature-block img {
            margin-top: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          .footer {
            margin-top: 40px;
            font-size: 14px;
          }
        </style>
      </head>

      <body>

        <h1>SSSL Reschedule of Game Form</h1>

        <div class="section">
          <p><strong>USE THIS FORM ONLY FOR RESCHEDULING OF OFFICIAL GAMES</strong></p>
          <p>Form must be received at least 10 days prior to the current and new game dates.</p>
          <p>All fields must be completed — no TBDs allowed.</p>
        </div>

        <h2>Game Information</h2>
        <table>
          <tr><td class="label">Age, Gender, Division:</td><td>${teamName}</td></tr>
          <tr><td class="label">Home Team:</td><td>${teamName}</td></tr>
          <tr><td class="label">Away Team:</td><td>${opponent}</td></tr>
        </table>

        <h2>Current Game Details</h2>
        <table>
          <tr><td class="label">Current Game Date:</td><td>${origDate}</td></tr>
          <tr><td class="label">Current Game Time:</td><td>${origTime}</td></tr>
          <tr><td class="label">Current Game Location:</td><td>${origField}</td></tr>
          <tr><td class="label">Game Number:</td><td>(Coach fills manually)</td></tr>
        </table>

        <h2>New Game Details</h2>
        <table>
          <tr><td class="label">New Game Date:</td><td>${newDate}</td></tr>
          <tr><td class="label">New Game Time:</td><td>${newTime}</td></tr>
          <tr><td class="label">New Game Location:</td><td>${newField}</td></tr>
          <tr><td class="label">Reason for Change:</td><td>${reason}</td></tr>
        </table>

        <h2>Coach Information</h2>
        <table>
          <tr><td class="label">Coach Initiating Reschedule:</td><td>${coachName}</td></tr>
          <tr><td class="label">Telephone:</td><td>${coachPhone}</td></tr>
          <tr><td class="label">Email:</td><td>${coachEmail}</td></tr>
        </table>

        <h2>Opposing Coach</h2>
        <table>
          <tr><td class="label">Name of Opposing Coach:</td><td>(Coach fills manually)</td></tr>
          <tr><td class="label">Telephone:</td><td>(Coach fills manually)</td></tr>
        </table>

        <div class="signature-block">
          <h2>Coach Signature</h2>
          <img src="${signatureDataUrl}" width="300" />
        </div>

        <div class="footer">
          <p><strong>Mail completed form and fee to:</strong><br>
          South Shore Soccer League<br>
          P.O. BOX 486<br>
          West Bridgewater, MA 02379</p>

          <p><strong>Email:</strong> game.scheduler@southshoresoccer.com & referee.assignor@southshoresoccer.com</p>
        </div>

        <script>window.print();</script>

      </body>
      </html>
    `);

    win.document.close();

    document.querySelectorAll('[data-sensitive="true"]').forEach(input => {
      input.value = "";
    });

    form.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    alert("SSSL Game Reschedule Form generated. Save/print as PDF. Email and phone have been cleared.");
  });
}
