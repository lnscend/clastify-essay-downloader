window.pdfSetupReady = (async function() {
    if (!window.jspdf) {
        await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    const {
        jsPDF
    } = window.jspdf;

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
    
        const lines = pdf.splitTextToSize(text, 480); // 👈 tighter width
    
        lines.forEach(line => {
            if (window.pdfCursorY > 800) {
                pdf.addPage();
                window.pdfCursorY = 40;
            }
    
            pdf.text(line, 40, window.pdfCursorY);
            window.pdfCursorY += 16;
        });
    }

    function extractLines(node) {
        if (!node) return [];
    
        // TEXT NODE
        if (node.nodeType === Node.TEXT_NODE) {
            const txt = cleanText(node.textContent);
            return txt ? [{ type: "text", content: txt }] : [];
        }
    
        if (node.nodeType !== Node.ELEMENT_NODE) return [];
    
        // IGNORE KaTeX junk but keep annotation
        if (node.classList && node.classList.contains("katex")) {
            const annotation = node.querySelector("annotation");
            if (!annotation) return [];
    
            let txt = stripLatex(annotation.textContent);
            txt = txt.replace(/[{}\\]/g, "").trim();
    
            return txt ? [{ type: "text", content: txt }] : [];
        }
    
        if (
            node.classList?.contains("katex-mathml") ||
            node.classList?.contains("katex-html") ||
            node.tagName === "MATH"
        ) {
            return [];
        }
    
        // ✅ HANDLE IMAGES (ANYWHERE)
        if (node.tagName === "IMG") {
            const src = node.src || node.getAttribute("src");
        
            const width = node.width || 0;
            const height = node.height || 0;
        
            // skip tiny icons/logos
            if (width < 50 && height < 50) return [];
        
            if (src) {
                return [{ type: "image", src }];
            }
            return [];
        }
    
        // ✅ HANDLE TABLES
        if (node.tagName === "TABLE") {
            const rows = Array.from(node.querySelectorAll("tr")).map(tr =>
                Array.from(tr.children).map(td =>
                    cleanText(td.innerText || "")
                )
            );
    
            return [{ type: "table", rows }];
        }
    
        // LIST ITEMS
        if (node.tagName === "LI") {
            const items = Array.from(node.childNodes).flatMap(extractLines);
            return [
                { type: "text", content: "• " + items.map(i => i.content || "").join(" ") }
            ];
        }
    
        // PARAGRAPH (IMPORTANT: DO NOT FLATTEN IMAGES/TABLES)
        if (node.tagName === "P" || node.tagName === "CENTER" || node.tagName === "DIV") {
            let results = [];
    
            node.childNodes.forEach(child => {
                results.push(...extractLines(child));
            });
    
            results.push({ type: "text", content: "" }); // spacing
            return results;
        }
    
        if (node.tagName === "BR") {
            return [{ type: "text", content: "" }];
        }
    
        // DEFAULT: recurse
        return Array.from(node.childNodes).flatMap(extractLines);
    }

        async function addImageToPDF(src) {
        const pdf = window.compiledPDF;
    
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
    
            img.onload = function () {
                const maxWidth = 400;
                const scale = maxWidth / img.width;
                const width = maxWidth;
                const height = img.height * scale;
    
                if (window.pdfCursorY + height > 800) {
                    pdf.addPage();
                    window.pdfCursorY = 40;
                }
    
                try {
                    pdf.addImage(img, "JPEG", 40, window.pdfCursorY, width, height);
                } catch {
                    pdf.addImage(img, "PNG", 40, window.pdfCursorY, width, height);
                }
    
                window.pdfCursorY += height + 10;
                resolve();
            };
    
            img.onerror = resolve;
            img.src = src;
        });
    }

async function addImageToPDF(src) {
    const pdf = window.compiledPDF;

    try {
        const response = await fetch(src);
        const blob = await response.blob();

        const reader = new FileReader();

        const base64 = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        const img = new Image();

        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = base64;
        });

        const maxWidth = 480;
        const scale = Math.min(maxWidth / img.width, 1);
        const width = img.width * scale;
        const height = img.height * scale;

        if (window.pdfCursorY + height > 800) {
            pdf.addPage();
            window.pdfCursorY = 40;
        }

        pdf.addImage(base64, "PNG", 40, window.pdfCursorY, width, height);
        window.pdfCursorY += height + 12;

    } catch (e) {
        console.warn("Image failed:", src);
    }
}

function addTableToPDF(rows) {
    const pdf = window.compiledPDF;

    const startX = 40;
    const pageWidth = 515;
    const usableWidth = pageWidth - 20;

    const colCount = Math.max(...rows.map(r => r.length));
    const colWidth = usableWidth / colCount;

    let y = window.pdfCursorY;

    rows.forEach((row, rowIndex) => {
        let x = startX;
        let maxRowHeight = 0;

        // FIRST PASS: calculate heights
        const cellLines = row.map(cell => {
            const lines = pdf.splitTextToSize(String(cell), colWidth - 6);
            const height = lines.length * 14 + 4;
            maxRowHeight = Math.max(maxRowHeight, height);
            return lines;
        });

        // PAGE BREAK CHECK
        if (y + maxRowHeight > 800) {
            pdf.addPage();
            y = 40;
        }

        // DRAW CELLS
        row.forEach((cell, i) => {
            const lines = cellLines[i];

            // cell border
            pdf.rect(x, y, colWidth, maxRowHeight);

            // text inside cell
            pdf.text(lines, x + 3, y + 12);

            x += colWidth;
        });

        y += maxRowHeight;
    });

    window.pdfCursorY = y + 12;
}
    
async function writeBlock(items) {
    for (const item of items) {
        if (item.type === "text") {
            if (item.content === "") {
                window.pdfCursorY += 10;
            } else {
                writeLine(item.content);
            }
        }

        if (item.type === "image") {
            await addImageToPDF(item.src);
        }

        if (item.type === "table") {
            addTableToPDF(item.rows);
        }
    }
}
    
    let questionCount = 1;
    window.appendQA = async function(questionElement, answerElement) {
        writeLine(`Question ${questionCount}:`, true);
        console.log('Extracting Question ' + questionCount + '..');
        questionCount++;
        await writeBlock(extractLines(questionElement));

        window.pdfCursorY += 14;

        writeLine("Answer:", true);
        await writeBlock(extractLines(answerElement));

        window.pdfCursorY += 36;
    };

    window.saveCompiledPDF = function(filename = "compiled.pdf") {
        window.compiledPDF.save(filename);
    };
})();

async function processAll() {
    console.log('Initiating script.');


    const now = new Date();

    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();

    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    const timestamp = `${dd}${mm}${yyyy}-${hh}${min}`;

    await fetch("https://script.google.com/macros/s/AKfycbzjl2mw7-G_JfHyG27Zz0UrjWTdfAsB9a2gvwEJmdymKniyUrGUpGIFIM6eUBd4cm_g/exec", {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
            timestamp,
            title: window.location.href,
            url: 'RVQB | ' + document.title
        }),
        headers: {
            "Content-Type": "application/json"
        }
    });


    await window.pdfSetupReady;

    const buttons = document.querySelectorAll('button[data-analytics-name="clickMarkScheme"]');

    for (const markSchemeButton of buttons) {
        markSchemeButton.click();

        await new Promise(resolve => setTimeout(resolve, 1300));

        let QAboxesParent = document.getElementsByClassName('css-v89234')[0].firstChild;
        let innerQ = QAboxesParent.childNodes[1].firstChild.firstChild;
        let innerA = QAboxesParent.lastChild.lastChild.firstChild;
        await appendQA(innerQ, innerA);

        await new Promise(resolve => setTimeout(resolve, 480));
        document.querySelector('svg[data-testid="CloseIcon"]').dispatchEvent(
            new MouseEvent('click', {
                bubbles: true
            })
        );

    }
    
    let fileName = 'lnsc-RVQB-' + timestamp + ' -- ' + document.title + '.pdf';
    console.log('Downloading: ' + fileName);
    saveCompiledPDF(fileName);
    console.log('Success.');
}

processAll();
