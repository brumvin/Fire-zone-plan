// V41 - manual plan drawing mode using the same wall model as scanned plans.
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
    <div class="tip"><b>Site drawing mode.</b> Draw roughly with a finger, mouse or Apple Pencil. Walls automatically become straight horizontal or vertical geometry and snap to nearby wall ends.</div>
    <div class="manualStage41">
      <div>
        <div class="canvasWrap manualCanvas41"><svg id="manualPlan41" viewBox="0 0 760 500" aria-label="Manual building plan drawing canvas"></svg></div>
        <div id="manualStatus41" class="status">Choose a drawing tool, then draw the building outline and internal walls.</div>
      </div>
      <div class="manualDock41">
        <h4>Drawing tools</h4>
        <div class="controls">
          <button id="selectMode41">Select / move</button>
          <button id="wallMode41" class="modeActive41">Draw wall</button>
          <button id="outlineMode41">Draw outline</button>
          <button id="rectMode41">Rectangle room</button>
        </div>
        <div id="outlineTools41" class="hidden" style="margin-top:8px"><button id="closeOutline41">Close outline</button></div>
        <hr>
        <h4>Selected wall</h4>
        <div id="manualSelected41" class="status">No wall selected.</div>
        <div class="controls">
          <button id="shorter41">− Shorter</button>
          <button id="longer41">+ Longer</button>
          <button id="duplicate41">Duplicate</button>
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

  let mwalls=[],mhistory=[],mredo=[],mselected=-1,mode='wall',gesture=null,outline=[];
  const svg=$('manualPlan41');
  const clone=x=>JSON.parse(JSON.stringify(x));

  function saveManual(){
    mhistory.push(JSON.stringify(mwalls));
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
  function wallFrom(a,b){
    const dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
    if(dx>=dy)return normaliseWall({x1:a.x,y1:a.y,x2:b.x,y2:a.y,axis:'H'});
    return normaliseWall({x1:a.x,y1:a.y,x2:a.x,y2:b.y,axis:'V'});
  }
  function dedupeManual(list){
    const out=[];
    for(const raw of list.map(normaliseWall)){
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
    return out.map(normaliseWall);
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
    ['select','wall','outline','rect'].forEach(n=>$(n+'Mode41').classList.toggle('modeActive41',n===mode));
    $('outlineTools41').classList.toggle('hidden',mode!=='outline');
    $('manualStatus41').textContent=mode==='wall'?'Drag to draw a wall. It will snap horizontal or vertical.':mode==='rect'?'Drag corner-to-corner to add a rectangular room.':mode==='outline'?'Tap each perimeter corner, then press Close outline.':'Tap a wall to move it or drag an orange end handle to resize it.';
    renderManual();
  }

  function renderManual(){
    const rooms=enclosedCells();
    let s='<rect width="760" height="500" fill="transparent"/>';
    for(const g of rooms)for(const c of g)s+='<rect class="roomPreview41" x="'+c.x1+'" y="'+c.y1+'" width="'+(c.x2-c.x1)+'" height="'+(c.y2-c.y1)+'"/>';
    mwalls.forEach((w,i)=>{
      s+='<g data-mwall41="'+i+'"><line class="drawWall41 '+(mselected===i?'selected':'')+'" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/><line class="drawHit41" data-mwall41="'+i+'" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>';
      if(mselected===i)s+='<circle class="drawHandle41" data-mwall41="'+i+'" data-mend41="1" cx="'+w.x1+'" cy="'+w.y1+'" r="9"/><circle class="drawHandle41" data-mwall41="'+i+'" data-mend41="2" cx="'+w.x2+'" cy="'+w.y2+'" r="9"/>';
      s+='</g>';
    });
    if(outline.length){
      for(const p of outline)s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="5" fill="#1769aa"/>';
    }
    if(gesture&&(gesture.type==='wall'||gesture.type==='rect')){
      const a=gesture.start,b=gesture.now||a;
      if(gesture.type==='wall'){
        const w=wallFrom(a,b);s+='<line class="previewWall41" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>';
      }else{
        const x1=Math.min(a.x,b.x),x2=Math.max(a.x,b.x),y1=Math.min(a.y,b.y),y2=Math.max(a.y,b.y);
        s+='<rect x="'+x1+'" y="'+y1+'" width="'+(x2-x1)+'" height="'+(y2-y1)+'" fill="none" class="previewWall41"/>';
      }
    }
    svg.innerHTML=s;
    $('mWalls41').textContent=mwalls.length;$('mRooms41').textContent=rooms.length;
    if(mselected>=0&&mwalls[mselected])$('manualSelected41').textContent=mwalls[mselected].axis+' wall · '+Math.round(wallLength(mwalls[mselected]))+' units';
    else $('manualSelected41').textContent='No wall selected.';
  }

  $('selectMode41').onclick=()=>setMode('select');
  $('wallMode41').onclick=()=>setMode('wall');
  $('outlineMode41').onclick=()=>{outline=[];setMode('outline')};
  $('rectMode41').onclick=()=>setMode('rect');

  svg.addEventListener('pointerdown',e=>{
    e.preventDefault();const p=mp(e);
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
      const h=e.target.closest('[data-mwall41]');
      if(!h){mselected=-1;renderManual();return}
      const i=+h.dataset.mwall41,w=mwalls[i];mselected=i;saveManual();
      const end=e.target.dataset.mend41;
      gesture=end?{type:'end',i,end:+end,id:e.pointerId}:{type:'move',i,id:e.pointerId,start:p,orig:{...w}};
      svg.setPointerCapture?.(e.pointerId);renderManual();return;
    }
    gesture={type:mode,start:p,now:p,id:e.pointerId};svg.setPointerCapture?.(e.pointerId);renderManual();
  });
  svg.addEventListener('pointermove',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const p=mp(e);
    if(gesture.type==='wall'||gesture.type==='rect'){gesture.now=p;renderManual();return}
    const w=mwalls[gesture.i];if(!w)return;
    if(gesture.type==='move'){
      const dx=snap(p.x-gesture.start.x),dy=snap(p.y-gesture.start.y);
      if(w.axis==='H'){w.x1=gesture.orig.x1+dx;w.x2=gesture.orig.x2+dx;w.y1=w.y2=gesture.orig.y1+dy}
      else{w.x1=w.x2=gesture.orig.x1+dx;w.y1=gesture.orig.y1+dy;w.y2=gesture.orig.y2+dy}
    }else{
      const q=snapNear(p,gesture.i);
      if(w.axis==='H'){if(gesture.end===1)w.x1=q.x;else w.x2=q.x}
      else{if(gesture.end===1)w.y1=q.y;else w.y2=q.y}
    }
    mwalls[gesture.i]=normaliseWall(w);renderManual();
  });
  function finishGesture(e){
    if(!gesture||gesture.id!==e.pointerId)return;
    try{svg.releasePointerCapture?.(e.pointerId)}catch{}
    if(gesture.type==='wall'){
      const w=wallFrom(gesture.start,gesture.now||gesture.start);
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

  $('undo41').onclick=()=>{if(!mhistory.length)return;mredo.push(JSON.stringify(mwalls));mwalls=JSON.parse(mhistory.pop());mselected=-1;renderManual()};
  $('redo41').onclick=()=>{if(!mredo.length)return;mhistory.push(JSON.stringify(mwalls));mwalls=JSON.parse(mredo.pop());mselected=-1;renderManual()};
  $('delete41').onclick=()=>{if(mselected<0)return;saveManual();mwalls.splice(mselected,1);mselected=-1;renderManual()};
  $('duplicate41').onclick=()=>{if(mselected<0)return;saveManual();const w={...mwalls[mselected]};if(w.axis==='H'){w.y1+=20;w.y2+=20}else{w.x1+=20;w.x2+=20}mwalls.push(normaliseWall(w));mselected=mwalls.length-1;renderManual()};
  $('shorter41').onclick=()=>{if(mselected<0)return;saveManual();const w=mwalls[mselected];if(w.axis==='H'){w.x1+=10;w.x2-=10}else{w.y1+=10;w.y2-=10}mwalls[mselected]=normaliseWall(w);renderManual()};
  $('longer41').onclick=()=>{if(mselected<0)return;saveManual();const w=mwalls[mselected];if(w.axis==='H'){w.x1-=10;w.x2+=10}else{w.y1-=10;w.y2+=10}mwalls[mselected]=normaliseWall(w);renderManual()};
  $('tidy41').onclick=()=>{saveManual();mwalls=dedupeManual(mwalls);mselected=-1;renderManual();$('manualStatus41').textContent='Plan tidied: aligned wall runs merged and nearby intersections joined.'};
  $('clear41').onclick=()=>{if(!mwalls.length)return;saveManual();mwalls=[];outline=[];mselected=-1;renderManual();$('manualStatus41').textContent='Drawing cleared.'};
  $('loadWalls41').onclick=()=>{
    if(!walls.length){$('manualStatus41').textContent='There is no current scanned/drawn wall structure to load yet.';return}
    saveManual();mwalls=clone(walls).map(normaliseWall);mselected=-1;outline=[];renderManual();$('manualStatus41').textContent='Current wall structure loaded. Correct it here, then use this drawing.';
  };
  $('useDrawing41').onclick=()=>{
    if(mwalls.length<4){$('manualStatus41').textContent='Add at least four structural walls before continuing.';return}
    mwalls=dedupeManual(mwalls);
    walls=clone(mwalls).map(normaliseWall);selected=-1;history=[];
    connectIntersections();renderAll();
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
    correction.onclick=()=>{card.classList.remove('hidden');mwalls=clone(walls).map(normaliseWall);mhistory=[];mredo=[];outline=[];mselected=-1;setMode('select');card.scrollIntoView({behavior:'smooth'})};
    editBtn.parentElement?.appendChild(correction);
  }

  renderManual();
})();