// ===============================================
// PDF GENERATION FOR GAME CHANGE FORM
// ===============================================
// Uses pdf-lib (loaded via CDN in form.html)
// ===============================================

async function generateReschedulePDF(formData) {
  // Load the PDF template
  const url = "sssl-reschedule.pdf"; // Must be in same folder
  const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());

  const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();

  // -----------------------------
  // SAFE FIELDS (stored in sheet)
  // -----------------------------
  setTextField(form, "Age_Gender_Division", formData.team_name || "");
  setTextField(form, "Home_Team", formData.team_name || "");
  setTextField(form, "Away_Team", "");
  setTextField(form, "Current_Game_Date", formData.orig_date || "");
  setTextField(form, "Current_Game_Time", formData.orig_time || "");
  setTextField(form, "Current_Game_Location", formData.orig_field || "");
  setTextField(form, "Game_Number", formData.game_number || "");
  setTextField(form, "New_Game_Date", formData.final_date || "");
  setTextField(form, "New_Game_Time", formData.final_time || "");
  setTextField(form, "New_Game_Location", formData.final_field || "");

  // -----------------------------
  // PRIVATE FIELDS (NOT stored)
  // -----------------------------
  setTextField(form, "Coach_Initiating_Request", formData.coach_name || "");
  setTextField(form, "Phone_Number_of_Initiating_Coach", formData.coach_phone || "");
  setTextField(form, "Email_of_Initiating_Coach", formData.coach_email || "");
  setTextField(form, "Name_of_Opposing_Coach", formData.opp_coach_name || "");
  setTextField(form, "Phone_Number_of_Opposing_Coach", formData.opp_coach_phone || "");

  // -----------------------------
  // SIGNATURE (PNG from canvas)
  // -----------------------------
  if (formData.signature_data) {
    const signatureBytes = dataURLToBytes(formData.signature_data);
    const signatureImage = await pdfDoc.embedPng(signatureBytes);

    const sigField = form.getTextField("Signature_of_Initiating_Coach");
    const widget = sigField.getWidgets()[0];
    const rect = widget.getRectangle();

    const page = pdfDoc.getPages()[0];
    page.drawImage(signatureImage, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    });

    sigField.setText(""); // Clear text so image shows
  }

  // Flatten fields so they cannot be edited
  form.flatten();

  // Save PDF
  const pdfBytes = await pdfDoc.save();

  // Trigger download
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const urlBlob = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = urlBlob;
  a.download = `SSSL-Reschedule-${formData.game_number}.pdf`;
  a.click();
}


// ===============================================
// HELPERS
// ===============================================

function setTextField(form, fieldName, value) {
  try {
    const field = form.getTextField(fieldName);
    field.setText(value || "");
  } catch (err) {
    console.warn("Missing field in PDF:", fieldName);
  }
}

function dataURLToBytes(dataURL) {
  const base64 = dataURL.split(",")[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
