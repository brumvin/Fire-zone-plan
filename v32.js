// V32 - doors, labels and fire-plan markers.
(function(){
  const anchor=$('roomApprovedV25');
  if(!anchor)return;

  const css=document.createElement('style');
  css.textContent=`
  .reviewStage{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px}
  .reviewDock{border:2px solid #dfe7ea;border-radius:12px;padding:10px;background:#fbfcfc;align-self:start;overflow:hidden}
  .reviewDock .controls{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .reviewDock button,.reviewDock input{width:100%;min-width:0}
  .doorHit32{stroke:transparent;stroke-width:30;fill:none;cursor:grab}
  .doorCore32{stroke:#102f3f;stroke-width:5;fill:none}
  .door32.review .doorCore32{stroke:#b87800;stroke-dasharray:7 5}
  .door32.selected .doorCore32{stroke:#ed6a32;stroke-width:8;stroke-dasharray:none}
  .label32 text{font-size:14px;font-weight:800;paint-order:stroke;stroke:#fff;stroke-width:4px}
  .label32{cursor:move}.label32.selected text{fill:#ed6a32}
  .marker32{cursor:move}.marker32.selected circle{stroke:#ed6a32;stroke-width:5}
  .itemRow32{display:grid;grid-template-columns:1fr 82px;gap:7px;margin:6px 0;align-items:center}
  @media(max-width:900px){.reviewStage{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  const card=document.createElement('section');
  card.id='doorLabelCard32';card.className='card hidden';
  card.innerHTML=`
  <h2>8. Doors, labels and markers</h2>
  <div class="tip"><b>Review stage.</b> Door suggestions come from wall gaps and must be checked by the engineer. Labels and markers can be moved independently.</div>
  <div class="reviewStage">
    <div>
      <div class="canvasWrap"><svg id="reviewPlan32" viewBox="0 0 760 500"></svg></div>
      <div id="reviewStatus32" class="status">Approve rooms to start.</div>
    </div>
    <div class="reviewDock">
      <h4>Selected item</h4>
      <div id="selected32" class="status">Nothing selected.</div>
      <div id="labelTools32" class="hidden">
        <label class="small">Room name</label><input id="labelName32">
        <div class="controls"><button id="centreLabel32">Centre label</button></div>
      </div>
      <div id="doorTools32" class="hidden">
        <div class="controls">
          <button id="flipDoor32">Flip swing</button>
          <button id="typeDoor32">Single ↔ Double</button>
          <button id="verifyDoor32">✓ Confirm door</button>
          <button id="deleteDoor32" class="danger">Delete door</button>
        </div>
      </div>
      <div id="markerTools32" class="hidden">
        <div class="controls"><button id="deleteMarker32" class="danger">Delete marker</button></div>
      </div>
      <hr>
      <h4>Add items</h4>
      <div class="controls">
        <button data-add32="door1">+ Single door</button>
        <button data-add32="door2">+ Double door</button>
        <button data-add32="entrance">+ Main entrance</button>
        <button data-add32="exit">+ Fire exit</button>
        <button data-add32="facp">+ FACP</button>
        <button data-add32="mcp">+ MCP</button>
        <button data-add32="here">+ You Are Here</button>
        <button id="detectDoors32">Re-detect doors</button>
      </div>
      <hr>
      <h4>Door review</h4><div id="doorList32"></div>
    </div>
  </div>
  <div class="actions" style="margin-top:10px"><button id="approveDoors32" class="green">Approve doors & labels</button></div>`;
  anchor.insertAdjacentElement('afterend',card);

  const done=document.createElement('section');
  done.id='doorApproved32';done.className='card hidden';
  done.innerHTML='<h2>9. Doors and labels approved</h2><div class="tip"><b>Next:</b> assign fire alarm Zones 1–9 to approved rooms and produce the final zone-plan layout.</div><div id="doorApprovedSummary32" class="status"></div>';
  card.insertAdjacentElement('afterend',done);

  let rooms=[],doors=[],markers=[],selected=null,drag=null,armed='';

  const clone=x=>JSON.parse(JSON.stringify(x));
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function rb(r){
    if(r.manualRect)return [r.manualRect.x,r.manualRect.y,r.manualRect.x+r.manualRect.w,r.manualRect.y+r.manualRect.h];
    if(!r.cells||!r.cells.length)return [r.lx-40,r.ly-30,r.lx+40,r.ly+30];
    return [Math.min(...r.cells.map(c=>c.x1)),Math.min(...r.cells.map(c=>c.y1)),Math.max(...r.cells.map(c=>c.x2)),Math.max(...r.cells.map(c=>c.y2))];
  }
  function env(){
    const xs=walls.flatMap(w=>[w.x1,w.x2]),ys=walls.flatMap(w=>[w.y1,w.y2]);
    return xs.length?{l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...ys),b:Math.max(...ys)}:{l:0,r:760,t:0,b:500};
  }
  function nearestWall(x,y){
    let best=null;
    for(const w of walls){
      const dx=w.x2-w.x1,dy=w.y2-w.y1,L=dx*dx+dy*dy||1;
      const t=Math.max(0,Math.min(1,((x-w.x1)*dx+(y-w.y1)*dy)/L));
      const qx=w.x1+t*dx,qy=w.y1+t*dy,d=Math.hypot(x-qx,y-qy);
      if(!best||d<best.d)best={x:qx,y:qy,d,axis:w.axis};
    }
    return best;
  }
  function detectDoors(){
    const e=env(),out=[];
    for(const axis of ['H','V']){
      const groups=[];
      for(const w of walls.filter(q=>q.axis===axis)){
        const c=axis==='H'?w.y1:w.x1;
        let g=groups.find(q=>Math.abs(q.c-c)<=7);
        if(!g){g={c,spans:[]};groups.push(g)}
        g.spans.push(axis==='H'?[Math.min(w.x1,w.x2),Math.max(w.x1,w.x2)]:[Math.min(w.y1,w.y2),Math.max(w.y1,w.y2)]);
      }
      for(const g of groups){
        const spans=g.spans.sort((a,b)=>a[0]-b[0]);
        for(let i=0;i<spans.length-1;i++){
          const a=spans[i],b=spans[i+1],gap=b[0]-a[1];
          if(gap<18||gap>62)continue;
          const pos=(a[1]+b[0])/2,x=axis==='H'?pos:g.c,y=axis==='H'?g.c:pos;
          if(x<e.l+8||x>e.r-8||y<e.t+8||y>e.b-8)continue;
          if(out.some(d=>Math.hypot(d.x-x,d.y-y)<24))continue;
          out.push({type:'door1',x:snap(x),y:snap(y),axis,flip:false,status:'review'});
        }
      }
    }
    doors=out;render();
  }
  function doorSvg(d,i){
    const sel=selected?.kind==='door'&&selected.i===i,w=d.type==='door2'?34:25,rot=d.axis==='V'?90:0,sy=d.flip?-1:1;
    const swing=d.type==='door2'
      ?'<path d="M-34 0 A34 34 0 0 1 0 34 M34 0 A34 34 0 0 0 0 34" stroke="#1769aa" stroke-width="3" fill="none"/>'
      :'<path d="M-25 0 A50 50 0 0 1 25 50" stroke="#1769aa" stroke-width="3" fill="none"/>';
    return '<g class="door32 '+(d.status==='review'?'review ':'')+(sel?'selected':'')+'" data-door32="'+i+'" transform="translate('+d.x+' '+d.y+') rotate('+rot+') scale(1 '+sy+')"><line class="doorHit32" x1="-45" y1="0" x2="45" y2="0"/><line class="doorCore32" x1="-'+w+'" y1="0" x2="'+w+'" y2="0"/>'+swing+'</g>';
  }
  function markerSvg(m,i){
    const sel=selected?.kind==='marker'&&selected.i===i;
    if(m.type==='entrance'||m.type==='exit'){
      const label=m.type==='entrance'?'MAIN ENTRANCE':'FIRE EXIT';
      return '<g class="marker32 '+(sel?'selected':'')+'" data-marker32="'+i+'" transform="translate('+m.x+' '+m.y+')"><circle r="17" fill="transparent"/><text text-anchor="middle" y="-8" font-size="12" font-weight="800">'+label+'</text><path d="M0 0v20m0 0l-6-8m6 8l6-8" stroke="#102f3f" stroke-width="2" fill="none"/></g>';
    }
    const label=m.type==='facp'?'FACP':m.type==='mcp'?'MCP':'YOU ARE HERE';
    return '<g class="marker32 '+(sel?'selected':'')+'" data-marker32="'+i+'" transform="translate('+m.x+' '+m.y+')"><circle r="15" fill="'+(m.type==='here'?'#1769aa':'#c83d3d')+'" stroke="#fff" stroke-width="2"/><text x="22" y="5" font-size="12" font-weight="800">'+label+'</text></g>';
  }
  function render(){
    let s='<rect width="760" height="500" fill="white"/>';
    rooms.forEach(r=>{
      if(r.manualRect){
        const b=rb(r);s+='<rect x="'+b[0]+'" y="'+b[1]+'" width="'+(b[2]-b[0])+'" height="'+(b[3]-b[1])+'" fill="#dcecf7" fill-opacity=".28"/>';
      } else for(const c of (r.cells||[]))s+='<rect x="'+c.x1+'" y="'+c.y1+'" width="'+(c.x2-c.x1)+'" height="'+(c.y2-c.y1)+'" fill="#dcecf7" fill-opacity=".28"/>';
    });
    walls.forEach(w=>s+='<line class="wallLine" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>');
    doors.forEach((d,i)=>s+=doorSvg(d,i));
    markers.forEach((m,i)=>s+=markerSvg(m,i));
    rooms.forEach((r,i)=>{
      const sel=selected?.kind==='label'&&selected.i===i;
      s+='<g class="label32 '+(sel?'selected':'')+'" data-label32="'+i+'" transform="translate('+r.lx+' '+r.ly+')"><rect class="roomHit" x="-65" y="-20" width="130" height="40"/><text text-anchor="middle">'+esc(r.name)+'</text></g>';
    });
    $('reviewPlan32').innerHTML=s;
    $('doorList32').innerHTML=doors.map((d,i)=>'<div class="itemRow32"><span>'+(d.type==='door2'?'Double':'Single')+' door · '+(d.status==='verified'?'confirmed':'review')+'</span><button onclick="window.selectDoor32('+i+')">Select</button></div>').join('');
    updateTools();
  }
  function updateTools(){
    ['labelTools32','doorTools32','markerTools32'].forEach(id=>$(id).classList.add('hidden'));
    if(!selected){$('selected32').textContent='Nothing selected.';return}
    if(selected.kind==='label'){
      const r=rooms[selected.i];$('selected32').textContent='Room label: '+r.name;$('labelTools32').classList.remove('hidden');$('labelName32').value=r.name;
    }else if(selected.kind==='door'){
      const d=doors[selected.i];$('selected32').textContent=(d.type==='door2'?'Double':'Single')+' door · '+(d.status==='verified'?'ENGINEER CONFIRMED':'REVIEW');$('doorTools32').classList.remove('hidden');
    }else{
      $('selected32').textContent='Marker: '+markers[selected.i].type.toUpperCase();$('markerTools32').classList.remove('hidden');
    }
  }
  function startStage(){
    if(!window.fireZoneRoomModel)return;
    rooms=window.fireZoneRoomModel.getRooms();
    selected=null;markers=[];armed='';
    detectDoors();
    $('doorLabelCard32').classList.remove('hidden');
    $('reviewStatus32').textContent=doors.length+' door suggestion'+(doors.length===1?'':'s')+' found from wall gaps. Review, move, confirm or delete each one.';
    $('doorLabelCard32').scrollIntoView({behavior:'smooth'});
  }
  window.addEventListener('firezone:rooms-approved',startStage);
  window.selectDoor32=i=>{selected={kind:'door',i};render()};

  $('labelName32').oninput=e=>{if(selected?.kind!=='label')return;rooms[selected.i].name=e.target.value;render()};
  $('centreLabel32').onclick=()=>{if(selected?.kind!=='label')return;const r=rooms[selected.i],b=rb(r);r.lx=(b[0]+b[2])/2;r.ly=(b[1]+b[3])/2;render()};
  $('flipDoor32').onclick=()=>{if(selected?.kind!=='door')return;doors[selected.i].flip=!doors[selected.i].flip;doors[selected.i].status='edited';render()};
  $('typeDoor32').onclick=()=>{if(selected?.kind!=='door')return;doors[selected.i].type=doors[selected.i].type==='door1'?'door2':'door1';doors[selected.i].status='edited';render()};
  $('verifyDoor32').onclick=()=>{if(selected?.kind!=='door')return;doors[selected.i].status='verified';render()};
  $('deleteDoor32').onclick=()=>{if(selected?.kind!=='door')return;doors.splice(selected.i,1);selected=null;render()};
  $('deleteMarker32').onclick=()=>{if(selected?.kind!=='marker')return;markers.splice(selected.i,1);selected=null;render()};
  $('detectDoors32').onclick=detectDoors;
  document.querySelectorAll('[data-add32]').forEach(b=>b.onclick=()=>{armed=b.dataset.add32;selected=null;$('reviewStatus32').textContent='Tap the plan to place '+armed+'.';render()});

  function pnt(e){
    const svg=$('reviewPlan32'),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  $('reviewPlan32').addEventListener('pointerdown',e=>{
    e.preventDefault();const p=pnt(e),lab=e.target.closest('[data-label32]'),door=e.target.closest('[data-door32]'),mark=e.target.closest('[data-marker32]');
    if(armed){
      if(armed.startsWith('door')){
        const w=nearestWall(p.x,p.y),d={type:armed,x:snap(p.x),y:snap(p.y),axis:'H',flip:false,status:'edited'};
        if(w&&w.d<45){d.x=snap(w.x);d.y=snap(w.y);d.axis=w.axis}
        doors.push(d);selected={kind:'door',i:doors.length-1};
      }else{
        markers.push({type:armed,x:snap(p.x),y:snap(p.y)});selected={kind:'marker',i:markers.length-1};
      }
      armed='';render();return;
    }
    if(lab){const i=+lab.dataset.label32,r=rooms[i];selected={kind:'label',i};drag={kind:'label',i,id:e.pointerId,p,x:r.lx,y:r.ly};}
    else if(door){const i=+door.dataset.door32,d=doors[i];selected={kind:'door',i};drag={kind:'door',i,id:e.pointerId,p,x:d.x,y:d.y};}
    else if(mark){const i=+mark.dataset.marker32,m=markers[i];selected={kind:'marker',i};drag={kind:'marker',i,id:e.pointerId,p,x:m.x,y:m.y};}
    if(drag)$('reviewPlan32').setPointerCapture?.(e.pointerId);
    render();
  });
  $('reviewPlan32').addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const p=pnt(e);
    if(drag.kind==='label'){
      const r=rooms[drag.i];r.lx=snap(drag.x+p.x-drag.p.x);r.ly=snap(drag.y+p.y-drag.p.y);
    }else if(drag.kind==='door'){
      const d=doors[drag.i],nx=drag.x+p.x-drag.p.x,ny=drag.y+p.y-drag.p.y,w=nearestWall(nx,ny);
      if(w&&w.d<45){d.x=snap(w.x);d.y=snap(w.y);d.axis=w.axis}else{d.x=snap(nx);d.y=snap(ny)}
      d.status='edited';
    }else{
      const m=markers[drag.i];m.x=snap(drag.x+p.x-drag.p.x);m.y=snap(drag.y+p.y-drag.p.y);
    }
    render();
  });
  function endDrag(e){if(drag&&drag.id===e.pointerId){try{$('reviewPlan32').releasePointerCapture?.(e.pointerId)}catch{}drag=null}}
  $('reviewPlan32').addEventListener('pointerup',endDrag);$('reviewPlan32').addEventListener('pointercancel',endDrag);

  $('approveDoors32').onclick=()=>{
    const unconfirmed=doors.filter(d=>d.status==='review').length;
    if(unconfirmed){$('reviewStatus32').textContent=unconfirmed+' door suggestion'+(unconfirmed===1?' still needs':'s still need')+' confirmation or deletion.';return}
    window.fireZoneDoorLabelModel={rooms:clone(rooms),doors:clone(doors),markers:clone(markers)};
    $('doorApproved32').classList.remove('hidden');
    $('doorApprovedSummary32').textContent='Approved: '+rooms.length+' rooms, '+doors.length+' doors and '+markers.length+' markers. Ready for fire-zone assignment.';
    window.dispatchEvent(new CustomEvent('firezone:doors-approved',{detail:clone(window.fireZoneDoorLabelModel)}));
    $('doorApproved32').scrollIntoView({behavior:'smooth'});
  };
})();