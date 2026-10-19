// V44 - fluid direct-manipulation engineer drawing mode.
(function(){
  const scanSection=$('cameraBtn')?.closest('section');
  const siteSection=$('customer')?.closest('section');
  if(!scanSection||!siteSection)return;

  const css=document.createElement('style');
  css.textContent=`
    .createChoice41{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .manualStage41{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:12px}
    .manualDock41{border:2px solid #dfe7ea;border-radius:12px;padding:10px;background:#fbfcfc;align-self:start;overflow:hidden}
    .manualDock41 .controls{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px}
    .manualDock41 button{width:100%!important;min-width:0!important;white-space:normal;line-height:1.15}
    .modeActive41{background:var(--navy)!important;color:#fff!important}
    .drawHit41{stroke:transparent;stroke-width:28;cursor:grab}
    .drawWall41{stroke:#1b313b;stroke-width:5;stroke-linecap:square}
    .drawWall41.selected{stroke:var(--orange);stroke-width:8}
    .drawHandle41{fill:var(--orange);stroke:#fff;stroke-width:3}
    .roomPreview41{fill:#dcecf7;fill-opacity:.34;stroke:none}
    .previewWall41{stroke:var(--orange);stroke-width:4;stroke-dasharray:8 6}
    .manualStats41{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:8px 0}
    .manualStats41>div{border:1px solid #d8e0e4;border-radius:9px;padding:8px;background:#fff}
    .manualStats41 b{display:block;font-size:19px}
    .manualCanvas41{background-color:#fff;background-image:linear-gradient(#edf2f4 1px,transparent 1px),linear-gradient(90deg,#edf2f4 1px,transparent 1px);background-size:20px 20px}
    [data-mdoor41],[data-mstairs41],[data-mwall41]{cursor:grab}
    [data-mdoor41]:active,[data-mstairs41]:active,[data-mwall41]:active{cursor:grabbing}
    .itemHit44{fill:transparent;stroke:transparent;pointer-events:all}
    @media(max-width:900px){.createChoice41,.manualStage41{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  scanSection.querySelector('h2').textContent='2A. Scan an existing sketch';

  const choice=document.createElement('section');
  choice.className='card';
  choice.id='createPlanChoice41';
  choice.innerHTML=`
    <h2>2. Create the building plan</h2>
    <div class="tip"><b>Choose the quickest route.</b> Scan an existing sketch, draw the building directly, or load the current wall structure into the drawing tool for correction. Every route creates the same wall model.</div>
    <div class="createChoice41">
      <button id="chooseScan41" class="orange">Scan existing sketch</button>
      <button id="chooseDraw41" class="navy">Draw new plan</button>
    </div>
  `;
  siteSection.insertAdjacentElement('afterend',choice);

  const card=document.createElement('section');
  card.id='manualCard41';card.className='card hidden';
  card.innerHTML=`
    <h2>2B. Draw the building plan</h2>
    <div class="tip"><b>Site drawing mode.</b> Draw with a finger, mouse or Apple Pencil. Placed doors and stairs can be grabbed and dragged immediately without changing tools. Walls can be moved in Select / move mode.</div>
    <div class="manualStage41">
      <div>
        <div class="canvasWrap manualCanvas41"><svg id="manualPlan41" viewBox="0 0 760 500" aria-label="Manual building plan drawing canvas"></svg></div>
        <div id="manualStatus41" class="status">Choose a drawing tool, then draw the building outline and internal walls.</div>
      </div>
      <div class="manualDock41">
        <h4>Drawing tools</h4>
        <div class="controls">
          <button id="selectMode41">Select / move</button>
          <button id="wallMode41" class="modeActive41">Square wall</button>
          <button id="angleMode41">Angled wall</button>
          <button id="arcMode41">Arc wall</button>
          <button id="outlineMode41">Draw outline</button>
          <button id="rectMode41">Rectangle room</button>
          <button id="doorMode41">Add door</button>
          <button id="stairsMode41">Add staircase</button>
        </div>
        <div id="outlineTools41" class="hidden" style="margin-top:8px"><button id="closeOutline41">Close outline</button></div>
        <hr>
        <h4>Selected wall</h4>
        <div id="manualSelected41" class="status">No wall selected.</div>
        <div class="controls">
          <button id="shorter41">− Shorter</button>
          <button id="longer41">+ Longer</button>
          <button id="duplicate41">Duplicate</button>
          <button id="rotate41">Rotate selected</button>
          <button id="delete41" class="danger">Delete</button>
        </div>
        <hr>
        <div class="controls">
          <button id="undo41">Undo</button>
          <button id="redo41">Redo</button>
          <button id="tidy41">Tidy plan</button>
          <button id="loadWalls41">Edit current plan</button>
          <button id="clear41" class="danger">Clear drawing</button>
          <button id="useDrawing41" class="green">Use this drawing</button>
        </div>
        <div class="manualStats41">
          <div><span class="small">Walls</span><b id="mWalls41">0</b></div>
          <div><span class="small">Rooms</span><b id="mRooms41">0</b></div>
          <div><span class="small">Snap</span><b>ON</b></div>
        </div>
        <div class="small">Tip: use <b>Draw outline</b> to tap around the perimeter, then <b>Draw wall</b> for internal partitions. Enclosed spaces are shaded automatically.</div>
      </div>
    </div>
  `;
  scanSection.insertAdjacentElement('afterend',card);

  let mwalls=[],mdoors=[],mstairs=[],mhistory=[],mredo=[],mselected=-1,objSelected=null,mode='wall',gesture=null,outline=[],arcPoints=[];
  const svg=$('manualPlan41');
  const clone=x=>JSON.parse(JSON.stringify(x));

  function saveManual(){
    mhistory.push(JSON.stringify({mwalls,mdoors,mstairs}));
    if(mhistory.length>40)mhistory.shift();
    mredo=[];
  }
  function mp(e){
    const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
    const q=p.matrixTransform(svg.getScreenCTM().inverse());
    return snapNear({x:snap(clamp(q.x,0,W),5),y:snap(clamp(q.y,0,H),5)});
  }
  function snapNear(p,exclude=-1){
    let best={...p},bd=15;
    mwalls.forEach((w,i)=>{
      if(i===exclude)return;
      for(const q of [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}]){
        const d=Math.hypot(q.x-p.x,q.y-p.y);
        if(d<bd){bd=d;best={...q}}
      }
    });
    return best;
  }
  function wallFrom(a,b,free=false){
    if(free){
      const dx=b.x-a.x,dy=b.y-a.y;
      return {x1:a.x,y1:a.y,x2:b.x,y2:b.y,axis:'A',angle:Math.atan2(dy,dx)*180/Math.PI};
    }
    const dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
    if(dx>=dy)return normaliseWall({x1:a.x,y1:a.y,x2:b.x,y2:a.y,axis:'H'});
    return normaliseWall({x1:a.x,y1:a.y,x2:a.x,y2:b.y,axis:'V'});
  }
  function lineLen(w){return Math.hypot(w.x2-w.x1,w.y2-w.y1)}
  function arcPath(w){return 'M '+w.x1+' '+w.y1+' Q '+w.cx+' '+w.cy+' '+w.x2+' '+w.y2}
  function nearestAnyWall(x,y){
    let best=null;
    for(const w of mwalls){
      if(w.type==='ARC')continue;
      const dx=w.x2-w.x1,dy=w.y2-w.y1,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(y-w.y1)*dy)/L));
      const qx=w.x1+t*dx,qy=w.y1+t*dy,d=Math.hypot(x-qx,y-qy),ang=Math.atan2(dy,dx)*180/Math.PI;
      if(!best||d<best.d)best={x:qx,y:qy,d,angle:ang};
    }
    return best;
  }
  function dedupeManual(list){
    const out=[];
    for(const source of list){
      if(source.type==='ARC'||source.axis==='A'){out.push({...source});continue}
      const raw=normaliseWall(source);
      if(wallLength(raw)<12)continue;
      let hit=false;
      for(const o of out){
        if(o.axis!==raw.axis)continue;
        if(o.axis==='H'&&Math.abs(o.y1-raw.y1)<=5&&Math.min(o.x2,raw.x2)-Math.max(o.x1,raw.x1)>=-10){
          o.x1=Math.min(o.x1,raw.x1);o.x2=Math.max(o.x2,raw.x2);hit=true;break;
        }
        if(o.axis==='V'&&Math.abs(o.x1-raw.x1)<=5&&Math.min(o.y2,raw.y2)-Math.max(o.y1,raw.y1)>=-10){
          o.y1=Math.min(o.y1,raw.y1);o.y2=Math.max(o.y2,raw.y2);hit=true;break;
        }
      }
      if(!hit)out.push({...raw});
    }
    // Snap close perpendicular endpoints/intersections without deleting short intentional walls.
    const hs=out.filter(w=>w.axis==='H'),vs=out.filter(w=>w.axis==='V');
    for(const h of hs)for(const v of vs){
      const x=v.x1,y=h.y1,g=14;
      if(x>=h.x1-g&&x<=h.x2+g&&y>=v.y1-g&&y<=v.y2+g){
        if(Math.abs(h.x1-x)<=g)h.x1=x;if(Math.abs(h.x2-x)<=g)h.x2=x;
        if(Math.abs(v.y1-y)<=g)v.y1=y;if(Math.abs(v.y2-y)<=g)v.y2=y;
      }
    }
    return out.map(w=>(w.type==='ARC'||w.axis==='A')?w:normaliseWall(w));
  }

  function unique(vals){
    vals=vals.map(v=>Math.round(v)).sort((a,b)=>a-b);
    const out=[];for(const v of vals)if(!out.length||Math.abs(v-out[out.length-1])>2)out.push(v);
    return out;
  }
  function blockedV(x,y1,y2){
    const need=y2-y1;
    return mwalls.some(w=>w.axis==='V'&&Math.abs(w.x1-x)<=4&&Math.min(w.y2,y2)-Math.max(w.y1,y1)>=need-4);
  }
  function blockedH(y,x1,x2){
    const need=x2-x1;
    return mwalls.some(w=>w.axis==='H'&&Math.abs(w.y1-y)<=4&&Math.min(w.x2,x2)-Math.max(w.x1,x1)>=need-4);
  }
  function enclosedCells(){
    if(mwalls.length<4)return [];
    const xs=unique([0,W,...mwalls.flatMap(w=>[w.x1,w.x2])]),ys=unique([0,H,...mwalls.flatMap(w=>[w.y1,w.y2])]);
    if(xs.length*ys.length>2500)return [];
    const nx=xs.length-1,ny=ys.length-1,N=nx*ny,outside=new Uint8Array(N);
    const id=(x,y)=>y*nx+x,queue=[];
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      if(x===0||y===0||x===nx-1||y===ny-1){outside[id(x,y)]=1;queue.push([x,y])}
    }
    for(let q=0;q<queue.length;q++){
      const [x,y]=queue[q],x1=xs[x],x2=xs[x+1],y1=ys[y],y2=ys[y+1];
      const ns=[
        [x-1,y,x>0&&!blockedV(x1,y1,y2)],
        [x+1,y,x<nx-1&&!blockedV(x2,y1,y2)],
        [x,y-1,y>0&&!blockedH(y1,x1,x2)],
        [x,y+1,y<ny-1&&!blockedH(y2,x1,x2)]
      ];
      for(const [xx,yy,ok] of ns)if(ok&&!outside[id(xx,yy)]){outside[id(xx,yy)]=1;queue.push([xx,yy])}
    }
    const seen=new Uint8Array(N),groups=[];
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const k=id(x,y);if(outside[k]||seen[k])continue;
      const group=[],qq=[[x,y]];seen[k]=1;
      for(let z=0;z<qq.length;z++){
        const [cx,cy]=qq[z],a=xs[cx],b=xs[cx+1],c=ys[cy],d=ys[cy+1];
        group.push({x1:a,x2:b,y1:c,y2:d});
        const ns=[
          [cx-1,cy,cx>0&&!blockedV(a,c,d)],
          [cx+1,cy,cx<nx-1&&!blockedV(b,c,d)],
          [cx,cy-1,cy>0&&!blockedH(c,a,b)],
          [cx,cy+1,cy<ny-1&&!blockedH(d,a,b)]
        ];
        for(const [xx,yy,ok] of ns){const n=id(xx,yy);if(ok&&!outside[n]&&!seen[n]){seen[n]=1;qq.push([xx,yy])}}
      }
      groups.push(group);
    }
    return groups;
  }

  function setMode(next){
    mode=next;gesture=null;mselected=-1;
    ['select','wall','angle','arc','outline','rect','door','stairs'].forEach(n=>$(n+'Mode41')?.classList.toggle('modeActive41',n===mode));
    $('outlineTools41').classList.toggle('hidden',mode!=='outline');
    $('manualStatus41').textContent=
      mode==='wall'?'Drag to draw a square wall. It snaps horizontal or vertical.':
      mode==='angle'?'Drag freely to draw a wall at any angle.':
      mode==='arc'?'Arc wall: tap start, tap end, then tap where the curve should bow.':
      mode==='door'?'Tap a wall to place a door.':
      mode==='stairs'?'Tap the plan to place a staircase.':
      mode==='rect'?'Drag corner-to-corner to add a rectangular room.':
      mode==='outline'?'Tap each perimeter corner, then press Close outline.':
      'Tap a wall, door or staircase to move or edit it.';
    renderManual();
  }

  function renderManual(){
    const rooms=enclosedCells();
    let s='<rect width="760" height="500" fill="transparent"/>';
    for(const g of rooms)for(const c of g)s+='<rect class="roomPreview41" x="'+c.x1+'" y="'+c.y1+'" width="'+(c.x2-c.x1)+'" height="'+(c.y2-c.y1)+'"/>';
    mwalls.forEach((w,i)=>{
      if(w.type==='ARC'){
        s+='<g data-mwall41="'+i+'"><path class="drawWall41 '+(mselected===i?'selected':'')+'" d="'+arcPath(w)+'" fill="none"/><path class="drawHit41" data-mwall41="'+i+'" d="'+arcPath(w)+'" fill="none"/>';
        if(mselected===i)s+='<circle class="drawHandle41" data-mwall41="'+i+'" data-mend41="1" cx="'+w.x1+'" cy="'+w.y1+'" r="9"/><circle class="drawHandle41" data-mwall41="'+i+'" data-mend41="2" cx="'+w.x2+'" cy="'+w.y2+'" r="9"/>';
        s+='</g>';
      }else{
        s+='<g data-mwall41="'+i+'"><line class="drawWall41 '+(mselected===i?'selected':'')+'" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/><line class="drawHit41" data-mwall41="'+i+'" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>';
        if(mselected===i)s+='<circle class="drawHandle41" data-mwall41="'+i+'" data-mend41="1" cx="'+w.x1+'" cy="'+w.y1+'" r="9"/><circle class="drawHandle41" data-mwall41="'+i+'" data-mend41="2" cx="'+w.x2+'" cy="'+w.y2+'" r="9"/>';
        s+='</g>';
      }
    });
    mdoors.forEach((d,i)=>{
      const sel=objSelected?.kind==='door'&&objSelected.i===i,rot=d.angle||0,sz=d.size||1;
      s+='<g data-mdoor41="'+i+'" transform="translate('+d.x+' '+d.y+') rotate('+rot+') scale('+sz+')"><rect class="itemHit44" x="-38" y="-20" width="76" height="82" rx="10"/><line x1="-24" y1="0" x2="24" y2="0" stroke="'+(sel?'#ed6a32':'#102f3f')+'" stroke-width="'+(sel?7:5)+'"/><path d="M-24 0 A48 48 0 0 1 24 48" stroke="#1769aa" stroke-width="3" fill="none"/></g>';
    });
    mstairs.forEach((m,i)=>{
      const sel=objSelected?.kind==='stairs'&&objSelected.i===i,rot=m.rot||0,sc=m.size||1;
      let steps='';for(let n=0;n<6;n++){const yy=-24+n*9;steps+='<line x1="-22" y1="'+yy+'" x2="22" y2="'+yy+'" stroke="#102f3f" stroke-width="2"/>'}
      s+='<g data-mstairs41="'+i+'" transform="translate('+m.x+' '+m.y+') rotate('+rot+') scale('+sc+')"><rect class="itemHit44" x="-34" y="-38" width="68" height="78" rx="8"/><rect x="-24" y="-28" width="48" height="58" fill="white" fill-opacity=".75" stroke="'+(sel?'#ed6a32':'#102f3f')+'" stroke-width="'+(sel?4:2)+'"/>'+steps+'<path d="M0 22V-18m0 0l-6 8m6-8l6 8" stroke="#1769aa" stroke-width="2.5" fill="none"/></g>';
    });
    if(outline.length){
      for(const p of outline)s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="5" fill="#1769aa"/>';
    }
    if(arcPoints.length){
      arcPoints.forEach(p=>s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="6" fill="#ed6a32"/>');
      if(arcPoints.length===2)s+='<line class="previewWall41" x1="'+arcPoints[0].x+'" y1="'+arcPoints[0].y+'" x2="'+arcPoints[1].x+'" y2="'+arcPoints[1].y+'"/>';
    }
    if(gesture&&(gesture.type==='wall'||gesture.type==='angle'||gesture.type==='rect')){
      const a=gesture.start,b=gesture.now||a;
      if(gesture.type==='wall'||gesture.type==='angle'){
        const w=wallFrom(a,b,gesture.type==='angle');s+='<line class="previewWall41" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>';
      }else{
        const x1=Math.min(a.x,b.x),x2=Math.max(a.x,b.x),y1=Math.min(a.y,b.y),y2=Math.max(a.y,b.y);
        s+='<rect x="'+x1+'" y="'+y1+'" width="'+(x2-x1)+'" height="'+(y2-y1)+'" fill="none" class="previewWall41"/>';
      }
    }
    svg.innerHTML=s;
    $('mWalls41').textContent=mwalls.length;$('mRooms41').textContent=rooms.length;
    if(mselected>=0&&mwalls[mselected]){
      const w=mwalls[mselected],label=w.type==='ARC'?'ARC':w.axis==='A'?'ANGLED':w.axis;
      $('manualSelected41').textContent=label+' wall · '+Math.round(lineLen(w))+' units';
    }else if(objSelected?.kind==='door')$('manualSelected41').textContent='Door selected';
    else if(objSelected?.kind==='stairs')$('manualSelected41').textContent='Staircase selected';
    else $('manualSelected41').textContent='No item selected.';
  }

  $('selectMode41').onclick=()=>setMode('select');
  $('wallMode41').onclick=()=>setMode('wall');
  $('angleMode41').onclick=()=>setMode('angle');
  $('arcMode41').onclick=()=>{arcPoints=[];setMode('arc')};
  $('doorMode41').onclick=()=>setMode('door');
  $('stairsMode41').onclick=()=>setMode('stairs');
  $('outlineMode41').onclick=()=>{outline=[];setMode('outline')};
  $('rectMode41').onclick=()=>setMode('rect');

  svg.addEventListener('pointerdown',e=>{
    e.preventDefault();const p=mp(e);

    // Direct manipulation always wins for placed items. Engineers do not need
    // to switch back to Select / move just to reposition a door or staircase.
    const directDoor=e.target.closest('[data-mdoor41]');
    const directStair=e.target.closest('[data-mstairs41]');
    if(directDoor){
      const i=+directDoor.dataset.mdoor41,d=mdoors[i];
      objSelected={kind:'door',i};mselected=-1;saveManual();
      gesture={type:'objmove',kind:'door',i,id:e.pointerId,start:p,orig:{...d},snapToWall:true};
      svg.setPointerCapture?.(e.pointerId);renderManual();return;
    }
    if(directStair){
      const i=+directStair.dataset.mstairs41,d=mstairs[i];
      objSelected={kind:'stairs',i};mselected=-1;saveManual();
      gesture={type:'objmove',kind:'stairs',i,id:e.pointerId,start:p,orig:{...d}};
      svg.setPointerCapture?.(e.pointerId);renderManual();return;
    }

    if(mode==='arc'){
      if(arcPoints.length===0){arcPoints=[p];$('manualStatus41').textContent='Arc start set. Tap the end point.'}
      else if(arcPoints.length===1){arcPoints.push(p);$('manualStatus41').textContent='Arc end set. Tap where the curve should bow.'}
      else{
        saveManual();const a=arcPoints[0],b=arcPoints[1];
        mwalls.push({type:'ARC',axis:'ARC',x1:a.x,y1:a.y,x2:b.x,y2:b.y,cx:p.x,cy:p.y});arcPoints=[];mselected=mwalls.length-1;objSelected=null;
        $('manualStatus41').textContent='Arc wall added.';
      }
      renderManual();return;
    }
    if(mode==='door'){
      const q=nearestAnyWall(p.x,p.y);
      if(!q||q.d>50){$('manualStatus41').textContent='Tap closer to a wall to place the door.';return}
      saveManual();mdoors.push({x:snap(q.x),y:snap(q.y),angle:q.angle,size:1});objSelected={kind:'door',i:mdoors.length-1};mselected=-1;
      gesture={type:'objmove',kind:'door',i:mdoors.length-1,id:e.pointerId,start:p,orig:{...mdoors[mdoors.length-1]},snapToWall:true};
      svg.setPointerCapture?.(e.pointerId);
      $('manualStatus41').textContent='Door placed. Keep dragging to slide it along the wall, or release to leave it here.';
      renderManual();return;
    }
    if(mode==='stairs'){
      saveManual();mstairs.push({x:p.x,y:p.y,rot:0,size:1});objSelected={kind:'stairs',i:mstairs.length-1};mselected=-1;
      gesture={type:'objmove',kind:'stairs',i:mstairs.length-1,id:e.pointerId,start:p,orig:{...mstairs[mstairs.length-1]}};
      svg.setPointerCapture?.(e.pointerId);
      $('manualStatus41').textContent='Staircase placed. Keep dragging to position it, or release to leave it here.';
      renderManual();return;
    }
    if(mode==='outline'){
      saveManual();
      if(!outline.length){outline.push(p);$('manualStatus41').textContent='First corner set. Tap the next perimeter corner.'}
      else{
        const prev=outline[outline.length-1],w=wallFrom(prev,p);
        if(wallLength(w)>=12){mwalls.push(w);outline.push({x:w.x2,y:w.y2});$('manualStatus41').textContent='Perimeter edge added. Continue around the building or close the outline.'}
      }
      renderManual();return;
    }
    if(mode==='select'){
      const door=e.target.closest('[data-mdoor41]'),stair=e.target.closest('[data-mstairs41]'),h=e.target.closest('[data-mwall41]');
      if(door){const i=+door.dataset.mdoor41,d=mdoors[i];objSelected={kind:'door',i};mselected=-1;saveManual();gesture={type:'objmove',kind:'door',i,id:e.pointerId,start:p,orig:{...d}};svg.setPointerCapture?.(e.pointerId);renderManual();return}
      if(stair){const i=+stair.dataset.mstairs41,d=mstairs[i];objSelected={kind:'stairs',i};mselected=-1;saveManual();gesture={type:'objmove',kind:'stairs',i,id:e.pointerId,start:p,orig:{...d}};svg.setPointerCapture?.(e.pointerId);renderManual();return}
      if(!h){mselected=-1;objSelected=null;renderManual();return}
      const i=+h.dataset.mwall41,w=mwalls[i];mselected=i;objSelected=null;saveManual();
      const end=e.target.dataset.mend41;
      gesture=end?{type:'end',i,end:+end,id:e.pointerId}:{type:'move',i,id:e.pointerId,start:p,orig:{...w}};
      svg.setPointerCapture?.(e.pointerId);renderManual();return;
    }
    gesture={type:mode,start:p,now:p,id:e.pointerId};svg.setPointerCapture?.(e.pointerId);renderManual();
  });
  svg.addEventListener('pointermove',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const p=mp(e);
    if(gesture.type==='wall'||gesture.type==='angle'||gesture.type==='rect'){gesture.now=p;renderManual();return}
    if(gesture.type==='objmove'){
      const arr=gesture.kind==='door'?mdoors:mstairs,o=arr[gesture.i];if(!o)return;
      const nx=gesture.orig.x+p.x-gesture.start.x,ny=gesture.orig.y+p.y-gesture.start.y;
      if(gesture.kind==='door'){
        const q=nearestAnyWall(nx,ny);
        if(q&&q.d<55){o.x=snap(q.x);o.y=snap(q.y);o.angle=q.angle}
        else{o.x=snap(nx);o.y=snap(ny)}
      }else{
        o.x=snap(nx);o.y=snap(ny);
      }
      renderManual();return;
    }
    const w=mwalls[gesture.i];if(!w)return;
    if(gesture.type==='move'){
      const dx=snap(p.x-gesture.start.x),dy=snap(p.y-gesture.start.y);
      if(w.type==='ARC'){w.x1=gesture.orig.x1+dx;w.x2=gesture.orig.x2+dx;w.cx=gesture.orig.cx+dx;w.y1=gesture.orig.y1+dy;w.y2=gesture.orig.y2+dy;w.cy=gesture.orig.cy+dy}
      else if(w.axis==='H'){w.x1=gesture.orig.x1+dx;w.x2=gesture.orig.x2+dx;w.y1=w.y2=gesture.orig.y1+dy}
      else if(w.axis==='V'){w.x1=w.x2=gesture.orig.x1+dx;w.y1=gesture.orig.y1+dy;w.y2=gesture.orig.y2+dy}
      else{w.x1=gesture.orig.x1+dx;w.x2=gesture.orig.x2+dx;w.y1=gesture.orig.y1+dy;w.y2=gesture.orig.y2+dy}
    }else{
      const q=snapNear(p,gesture.i);
      if(w.type==='ARC'){if(gesture.end===1){w.x1=q.x;w.y1=q.y}else{w.x2=q.x;w.y2=q.y}}
      else if(w.axis==='H'){if(gesture.end===1)w.x1=q.x;else w.x2=q.x}
      else if(w.axis==='V'){if(gesture.end===1)w.y1=q.y;else w.y2=q.y}
      else{if(gesture.end===1){w.x1=q.x;w.y1=q.y}else{w.x2=q.x;w.y2=q.y}}
    }
    mwalls[gesture.i]=(w.type==='ARC'||w.axis==='A')?w:normaliseWall(w);renderManual();
  });
  function finishGesture(e){
    if(!gesture||gesture.id!==e.pointerId)return;
    try{svg.releasePointerCapture?.(e.pointerId)}catch{}
    if(gesture.type==='wall'||gesture.type==='angle'){
      const w=wallFrom(gesture.start,gesture.now||gesture.start,gesture.type==='angle');
      if(wallLength(w)>=12){saveManual();mwalls.push(w);mselected=mwalls.length-1}
    }else if(gesture.type==='rect'){
      const a=gesture.start,b=gesture.now||a,x1=snap(Math.min(a.x,b.x)),x2=snap(Math.max(a.x,b.x)),y1=snap(Math.min(a.y,b.y)),y2=snap(Math.max(a.y,b.y));
      if(x2-x1>=20&&y2-y1>=20){
        saveManual();mwalls.push(
          {x1,y1,x2,y2:y1,axis:'H'},{x1,y1:y2,x2,y2,axis:'H'},
          {x1,y1,x2:x1,y2,axis:'V'},{x1:x2,y1,x2,y2,axis:'V'}
        );mwalls=dedupeManual(mwalls);
      }
    }
    if(gesture.type==='objmove'){
      $('manualStatus41').textContent=gesture.kind==='door'?'Door positioned. Drag it again at any time.':'Staircase positioned. Drag it again at any time.';
    }
    gesture=null;renderManual();
  }
  svg.addEventListener('pointerup',finishGesture);svg.addEventListener('pointercancel',finishGesture);

  $('closeOutline41').onclick=()=>{
    if(outline.length<3){$('manualStatus41').textContent='Add at least three perimeter corners before closing the outline.';return}
    saveManual();const first=outline[0],last=outline[outline.length-1];
    if(Math.abs(first.x-last.x)<8||Math.abs(first.y-last.y)<8){
      const w=wallFrom(last,first);if(wallLength(w)>=12)mwalls.push(w);
    }else{
      const turn={x:last.x,y:first.y};
      const a=wallFrom(last,turn),b=wallFrom(turn,first);
      if(wallLength(a)>=12)mwalls.push(a);if(wallLength(b)>=12)mwalls.push(b);
    }
    mwalls=dedupeManual(mwalls);outline=[];setMode('wall');$('manualStatus41').textContent='Building outline closed. Draw internal walls next.';
  };

  $('undo41').onclick=()=>{if(!mhistory.length)return;mredo.push(JSON.stringify({mwalls,mdoors,mstairs}));const s=JSON.parse(mhistory.pop());mwalls=s.mwalls||[];mdoors=s.mdoors||[];mstairs=s.mstairs||[];mselected=-1;objSelected=null;renderManual()};
  $('redo41').onclick=()=>{if(!mredo.length)return;mhistory.push(JSON.stringify({mwalls,mdoors,mstairs}));const s=JSON.parse(mredo.pop());mwalls=s.mwalls||[];mdoors=s.mdoors||[];mstairs=s.mstairs||[];mselected=-1;objSelected=null;renderManual()};
  $('delete41').onclick=()=>{saveManual();if(mselected>=0){mwalls.splice(mselected,1);mselected=-1}else if(objSelected?.kind==='door'){mdoors.splice(objSelected.i,1);objSelected=null}else if(objSelected?.kind==='stairs'){mstairs.splice(objSelected.i,1);objSelected=null}renderManual()};
  $('duplicate41').onclick=()=>{if(mselected<0)return;saveManual();const w={...mwalls[mselected]};w.x1+=20;w.x2+=20;w.y1+=20;w.y2+=20;if(w.cx!==undefined){w.cx+=20;w.cy+=20}mwalls.push((w.type==='ARC'||w.axis==='A')?w:normaliseWall(w));mselected=mwalls.length-1;renderManual()};
  $('shorter41').onclick=()=>{if(mselected<0)return;saveManual();const w=mwalls[mselected];if(w.axis==='H'){w.x1+=10;w.x2-=10}else if(w.axis==='V'){w.y1+=10;w.y2-=10}else{const dx=w.x2-w.x1,dy=w.y2-w.y1,L=Math.hypot(dx,dy)||1;w.x1+=dx/L*10;w.y1+=dy/L*10;w.x2-=dx/L*10;w.y2-=dy/L*10}mwalls[mselected]=(w.type==='ARC'||w.axis==='A')?w:normaliseWall(w);renderManual()};
  $('longer41').onclick=()=>{if(mselected<0)return;saveManual();const w=mwalls[mselected];if(w.axis==='H'){w.x1-=10;w.x2+=10}else if(w.axis==='V'){w.y1-=10;w.y2+=10}else{const dx=w.x2-w.x1,dy=w.y2-w.y1,L=Math.hypot(dx,dy)||1;w.x1-=dx/L*10;w.y1-=dy/L*10;w.x2+=dx/L*10;w.y2+=dy/L*10}mwalls[mselected]=(w.type==='ARC'||w.axis==='A')?w:normaliseWall(w);renderManual()};
  $('rotate41').onclick=()=>{saveManual();if(objSelected?.kind==='stairs'){mstairs[objSelected.i].rot=((mstairs[objSelected.i].rot||0)+90)%360}else if(objSelected?.kind==='door'){mdoors[objSelected.i].angle=((mdoors[objSelected.i].angle||0)+180)%360}else if(mselected>=0&&mwalls[mselected].axis==='A'){const w=mwalls[mselected],cx=(w.x1+w.x2)/2,cy=(w.y1+w.y2)/2,dx=w.x1-cx,dy=w.y1-cy;w.x1=cx-dy;w.y1=cy+dx;w.x2=cx+dy;w.y2=cy-dx}renderManual()};
  $('tidy41').onclick=()=>{saveManual();mwalls=dedupeManual(mwalls);mselected=-1;renderManual();$('manualStatus41').textContent='Plan tidied: aligned wall runs merged and nearby intersections joined.'};
  $('clear41').onclick=()=>{if(!mwalls.length&&!mdoors.length&&!mstairs.length)return;saveManual();mwalls=[];mdoors=[];mstairs=[];outline=[];arcPoints=[];mselected=-1;objSelected=null;renderManual();$('manualStatus41').textContent='Drawing cleared.'};
  $('loadWalls41').onclick=()=>{
    if(!walls.length){$('manualStatus41').textContent='There is no current scanned/drawn wall structure to load yet.';return}
    saveManual();mwalls=clone(walls).map(w=>w.type==='ARC'||w.axis==='A'?w:normaliseWall(w));mselected=-1;objSelected=null;outline=[];renderManual();$('manualStatus41').textContent='Current wall structure loaded. Correct it here, then use this drawing.';
  };
  $('useDrawing41').onclick=()=>{
    if(mwalls.length<4){$('manualStatus41').textContent='Add at least four structural walls before continuing.';return}
    mwalls=dedupeManual(mwalls);
    const structural=[];
    for(const w of mwalls){
      if(w.type==='ARC'){
        let prev={x:w.x1,y:w.y1};
        for(let n=1;n<=12;n++){
          const t=n/12,u=1-t,x=u*u*w.x1+2*u*t*w.cx+t*t*w.x2,y=u*u*w.y1+2*u*t*w.cy+t*t*w.y2;
          structural.push({x1:prev.x,y1:prev.y,x2:x,y2:y,axis:'A',curve:true});prev={x,y};
        }
      }else structural.push({...w});
    }
    walls=clone(structural);selected=-1;history=[];
    window.fireZoneManualAssets={doors:clone(mdoors),stairs:clone(mstairs),rawWalls:clone(mwalls)};
    renderAll();
    $('resultCard').classList.remove('hidden');
    $('originalPane').innerHTML='<div class="status"><b>Manual plan</b><br>This structure was drawn directly in the app rather than reconstructed from a photograph.</div>';
    $('status').textContent='Manual drawing accepted: '+walls.length+' structural walls. Review the clean structural plan, then edit or approve it.';
    $('resultCard').scrollIntoView({behavior:'smooth'});
  };

  $('chooseScan41').onclick=()=>scanSection.scrollIntoView({behavior:'smooth'});
  $('chooseDraw41').onclick=()=>{card.classList.remove('hidden');setMode('wall');card.scrollIntoView({behavior:'smooth'})};

  // If a scan already exists, make it easy to jump straight into correction mode.
  const editBtn=$('editBtn');
  if(editBtn){
    const correction=document.createElement('button');
    correction.id='drawCorrect41';correction.textContent='Correct in drawing mode';
    correction.onclick=()=>{card.classList.remove('hidden');mwalls=clone(window.fireZoneManualAssets?.rawWalls||walls).map(w=>w.type==='ARC'||w.axis==='A'?w:normaliseWall(w));mdoors=clone(window.fireZoneManualAssets?.doors||[]);mstairs=clone(window.fireZoneManualAssets?.stairs||[]);mhistory=[];mredo=[];outline=[];mselected=-1;objSelected=null;setMode('select');card.scrollIntoView({behavior:'smooth'})};
    editBtn.parentElement?.appendChild(correction);
  }

  window.fireZoneManualEditor={
    getState:()=>clone({walls:mwalls,doors:mdoors,stairs:mstairs}),
    setState:(state)=>{
      state=state||{};
      mwalls=clone(state.walls||[]);
      mdoors=clone(state.doors||[]);
      mstairs=clone(state.stairs||[]);
      mhistory=[];mredo=[];mselected=-1;objSelected=null;outline=[];arcPoints=[];gesture=null;
      renderManual();
    },
    open:()=>{
      card.classList.remove('hidden');
      renderManual();
      card.scrollIntoView({behavior:'smooth'});
    }
  };

  renderManual();
})();