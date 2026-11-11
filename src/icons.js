const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for (const s of [180,192,512]) {
 const pg=await b.newPage({viewport:{width:s,height:s}});
 const cell=s*0.62/3, off=s*0.19, fs=cell*0.62;
 let cells='';
 const digits=[5,'',3,'',7,'',9,'',1];
 digits.forEach((d,i)=>{const x=off+(i%3)*cell, y=off+Math.floor(i/3)*cell;
   const hl=i===4;
   cells+=`<div style="position:absolute;left:${x}px;top:${y}px;width:${cell}px;height:${cell}px;display:grid;place-items:center;font:700 ${fs}px Arial,sans-serif;color:${hl?'#fff':'#1b2131'};background:${hl?'#1d5fe0':'transparent'};border:${Math.max(1,s/120)}px solid #c9cddb;box-sizing:border-box">${d}</div>`;});
 await pg.setContent(`<body style="margin:0"><div style="position:relative;width:${s}px;height:${s}px;background:#5b3fd1">
 <div style="position:absolute;left:${off-s*0.02}px;top:${off-s*0.02}px;width:${s*0.66}px;height:${s*0.66}px;background:#fff;border-radius:${s*0.05}px"></div>${cells}</div></body>`);
 await pg.screenshot({path:`/mnt/project-files/sudoku/app/icon-${s}.png`});
}
await b.close();})();
