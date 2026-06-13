console.log("✅ CONTENT RUNNING")

function fetchImageViaBackground(url) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { type: "FETCH_IMAGE", url },
            (res) => {
                if (!res?.dataUrl) {
                    reject("Background fetch failed");
                    return;
                }
                resolve(res.dataUrl);
            }
        );
    });
}


(async function () {

    if (window.__RVQB_RUNNING__) {
        console.log("Already running.");
        return;
    }

    window.__RVQB_RUNNING__ = true;


    async function processAll(qOnly=false) {

            let { jsPDF } = window.jspdf;

    let pdf = new jsPDF({
        unit: "pt",
        format: "a4"
    });

    let cursorY = 40;

    let margin = 40;
    let maxWidth = 515;
    let lineHeight = 16;

    function decodeHtml(text) {
        let txt = document.createElement("textarea");
        txt.innerHTML = text;
        return txt.value;
    }

    function stripLatex(text) {
        if (!text) return "";

        return text
            // remove commands like \textbf \underline \textrm etc
            .replace(/\\[a-zA-Z]+/g, "")

            // remove curly braces
            .replace(/[{}]/g, "")

            // remove leftover latex symbols combos
            .replace(/\\+/g, "")

            .trim();
    }

    function cleanText(text) {
        if (!text) return "";

        text = text.replace(
            /[\u00A0\u200B-\u200D\uFEFF\u2800]/g,
            " "
        );

        return text
            .replace(
                /[^A-Za-z0-9\s.,!?;:'"()\[\]{}\-–—/%+=<>@#$*°±×÷≤≥≈√μπΔ→←↔✓]/g,
                ""
            )
            .replace(/\s+/g, " ")
            .replace(/\s([.,!?;:])/g, "$1")
                        .replace(/\\underline\{([^}]*)\}/g, "$1")
            .replace(/\\textrm\{([^}]*)\}/g, "$1")
            .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
            .replace(/✓|checkmark/g, "")
            .replace(/ +\( +\)/g, "")
            .replace(/\[\s*(\d+)\s*\]/g, "[$1]")
            .replace(/Sample answer:?/g, `------- A: `)
            .replace(/underlinetextrm/g, '')

            // remove latex commands but KEEP letters attached
            .replace(/\\[a-zA-Z]+/g, "")

            // remove leftover braces
            .replace(/[{}]/g, "")
            .trim();
    }

    function fixLetterSpacing(text) {
        return text
            .replace(/\b(?:[A-Za-z]\s+){3,}[A-Za-z]\b/g, match =>
                match.replace(/\s+/g, "")
            )
            .replace(/(?:\b[A-Za-z]\b\s*){4,}/g, match =>
                match.replace(/\s+/g, "")
            );
    }

    function sanitize(text) {
        return stripLatex(fixLetterSpacing(cleanText(text)));
    }

    function ensurePageSpace(heightNeeded = 20) {
        if (cursorY + heightNeeded > 800) {
            pdf.addPage();
            cursorY = 40;
        }
    }

    function writeLine(text, bold = false) {
        text = cleanText(text);
        text = stripLatex(text);   // <-- ADD THIS
        text = fixLetterSpacing(text);

        if (!text) return;

        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(11);

        let lines = pdf.splitTextToSize(text, 480);

        lines.forEach(line => {
            ensurePageSpace(20);
            pdf.text(line, margin, cursorY);
            cursorY += lineHeight;
        });
    }

    async function addImageToPDF(src) {
    try {
        if (src.startsWith("/_next/image")) {
            let url = new URL(src, window.location.origin);
            let actual = url.searchParams.get("url");
            if (actual) src = actual;
        }

        let dataUrl = await fetchImageViaBackground(src);

        // create temp image just for sizing
        let img = new Image();

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
        });

        let pageWidth = 515;
        let maxWidth = 460;
        let maxHeight = 650; // prevents overflow issues

        let ratio = Math.min(
            maxWidth / img.width,
            maxHeight / img.height,
            1
        );

        let renderWidth = img.width * ratio;
        let renderHeight = img.height * ratio;

        ensurePageSpace(renderHeight + 20);

        pdf.addImage(
            dataUrl,
            "JPEG",
            margin,
            cursorY,
            renderWidth,
            renderHeight
        );

        cursorY += renderHeight + 12;

    } catch (err) {
        console.warn("Image failed:", src, err);
    }
    }

    function addTableToPDF(rows) {

        let pageWidth = 515;
        let usableWidth = 480;

        let colCount = Math.max(...rows.map(r => r.length));

        let colWidth = usableWidth / colCount;

        rows.forEach((row, rowIndex) => {

            let x = margin;
            let rowHeight = 0;

            let wrappedCells = row.map(cell => {

                let lines = pdf.splitTextToSize(
                    String(cell),
                    colWidth - 8
                );

                let height = lines.length * 14 + 8;

                rowHeight = Math.max(rowHeight, height);

                return lines;
            });

            ensurePageSpace(rowHeight + 10);

            row.forEach((cell, i) => {

                pdf.rect(x, cursorY, colWidth, rowHeight);

                pdf.text(
                    wrappedCells[i],
                    x + 4,
                    cursorY + 14
                );

                x += colWidth;
            });

            cursorY += rowHeight;
        });

        cursorY += 12;
    }

    function extractLines(node) {

        if (!node) return [];

        // if (node.className === 'katex') {
        //     return [];
        // } // katex fix

        if (node.nodeType === Node.TEXT_NODE) {
            let txt = cleanText(node.textContent);

            return txt
                ? [{ type: "text", content: txt }]
                : [];
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return [];
        }

        if (
            node.classList?.contains("katex-mathml") ||
            node.classList?.contains("katex-html") ||
            node.tagName === "MATH"
        ) {
            return [];
        }

        if (node.classList?.contains("katex")) {
            let annotation = node.querySelector("annotation");

            if (!annotation) return [];

        let txt = stripLatex(annotation.textContent);

            return txt
                ? [{ type: "text", content: txt }]
                : [];
        }

        // IMAGES
        if (node.tagName === "IMG") {

            let src = node.getAttribute("src") || "";

            let width = node.width || 0;
            let height = node.height || 0;

            // skip tiny logos/icons
            if (width < 50 && height < 50) {
                return [];
            }

            return [{ type: "image", src }];
        }

        // TABLES
        if (node.tagName === "TABLE") {

            // if table contains image -> fallback to normal parsing
            if (node.querySelector("img")) {

                let results = [];

                node.childNodes.forEach(child => {
                    results.push(...extractLines(child));
                });

                return results;
            }

            let rows = Array.from(node.querySelectorAll("tr"))
                .map(tr =>
                    Array.from(tr.children)
                        .map(td => stripLatex(cleanText(td.innerText || "")))
                );

            return [{
                type: "table",
                rows
            }];
        }

        if (node.tagName === "BR") {
            return [{ type: "text", content: "" }];
        }

        if (
            node.tagName === "P" ||
            node.tagName === "DIV" ||
            node.tagName === "CENTER" ||
            node.tagName === "LI"
        ) {

            let results = [];

            node.childNodes.forEach(child => {
                results.push(...extractLines(child));
            });

            if (node.tagName === "LI") {

                let combined = results
                    .filter(x => x.type === "text")
                    .map(x => x.content)
                    .join(" ");

                return [{
                    type: "text",
                    content: cleanText("• " + combined)
                }];
            }

            results.push({
                type: "text",
                content: ""
            });

            return results;
        }

        return Array.from(node.childNodes)
            .flatMap(extractLines);
    }

    async function writeBlock(items) {

        for (let item of items) {

            if (item.type === "text") {

                if (item.content === "") {
                    cursorY += 8;
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

    async function appendQA(questionElement, answerElement, qOnly=false) {

        writeLine(`Question ${questionCount}:`, true);

        await writeBlock(
            extractLines(questionElement)
        );

        if (!qOnly) {
            cursorY += 14;

            writeLine("Answer:", true);

            await writeBlock(
                extractLines(answerElement)
            );
        };

        cursorY += 30;

        questionCount++;
    }

        console.log("Starting extraction...");

        let buttons = document.querySelectorAll(
            'button[data-analytics-name="clickMarkScheme"]'
        );

        for (let markSchemeButton of buttons) {

            markSchemeButton.click();

            await new Promise(resolve =>
                setTimeout(resolve, 1400)
            );

            let QAboxesParent = document
                .getElementsByClassName('css-v89234')[0]
                .firstChild;

            let innerQ = QAboxesParent
                .childNodes[1]
                .firstChild
                .firstChild;

            let innerA = QAboxesParent
                .lastChild
                .lastChild
                .firstChild;

            await appendQA(innerQ, innerA, qOnly);

            await new Promise(resolve =>
                setTimeout(resolve, 500)
            );

            document
                .querySelector('svg[data-testid="CloseIcon"]')
                .dispatchEvent(
                    new MouseEvent('click', {
                        bubbles: true
                    })
                );
        }

        let now = new Date();

        let dd = String(now.getDate()).padStart(2, '0');
        let mm = String(now.getMonth() + 1).padStart(2, '0');
        let yyyy = now.getFullYear();

        let hh = String(now.getHours()).padStart(2, '0');
        let min = String(now.getMinutes()).padStart(2, '0');

        let timestamp = `${dd}${mm}${yyyy}-${hh}${min}`;

        await fetch("https://script.google.com/macros/s/AKfycbzjl2mw7-G_JfHyG27Zz0UrjWTdfAsB9a2gvwEJmdymKniyUrGUpGIFIM6eUBd4cm_g/exec", {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                timestamp,
                title: window.location.href,
                url: `RVQB-Q${qOnly ? '' : 'A'} | ` + document.title
            }),
            headers: {
                "Content-Type": "application/json"
            }
        });

        function addFooters(timestamp) {

            let totalPages = pdf.getNumberOfPages();

            for (let i = 1; i <= totalPages; i++) {

                pdf.setPage(i);

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8);

                pdf.setTextColor(255, 0, 0);

                let pageHeight = pdf.internal.pageSize.getHeight();

                pdf.setFont("times", "bold");
                pdf.setFontSize(11);
                pdf.setTextColor(255, 0, 0);

                pdf.text(
                    `lnsc(1.6) \\ Q${qOnly ? '' : 'A'}: ${timestamp} \\ nil`,
                    pdf.internal.pageSize.getWidth() / 2,
                    pageHeight - 12,
                    { align: "center" }
                );
            }

            // restore defaults
            pdf.setTextColor(0, 0, 0);
        }

        let fileName =
            `RVQB-Q${qOnly ? '' : 'A'}-` + timestamp + '.pdf';

            addFooters(timestamp);

        pdf.save(fileName);

        console.log("Finished.");
        window.__RVQB_RUNNING__ = false;
    };

    // chrome.runtime.onMessage.addListener((msg) => {

    //     if (msg === "RUN_RVQB") {
    //         (async () => {
    //             await processAll(true);
    //             console.log('Moving onto second log.');
    //             await processAll(false);
    //         })();
    //     }

    // });

            (async () => {
                await processAll(true);
                console.log('Moving onto second log.');
                await processAll(false);
            })();
})();
