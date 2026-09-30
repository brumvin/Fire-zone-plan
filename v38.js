// V39 - staircase-aware, colour-safe one-page A4/A3 printing.
(function(){
  const zoneColours={1:'#f4b4b4',2:'#b8d9ff',3:'#bde5c5',4:'#ffe699',5:'#f6c28b',6:'#d8c2f0',7:'#bce8e6',8:'#e2c1a6',9:'#d8dde3'};
  let model=null;

  const css=document.createElement('style');
  css.textContent=`
  .zoneStage35{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px}
  .zoneDock35{border:2px solid #dfe7ea;border-radius:12px;padding:10px;background:#fbfcfc;align-self:start;overflow:hidden}
  .zoneDock35 .controls{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px}
  .zoneRow35{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:8px;align-items:center;margin:6px 0}
  .zoneSwatch35{display:inline-block;width:20px;height:15px;border:1px solid #5b6b72;border-radius:3px;margin-right:6px;vertical-align:middle}
  .zoneBadge35{display:inline-flex;align-items:center;justify-content:center;min-width:70px;padding:5px 9px;border:1px solid #5b6b72;border-radius:7px;font-weight:800;color:#102f3f}
  .finalSheet35{background:white;border:3px solid #102f3f;padding:14px}
  .finalHeader35{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
  .finalMeta35{font-size:13px;text-align:right}
  .finalGrid35{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:12px;align-items:start}
  .finalPlanWrap35 svg{display:block;width:100%;height:auto;max-height:620px}
  .finalSide35{min-width:0}
  .legend35{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 10px}
  .legendItem35{border:1px solid #ccd5d9;border-radius:8px;padding:5px 8px;font-weight:800}
  .finalSchedule35{width:100%;border-collapse:collapse;font-size:12px}
  .finalSchedule35 th,.finalSchedule35 td{border:1px solid #ccd5d9;padding:5px;vertical-align:top}
  .printControls35{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
  @media(max-width:900px){.zoneStage35,.finalGrid35{grid-template-columns:1fr}}
  @media print{
    html,body{margin:0!important;padding:0!important;background:#fff!important;width:100%!important;height:auto!important;overflow:hidden!important}
    header,main>section:not(#finalCard35){display:none!important}
    main{display:block!important;max-width:none!important;width:100%!important;margin:0!important;padding:0!important}
    #finalCard35{display:block!important;position:static!important;width:100%!important;height:auto!important;margin:0!important;padding:0!important;box-shadow:none!important;overflow:hidden!important}
    #finalCard35>h2,.printControls35{display:none!important}
    #finalCard35,#finalCard35 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    .finalSheet35{box-sizing:border-box!important;overflow:hidden!important;page-break-inside:avoid!important;break-inside:avoid!important;page-break-after:avoid!important;break-after:avoid-page!important;margin:0!important}
    .finalPlanWrap35{min-height:0!important;overflow:hidden!important}
    .finalPlanWrap35 svg{display:block!important;width:100%!important;height:auto!important;max-height:100%!important}
    .finalSide35{overflow:hidden!important}
    .footerNote{font-size:8.5px!important;margin:3px 0 0!important}
    body.printA4Landscape35 .finalSheet35{width:274mm!important;height:186mm!important;padding:6mm!important}
    body.printA4Landscape35 .finalGrid35{grid-template-columns:minmax(0,1fr) 72mm!important;gap:5mm!important}
    body.printA4Landscape35 .finalPlanWrap35 svg{max-height:138mm!important}
    body.printA4Landscape35 .finalHeader35{margin-bottom:3mm!important}
    body.printA4Landscape35 .finalSchedule35{font-size:9.5px!important}

    body.printA4Portrait35 .finalSheet35{width:186mm!important;height:274mm!important;padding:6mm!important}
    body.printA4Portrait35 .finalGrid35{grid-template-columns:1fr!important;gap:3mm!important}
    body.printA4Portrait35 .finalPlanWrap35 svg{max-height:154mm!important}
    body.printA4Portrait35 .finalSide35{display:grid!important;grid-template-columns:1fr 1.25fr!important;gap:4mm!important}
    body.printA4Portrait35 .finalSchedule35{font-size:9.5px!important}

    body.printA3Landscape35 .finalSheet35{width:396mm!important;height:274mm!important;padding:8mm!important}
    body.printA3Landscape35 .finalGrid35{grid-template-columns:minmax(0,1fr) 95mm!important;gap:7mm!important}
    body.printA3Landscape35 .finalPlanWrap35 svg{max-height:210mm!important}
    body.printA3Landscape35 .finalHeader35{margin-bottom:4mm!important}
    body.printA3Landscape35 .finalMeta35{font-size:15px!important}
    body.printA3Landscape35 .legendItem35{font-size:14px!important;padding:7px 10px!important}
    body.printA3Landscape35 .finalSchedule35{font-size:12px!important}

    body.printA3Portrait35 .finalSheet35{width:274mm!important;height:396mm!important;padding:8mm!important}
    body.printA3Portrait35 .finalGrid35{grid-template-columns:1fr!important;gap:5mm!important}
    body.printA3Portrait35 .finalPlanWrap35 svg{max-height:232mm!important}
    body.printA3Portrait35 .finalSide35{display:grid!important;grid-template-columns:1fr 1.35fr!important;gap:6mm!important}
    body.printA3Portrait35 .finalMeta35{font-size:15px!important}
    body.printA3Portrait35 .legendItem35{font-size:14px!important;padding:7px 10px!important}
    body.printA3Portrait35 .finalSchedule35{font-size:12px!important}
  }`;
  document.head.appendChild(css);

  const anchor=$('doorApproved32');
  if(!anchor)return;

  const card=document.createElement('section');
  card.id='zoneCard35';card.className='card hidden';
  card.innerHTML=`
    <h2>10. Fire alarm zones</h2>
    <div class="tip"><b>Engineer-controlled zoning.</b> The app does not choose fire alarm zones. Assign Zone 1–9 to each approved room/area and review the coloured plan.</div>
    <div class="zoneStage35">
      <div><div class="canvasWrap"><svg id="zonePlan35" viewBox="0 0 760 500"></svg></div><div id="zoneStatus35" class="status">Approve doors and labels to start zoning.</div></div>
      <div class="zoneDock35"><h4>Assign zones</h4><div id="zoneRows35"></div><hr><div class="controls"><button id="allZone1_35">Set all to Zone 1</button><button id="buildFinal35" class="green">Build final plan</button></div></div>
    </div>`;
  anchor.insertAdjacentElement('afterend',card);

  const finalCard=document.createElement('section');
  finalCard.id='finalCard35';finalCard.className='card hidden';
  finalCard.innerHTML='<h2>11. Final fire alarm zone plan</h2><div id="finalOutput35"></div><div class="printControls35"><button id="printA4Landscape35" class="navy">A4 Landscape</button><button id="printA4Portrait35">A4 Portrait</button><button id="printA3Landscape35" class="navy">A3 Landscape</button><button id="printA3Portrait35">A3 Portrait</button></div>';
  card.insertAdjacentElement('afterend',finalCard);

  function rb(r){
    if(r.manualRect)return [r.manualRect.x,r.manualRect.y,r.manualRect.x+r.manualRect.w,r.manualRect.y+r.manualRect.h];
    if(!r.cells||!r.cells.length)return [r.lx-40,r.ly-30,r.lx+40,r.ly+30];
    return [Math.min(...r.cells.map(c=>c.x1)),Math.min(...r.cells.map(c=>c.y1)),Math.max(...r.cells.map(c=>c.x2)),Math.max(...r.cells.map(c=>c.y2))];
  }
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function doorSvg(d){
    const sz=d.size||1,w=(d.type==='door2'?34:25)*sz,rot=d.axis==='V'?90:0,sy=d.flip?-1:1,sx=d.hand?-1:1;
    const swing=d.type==='door2'
      ?'<path d="M-'+(34*sz)+' 0 A'+(34*sz)+' '+(34*sz)+' 0 0 1 0 '+(34*sz)+' M'+(34*sz)+' 0 A'+(34*sz)+' '+(34*sz)+' 0 0 0 0 '+(34*sz)+'" stroke="#1769aa" stroke-width="3" fill="none"/>'
      :'<path d="M-'+(25*sz)+' 0 A'+(50*sz)+' '+(50*sz)+' 0 0 1 '+(25*sz)+' '+(50*sz)+'" stroke="#1769aa" stroke-width="3" fill="none"/>';
    return '<g transform="translate('+d.x+' '+d.y+') rotate('+rot+') scale('+sx+' '+sy+')"><line x1="-'+w+'" y1="0" x2="'+w+'" y2="0" stroke="#102f3f" stroke-width="5"/>'+swing+'</g>';
  }
  function markerSvg(m){
    m.rot=m.rot||0;m.tx=m.tx??22;m.ty=m.ty??5;m.size=m.size||1;
    if(m.type==='stairs'){
      const sc=m.size;let steps='';
      for(let n=0;n<6;n++){const yy=-24+n*9;steps+='<line x1="-22" y1="'+yy+'" x2="22" y2="'+yy+'" stroke="#102f3f" stroke-width="2"/>'}
      return '<g transform="translate('+m.x+' '+m.y+') rotate('+m.rot+') scale('+sc+')"><rect x="-24" y="-28" width="48" height="58" fill="white" fill-opacity=".72" stroke="#102f3f" stroke-width="2"/>'+steps+'<path d="M0 22V-18m0 0l-6 8m6-8l6 8" stroke="#1769aa" stroke-width="2.5" fill="none"/></g>';
    }
    if(m.type==='entrance'||m.type==='exit'){
      const label=m.type==='entrance'?'MAIN ENTRANCE':'FIRE EXIT';
      return '<g transform="translate('+m.x+' '+m.y+')"><text text-anchor="middle" y="-10" font-size="12" font-weight="800">'+label+'</text><g transform="rotate('+m.rot+') scale('+m.size+')"><path d="M0 0v20m0 0l-6-8m6 8l6-8" stroke="#102f3f" stroke-width="2" fill="none"/></g></g>';
    }
    const label=m.type==='facp'?'FACP':m.type==='mcp'?'MCP':'YOU ARE HERE';
    return '<g transform="translate('+m.x+' '+m.y+')"><circle r="'+(15*m.size)+'" fill="'+(m.type==='here'?'#1769aa':'#c83d3d')+'" stroke="#fff" stroke-width="2"/><text x="'+m.tx+'" y="'+m.ty+'" font-size="12" font-weight="800" style="paint-order:stroke;stroke:#fff;stroke-width:4px">'+label+'</text></g>';
  }

  function planSvg(){
    if(!model)return '';
    let s='<rect width="760" height="500" fill="white"/>';
    model.rooms.forEach(r=>{
      const fill=zoneColours[r.zone||1]||'#eee';
      if(r.manualRect){const b=rb(r);s+='<rect x="'+b[0]+'" y="'+b[1]+'" width="'+(b[2]-b[0])+'" height="'+(b[3]-b[1])+'" fill="'+fill+'" fill-opacity=".62"/>'}
      else for(const c of (r.cells||[]))s+='<rect x="'+c.x1+'" y="'+c.y1+'" width="'+(c.x2-c.x1)+'" height="'+(c.y2-c.y1)+'" fill="'+fill+'" fill-opacity=".62"/>';
    });
    walls.forEach(w=>s+='<line x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'" stroke="#102f3f" stroke-width="5"/>');
    model.doors.forEach(d=>s+=doorSvg(d));
    model.markers.forEach(m=>s+=markerSvg(m));
    model.rooms.forEach(r=>s+='<text x="'+r.lx+'" y="'+r.ly+'" text-anchor="middle" font-size="14" font-weight="800" style="paint-order:stroke;stroke:#fff;stroke-width:4px">'+esc(r.name)+'</text>');
    return '<svg viewBox="0 0 760 500" style="width:100%;height:auto">'+s+'</svg>';
  }
  function render(){
    if(!model)return;
    $('zonePlan35').innerHTML=planSvg().replace(/^<svg[^>]*>|<\/svg>$/g,'');
    $('zoneRows35').innerHTML=model.rooms.map((r,i)=>'<div class="zoneRow35"><div><span class="zoneSwatch35" style="background:'+zoneColours[r.zone||1]+'"></span><b>'+esc(r.name)+'</b></div><select onchange="window.setZone35('+i+',this.value)">'+[1,2,3,4,5,6,7,8,9].map(z=>'<option value="'+z+'" '+((r.zone||1)===z?'selected':'')+'>Zone '+z+'</option>').join('')+'</select></div>').join('');
    $('zoneStatus35').textContent=model.rooms.length+' approved areas ready for engineer zone assignment.';
  }
  window.setZone35=(i,z)=>{model.rooms[i].zone=+z;render()};

  window.addEventListener('firezone:doors-approved',e=>{
    model=JSON.parse(JSON.stringify(e.detail));
    model.rooms.forEach(r=>r.zone=r.zone||1);
    $('zoneCard35').classList.remove('hidden');render();$('zoneCard35').scrollIntoView({behavior:'smooth'});
  });

  $('allZone1_35').onclick=()=>{if(!model)return;model.rooms.forEach(r=>r.zone=1);render()};
  $('buildFinal35').onclick=()=>{
    if(!model)return;
    const used=[...new Set(model.rooms.map(r=>r.zone||1))].sort((a,b)=>a-b);
    const zoneChip=z=>'<svg width="74" height="26" viewBox="0 0 74 26" role="img" aria-label="Zone '+z+'"><rect x="1" y="1" width="72" height="24" rx="5" fill="'+zoneColours[z]+'" stroke="#5b6b72"/><text x="37" y="17" text-anchor="middle" font-size="12" font-weight="800" fill="#102f3f">Zone '+z+'</text></svg>';
    const legend=used.map(z=>'<span class="legendItem35" style="padding:2px;background:#fff">'+zoneChip(z)+'</span>').join('');
    const schedule=used.map(z=>'<tr><td>'+zoneChip(z)+'</td><td>'+model.rooms.filter(r=>(r.zone||1)===z).map(r=>esc(r.name)).join(', ')+'</td></tr>').join('');
    $('finalOutput35').innerHTML='<div class="finalSheet35"><div class="finalHeader35"><div><h2 style="margin:0">FIRE ALARM ZONE PLAN</h2><div>'+esc($('customer').value||'Customer')+' · '+esc($('site').value||'Site / Building')+' · '+esc($('floor').value||'Floor')+'</div></div><div class="finalMeta35">Engineer: '+esc($('engineer').value||'—')+'<br>Date: '+esc($('date').value||'—')+'</div></div><div class="finalGrid35"><div class="finalPlanWrap35">'+planSvg()+'</div><div class="finalSide35"><div class="legend35">'+legend+'</div><table class="finalSchedule35"><tr><th>Zone</th><th>Areas</th></tr>'+schedule+'</table></div></div><p class="footerNote">Final controlled issue requires competent-person verification of geometry, room labels, doors, markers and fire alarm zoning.</p></div>';
    $('finalCard35').classList.remove('hidden');$('finalCard35').scrollIntoView({behavior:'smooth'});
  };
  const printStyle=document.createElement('style');document.head.appendChild(printStyle);
  function printPlan35(paper,orientation){
    document.body.classList.remove('printA4Landscape35','printA4Portrait35','printA3Landscape35','printA3Portrait35');
    const cls='print'+paper+(orientation==='portrait'?'Portrait35':'Landscape35');
    document.body.classList.add(cls);
    printStyle.textContent='@page{size:'+paper+' '+orientation+';margin:5mm}';
    setTimeout(()=>window.print(),50);
  }
  $('printA4Landscape35').onclick=()=>printPlan35('A4','landscape');
  $('printA4Portrait35').onclick=()=>printPlan35('A4','portrait');
  $('printA3Landscape35').onclick=()=>printPlan35('A3','landscape');
  $('printA3Portrait35').onclick=()=>printPlan35('A3','portrait');
  window.addEventListener('afterprint',()=>document.body.classList.remove('printA4Landscape35','printA4Portrait35','printA3Landscape35','printA3Portrait35'));
})();