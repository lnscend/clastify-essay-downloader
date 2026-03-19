/* To be run in the browser console with a Clastify document open, with the console scaled to the side as far/small as possible.
Scroll to ensure that the annotations have loaded before running the script.
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

// Annotations
(()=>{
  try{
    const ann=document.querySelector('.react-pdf__Document canvas.annotation-canvas').annotations;
    if(!ann)throw 0;
    const f=[...new Set(ann.map(a=>`${a.justification ? 'GOOD' : 'BAD'} | Page ${a.rectCoords[0].pageNumber} at ${Math.round(a.rectCoords[0].y * 100)}% | ${a.criterion}\n${a.subCriterion}. ${a.comment}`))].join('\n\n');
    (async()=>{
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      document.head.appendChild(s);
      await new Promise(r=>s.onload=r);
      const {jsPDF}=window.jspdf,p=new jsPDF(),m=15,W=p.internal.pageSize.getWidth(),H=p.internal.pageSize.getHeight(),L=7;
      p.setFont("times","normal");p.setFontSize(11);
      let y=m;
      f.split(/\n\s*\n/).forEach(par=>{
        const lines=p.splitTextToSize(par,W-2*m),h=lines.length*L;
        if(y+h>H-m){p.addPage();y=m;}
        lines.forEach(l=>{p.text(l,m,y);y+=L;});y+=L;
      });
      p.save('Annotations -- '+document.title+'.pdf');
    })();
  }catch(e){console.log("No annotations found")}
})();
