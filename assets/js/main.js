// ================================
// RESCHEDULE CHECKLIST + CALENDAR
// ================================

document.addEventListener("DOMContentLoaded", () => {
  initRescheduleChecklist();
  initSlotProposalForm();
  initFieldHoldEmailLink();
  initGameChangeForm();
});

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
      // In the future, you can send non-sensitive status to a backend here.
    });
  });
}

function initSlotProposalForm() {
  const form = document.getElementById("slotProposalForm");
  const fieldSelect = document.getElementById("slotField");
  if (!form || !fieldSelect) return;

  // Simple static field list for now; can be wired to calendar snapshot later.
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

    // Build a simple printable document in a new window
    const win = window.open("", "_blank");
    if (!win) {
      alert("Popup blocked. Please allow popups to generate the PDF.");
      return;
    }

    win.document.write(`
      <html>
      <head>
        <title>Game Change Form - ${teamName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 22px; margin-bottom: 10px; }
          h2 { font-size: 18px; margin-top: 20px; }
          p  { font-size: 14px; line-height: 1.5; }
          .section { margin-bottom: 18px; }
          .label { font-weight: bold; }
          .signature { margin-top: 10px; }
          img { border: 1px solid #ccc; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Game Change Form</h1>

        <div class="section">
          <h2>Team Information</h2>
          <p><span class="label">Team Name:</span> ${teamName}</p>
          <p><span class="label">Coach Name:</span> ${coachName}</p>
          <p><span class="label">Coach Email:</span> ${coachEmail}</p>
          <p><span class="label">Coach Phone:</span> ${coachPhone}</p>
        </div>

        <div class="section">
          <h2>Original Game Details</h2>
          <p><span class="label">Date:</span> ${origDate}</p>
          <p><span class="label">Time:</span> ${origTime}</p>
          <p><span class="label">Field:</span> ${origField}</p>
          <p><span class="label">Opponent:</span> ${opponent}</p>
        </div>

        <div class="section">
          <h2>New Requested Details</h2>
          <p><span class="label">Date:</span> ${newDate}</p>
          <p><span class="label">Time:</span> ${newTime}</p>
          <p><span class="label">Field:</span> ${newField}</p>
          <p><span class="label">Reason:</span> ${reason}</p>
        </div>

        <div class="section signature">
          <h2>Coach Signature</h2>
          <img src="${signatureDataUrl}" alt="Signature" />
        </div>

        <script>
          window.print();
        </script>
      </body>
      </html>
    `);

    win.document.close();

    // PRIVACY: wipe sensitive fields immediately
    document.querySelectorAll('[data-sensitive="true"]').forEach(input => {
      input.value = "";
    });

    // Reset the form and signature pad
    form.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    alert("Game Change Form generated. You can save/print it as PDF. Email and phone have been cleared.");
  });
}
