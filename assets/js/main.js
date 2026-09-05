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

    // difference highlighting
    const isDateChanged  = origDate && newDate && origDate !== newDate;
    const isTimeChanged  = origTime && newTime && origTime !== newTime;
    const isFieldChanged = origField && newField && origField !== newField;

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
            padding: 40px;
            line-height: 1.5;
            font-size: 14px;
          }
          h1 {
            text-align: center;
            font-size: 20px;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          p {
            margin: 4px 0;
          }
          .section {
            margin-top: 12px;
          }
          .fill,
          .fill-short {
            display: inline-block;
            border-bottom: 1px solid #000;
            padding: 0 4px;
            color: #000;
          }
          .fill {
            min-width: 260px;
          }
          .fill-short {
            min-width: 160px;
          }
          .fill-red {
            color: #c00000;
            font-weight: bold;
          }
          .signature-line {
            display: inline-block;
            min-width: 260px;
            border-bottom: 1px solid #000;
            padding: 0 4px;
          }
          .signature-image {
            margin-top: 8px;
          }
        </style>
      </head>
      <body>

        <h1>SSSL Reschedule of Game Form</h1>

        <div class="section">
          <p>A. It shall be the responsibility of the coach initiating the reschedule to fill out the form and pay the fees, if any.</p>
          <p>B. Form fees from section 5.2 are based on postmark date</p>
          <p>C. This form must be received at least 10 days prior to the “Current and New Game Dates”</p>
          <p>D. If this form is not completed in its entirety, (no TBDs or TBDs allowed) it will be rejected.</p>
        </div>

        <div class="section">
          <p><strong>Do not USE this form for Make-up Games. (Games postponed due to unsafe natural conditions)</strong></p>
        </div>

        <div class="section">
          <p>Age, Gender, and Division of the game being rescheduled
            <span class="fill">${teamName}</span>
          </p>

          <p>Home Team:
            <span class="fill-short">${teamName}</span>
            &nbsp;&nbsp;&nbsp;
            Away Team:
            <span class="fill-short">${opponent}</span>
          </p>

          <p>Current Game Date:
            <span class="fill-short">${origDate}</span>
            &nbsp;&nbsp;&nbsp;
            Current Game Time:
            <span class="fill-short">${origTime}</span>
          </p>

          <p>Current Game Location:
            <span class="fill">${origField}</span>
            &nbsp;&nbsp;&nbsp;
            Game Number:
            <span class="fill-short"></span>
          </p>

          <p>New Game date:
            <span class="fill-short ${isDateChanged ? 'fill-red' : ''}">${newDate}</span>
            &nbsp;&nbsp;&nbsp;
            New Game Time:
            <span class="fill-short ${isTimeChanged ? 'fill-red' : ''}">${newTime}</span>
          </p>

          <p>New game Location:
            <span class="fill ${isFieldChanged ? 'fill-red' : ''}">${newField}</span>
          </p>

          <p>Name of Coach Initiating the Reschedule:
            <span class="fill">${coachName}</span>
          </p>

          <p>Telephone:
            <span class="fill-short">${coachPhone}</span>
          </p>

          <p>Name of Opposing Coach:
            <span class="fill-short"></span>
            &nbsp;&nbsp;&nbsp;
            Telephone:
            <span class="fill-short"></span>
          </p>
        </div>

        <div class="section">
          <p><strong>I certify that the Opposing Coach has agreed to the above reschedule, subject to forfeit.</strong></p>
        </div>

        <div class="section">
          <p>Signed:
            <span class="signature-line"></span>
          </p>
          <div class="signature-image">
            <img src="${signatureDataUrl}" width="300" />
          </div>
        </div>

        <div class="section" style="margin-top: 20px;">
          <p><strong>Mail completed form and fee to:</strong></p>
          <p>South Shore Soccer League</p>
          <p>P.O. BOX 486</p>
          <p>West Bridgewater, MA 02379</p>
          <p>&nbsp;</p>
          <p>Email: game.scheduler@southshoresoccer.com &amp; referee.assignor@southshoresoccer.com</p>
        </div>

        <script>
          window.print();
        </script>

      </body>
      </html>
    `);

    win.document.close();

    // wipe sensitive fields immediately
    document.querySelectorAll('[data-sensitive="true"]').forEach(input => {
      input.value = "";
    });

    form.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    alert("SSSL Reschedule of Game Form generated. Save/print as PDF. Email and phone have been cleared.");
  });
}
