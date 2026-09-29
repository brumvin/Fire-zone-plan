// V24 refinement: boundary-aware annotation cleanup.
(function(){
  function inferEnvelope(input){
    const hs=input.filter(w=>w.axis==='H' && wallLength(w)>150);
    const vs=input.filter(w=>w.axis==='V' && wallLength(w)>150);
    if(!hs.length||!vs.length)return null;
    return {
      top:Math.min(...hs.map(w=>w.y1)),
      bottom:Math.max(...hs.map(w=>w.y1)),
      left:Math.min(...vs.map(w=>w.x1)),
      right:Math.max(...vs.map(w=>w.x1))
    };
  }

  function removeSmallClosedLoops(input){
    const remove=new Set();
    const hs=input.map((w,i)=>({w,i})).filter(q=>q.w.axis==='H');
    const vs=input.map((w,i)=>({w,i})).filter(q=>q.w.axis==='V');

    for(let a=0;a<hs.length;a++){
      for(let b=a+1;b<hs.length;b++){
        const h1=hs[a],h2=hs[b];
        const top=Math.min(h1.w.y1,h2.w.y1),bottom=Math.max(h1.w.y1,h2.w.y1);
        const height=bottom-top;
        if(height<18||height>75)continue;

        const left=Math.max(Math.min(h1.w.x1,h1.w.x2),Math.min(h2.w.x1,h2.w.x2));
        const right=Math.min(Math.max(h1.w.x1,h1.w.x2),Math.max(h2.w.x1,h2.w.x2));
        const width=right-left;
        if(width<18||width>75)continue;

        const lv=vs.find(q=>Math.abs(q.w.x1-left)<=10 && Math.min(q.w.y1,q.w.y2)<=top+10 && Math.max(q.w.y1,q.w.y2)>=bottom-10);
        const rv=vs.find(q=>Math.abs(q.w.x1-right)<=10 && Math.min(q.w.y1,q.w.y2)<=top+10 && Math.max(q.w.y1,q.w.y2)>=bottom-10);
        if(!lv||!rv)continue;

        const ids=[h1.i,h2.i,lv.i,rv.i];
        if(!ids.every(i=>wallLength(input[i])<90))continue;

        let links=0;
        for(const i of ids){
          for(let j=0;j<input.length;j++){
            if(ids.includes(j))continue;
            if(wallLength(input[j])>=120 && wallConnected(input[i],input[j],10)){links++;break}
          }
        }
        if(links<=1)ids.forEach(i=>remove.add(i));
      }
    }
    return input.filter((_,i)=>!remove.has(i));
  }

  removeEnvelopeStubs=function(input){
    if(input.length<4)return input;
    const env=inferEnvelope(input);
    let out=input.map(w=>({...w}));

    if(env){
      out=out.filter(w=>{
        const len=wallLength(w);
        if(len>125)return true;

        if(w.axis==='V'){
          const lo=Math.min(w.y1,w.y2),hi=Math.max(w.y1,w.y2);
          if(lo<env.top-8 && hi>env.top+8){
            const outside=env.top-lo,inside=hi-env.top;
            if(outside>=10 && inside<55)return false;
          }
          if(lo<env.bottom-8 && hi>env.bottom+8){
            const inside=env.bottom-lo,outside=hi-env.bottom;
            if(outside>=10 && inside<55)return false;
          }
        }else{
          const lo=Math.min(w.x1,w.x2),hi=Math.max(w.x1,w.x2);
          if(lo<env.left-8 && hi>env.left+8){
            const outside=env.left-lo,inside=hi-env.left;
            if(outside>=10 && inside<55)return false;
          }
          if(lo<env.right-8 && hi>env.right+8){
            const inside=env.right-lo,outside=hi-env.right;
            if(outside>=10 && inside<55)return false;
          }
        }
        return true;
      });
    }

    return removeSmallClosedLoops(out);
  };

  const oldCleanup=$('cleanupBtn').onclick;
  $('cleanupBtn').onclick=()=>{
    save();
    walls=cleanTopology(walls);
    walls=removeEnvelopeStubs(walls);
    connectIntersections();
    renderAll();
    $('status').textContent='V24 cleanup applied: perimeter-crossing annotation strokes and tiny closed symbol loops removed.';
  };
})();