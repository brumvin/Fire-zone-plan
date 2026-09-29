// V26 - corridor-aware structural protection.
// Prevents aligned room partitions above/below a corridor being merged through it.
(function(){
  function len(w){return wallLength(w)}
  function segOverlap(a1,a2,b1,b2){
    const lo=Math.max(Math.min(a1,a2),Math.min(b1,b2));
    const hi=Math.min(Math.max(a1,a2),Math.max(b1,b2));
    return Math.max(0,hi-lo);
  }
  function envOf(input){
    const xs=input.flatMap(w=>[w.x1,w.x2]),ys=input.flatMap(w=>[w.y1,w.y2]);
    if(!xs.length||!ys.length)return null;
    return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
  }
  function findHorizontalBand(input,env){
    const hs=input.filter(w=>w.axis==='H'&&len(w)>=(env.right-env.left)*.42);
    let best=null;
    for(let i=0;i<hs.length;i++)for(let j=i+1;j<hs.length;j++){
      const a=hs[i],b=hs[j],sep=Math.abs(a.y1-b.y1);
      if(sep<22||sep>95)continue;
      const ov=segOverlap(a.x1,a.x2,b.x1,b.x2);
      const minLen=Math.min(len(a),len(b));
      if(ov<minLen*.55)continue;
      const left=Math.max(Math.min(a.x1,a.x2),Math.min(b.x1,b.x2));
      const right=Math.min(Math.max(a.x1,a.x2),Math.max(b.x1,b.x2));
      const score=ov-(sep*.6);
      if(!best||score>best.score)best={kind:'H',top:Math.min(a.y1,b.y1),bottom:Math.max(a.y1,b.y1),left,right,score};
    }
    return best;
  }
  function findVerticalBand(input,env){
    const vs=input.filter(w=>w.axis==='V'&&len(w)>=(env.bottom-env.top)*.42);
    let best=null;
    for(let i=0;i<vs.length;i++)for(let j=i+1;j<vs.length;j++){
      const a=vs[i],b=vs[j],sep=Math.abs(a.x1-b.x1);
      if(sep<22||sep>95)continue;
      const ov=segOverlap(a.y1,a.y2,b.y1,b.y2);
      const minLen=Math.min(len(a),len(b));
      if(ov<minLen*.55)continue;
      const top=Math.max(Math.min(a.y1,a.y2),Math.min(b.y1,b.y2));
      const bottom=Math.min(Math.max(a.y1,a.y2),Math.max(b.y1,b.y2));
      const score=ov-(sep*.6);
      if(!best||score>best.score)best={kind:'V',left:Math.min(a.x1,b.x1),right:Math.max(a.x1,b.x1),top,bottom,score};
    }
    return best;
  }
  function protectHorizontal(input,band,env){
    if(!band)return {walls:input,changed:0};
    const out=[],edge=28;let changed=0;
    for(const w of input){
      if(w.axis!=='V'){out.push({...w});continue}
      const x=w.x1,lo=Math.min(w.y1,w.y2),hi=Math.max(w.y1,w.y2);
      const insideSpan=x>band.left+edge&&x<band.right-edge;
      const notOuter=x>env.left+edge&&x<env.right-edge;
      if(insideSpan&&notOuter&&lo<band.top-5&&hi>band.bottom+5){
        const upper={...w,y1:lo,y2:band.top};
        const lower={...w,y1:band.bottom,y2:hi};
        if(len(upper)>=22)out.push(upper);
        if(len(lower)>=22)out.push(lower);
        changed++;
      }else out.push({...w});
    }
    return {walls:out,changed};
  }
  function protectVertical(input,band,env){
    if(!band)return {walls:input,changed:0};
    const out=[],edge=28;let changed=0;
    for(const w of input){
      if(w.axis!=='H'){out.push({...w});continue}
      const y=w.y1,lo=Math.min(w.x1,w.x2),hi=Math.max(w.x1,w.x2);
      const insideSpan=y>band.top+edge&&y<band.bottom-edge;
      const notOuter=y>env.top+edge&&y<env.bottom-edge;
      if(insideSpan&&notOuter&&lo<band.left-5&&hi>band.right+5){
        const left={...w,x1:lo,x2:band.left};
        const right={...w,x1:band.right,x2:hi};
        if(len(left)>=22)out.push(left);
        if(len(right)>=22)out.push(right);
        changed++;
      }else out.push({...w});
    }
    return {walls:out,changed};
  }
  function protectCorridors(input){
    const env=envOf(input);
    if(!env)return {walls:input,changed:0,band:null};
    const hb=findHorizontalBand(input,env),vb=findVerticalBand(input,env);
    let result={walls:input.map(w=>({...w})),changed:0,band:null};
    // Use the stronger corridor candidate. This prevents accidental over-cutting on simple room grids.
    const chosen=hb&&vb?(hb.score>=vb.score?hb:vb):(hb||vb);
    if(!chosen)return result;
    if(chosen.kind==='H')result=protectHorizontal(result.walls,chosen,env);
    else result=protectVertical(result.walls,chosen,env);
    result.band=chosen;
    return result;
  }

  function applyCorridorProtection(message){
    if(!walls.length)return 0;
    const r=protectCorridors(walls);
    if(r.changed){
      walls=r.walls.map(normaliseWall);
      connectIntersections();
      renderAll();
      const label=r.band&&r.band.kind==='H'?'horizontal':'vertical';
      $('status').textContent=(message||'Corridor protection applied')+': '+r.changed+' crossing partition'+(r.changed===1?'':'s')+' opened through the '+label+' corridor.';
    }
    return r.changed;
  }

  // Re-run protection after the normal scanner finishes.
  const baseRunScan=runScan;
  runScan=async function(){
    await baseRunScan();
    applyCorridorProtection('Scan complete');
  };
  $('scanBtn').onclick=runScan;
  $('rescanBtn').onclick=runScan;

  // Also apply it after structural cleanup.
  const baseCleanup=$('cleanupBtn').onclick;
  $('cleanupBtn').onclick=()=>{
    if(baseCleanup)baseCleanup();
    applyCorridorProtection('Cleanup complete');
  };

  // A manual control is useful if the engineer adjusts walls before approving.
  const btn=document.createElement('button');
  btn.id='corridorBtnV26';
  btn.textContent='Protect corridor';
  btn.onclick=()=>{
    const n=applyCorridorProtection('Corridor check complete');
    if(!n)$('status').textContent='No likely corridor-crossing partitions were found.';
  };
  const editBtn=$('editBtn');
  if(editBtn&&editBtn.parentElement)editBtn.parentElement.insertBefore(btn,editBtn);

  // Apply once more at approval so room generation always sees the corrected graph.
  const baseApprove=$('approveBtn').onclick;
  $('approveBtn').onclick=()=>{
    applyCorridorProtection('Approval check complete');
    if(baseApprove)baseApprove();
  };
})();