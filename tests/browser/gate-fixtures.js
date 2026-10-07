// Test-only source loader. Run/cancel/copy/export actions remain the public UI.
const panel = document.createElement("details"); panel.open = true; panel.id = "gate-fixtures";
panel.innerHTML = '<summary>Hardening fixture loader (test server only)</summary><label for="gate-fixture">Test fixture</label><select id="gate-fixture"></select><button id="gate-load" type="button">Load test fixture</button><label><input id="gate-drop" type="checkbox">Use public drop handler (source replacement)</label><p id="gate-source-status" role="status"></p>';
const select = panel.querySelector("select");
const fixtures = ["image-eng", "image-kor", "image-mixed", "pdf-eng-1", "pdf-kor-1", "pdf-mixed-1", "pdf-mixed-2", "pdf-mixed-5", "pdf-existing", "invalid-image", "invalid-pdf"];
for (const name of fixtures) select.append(Object.assign(document.createElement("option"), { value: name, textContent: name }));
document.body.append(panel);
panel.querySelector("button").disabled = true;
const controlDownload = document.createElement("a"); controlDownload.href = "/assets/icons/favicon.ico"; controlDownload.download = "gate-control.ico"; controlDownload.textContent = "Diagnostic static download"; panel.append(controlDownload);
const actionLabel = document.createElement("label"); actionLabel.textContent = "Next job interruption (after 50 ms)";
const interruption = document.createElement("select"); interruption.id = "gate-interruption";
for (const name of ["none", "cancel", "replace PDF with English"]) interruption.append(Object.assign(document.createElement("option"), { value: name, textContent: name }));
actionLabel.append(interruption); panel.append(actionLabel);
const retainLabel = document.createElement("label");
retainLabel.innerHTML = '<input id="gate-retain-url" type="checkbox">Diagnostic: delay download URL revocation by 30 seconds'; panel.append(retainLabel);
const replacementFile = await fixture("pdf-eng-1");
document.addEventListener("click", (event) => {
  if (!["recognize", "download-searchable"].includes(event.target.closest("button")?.id) || interruption.value === "none") return;
  const action = interruption.value; interruption.value = "none";
  setTimeout(() => {
    if (action === "cancel") document.querySelector("#cancel").click();
    else {
      const file = replacementFile; const transfer = new DataTransfer(); transfer.items.add(file);
      document.querySelector("#drop-zone").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      panel.dataset.fixture = JSON.stringify({ name: file.name, bytes: file.size });
    }
  }, 50);
}, true);
async function fixture(kind) {
  if (kind.startsWith("invalid")) return new File(["invalid fixture"], kind === "invalid-image" ? "invalid.png" : "invalid.pdf", { type: kind === "invalid-image" ? "image/png" : "application/pdf" });
  const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = 640;
  const context = canvas.getContext("2d"); context.fillStyle = "white"; context.fillRect(0, 0, 960, 640); context.fillStyle = "black"; context.font = '50px "Malgun Gothic", Arial, sans-serif';
  const lines = kind.includes("mixed") ? ["HELLO SEARCHABLE PDF", "검색 가능한 PDF", "HELLO 검색 PDF"] : kind.includes("kor") ? ["검색 가능한 PDF"] : ["HELLO SEARCHABLE PDF"];
  lines.forEach((text, index) => context.fillText(text, 80, 160 + index * 130));
  const image = await new Promise((resolve) => canvas.toBlob(resolve, "image/png")); canvas.width = canvas.height = 1;
  if (kind.startsWith("image")) return new File([image], `${kind}.png`, { type: "image/png" });
  if (!window.PDFLib) await import("/assets/vendor/pdf-lib/pdf-lib.min.js");
  const pdf = await window.PDFLib.PDFDocument.create(); pdf.setCreationDate(new Date("2026-01-01T00:00:00Z")); pdf.setModificationDate(new Date("2026-01-01T00:00:00Z"));
  const embedded = await pdf.embedPng(await image.arrayBuffer());
  const count = Number(kind.split("-").at(-1)) || 1;
  for (let index = 0; index < count; index++) { const page = pdf.addPage([480, 320]); if (kind === "pdf-existing") page.drawText("EXISTING TEXT", { x: 40, y: 240, size: 25 }); else page.drawImage(embedded, { x: 0, y: 0, width: 480, height: 320 }); }
  return new File([await pdf.save()], `${kind}.pdf`, { type: "application/pdf" });
}
panel.querySelector("button").addEventListener("click", async () => {
  const status = panel.querySelector("p");
  try {
    const file = await fixture(select.value); const transfer = new DataTransfer(); transfer.items.add(file);
    if (panel.querySelector("input").checked) document.querySelector("#drop-zone").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    else { const input = document.querySelector('input[type="file"]'); input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true })); }
    panel.dataset.fixture = JSON.stringify({ name: file.name, bytes: file.size }); status.textContent = `Loaded ${file.name} (${file.size} bytes) through the public source handler.`;
  } catch (error) { status.textContent = `Fixture loader failed: ${error.message}`; throw error; }
});
panel.querySelector("button").disabled = false;
