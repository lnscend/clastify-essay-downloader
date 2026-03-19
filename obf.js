/* To be run in the browser console with a Clastify document open, with the console scaled to the side as far/small as possible.
Scroll to ensure that the annotations have loaded before running the script.
Have the Info tab on the left sidebar selected.
Two documents, one with the prefix 'Essay' and the other with the prefix 'Document' should be downloaded onto your device.
Allow the site to download multiple files if prompted. */

// Essay
(async()=>{
  const canvases=[...document.querySelectorAll('.react-pdf__Document canvas.react-pdf__Page__canvas')];
  if(!canvases.length){console.log("No canvases found");return;}

  const script=document.createElement("script");
  script.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  document.head.appendChild(script);
  await new Promise(r=>script.onload=r);

  const { jsPDF } = window.jspdf;
  const pdf=new jsPDF();

  canvases.forEach((canvas,i)=>{
    const w=pdf.internal.pageSize.getWidth();
    const h=(canvas.height*w)/canvas.width;

    if(i>0) pdf.addPage();

    // Add canvas image full page
    pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,w,h);

    // Draw flush ruler overlay on the left
    const pageHeight=pdf.internal.pageSize.getHeight();
    const rulerX=2;       // very close to the left edge
    const tickLength=4;   // short tick lines
    pdf.setLineWidth(0.5);
    pdf.setFont("times","normal");
    pdf.setFontSize(8);
    for(let pct=10;pct<=90;pct+=10){
      const y=(pct/100)*pageHeight;
      pdf.line(rulerX, y, rulerX+tickLength, y);       // small tick
      pdf.text(`${pct}%`, rulerX+tickLength+1, y+2);   // tiny label
    }
  });

  pdf.save('Essay -- '+document.title+'.pdf');
})();

// Annotations + Criteria Text
(()=>{
  try{
    const ann=document.querySelector('.react-pdf__Document canvas.annotation-canvas').annotations;
    if(!ann)throw 0;

    // Extract your criteria text first
    function ExtractCriteriaText(rootElement) {
      const criteriaBoxes = rootElement.querySelectorAll('.MuiBox-root.css-mro3c9');
      const results = [];
      criteriaBoxes.forEach(box => {
        const titleEl = box.querySelector('h6.MuiTypography-subtitle2');
        const scoreEl = box.querySelector('.MuiChip-label');
        const textEl = box.querySelector('p.MuiTypography-body2');
        if(titleEl && scoreEl && textEl) {
          const title = titleEl.textContent.trim();
          const score = scoreEl.textContent.trim();
          const paragraph = textEl.textContent.trim().replace(/\s+/g, ' ');
          results.push(`${title} (${score})\n${paragraph}`);
        }
      });
      return results.join('\n\n');
    };

    // Assuming the criteria container is right after the <h5> element
    const criteriaRoot = document.querySelector('h5').nextElementSibling;
    const extractedText = ExtractCriteriaText(criteriaRoot);

    // Build annotations text
    const annotationText = [...new Set(ann.map(a=>`${a.justification ? 'GOOD' : 'BAD'} | Page ${a.rectCoords[0].pageNumber} at ${Math.round(a.rectCoords[0].y*100)}% | ${a.criterion}\n${a.subCriterion}. ${a.comment}`))].join('\n\n');

    // Combine extracted text + annotations
    const combinedText = extractedText + '\n'.repeat(7) + annotationText;

    // Generate PDF
    (async()=>{
      const script=document.createElement("script");
      script.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      document.head.appendChild(script);
      await new Promise(r=>script.onload=r);

      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF();
      const margin=15;
      const pageWidth=pdf.internal.pageSize.getWidth();
      const pageHeight=pdf.internal.pageSize.getHeight();
      const lineHeight=7;

      pdf.setFont("times","normal");
      pdf.setFontSize(11);

      let y=margin;
      combinedText.split(/\n\s*\n/).forEach(par=>{
        const lines=pdf.splitTextToSize(par,pageWidth-2*margin);
        const paragraphHeight=lines.length*lineHeight;
        if(y+paragraphHeight>pageHeight-margin){pdf.addPage(); y=margin;}
        lines.forEach(l=>{pdf.text(l,margin,y); y+=lineHeight;});
        y+=lineHeight;
      });

      pdf.save('Annotations -- '+document.title+'.pdf');
    })();

  }catch(e){console.log("No annotations found")}
})();
