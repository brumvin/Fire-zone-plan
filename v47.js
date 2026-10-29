// V47 - structural-context refinement layered over V46.
(function(){
  if(!$('scanBtn')||typeof runScan!=='function')return;
  const baseScan47=runScan;

  const css=document.createElement('style');
  css.textContent=`
    .v47note{margin-top:8px;padding:9px;border-radius:9px;background:#eef8f1;border-left:4px solid #19704d}
  `;
  document.head.appendChild(css);

  const host=$('scanControls')?.querySelector('.perspective45')||$('scanControls');
  if(host&&!$('v47note')){
    const n=document.createElement('div');n.id='v47note';n.className='v47note small';
    n.innerHTML='<b>V47 structural context:</b> isolated text-like strokes and staircase treads are filtered after detection, while door-separated wall runs and genuine junctions are preserved.';
    host.appendChild(n);
  }

  function segDist47(a,b){
    const dx=b.x2-b.x1,dy=b.y2-b.y1,L=dx*dx+dy*dy||1;
    const t=Math.max(0,Math.min(1,((a.x-b.x1)*dx+(a.y-b.y1)*dy)/L));
    return Math.hypot(a.x-(b.x1+t*dx),a.y-(b.y1+t*dy));
  }
  function endpointLinks47(w,all,tol=13){
    const pts=[{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}],links=[0,0];
    for(let k=0;k<2;k++)for(const o of all){
      if(o===w||o.axis===w.axis)continue;
      if(segDist47(pts[k],o)<=tol)links[k]++;
    }
    return links;
  }
  function crossingLinks47(w,all,tol=7){
    let n=0;
    for(const o of all){
      if(o===w||o.axis===w.axis)continue;
      if(w.axis==='H'){
        const x=o.x1,y=w.y1;
        if(x>=Math.min(w.x1,w.x2)-tol&&x<=Math.max(w.x1,w.x2)+tol&&y>=Math.min(o.y1,o.y2)-tol&&y<=Math.max(o.y1,o.y2)+tol)n++;
      }else{
        const x=w.x1,y=o.y1;
        if(x>=Math.min(o.x1,o.x2)-tol&&x<=Math.max(o.x1,o.x2)+tol&&y>=Math.min(w.y1,w.y2)-tol&&y<=Math.max(w.y1,w.y2)+tol)n++;
      }
    }
    return n;
  }
  function collinearSupport47(w,all){
    const coord=w.axis==='H'?w.y1:w.x1;
    const lo=w.axis==='H'?Math.min(w.x1,w.x2):Math.min(w.y1,w.y2);
    const hi=w.axis==='H'?Math.max(w.x1,w.x2):Math.max(w.y1,w.y2);
    let support=0;
    for(const o of all){
      if(o===w||o.axis!==w.axis)continue;
      const oc=o.axis==='H'?o.y1:o.x1;if(Math.abs(oc-coord)>8)continue;
      const olo=o.axis==='H'?Math.min(o.x1,o.x2):Math.min(o.y1,o.y2);
      const ohi=o.axis==='H'?Math.max(o.x1,o.x2):Math.max(o.y1,o.y2);
      const gap=Math.max(0,Math.max(olo,lo)-Math.min(ohi,hi));
      if(gap<=65)support++;
    }
    return support;
  }

  function stairTreads47(all){
    const remove=new Set();
    const hs=all.map((w,i)=>({w,i})).filter(q=>q.w.axis==='H'&&wallLength(q.w)>=20&&wallLength(q.w)<=75);
    for(let i=0;i<hs.length;i++){
      const a=hs[i],group=[a];
      const ac=(a.w.x1+a.w.x2)/2,alen=wallLength(a.w);
      for(let j=0;j<hs.length;j++){
        if(i===j)continue;
        const b=hs[j],bc=(b.w.x1+b.w.x2)/2,blen=wallLength(b.w);
        if(Math.abs(b.w.y1-a.w.y1)>85)continue;
        if(Math.abs(bc-ac)>18)continue;
        if(Math.abs(blen-alen)>22)continue;
        const xov=Math.min(Math.max(a.w.x1,a.w.x2),Math.max(b.w.x1,b.w.x2))-Math.max(Math.min(a.w.x1,a.w.x2),Math.min(b.w.x1,b.w.x2));
        if(xov>=Math.min(alen,blen)*.65)group.push(b);
      }
      if(group.length>=3){
        const ys=group.map(g=>g.w.y1).sort((x,y)=>x-y);
        let regular=0;
        for(let k=1;k<ys.length;k++){const d=ys[k]-ys[k-1];if(d>=6&&d<=28)regular++}
        if(regular>=2)group.forEach(g=>remove.add(g.i));
      }
    }
    return remove;
  }

  function likelyPageEdge47(w,all){
    const len=wallLength(w);
    if(len<250)return false;
    if(w.axis==='V'&&(w.x1<22||w.x1>W-22)){
      const inward=all.filter(o=>o.axis==='V'&&Math.abs(o.x1-w.x1)>18&&Math.abs(o.x1-w.x1)<95&&wallLength(o)>180);
      if(inward.length)return true;
    }
    if(w.axis==='H'&&(w.y1<18||w.y1>H-18)){
      const inward=all.filter(o=>o.axis==='H'&&Math.abs(o.y1-w.y1)>18&&Math.abs(o.y1-w.y1)<80&&wallLength(o)>180);
      if(inward.length)return true;
    }
    return false;
  }

  function refine47(input){
    const all=input.map(w=>({...w}));
    const stairs=stairTreads47(all);
    const out=[];
    for(let i=0;i<all.length;i++){
      const w=all[i],len=wallLength(w);
      if(stairs.has(i))continue;
      if(likelyPageEdge47(w,all))continue;
      const ends=endpointLinks47(w,all),cross=crossingLinks47(w,all),col=collinearSupport47(w,all);
      const degree=ends[0]+ends[1]+cross;
      const high=w.confidence==='high',medium=w.confidence==='medium';

      let keep=false;
      if(len>=145)keep=true;
      else if(len>=95)keep=degree>=1||col>=1||high||medium;
      else if(len>=58)keep=degree>=1||col>=1||(high&&len>=72);
      else keep=(ends[0]>0&&ends[1]>0)||(degree>=2&&high);

      // Short isolated horizontal/vertical marks are overwhelmingly room-name
      // strokes, arrows or symbol detail in hand sketches.
      if(len<82&&degree===0&&col===0)keep=false;
      if(keep)out.push({...w,contextScore:degree+col});
    }
    return out;
  }

  async function scan47(){
    await baseScan47();
    if(!walls?.length)return;
    const before=walls.length;
    walls=refine47(walls);
    history=[];selected=-1;renderAll();

    const removed=before-walls.length;
    const h=walls.filter(w=>w.axis==='H').length,v=walls.filter(w=>w.axis==='V').length;
    $('status').textContent='V47 contextual scan: '+walls.length+' structural wall sections retained ('+h+' horizontal, '+v+' vertical). '+removed+' text/symbol/stair-detail candidate'+(removed===1?' was':'s were')+' removed using structural context. Compare against the original before approving.';
    if($('scanSteps40'))$('scanSteps40').innerHTML='<b>Scanner:</b> complete — full-plan evidence + structural-context filtering';
  }

  $('scanBtn').textContent='Run V47 contextual scan';
  runScan=scan47;$('scanBtn').onclick=scan47;$('rescanBtn').onclick=scan47;
})();