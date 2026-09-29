// V25 - room generation from approved orthogonal wall structure.
(function(){
  const ROOM_GAP=58;
  const ROOM_MIN_AREA=700;
  let roomsV25=[], roomSelected=new Set(), roomDrag=null, roomHistory=[];

  const style=document.createElement('style');
  style.textContent=`
    .roomStage{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:12px}
    .roomDock{border:2px solid #dfe7ea;border-radius:12px;padding:10px;background:#fbfcfc;align-self:start}
    .roomRow{display:grid;grid-template-columns:34px 1fr 82px;gap:7px;align-items:center;margin:6px 0}
    .roomRow input[type=text]{min-width:0}
    .roomCheck{width:22px;height:22px;min-height:auto}
    .roomFill{stroke:#7b8c94;stroke-width:1.2;fill-opacity:.28}
    .roomLabel text{font-weight:750;font-size:14px;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
    .roomLabel{cursor:move}
    .roomLabel.selected text{fill:#ed6a32}
    .roomHit{fill:transparent;stroke:transparent}
    @media(max-width:900px){.roomStage{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const approved=$('approvedCard');
  approved.querySelector('.tip').innerHTML='<b>Wall structure approved.</b> V25 now derives room areas from the approved wall graph. Small door-sized gaps are temporarily closed for room detection, while the actual wall drawing remains unchanged.';

  const roomCard=document.createElement('section');
  roomCard.id='roomCard';
  roomCard.className='card hidden';
  roomCard.innerHTML=`
    <h2>6. Generated rooms</h2>
    <div class="tip"><b>Rooms are derived from the walls.</b> Door-sized gaps are closed only for detection so adjoining rooms do not merge through door openings. The walls remain the master geometry.</div>
    <div class="roomStage">
      <div>
        <div class="canvasWrap"><svg id="roomPlan" viewBox="0 0 760 500" aria-label="Generated room areas"></svg></div>
        <div id="roomStatus" class="status">Approve the wall structure to generate rooms.</div>
      </div>
      <div class="roomDock">
        <h4>Room controls</h4>
        <div id="roomListV25"></div>
        <hr>
        <div class="controls">
          <button id="mergeRoomsBtn">Merge selected</button>
          <button id="splitRoomVBtn">Split vertical</button>
          <button id="splitRoomHBtn">Split horizontal</button>
          <button id="addRoomV25">+ Add area</button>
          <button id="undoRoomsV25">Undo rooms</button>
          <button id="rebuildRoomsV25">Rebuild from walls</button>
        </div>
      </div>
    </div>
    <div class="actions" style="margin-top:10px"><button id="approveRoomsV25" class="green">Approve rooms</button></div>
  `;
  approved.insertAdjacentElement('afterend',roomCard);

  const roomApproved=document.createElement('section');
  roomApproved.id='roomApprovedV25';
  roomApproved.className='card hidden';
  roomApproved.innerHTML='<h2>7. Rooms approved</h2><div class="tip"><b>Next:</b> add doors and room-name recognition/editing on top of this stable wall-and-room model. Fire alarm zones remain deliberately out of this stage.</div><div id="roomApprovedSummary" class="status"></div>';
  roomCard.insertAdjacentElement('afterend',roomApproved);

  function roomSave(){
    roomHistory.push(JSON.stringify(roomsV25));
    if(roomHistory.length>25)roomHistory.shift();
  }
  function roomUndo(){
    if(!roomHistory.length)return;
    roomsV25=JSON.parse(roomHistory.pop());
    roomSelected.clear();
    renderRooms();
  }

  function uniq(vals,tol=3){
    vals=vals.slice().sort((a,b)=>a-b);
    const out=[];
    for(const v of vals){
      if(!out.length||Math.abs(v-out[out.length-1])>tol)out.push(v);
      else out[out.length-1]=(out[out.length-1]+v)/2;
    }
    return out.map(v=>snap(v));
  }

  function envelope(){
    const hs=walls.filter(w=>w.axis==='H'),vs=walls.filter(w=>w.axis==='V');
    if(!hs.length||!vs.length)return null;
    const longH=hs.filter(w=>wallLength(w)>160),longV=vs.filter(w=>wallLength(w)>160);
    return {
      left:Math.min(...(longV.length?longV:vs).map(w=>w.x1)),
      right:Math.max(...(longV.length?longV:vs).map(w=>w.x1)),
      top:Math.min(...(longH.length?longH:hs).map(w=>w.y1)),
      bottom:Math.max(...(longH.length?longH:hs).map(w=>w.y1))
    };
  }

  function mergeAxis(lines,axis){
    const groups=[];
    for(const raw of lines.slice().sort((a,b)=>(axis==='H'?a.y1-b.y1:a.x1-b.x1))){
      const c=axis==='H'?raw.y1:raw.x1;
      let g=groups.find(q=>Math.abs(q.coord-c)<=7);
      if(!g){g={coord:c,spans:[]};groups.push(g)}
      g.spans.push(axis==='H'?[Math.min(raw.x1,raw.x2),Math.max(raw.x1,raw.x2)]:[Math.min(raw.y1,raw.y2),Math.max(raw.y1,raw.y2)]);
    }
    const out=[];
    for(const g of groups){
      const spans=g.spans.sort((a,b)=>a[0]-b[0]);
      let cur=[...spans[0]];
      for(let i=1;i<spans.length;i++){
        const s=spans[i],gap=s[0]-cur[1];
        if(gap<=ROOM_GAP)cur[1]=Math.max(cur[1],s[1]);
        else{
          out.push(axis==='H'?{x1:cur[0],y1:snap(g.coord),x2:cur[1],y2:snap(g.coord),axis:'H'}:{x1:snap(g.coord),y1:cur[0],x2:snap(g.coord),y2:cur[1],axis:'V'});
          cur=[...s];
        }
      }
      out.push(axis==='H'?{x1:cur[0],y1:snap(g.coord),x2:cur[1],y2:snap(g.coord),axis:'H'}:{x1:snap(g.coord),y1:cur[0],x2:snap(g.coord),y2:cur[1],axis:'V'});
    }
    return out;
  }

  function virtualWalls(){
    const env=envelope();
    if(!env)return [];
    let all=walls.map(w=>({...w}));
    all.push(
      {x1:env.left,y1:env.top,x2:env.right,y2:env.top,axis:'H'},
      {x1:env.left,y1:env.bottom,x2:env.right,y2:env.bottom,axis:'H'},
      {x1:env.left,y1:env.top,x2:env.left,y2:env.bottom,axis:'V'},
      {x1:env.right,y1:env.top,x2:env.right,y2:env.bottom,axis:'V'}
    );
    return mergeAxis(all.filter(w=>w.axis==='H'),'H').concat(mergeAxis(all.filter(w=>w.axis==='V'),'V'));
  }

  function coversBoundary(vwalls,axis,coord,a,b){
    const lo=Math.min(a,b),hi=Math.max(a,b),len=hi-lo;
    if(len<=0)return true;
    let covered=0;
    const spans=[];
    for(const w of vwalls){
      if(w.axis!==axis)continue;
      const c=axis==='V'?w.x1:w.y1;
      if(Math.abs(c-coord)>5)continue;
      const s=axis==='V'?[Math.min(w.y1,w.y2),Math.max(w.y1,w.y2)]:[Math.min(w.x1,w.x2),Math.max(w.x1,w.x2)];
      const x1=Math.max(lo,s[0]),x2=Math.min(hi,s[1]);
      if(x2>x1)spans.push([x1,x2]);
    }
    spans.sort((p,q)=>p[0]-q[0]);
    let cur=null;
    for(const s of spans){
      if(!cur)cur=[...s];
      else if(s[0]<=cur[1]+3)cur[1]=Math.max(cur[1],s[1]);
      else{covered+=cur[1]-cur[0];cur=[...s]}
    }
    if(cur)covered+=cur[1]-cur[0];
    return covered>=len*.72;
  }

  function inferRooms(){
    const env=envelope();
    if(!env)return [];
    const vw=virtualWalls();
    const xs=uniq([env.left,env.right,...vw.flatMap(w=>[w.x1,w.x2])]).filter(x=>x>=env.left-2&&x<=env.right+2);
    const ys=uniq([env.top,env.bottom,...vw.flatMap(w=>[w.y1,w.y2])]).filter(y=>y>=env.top-2&&y<=env.bottom+2);
    const cells=[],byKey=new Map();

    for(let yi=0;yi<ys.length-1;yi++)for(let xi=0;xi<xs.length-1;xi++){
      const x1=xs[xi],x2=xs[xi+1],y1=ys[yi],y2=ys[yi+1];
      if(x2-x1<7||y2-y1<7)continue;
      const c={xi,yi,x1,x2,y1,y2,area:(x2-x1)*(y2-y1)};
      const idx=cells.length;cells.push(c);byKey.set(xi+','+yi,idx);
    }

    const adj=Array.from({length:cells.length},()=>[]);
    for(let i=0;i<cells.length;i++){
      const c=cells[i];
      const right=byKey.get((c.xi+1)+','+c.yi);
      if(right!==undefined){
        const n=cells[right];
        if(!coversBoundary(vw,'V',c.x2,Math.max(c.y1,n.y1),Math.min(c.y2,n.y2))){adj[i].push(right);adj[right].push(i)}
      }
      const down=byKey.get(c.xi+','+(c.yi+1));
      if(down!==undefined){
        const n=cells[down];
        if(!coversBoundary(vw,'H',c.y2,Math.max(c.x1,n.x1),Math.min(c.x2,n.x2))){adj[i].push(down);adj[down].push(i)}
      }
    }

    const seen=new Set(),comps=[];
    for(let i=0;i<cells.length;i++){
      if(seen.has(i))continue;
      const stack=[i],ids=[];seen.add(i);
      while(stack.length){
        const n=stack.pop();ids.push(n);
        for(const j of adj[n])if(!seen.has(j)){seen.add(j);stack.push(j)}
      }
      const area=ids.reduce((s,j)=>s+cells[j].area,0);
      if(area>=ROOM_MIN_AREA)comps.push({ids,area});
    }

    const rs=comps.map(comp=>{
      const cc=comp.ids.map(i=>cells[i]);
      const area=comp.area;
      const cx=cc.reduce((s,c)=>s+((c.x1+c.x2)/2)*c.area,0)/area;
      const cy=cc.reduce((s,c)=>s+((c.y1+c.y2)/2)*c.area,0)/area;
      return {name:'',cells:cc,lx:cx,ly:cy,manual:false};
    }).sort((a,b)=>a.ly-b.ly||a.lx-b.lx);

    rs.forEach((r,i)=>r.name='Area '+(i+1));
    return rs;
  }

  function roomBounds(r){
    if(r.manualRect)return [r.manualRect.x,r.manualRect.y,r.manualRect.x+r.manualRect.w,r.manualRect.y+r.manualRect.h];
    return [Math.min(...r.cells.map(c=>c.x1)),Math.min(...r.cells.map(c=>c.y1)),Math.max(...r.cells.map(c=>c.x2)),Math.max(...r.cells.map(c=>c.y2))];
  }

  const fills=['#b8d9ff','#bde5c5','#ffe699','#f4b4b4','#d8c2f0','#bce8e6','#f6c28b','#e2c1a6','#d8dde3','#c9e5ff','#d9efc1'];

  function renderRooms(){
    const svg=$('roomPlan');
    let s='<rect width="760" height="500" fill="white"/>';
    roomsV25.forEach((r,i)=>{
      const fill=fills[i%fills.length],sel=roomSelected.has(i);
      if(r.manualRect){
        const q=r.manualRect;
        s+='<rect class="roomFill" x="'+q.x+'" y="'+q.y+'" width="'+q.w+'" height="'+q.h+'" fill="'+fill+'" stroke="'+(sel?'#ed6a32':'#7b8c94')+'" stroke-width="'+(sel?4:1.2)+'"/>';
      }else{
        for(const c of r.cells)s+='<rect class="roomFill" x="'+c.x1+'" y="'+c.y1+'" width="'+(c.x2-c.x1)+'" height="'+(c.y2-c.y1)+'" fill="'+fill+'"/>';
      }
    });

    walls.forEach(w=>s+='<line class="wallLine" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>');

    roomsV25.forEach((r,i)=>{
      const sel=roomSelected.has(i);
      s+='<g class="roomLabel '+(sel?'selected':'')+'" data-room-label="'+i+'" transform="translate('+r.lx+' '+r.ly+')"><rect class="roomHit" x="-65" y="-20" width="130" height="40"/><text text-anchor="middle" pointer-events="none">'+escapeHtml(r.name)+'</text></g>';
    });
    svg.innerHTML=s;

    $('roomListV25').innerHTML=roomsV25.map((r,i)=>'<div class="roomRow"><input class="roomCheck" type="checkbox" '+(roomSelected.has(i)?'checked':'')+' onchange="window.v25ToggleRoom('+i+',this.checked)"><input type="text" value="'+escapeAttr(r.name)+'" onchange="window.v25RenameRoom('+i+',this.value)"><button onclick="window.v25FocusRoom('+i+')">Select</button></div>').join('');
    $('roomStatus').textContent=roomsV25.length+' room area'+(roomsV25.length===1?'':'s')+' generated. Rename labels or make manual corrections before approval.';
  }

  function escapeHtml(v){return String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
  function escapeAttr(v){return escapeHtml(v).replace(/"/g,'&quot;')}

  window.v25ToggleRoom=(i,on)=>{on?roomSelected.add(i):roomSelected.delete(i);renderRooms()};
  window.v25RenameRoom=(i,v)=>{roomSave();roomsV25[i].name=v||('Area '+(i+1));renderRooms()};
  window.v25FocusRoom=i=>{roomSelected.clear();roomSelected.add(i);renderRooms()};

  function generateRooms(){
    roomsV25=inferRooms();roomSelected.clear();roomHistory=[];
    $('roomCard').classList.remove('hidden');renderRooms();$('roomCard').scrollIntoView({behavior:'smooth'});
  }

  function mergeSelected(){
    const ids=[...roomSelected].sort((a,b)=>a-b);
    if(ids.length<2){$('roomStatus').textContent='Select at least two rooms to merge.';return}
    roomSave();
    const base=roomsV25[ids[0]],cells=[],rects=[];
    for(const i of ids){
      const r=roomsV25[i];
      if(r.cells)cells.push(...r.cells);
      if(r.manualRect)rects.push(r.manualRect);
    }
    if(rects.length){
      const bs=ids.map(i=>roomBounds(roomsV25[i]));
      const b=[Math.min(...bs.map(q=>q[0])),Math.min(...bs.map(q=>q[1])),Math.max(...bs.map(q=>q[2])),Math.max(...bs.map(q=>q[3]))];
      base.manualRect={x:b[0],y:b[1],w:b[2]-b[0],h:b[3]-b[1]};base.cells=[];
    }else base.cells=cells;
    const b=roomBounds(base);base.lx=(b[0]+b[2])/2;base.ly=(b[1]+b[3])/2;
    roomsV25=roomsV25.filter((_,i)=>i===ids[0]||!ids.includes(i));
    roomSelected.clear();roomSelected.add(roomsV25.indexOf(base));renderRooms();
  }

  function splitSelected(dir){
    const ids=[...roomSelected];
    if(ids.length!==1){$('roomStatus').textContent='Select exactly one room to split.';return}
    const idx=ids[0],r=roomsV25[idx];
    if(r.manualRect){
      roomSave();const q=r.manualRect;
      let r1,r2;
      if(dir==='V'){
        const w=q.w/2;
        r1={name:r.name+' A',cells:[],manual:true,manualRect:{x:q.x,y:q.y,w:w,h:q.h},lx:q.x+w/2,ly:q.y+q.h/2};
        r2={name:r.name+' B',cells:[],manual:true,manualRect:{x:q.x+w,y:q.y,w:q.w-w,h:q.h},lx:q.x+w+(q.w-w)/2,ly:q.y+q.h/2};
      }else{
        const hh=q.h/2;
        r1={name:r.name+' A',cells:[],manual:true,manualRect:{x:q.x,y:q.y,w:q.w,h:hh},lx:q.x+q.w/2,ly:q.y+hh/2};
        r2={name:r.name+' B',cells:[],manual:true,manualRect:{x:q.x,y:q.y+hh,w:q.w,h:q.h-hh},lx:q.x+q.w/2,ly:q.y+hh+(q.h-hh)/2};
      }
      roomsV25.splice(idx,1,r1,r2);roomSelected.clear();renderRooms();return;
    }
    const b=roomBounds(r),mid=dir==='V'?(b[0]+b[2])/2:(b[1]+b[3])/2;
    const a=r.cells.filter(c=>dir==='V'?((c.x1+c.x2)/2<mid):((c.y1+c.y2)/2<mid));
    const c=r.cells.filter(c=>!a.includes(c));
    if(!a.length||!c.length){$('roomStatus').textContent='This room cannot be split cleanly on that axis.';return}
    roomSave();
    function made(cells,name){
      const area=cells.reduce((s,x)=>s+x.area,0);
      const lx=cells.reduce((s,x)=>s+((x.x1+x.x2)/2)*x.area,0)/area;
      const ly=cells.reduce((s,x)=>s+((x.y1+x.y2)/2)*x.area,0)/area;
      return {name,cells,lx,ly,manual:false};
    }
    const r1=made(a,r.name+' A'),r2=made(c,r.name+' B');
    roomsV25.splice(idx,1,r1,r2);roomSelected.clear();renderRooms();
  }

  function addManual(){
    roomSave();const env=envelope()||{left:180,right:580,top:130,bottom:370};
    const w=120,h=80,x=(env.left+env.right-w)/2,y=(env.top+env.bottom-h)/2;
    roomsV25.push({name:'New area',cells:[],manual:true,manualRect:{x,y,w,h},lx:x+w/2,ly:y+h/2});
    roomSelected.clear();roomSelected.add(roomsV25.length-1);renderRooms();
  }

  $('mergeRoomsBtn').onclick=mergeSelected;
  $('splitRoomVBtn').onclick=()=>splitSelected('V');
  $('splitRoomHBtn').onclick=()=>splitSelected('H');
  $('addRoomV25').onclick=addManual;
  $('undoRoomsV25').onclick=roomUndo;
  $('rebuildRoomsV25').onclick=()=>{roomSave();roomsV25=inferRooms();roomSelected.clear();renderRooms()};

  $('roomPlan').addEventListener('pointerdown',e=>{
    const lab=e.target.closest('[data-room-label]');if(!lab)return;
    const i=+lab.dataset.roomLabel,r=roomsV25[i],svg=$('roomPlan'),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
    const q=p.matrixTransform(svg.getScreenCTM().inverse());
    roomSave();roomSelected.clear();roomSelected.add(i);roomDrag={i,id:e.pointerId,px:q.x,py:q.y,lx:r.lx,ly:r.ly};
    svg.setPointerCapture?.(e.pointerId);renderRooms();
  });
  $('roomPlan').addEventListener('pointermove',e=>{
    if(!roomDrag||roomDrag.id!==e.pointerId)return;
    const svg=$('roomPlan'),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());
    const r=roomsV25[roomDrag.i];r.lx=snap(roomDrag.lx+q.x-roomDrag.px);r.ly=snap(roomDrag.ly+q.y-roomDrag.py);renderRooms();
  });
  function endRoomDrag(e){if(roomDrag&&roomDrag.id===e.pointerId){try{$('roomPlan').releasePointerCapture?.(e.pointerId)}catch{}roomDrag=null}}
  $('roomPlan').addEventListener('pointerup',endRoomDrag);$('roomPlan').addEventListener('pointercancel',endRoomDrag);

  const originalApprove=$('approveBtn').onclick;
  $('approveBtn').onclick=()=>{
    if(!walls.length){$('editStatus').textContent='No walls to approve.';return}
    $('approvedCard').classList.remove('hidden');
    $('approvedSummary').textContent='Approved structural model: '+walls.length+' straight walls. Generating enclosed room areas from this wall graph…';
    generateRooms();
  };

  $('approveRoomsV25').onclick=()=>{
    if(!roomsV25.length){$('roomStatus').textContent='No room areas are available to approve.';return}
    $('roomApprovedV25').classList.remove('hidden');
    $('roomApprovedSummary').textContent='Approved room model: '+roomsV25.length+' areas. Room names and label positions are now ready for the door/label stage.';
    $('roomApprovedV25').scrollIntoView({behavior:'smooth'});
  };
})();