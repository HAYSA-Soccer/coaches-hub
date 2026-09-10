function generateReschedulePDF(data) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("SSSL Game Change Form", 10, 10);

  doc.setFontSize(12);
  let y = 20;

  const add = (label, value) => {
    doc.text(`${label}: ${value || ""}`, 10, y);
    y += 8;
  };

  add("Game Number", data.game_number);
  add("Team Name", data.team_name);
  add("Original Date", data.orig_date);
  add("Original Time", data.orig_time);
  add("Original Field", data.orig_field);

  add("New Date", data.final_date);
  add("New Time", data.final_time);
  add("New Field", data.final_field);

  add("Coach Name", data.coach_name);
  add("Coach Email", data.coach_email);
  add("Coach Phone", data.coach_phone);

  add("Opposing Coach Name", data.opp_coach_name);
  add("Opposing Coach Phone", data.opp_coach_phone);

  // Signature image
  if (data.signature_data) {
    doc.addImage(data.signature_data, "PNG", 10, y, 100, 40);
    y += 50;
  }

  doc.save(`Game_${data.game_number}_Reschedule.pdf`);
}
