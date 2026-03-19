// To be run in the browser console with a Clastify document open, with the console scaled to the side as far/small as possible.

// Essay
(async () => {
  const canvases = [...document.querySelectorAll('.react-pdf__Document canvas.react-pdf__Page__canvas')];

  if (!canvases.length) {
    console.log("No canvases found");
    return;
  }

  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  document.head.appendChild(script);

  await new Promise(r => script.onload = r);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  canvases.forEach((canvas, i) => {
    const img = canvas.toDataURL("image/png");
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;

    if (i > 0) pdf.addPage();
    pdf.addImage(img, "PNG", 0, 0, w, h);
  });

  pdf.save('Essay -- ' + document.title + '.pdf');
})();

// Annotations
let annotations = document.querySelector('.react-pdf__Document canvas.annotation-canvas').annotations;
let reformatted = [];

for (const annotation of annotations) {
    let annotationText = `Page ${annotation.rectCoords[0].pageNumber} | ${annotation.criterion}\n${annotation.subCriterion}. ${annotation.comment}`;
    reformatted.push(annotationText);
};

let finalAnnotations = [... new Set(reformatted)].join('\n\n');

(async () => {
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  document.head.appendChild(script);

  await new Promise(r => script.onload = r);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const margin = 15;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 7;

  pdf.setFont("times", "normal");
  pdf.setFontSize(11);

  const paragraphs = finalAnnotations.split(/\n\s*\n/);

  let y = margin;

  paragraphs.forEach(paragraph => {
    const lines = pdf.splitTextToSize(paragraph, maxWidth);
    const paragraphHeight = lines.length * lineHeight;

    if (y + paragraphHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }

    lines.forEach(line => {
      pdf.text(line, margin, y);
      y += lineHeight;
    });

    y += lineHeight;
  });

  pdf.save('Annotations -- ' + document.title + '.pdf');
})();
