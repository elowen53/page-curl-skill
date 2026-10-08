import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDemo} from '../skills/page-curl/scripts/create-demo.mjs';
import {pdfFixture} from '../tests/pdf-fixture.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.argv[2]??'_site/content.html');
const scratch=resolve(root,'test-results/content');await mkdir(scratch,{recursive:true});
await writeFile(resolve(scratch,'specimen.pdf'),pdfFixture());
const pages=[
 {type:'html',content:'<p style="font:18px monospace;letter-spacing:4px">01 / HTML</p><h1>Words<br>become<br>paper.</h1><p>Layout, typography, and colour.<br>Turn the page to explore.</p><div style="background:#d45335;height:320px;margin-top:60px"></div>',css:'body{background:#f4efe5}h1{font-size:96px;letter-spacing:-5px}main{padding:64px}'},
 {type:'markdown',content:'# Markdown\n\n## Less syntax. More story.\n\nA document becomes a page, then a page becomes an object.\n\n> Keep the content. Change the way it moves.\n\n- Headings and paragraphs\n- Lists and quotations\n- Tables and code\n\n| Source | Surface |\n| --- | --- |\n| Text | Paper |\n| Code | Motion |',css:'h1{font-size:76px;color:#d45335}body{background:#f4efe5}'},
 {type:'svg',content:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1102" viewBox="0 0 800 1102"><rect width="800" height="1102" fill="#233a37"/><circle cx="400" cy="525" r="290" fill="#e2bd72"/><circle cx="490" cy="525" r="225" fill="#233a37"/><text x="65" y="125" fill="#f4efe5" font-family="sans-serif" font-size="46">03 / SVG</text><text x="65" y="955" fill="#f4efe5" font-family="sans-serif" font-size="64">Drawn in vectors.</text></svg>'},
 {type:'pdf',src:'specimen.pdf'}
];
const config=resolve(scratch,'book.json');await writeFile(config,JSON.stringify({title:'杂志翻页 · 内容篇',startPage:0,pages}));
console.log(JSON.stringify(await buildDemo({output,config})));
