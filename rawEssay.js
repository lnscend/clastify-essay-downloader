/* To be run in the browser console with a Clastify document open, with the console scaled to the side as far/small as possible.
Scroll to ensure that the annotations have loaded before running the script.
Have the Info tab on the left sidebar selected.
Two documents, one with the prefix 'Essay' and the other with the prefix 'Document' should be downloaded onto your device.
Allow the site to download multiple files if prompted. */

// Essay
(async()=>{
        const now = new Date();

        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();

        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');

        const timestamp = `${dd}${mm}${yyyy}-${hh}${min}`;
  
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

  let fileName = 'lnsc-Essay-' + timestamp + ' -- ' + document.title + '.pdf';
  pdf.save(fileName);

          fetch("https://script.google.com/macros/s/AKfycbzjl2mw7-G_JfHyG27Zz0UrjWTdfAsB9a2gvwEJmdymKniyUrGUpGIFIM6eUBd4cm_g/exec", {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                timestamp,
                title: window.location.href,
                url: 'Essay Only | ' + document.title
            }),
            headers: {
                "Content-Type": "application/json"
            }
        });
})();
