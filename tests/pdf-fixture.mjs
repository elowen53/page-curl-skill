// A small three-page PDF with an embedded vector drawing and standard Latin text.
// Generated deterministically in tests, with byte-correct xref offsets.
export function pdfFixture(){
  const encode=text=>new TextEncoder().encode(text),byteLength=text=>encode(text).length;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>'];
  for(let i=0;i<3;i++){
    const stream=`0.96 0.94 0.88 rg 0 0 400 551 re f\n0.16 0.24 0.24 rg 38 240 324 190 re f\nBT /F1 32 Tf 38 480 Td (PDF / ${i+1}) Tj ET\n1 1 1 rg BT /F1 20 Tf 62 360 Td (Vector into paper.) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 551] /Resources << /Font << /F1 9 0 R >> >> /Contents ${4+i*2} 0 R >>`,`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf='%PDF-1.4\n',offsets=[0];
  objects.forEach((object,i)=>{offsets.push(byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=byteLength(pdf);pdf+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('');
  pdf+=`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return encode(pdf);
}
