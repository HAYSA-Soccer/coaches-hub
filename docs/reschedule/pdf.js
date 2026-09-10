// pdf-lib loader
const { PDFDocument, StandardFonts, rgb } = PDFLib;

// RAW URL of your fillable SSSL form
const FORM_URL = "https://raw.githubusercontent.com/HAYSA-Soccer/coaches-hub/main/docs/reschedule/sssl-reschedule.pdf";

async function generateReschedulePDF(data) {
  // 1. Load the existing fillable PDF
  const formPdfBytes = await fetch(FORM_URL).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(formPdfBytes);

  // 2. Get the form
  const form = pdfDoc.getForm();

  // 3. Fill fields
  form.getTextField("game_number").setText(data.game_number || "");
  form.getTextField("team_name").setText(data.team_name || "");

  form.getTextField("orig_date").setText(data.orig_date || "");
  form.getTextField("orig_time").setText(data.orig_time || "");
  form.getTextField("orig_field").setText(data.orig_field || "");

  form.getTextField("final_date").setText(data.final_date || "");
  form.getTextField("final_time").setText(data.final_time || "");
  form.getTextField("final_field").setText(data.final_field || "");

  form.getTextField("coach_name").setText(data.coach_name || "");
  form.getTextField("coach_email").setText(data.coach_email || "");
  form.getTextField("coach_phone").setText(data.coach_phone || "");

  form.getTextField("opp_coach_name").setText(data.opp_coach_name || "");
  form.getTextField("opp_coach_phone").setText(data.opp_coach_phone || "");

  // 4. Signature (PNG)
  if (data.signature_data) {
    const pngImageBytes = await fetch(data.signature_data).then(res => res.arrayBuffer());
    const pngImage = await pdfDoc.embedPng(pngImageBytes);

    const pages = pdfDoc.getPages();
    const page = pages[0];

    // Adjust these coordinates to match your form layout
    page.drawImage(pngImage, {
      x: 50,
      y: 150,
      width: 200,
      height: 80
    });
  }

  // 5. Flatten the form (makes fields non-editable)
  form.flatten();

  // 6. Download the completed PDF
  const pdfBytes = await pdfDoc.save();

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `Game_${data.game_number}_Reschedule.pdf`;
  a.click();

  URL.revokeObjectURL(url);
}
