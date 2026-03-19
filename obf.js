/* To be run in the browser console with a Clastify document open, with the console scaled to the side as far/small as possible.
Scroll to ensure that the annotations have loaded before running the script.
Two documents, one with the prefix 'Essay' and the other with the prefix 'Document' should be downloaded onto your device.
Allow the site to download multiple files if prompted. */

// Essay
(async()=>{
  const c=[...document.querySelectorAll('.react-pdf__Document canvas.react-pdf__Page__canvas')];
  if(!c.length){console.log("No canvases found");return;}
  const s=document.createElement("script");
  s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  document.head.appendChild(s);
  await new Promise(r=>s.onload=r);
  const {jsPDF}=window.jspdf,p=new jsPDF();
  c.forEach((x,i)=>{
    const img=x.toDataURL("image/png"),w=p.internal.pageSize.getWidth(),h=(x.height*w)/x.width;
    if(i>0)p.addPage();
    p.addImage(img,"PNG",0,0,w,h);
  });
  p.save('Essay -- '+document.title+'.pdf');
})();

// Annotations
(()=>{
  try{
    const ann=document.querySelector('.react-pdf__Document canvas.annotation-canvas').annotations;
    if(!ann)throw 0;
    const f=[...new Set(ann.map(a=>`Page ${a.rectCoords[0].pageNumber} | ${a.criterion}\n${a.subCriterion}. ${a.comment}`))].join('\n\n');
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
