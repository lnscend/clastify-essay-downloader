(async () => {
    console.log('Initiating script..');
    const canvases = [...document.querySelectorAll('.react-pdf__Document canvas.react-pdf__Page__canvas')];
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

    if (!window.jspdf) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(script);
        await new Promise(r => script.onload = r);
    }

    const {
        jsPDF
    } = window.jspdf;

    console.log('Creating PDF..');
    const leftGutter = 45;
    const rightGutter = 48;

    const essayWidth = 210;
    const fullWidth = essayWidth + leftGutter + rightGutter;

    let pdf;

    canvases.forEach((canvas, pageIndex) => {

        const imgWidth = essayWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const pageAnnotations = annotations
            .filter(a => a.rectCoords?.some(r => r.pageNumber === pageIndex + 1))
            .sort((a, b) => a.rectCoords[0].y - b.rectCoords[0].y);

        // Estimate comment height first
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

        // Essay image untouched
        pdf.addImage(
            canvas.toDataURL("image/png"),
            "PNG",
            leftGutter,
            0,
            imgWidth,
            imgHeight
        );

        let leftCursor = 10;
        let rightCursor = 10;

        let elbowXincrementRight = 0;
        let elbowXincrementLeft = 0;
        pageAnnotations.forEach((a, i) => {

            const positive = !!a.justification;

            // Draw all highlight rectangles
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
                elbowXincrementRight -= 2;
            } else {
                commentX = 3; // originally 5
                commentY = Math.max(anchorY, leftCursor);
                elbowX = leftGutter - 1 + elbowXincrementLeft;
                elbowXincrementLeft += 2;
            }

            // Elbow connector
            pdf.setDrawColor(80);

            if (rightSide) {
                // same as before for right side
                pdf.line(anchorX, anchorY, elbowX, anchorY);
                pdf.line(elbowX, anchorY, elbowX, commentY);
                let textEdge = commentX - 2;
                pdf.line(elbowX, commentY, textEdge, commentY);
            } else {
                // left side: short horizontal past essay, then vertical down to comment
                const shortX = leftGutter + 14; // just past essay
                pdf.line(anchorX, anchorY, shortX, anchorY); // horizontally left
                pdf.line(shortX, anchorY, shortX, commentY); // vertical down
                let textEdge = commentX + 27;
                pdf.line(shortX, commentY, textEdge, commentY);
            }

            // Text
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
    
    pdf.save('Essay -- Annotated-' + document.title + '.pdf');

})();
