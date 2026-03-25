(async () => {
    try {

        console.log('Initiating script.');


        const now = new Date();

        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();

        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');

        const timestamp = `${dd}${mm}${yyyy}-${hh}${min}`;

        console.log('Current timestamp: ' + timestamp);
        // Extract criteria text
        function extractCriteriaText(rootElement) {
            const criteriaBoxes = rootElement.querySelectorAll('.MuiBox-root.css-mro3c9');
            const results = [];

            criteriaBoxes.forEach(box => {
                const titleEl = box.querySelector('h6.MuiTypography-subtitle2');
                const scoreEl = box.querySelector('.MuiChip-label');
                const textEl = box.querySelector('p.MuiTypography-body2');

                if (titleEl && scoreEl && textEl) {
                    const title = titleEl.textContent.trim();
                    const score = scoreEl.textContent.trim();
                    const paragraph = textEl.textContent.trim().replace(/\s+/g, ' ');

                    results.push(`${title} (${score})\n${paragraph}`);
                }
            });

            return results.join('\n\n');
        }

        const criteriaRoot = document.querySelector('h5')?.nextElementSibling;
        const extractedText = criteriaRoot ? extractCriteriaText(criteriaRoot) : "";


        const canvases = [...document.querySelectorAll('.react-pdf__Document canvas.react-pdf__Page__canvas')];
        console.log('Page count: ' + canvases.length);
        const annCanvas = document.querySelector('.react-pdf__Document canvas.annotation-canvas');

        if (!canvases.length) {
            console.log("No canvases found");
            return;
        }
        if (!annCanvas?.annotations) {
            console.log("No annotations found");
            return;
        }

        const annotations = annCanvas.annotations;
        console.log('Annotations count: ' + annotations.length);
        if (!window.jspdf) {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
            document.head.appendChild(script);
            await new Promise(r => script.onload = r);
        }

        const {
            jsPDF
        } = window.jspdf;

        console.log('Generating PDF.');
        const leftGutter = 40;
        const rightGutter = 45;

        const essayWidth = 210;
        const fullWidth = essayWidth + leftGutter + rightGutter;

        let pdf;

        canvases.forEach((canvas, pageIndex) => {
            console.log('Processing page ' + pageIndex + '.');
            const imgWidth = essayWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const pageAnnotations = annotations
                .filter(a => a.rectCoords?.some(r => r.pageNumber === pageIndex + 1))
                .sort((a, b) => a.rectCoords[0].y - b.rectCoords[0].y);

            let estimatedBottom = imgHeight;

            pageAnnotations.forEach((a, i) => {
                const body = (a.justification || a.comment) || "";
                const lines = Math.ceil(body.length / 55);
                estimatedBottom += lines * 3.5 + 10;
            });

            const pageHeight = fullWidth * 297 / 210;

            if (pageIndex === 0) {
                pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: [pageHeight, fullWidth]
                });

            } else {
                pdf.addPage([pageHeight, fullWidth], 'p');
            }

            // Essay image unedited
            pdf.addImage(
                canvas.toDataURL("image/png"),
                "PNG",
                leftGutter,
                0,
                imgWidth,
                imgHeight
            );


            // Water-log text
            const headerText = `lnsc(2.2) \\ Annotated: ${timestamp} \\ n = ${annotations.length}`;

            pdf.setFont("times", "bold");
            pdf.setFontSize(11);
            pdf.setTextColor(255, 0, 0);

            const centerX = fullWidth / 2;
            pdf.text(headerText, centerX, pageIndex ? 408 : 8, {
                align: 'center'
            });

            // Reset text color for text brush
            pdf.setTextColor(0, 0, 0);


            let leftCursor = 10;
            let rightCursor = 10;

            let elbowXincrementRight = 0;
            let shortXincrementLeft = 0;
            pageAnnotations.forEach((a, i) => {

                const positive = !!a.justification;

                // Generate all highlight boxes
                a.rectCoords.forEach(r => {

                    const x = leftGutter + (r.x * imgWidth);
                    const y = r.y * imgHeight;
                    const w = r.width * imgWidth;
                    const h = r.height * imgHeight;

                    if (positive) {
                        pdf.setFillColor(120, 255, 120);
                    } else {
                        pdf.setFillColor(255, 120, 120);
                    }

                    pdf.setGState(new pdf.GState({
                        opacity: 0.35
                    }));
                    pdf.rect(x, y, w, h, 'F');
                    pdf.setGState(new pdf.GState({
                        opacity: 1
                    }));
                });

                const firstRect = a.rectCoords[0];
                const rightSide = i % 2 === 0;

                const boxWidth = 50

                const anchorY = (firstRect.y * imgHeight) + (firstRect.height * imgHeight / 2) - 2.4;

                const anchorX = rightSide ?
                    leftGutter + (firstRect.x * imgWidth) + (firstRect.width * imgWidth) :
                    leftGutter + (firstRect.x * imgWidth);

                let commentX, commentY, elbowX;

                if (rightSide) {
                    commentX = leftGutter + essayWidth - 8; // originally +8
                    commentY = Math.max(anchorY, rightCursor);
                    elbowX = leftGutter + essayWidth - 12 + elbowXincrementRight;
                    if (anchorY !== commentY) elbowXincrementRight -= 2;
                } else {
                    commentX = 3; // originally 5
                    commentY = Math.max(anchorY, leftCursor);
                    elbowX = leftGutter - 1;
                    if (anchorY !== commentY) shortXincrementLeft += 2;
                }

                // Elbow connector
                pdf.setDrawColor(80);

                if (rightSide) {

                    pdf.line(anchorX, anchorY, elbowX, anchorY);
                    pdf.line(elbowX, anchorY, elbowX, commentY);
                    let textEdge = commentX - 2;
                    pdf.line(elbowX, commentY, textEdge, commentY);
                } else {
                    let shortX = leftGutter + 14 + shortXincrementLeft
                    pdf.line(anchorX, anchorY, shortX, anchorY);
                    pdf.line(shortX, anchorY, shortX, commentY);
                    let textEdge = commentX + 27;
                    pdf.line(shortX, commentY, textEdge, commentY);
                }
                console.log(`Added ${positive ? 'positive' : 'negative'} page annotation ${i} to ${rightSide ? 'right' : 'left'} side of page.`);

                const status = `${positive?'GOOD':'BAD'} | `;
                const criterion = a.criterion.replace(': ', '\n');
                const body = '\n' + (a.justification || a.comment);

                pdf.setFontSize(8.5);

                pdf.setFont("times", "normal");
                pdf.text(status, commentX, commentY);

                const statusWidth = pdf.getTextWidth(status);

                pdf.setFont("times", "bold");
                pdf.text(criterion, commentX + statusWidth, commentY);

                pdf.setFont("times", "normal");

                const wrapped = pdf.splitTextToSize(body, boxWidth);

                wrapped.forEach((line, j) => {
                    pdf.text(
                        line,
                        commentX,
                        commentY + 4 + (j * 3.5)
                    );
                });

                const blockHeight = (wrapped.length * 3.5) + 7;

                if (rightSide) {
                    rightCursor = commentY + blockHeight;
                } else {
                    leftCursor = commentY + blockHeight;
                }

            });

        });


        console.log("PDF width:", pdf.internal.pageSize.getWidth(), "mm");
        console.log("PDF height:", pdf.internal.pageSize.getHeight(), "mm");
        console.log('Ratio: ', pdf.internal.pageSize.getHeight() / pdf.internal.pageSize.getWidth());


        // Criteria Breakdown portion
        if (extractedText) {
            pdf.addPage([pdf.internal.pageSize.getHeight(), pdf.internal.pageSize.getWidth()], 'p');

            const margin = 15;
            const lineHeight = 7.5;
            const pageWidth = pdf.internal.pageSize.getWidth();

            let y = 30;

            // Title
            pdf.setFont("times", "bold");
            pdf.setFontSize(45);
            pdf.text("Criteria Breakdown", margin, y);

            y += 18;

            // Body
            pdf.setFont("times", "normal");
            pdf.setFontSize(16);

            const paragraphs = extractedText.split('\n\n');

            paragraphs.forEach(paragraph => {
                const lines = pdf.splitTextToSize(paragraph, pageWidth - margin * 2);

                lines.forEach(line => {
                    if (y > pdf.internal.pageSize.getHeight() - margin) {
                        pdf.addPage([pdf.internal.pageSize.getHeight(), pdf.internal.pageSize.getWidth()], 'p');
                        y = 20;
                    }

                    pdf.text(line, margin, y);
                    y += lineHeight;
                });

                y += 7;
            });
        };

        let fileName = 'lnsc-Annotated-' + timestamp + ' -- ' + document.title + '.pdf';
        console.log('Document downloaded: ' + fileName);
        pdf.save(fileName);
        await fetch("https://script.google.com/macros/s/AKfycbzjl2mw7-G_JfHyG27Zz0UrjWTdfAsB9a2gvwEJmdymKniyUrGUpGIFIM6eUBd4cm_g/exec", {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                timestamp,
                title: window.location.href,
                url: document.title
            }),
            headers: {
                "Content-Type": "application/json"
            }
        });
        console.log('Success.');
    } catch (errorFull) {
        console.log('Download failed. Ensure that your page is on the Info tab and your console is kept as small as possible before running the script.');
    };
})();
