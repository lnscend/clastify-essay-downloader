window.pdfSetupReady = (async function () {
  if (!window.jspdf) {
    await new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  const { jsPDF } = window.jspdf;

  window.compiledPDF = new jsPDF({
    unit: "pt",
    format: "a4"
  });

  window.pdfCursorY = 40;

  const margin = 40;
  const width = 515;
  const lineHeight = 16;

  function stripLatex(text) {
    return text
      .replace(/\\underline\{([^}]*)\}/g, "$1")
      .replace(/\\textrm\{([^}]*)\}/g, "$1")
      .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
      .replace(/\\checkmark/g, "✓")
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/[{}]/g, "");
  }

function cleanText(text) {
  return stripLatex(text)
    .replace(/\u00a0/g, " ")
    .replace(/✓/g, "")        
    .replace(/[^\x20-\x7E]/g, "")   
    .replace(/&/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\[\s+/g, "[")
    .replace(/\s+\]/g, "]")
    .replace(/\s+/g, " ")
    .replace(/\s([.,!?;:])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function fixLetterSpacing(text) {
  return text
    // collapse long sequences like c o n c e p t
    .replace(/\b(?:[A-Za-z]\s+){3,}[A-Za-z]\b/g, match =>
      match.replace(/\s+/g, "")
    )

    // collapse broken mixed sentence fragments
    .replace(/(?:\b[A-Za-z]\b\s*){4,}/g, match =>
      match.replace(/\s+/g, "")
    );
}

  function writeLine(text, bold = false) {
    const pdf = window.compiledPDF;

    text = fixLetterSpacing(cleanText(text));
    if (!text) return;

    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);

    const lines = pdf.splitTextToSize(text, width);

    lines.forEach(line => {
      if (window.pdfCursorY > 800) {
        pdf.addPage();
        window.pdfCursorY = 40;
      }

      pdf.text(line, margin, window.pdfCursorY);
      window.pdfCursorY += lineHeight;
    });
  }

function extractLines(node) {
  if (!node) return [];

  // KaTeX: only take annotation text, ignore all rendered junk
  if (node.classList && node.classList.contains("katex")) {
    const annotation = node.querySelector("annotation");
    if (!annotation) return [];

    let txt = annotation.textContent;

    txt = stripLatex(txt);

    // discard useless latex leftovers
    txt = txt.replace(/[{}\\]/g, "").trim();

    // if annotation becomes meaningless, skip it
    if (!txt || /^[^a-zA-Z0-9✓]+$/.test(txt)) return [];

    return [txt];
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const txt = cleanText(node.textContent);
    return txt ? [txt] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  // ignore hidden math layers
  if (
    node.classList.contains("katex-mathml") ||
    node.classList.contains("katex-html") ||
    node.tagName === "MATH"
  ) {
    return [];
  }

  if (node.tagName === "LI") {
    const content = Array.from(node.childNodes)
      .flatMap(extractLines)
      .join(" ");

    return content ? ["• " + cleanText(content)] : [];
  }

  if (node.tagName === "P") {
    const content = Array.from(node.childNodes)
      .flatMap(extractLines)
      .join(" ");

    return content ? [cleanText(content), ""] : [];
  }

  if (node.tagName === "BR") {
    return [""];
  }

  return Array.from(node.childNodes).flatMap(extractLines);
}

  function writeBlock(lines) {
    lines.forEach(line => {
      if (line === "") {
        window.pdfCursorY += 10;
      } else {
        writeLine(line);
      }
    });
  }
    let questionCount = 1;
  window.appendQA = function (questionElement, answerElement) {
    writeLine(`Question ${questionCount}:`, true);
      questionCount++;
    writeBlock(extractLines(questionElement));

    window.pdfCursorY += 14;

    writeLine("Answer:", true);
    writeBlock(extractLines(answerElement));

    window.pdfCursorY += 36;
  };

  window.saveCompiledPDF = function (filename = "compiled.pdf") {
    window.compiledPDF.save(filename);
  };

  console.log("Ready:");
  console.log("appendQA(questionElement, answerElement)");
  console.log("saveCompiledPDF()");
})();

async function processAll() {
  await window.pdfSetupReady;

  const buttons = document.querySelectorAll('button[data-analytics-name="clickMarkScheme"]');

  for (const markSchemeButton of buttons) {
    markSchemeButton.click();

    await new Promise(resolve => setTimeout(resolve, 640));

    let QAboxesParent = document.getElementsByClassName('css-v89234')[0].firstChild;
    let innerQ = QAboxesParent.childNodes[1].firstChild.firstChild;
    let innerA = QAboxesParent.lastChild.lastChild.firstChild;

    appendQA(innerQ, innerA);

    await new Promise(resolve => setTimeout(resolve, 120));
  }

  saveCompiledPDF(document.title + '.pdf');
}

processAll();
