// V45 - evidence-first high-accuracy scanner with perspective correction and consensus endpoints.
(function(){
  const scanControls=$('scanControls');
  if(!scanControls||!$('scanBtn'))return;

  const css=document.createElement('style');
  css.textContent=`
    .perspective45{margin-top:10px;border:2px solid #dfe7ea;border-radius:12px;padding:10px;background:#fbfcfc}
    .cornerWrap45{position:relative;border:1px solid #d8e0e4;border-radius:9px;overflow:hidden;background:#eef2f4;margin-top:8px}
    #cornerSvg45{width:100%;height:auto;max-height:340px;touch-action:none;display:block}
    .corner45{fill:#ed6a32;stroke:#fff;stroke-width:3;cursor:grab}
    .cornerLine45{fill:#1769aa18;stroke:#1769aa;stroke-width:3;stroke-dasharray:8 5}
    .review45{margin-top:9px;padding:9px;border-radius:9px;background:#fff6df;border-left:4px solid #ed6a32}
    .confidence45{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}
    .confidence45 span{font-size:12px;font-weight:800;padding:4px 7px;border-radius:999px;border:1px solid #ccd6da;background:#fff}
    @media(max-width:700px){.perspective45 .actions{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(css);

  const host=$('scanControls').querySelector('.scanQuality40')||scanControls;
  const panel=document.createElement('div');
  panel.className='perspective45';
  panel.innerHTML=`
    <b>V45 accuracy controls</b>
    <div class="small">Optional: move the four orange corners onto the paper corners before scanning. This flattens perspective before wall detection.</div>
    <div class="cornerWrap45 hidden" id="cornerWrap45">
      <svg id="cornerSvg45" viewBox="0 0 760 500" aria-label="Perspective corner editor"></svg>
    </div>
    <div class="actions" style="margin-top:8px">
      <button id="autoCorners45">Auto page corners</button>
      <button id="resetCorners45">Reset corners</button>
      <button id="togglePerspective45" class="blue">Perspective ON</button>
    </div>
    <div class="confidence45">
      <span>HIGH = 3-pass agreement</span>
      <span>MEDIUM = 2-pass agreement</span>
      <span>REVIEW = long single-pass evidence</span>
    </div>
    <div id="review45" class="review45 hidden"></div>
  `;
  host.appendChild(panel);

  let corners=[
    {x:.015,y:.015},{x:.985,y:.015},{x:.985,y:.985},{x:.015,y:.985}
  ];
  let perspectiveOn=true,cornerDrag=-1,lastFused=[];

  function clamp01(v){return Math.max(0,Math.min(1,v))}
  function median(a){
    if(!a.length)return 0;
    const s=a.slice().sort((x,y)=>x-y),m=Math.floor(s.length/2);
    return s.length%2?s[m]:(s[m-1]+s[m])/2;
  }
  function renderCorners(){
    const svg=$('cornerSvg45');
    if(!svg||!source)return;
    const pts=corners.map(p=>({x:p.x*760,y:p.y*500}));
    let s='<image href="'+source+'" x="0" y="0" width="760" height="500" preserveAspectRatio="none"/>';
    s+='<polygon class="cornerLine45" points="'+pts.map(p=>p.x+','+p.y).join(' ')+'"/>';
    pts.forEach((p,i)=>s+='<circle class="corner45" data-corner45="'+i+'" cx="'+p.x+'" cy="'+p.y+'" r="12"/>');
    svg.innerHTML=s;
    $('cornerWrap45').classList.remove('hidden');
  }
  function svgPoint45(e){
    const svg=$('cornerSvg45'),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  $('cornerSvg45').addEventListener('pointerdown',e=>{
    const h=e.target.closest('[data-corner45]');if(!h)return;
    e.preventDefault();cornerDrag=+h.dataset.corner45;$('cornerSvg45').setPointerCapture?.(e.pointerId);
  });
  $('cornerSvg45').addEventListener('pointermove',e=>{
    if(cornerDrag<0)return;e.preventDefault();
    const p=svgPoint45(e);
    corners[cornerDrag]={x:clamp01(p.x/760),y:clamp01(p.y/500)};
    renderCorners();
  });
  function endCorner(e){if(cornerDrag>=0){try{$('cornerSvg45').releasePointerCapture?.(e.pointerId)}catch{}cornerDrag=-1}}
  $('cornerSvg45').addEventListener('pointerup',endCorner);
  $('cornerSvg45').addEventListener('pointercancel',endCorner);

  $('resetCorners45').onclick=()=>{corners=[{x:.015,y:.015},{x:.985,y:.015},{x:.985,y:.985},{x:.015,y:.985}];renderCorners()};
  $('togglePerspective45').onclick=()=>{
    perspectiveOn=!perspectiveOn;
    $('togglePerspective45').textContent='Perspective '+(perspectiveOn?'ON':'OFF');
    $('togglePerspective45').classList.toggle('blue',perspectiveOn);
  };

  function autoCorners(){
    if(!sourceImg)return;
    const sw=360,sh=Math.max(220,Math.round(sw*sourceImg.height/sourceImg.width));
    const c=document.createElement('canvas');c.width=sw;c.height=sh;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(sourceImg,0,0,sw,sh);
    const d=x.getImageData(0,0,sw,sh).data;
    const lum=(xx,yy)=>{const i=(yy*sw+xx)*4;return .2126*d[i]+.7152*d[i+1]+.0722*d[i+2]};
    // Find strong brightness transitions from each edge. Use medians over scanlines
    // so shadows/fingers do not dominate one row or column.
    const lefts=[],rights=[],tops=[],bottoms=[];
    for(let y=Math.floor(sh*.12);y<sh*.88;y+=4){
      let bestL=0,scoreL=0,bestR=sw-1,scoreR=0;
      for(let xx=2;xx<sw*.3;xx++){const q=Math.abs(lum(xx+2,y)-lum(xx-2,y));if(q>scoreL){scoreL=q;bestL=xx}}
      for(let xx=Math.floor(sw*.7);xx<sw-2;xx++){const q=Math.abs(lum(xx+2,y)-lum(xx-2,y));if(q>scoreR){scoreR=q;bestR=xx}}
      if(scoreL>14)lefts.push(bestL);if(scoreR>14)rights.push(bestR);
    }
    for(let xx=Math.floor(sw*.12);xx<sw*.88;xx+=4){
      let bestT=0,scoreT=0,bestB=sh-1,scoreB=0;
      for(let y=2;y<sh*.3;y++){const q=Math.abs(lum(xx,y+2)-lum(xx,y-2));if(q>scoreT){scoreT=q;bestT=y}}
      for(let y=Math.floor(sh*.7);y<sh-2;y++){const q=Math.abs(lum(xx,y+2)-lum(xx,y-2));if(q>scoreB){scoreB=q;bestB=y}}
      if(scoreT>14)tops.push(bestT);if(scoreB>14)bottoms.push(bestB);
    }
    if(lefts.length>6&&rights.length>6&&tops.length>6&&bottoms.length>6){
      const l=clamp01(median(lefts)/sw),r=clamp01(median(rights)/sw),t=clamp01(median(tops)/sh),b=clamp01(median(bottoms)/sh);
      if(r-l>.45&&b-t>.45)corners=[{x:l,y:t},{x:r,y:t},{x:r,y:b},{x:l,y:b}];
    }
    renderCorners();
  }
  $('autoCorners45').onclick=autoCorners;

  function solve8(A,b){
    const n=8,M=A.map((r,i)=>r.slice().concat([b[i]]));
    for(let col=0;col<n;col++){
      let pivot=col;
      for(let r=col+1;r<n;r++)if(Math.abs(M[r][col])>Math.abs(M[pivot][col]))pivot=r;
      [M[col],M[pivot]]=[M[pivot],M[col]];
      const div=M[col][col]||1e-12;
      for(let j=col;j<=n;j++)M[col][j]/=div;
      for(let r=0;r<n;r++)if(r!==col){
        const f=M[r][col];if(!f)continue;
        for(let j=col;j<=n;j++)M[r][j]-=f*M[col][j];
      }
    }
    return M.map(r=>r[n]);
  }
  function homography(dst,src){
    const A=[],b=[];
    for(let i=0;i<4;i++){
      const x=dst[i].x,y=dst[i].y,u=src[i].x,v=src[i].y;
      A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);
      A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);
    }
    return solve8(A,b);
  }

  function perspectiveGray(outW){
    const outH=Math.round(outW*H/W);
    const maxSrc=1400,scale=Math.min(1,maxSrc/sourceImg.width);
    const sw=Math.max(2,Math.round(sourceImg.width*scale)),sh=Math.max(2,Math.round(sourceImg.height*scale));
    const c=document.createElement('canvas');c.width=sw;c.height=sh;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,sw,sh);ctx.drawImage(sourceImg,0,0,sw,sh);
    const rgba=ctx.getImageData(0,0,sw,sh).data;
    const srcPts=(perspectiveOn?corners:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]).map(p=>({x:p.x*(sw-1),y:p.y*(sh-1)}));
    const dstPts=[{x:0,y:0},{x:outW-1,y:0},{x:outW-1,y:outH-1},{x:0,y:outH-1}];
    const h=homography(dstPts,srcPts),gray=new Uint8Array(outW*outH);
    for(let y=0;y<outH;y++)for(let x=0;x<outW;x++){
      const den=h[6]*x+h[7]*y+1;
      const sx=Math.max(0,Math.min(sw-1,(h[0]*x+h[1]*y+h[2])/den));
      const sy=Math.max(0,Math.min(sh-1,(h[3]*x+h[4]*y+h[5])/den));
      const ix=Math.round(sx),iy=Math.round(sy),i=(iy*sw+ix)*4;
      gray[y*outW+x]=Math.round(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]);
    }
    return {gray,sw:outW,sh:outH};
  }
  function rotateGray(im,deg){
    if(Math.abs(deg)<.1)return im;
    const {gray,sw,sh}=im,out=new Uint8Array(gray.length),r=-deg*Math.PI/180,co=Math.cos(r),si=Math.sin(r),cx=(sw-1)/2,cy=(sh-1)/2;
    out.fill(255);
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
      const dx=x-cx,dy=y-cy,sx=Math.round(dx*co-dy*si+cx),sy=Math.round(dx*si+dy*co+cy);
      if(sx>=0&&sx<sw&&sy>=0&&sy<sh)out[y*sw+x]=gray[sy*sw+sx];
    }
    return {gray:out,sw,sh};
  }
  function prepared(sw,deg=0){return rotateGray(perspectiveGray(sw),deg)}

  function qualitySample45(){
    const q=prepared(420,0),gray=q.gray,sw=q.sw,sh=q.sh;
    let sum=0,sum2=0,grad=0,gc=0;
    for(const v of gray){sum+=v;sum2+=v*v}
    for(let y=1;y<sh-1;y+=2)for(let x=1;x<sw-1;x+=2){const i=y*sw+x;grad+=Math.abs(gray[i+1]-gray[i-1])+Math.abs(gray[i+sw]-gray[i-sw]);gc+=2}
    const mean=sum/gray.length,sd=Math.sqrt(Math.max(0,sum2/gray.length-mean*mean));
    return {...q,mean,sd,sharp:grad/Math.max(1,gc)};
  }
  function estimateSkew45(q){
    const pts=[],{gray,sw,sh}=q;
    for(let y=2;y<sh-2;y+=2)for(let x=2;x<sw-2;x+=2)if(gray[y*sw+x]<Math.min(185,q.mean-24))pts.push([x-sw/2,y-sh/2]);
    if(pts.length<120)return 0;
    let best={a:0,s:-Infinity},zero=0;
    for(let a=-5;a<=5.001;a+=.5){
      const r=a*Math.PI/180,co=Math.cos(r),si=Math.sin(r),rows=new Uint16Array(sh),cols=new Uint16Array(sw),step=Math.max(1,Math.floor(pts.length/14000));
      for(let k=0;k<pts.length;k+=step){const p=pts[k],x=Math.round(p[0]*co-p[1]*si+sw/2),y=Math.round(p[0]*si+p[1]*co+sh/2);if(x>=0&&x<sw&&y>=0&&y<sh){rows[y]++;cols[x]++}}
      let score=0;for(const n of rows)score+=n*n;for(const n of cols)score+=n*n;
      if(Math.abs(a)<.01)zero=score;if(score>best.s)best={a,s:score};
    }
    return zero&&best.s<zero*1.03?0:Math.round(best.a*2)/2;
  }

  function workerSource45(){
    return `
      function localBinary(gray,w,h,r,bias){
        const iw=w+1,integ=new Uint32Array((w+1)*(h+1));
        for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){row+=gray[(y-1)*w+x-1];integ[y*iw+x]=integ[(y-1)*iw+x]+row}}
        const bin=new Uint8Array(w*h);
        for(let y=0;y<h;y++){const y0=Math.max(0,y-r),y1=Math.min(h-1,y+r);for(let x=0;x<w;x++){
          const x0=Math.max(0,x-r),x1=Math.min(w-1,x+r),A=integ[y0*iw+x0],B=integ[y0*iw+x1+1],C=integ[(y1+1)*iw+x0],D=integ[(y1+1)*iw+x1+1];
          const mean=(D-B-C+A)/((x1-x0+1)*(y1-y0+1));bin[y*w+x]=gray[y*w+x]<mean-bias?1:0;
        }}return bin;
      }
      function scan(bin,w,h,minOut,gapAllow,pass){
        const sx=760/w,sy=500/h,minH=minOut/sx,minV=minOut/sy,hs=[],vs=[],step=w>=850?2:1;
        function rowHit(y,x){for(let d=-2;d<=2;d++){const yy=y+d;if(yy>=0&&yy<h&&bin[yy*w+x])return 1}return 0}
        function colHit(x,y){for(let d=-2;d<=2;d++){const xx=x+d;if(xx>=0&&xx<w&&bin[y*w+xx])return 1}return 0}
        for(let y=2;y<h-2;y+=step){let st=-1,last=-1,gap=0,hits=0;for(let x=1;x<w-1;x++){
          if(rowHit(y,x)){if(st<0)st=x;last=x;hits++;gap=0}else if(st>=0&&++gap>gapAllow){const len=last-st,dens=hits/Math.max(1,len);if(len>=minH&&dens>.47)hs.push({x1:st*sx,y1:y*sy,x2:last*sx,y2:y*sy,axis:'H',pass,score:hits,dens});st=-1;last=-1;gap=0;hits=0}
        }}
        for(let x=2;x<w-2;x+=step){let st=-1,last=-1,gap=0,hits=0;for(let y=1;y<h-1;y++){
          if(colHit(x,y)){if(st<0)st=y;last=y;hits++;gap=0}else if(st>=0&&++gap>gapAllow){const len=last-st,dens=hits/Math.max(1,len);if(len>=minV&&dens>.47)vs.push({x1:x*sx,y1:st*sy,x2:x*sx,y2:last*sy,axis:'V',pass,score:hits,dens});st=-1;last=-1;gap=0;hits=0}
        }}
        return hs.concat(vs);
      }
      self.onmessage=e=>{const p=e.data,all=[];for(let i=0;i<p.images.length;i++){self.postMessage({type:'progress',message:'evidence pass '+(i+1)+' of '+p.images.length});const im=p.images[i],bin=localBinary(new Uint8Array(im.gray),im.w,im.h,im.radius,im.bias);all.push(...scan(bin,im.w,im.h,p.minLen,im.gap,i))}self.postMessage({type:'done',segments:all})};
    `;
  }
  function workerDetect45(images,minLen,sensitivity){
    return new Promise((resolve,reject)=>{
      let worker;try{worker=new Worker(URL.createObjectURL(new Blob([workerSource45()],{type:'application/javascript'})))}catch(e){reject(e);return}
      worker.onmessage=e=>{if(e.data.type==='progress')$('scanSteps40').innerHTML='<b>Scanner:</b> '+e.data.message;else if(e.data.type==='done'){worker.terminate();resolve(e.data.segments)}};
      worker.onerror=e=>{worker.terminate();reject(new Error(e.message||'Worker failed'))};
      const adjust=(58-sensitivity)*.18;
      const payload=images.map((im,i)=>({w:im.sw,h:im.sh,gray:im.gray.buffer,radius:[10,15,22][i],bias:Math.max(3,Math.min(20,[7,11,15][i]+adjust)),gap:[3,4,5][i]}));
      worker.postMessage({images:payload,minLen},payload.map(p=>p.gray));
    });
  }
  function overlap45(a1,a2,b1,b2){return Math.min(Math.max(a1,a2),Math.max(b1,b2))-Math.max(Math.min(a1,a2),Math.min(b1,b2))}
  function fuse45(raw){
    const groups=[];
    for(const s0 of raw.slice().sort((a,b)=>(b.score||0)-(a.score||0))){
      const s=normaliseWall(s0),coord=s.axis==='H'?s.y1:s.x1,lo=s.axis==='H'?s.x1:s.y1,hi=s.axis==='H'?s.x2:s.y2;
      let best=null,bd=99;
      for(const g of groups){
        if(g.axis!==s.axis)continue;
        const d=Math.abs(g.coord-coord),ov=overlap45(g.lo,g.hi,lo,hi);
        if(d<=9&&ov>=Math.min(12,Math.min(g.hi-g.lo,hi-lo)*.22)&&d<bd){best=g;bd=d}
      }
      if(!best){groups.push({axis:s.axis,coord,lo,hi,members:[{pass:s0.pass,lo,hi,coord,score:s0.score||1}]})}
      else{
        best.members.push({pass:s0.pass,lo,hi,coord,score:s0.score||1});
        best.coord=median(best.members.map(m=>m.coord));
        // Broad grouping is only for association. Final endpoints are consensus medians, not extremes.
        best.lo=Math.min(best.lo,lo);best.hi=Math.max(best.hi,hi);
      }
    }
    const minLen=+$('minLength').value,out=[];
    for(const g of groups){
      const per=[];
      for(const p of [...new Set(g.members.map(m=>m.pass))]){
        const m=g.members.filter(x=>x.pass===p);
        per.push({pass:p,lo:median(m.map(x=>x.lo)),hi:median(m.map(x=>x.hi)),coord:median(m.map(x=>x.coord))});
      }
      const passes=per.length;
      const lo=median(per.map(x=>x.lo)),hi=median(per.map(x=>x.hi)),coord=median(per.map(x=>x.coord));
      if(passes<2&&(hi-lo)<Math.max(165,minLen*3))continue;
      const c=snap(coord),a=snap(lo),b=snap(hi);
      if(b-a<minLen)continue;
      const w=g.axis==='H'?{x1:a,y1:c,x2:b,y2:c,axis:'H'}:{x1:c,y1:a,x2:c,y2:b,axis:'V'};
      w.confidence=passes>=3?'high':passes===2?'medium':'review';
      w.passCount=passes;out.push(w);
    }
    return out;
  }

  function safeJoin45(list){
    const hs=list.filter(w=>w.axis==='H'),vs=list.filter(w=>w.axis==='V'),gap=7;
    for(const h of hs)for(const v of vs){
      const x=v.x1,y=h.y1;
      if(x>=h.x1-gap&&x<=h.x2+gap&&y>=v.y1-gap&&y<=v.y2+gap){
        if(Math.abs(h.x1-x)<=gap)h.x1=x;if(Math.abs(h.x2-x)<=gap)h.x2=x;
        if(Math.abs(v.y1-y)<=gap)v.y1=y;if(Math.abs(v.y2-y)<=gap)v.y2=y;
      }
    }
    return list;
  }
  function conservativeTopology45(input){
    let a=input.map(w=>({...normaliseWall(w),confidence:w.confidence,passCount:w.passCount}));
    a=a.filter(w=>!(w.axis==='H'&&(w.y1<25||w.y1>H-25))&&!(w.axis==='V'&&(w.x1<25||w.x1>W-25)));
    const anchors=a.filter(w=>wallLength(w)>=100&&w.confidence!=='review');
    a=a.filter(w=>{
      if(w.confidence==='high'||wallLength(w)>=120)return true;
      if(wallLength(w)<45)return false;
      return anchors.some(o=>o!==w&&wallConnected(w,o,12));
    });
    const xs=clusterCoords(a.filter(w=>w.axis==='V').map(w=>w.x1),8),ys=clusterCoords(a.filter(w=>w.axis==='H').map(w=>w.y1),8);
    a=a.map(w=>{
      if(w.axis==='H'){const y=nearestCluster(w.y1,ys);return {...w,y1:y,y2:y,x1:snap(w.x1),x2:snap(w.x2)}}
      const x=nearestCluster(w.x1,xs);return {...w,x1:x,x2:x,y1:snap(w.y1),y2:snap(w.y2)}
    });
    a=safeJoin45(a);
    // De-dupe conservatively: keep the higher-confidence candidate rather than unioning endpoints.
    const rank={high:3,medium:2,review:1},out=[];
    for(const w of a){
      const idx=out.findIndex(o=>o.axis===w.axis&&Math.abs((o.axis==='H'?o.y1:o.x1)-(w.axis==='H'?w.y1:w.x1))<=4&&
        (w.axis==='H'?overlap45(o.x1,o.x2,w.x1,w.x2):overlap45(o.y1,o.y2,w.y1,w.y2))>Math.min(20,wallLength(w)*.35));
      if(idx<0)out.push({...w});
      else{
        const o=out[idx],ro=rank[o.confidence]||0,rw=rank[w.confidence]||0;
        if(rw>ro||(rw===ro&&wallLength(w)>wallLength(o)))out[idx]={...w};
      }
    }
    if(out.length<2)return out;
    // Keep dominant connected structure, but with a smaller tolerance so page edges/folds do not join it.
    const seen=new Set(),comps=[];
    for(let i=0;i<out.length;i++){
      if(seen.has(i))continue;const st=[i],co=[];seen.add(i);
      while(st.length){const n=st.pop();co.push(n);for(let j=0;j<out.length;j++)if(!seen.has(j)&&wallConnected(out[n],out[j],14)){seen.add(j);st.push(j)}}
      comps.push(co);
    }
    comps.sort((aa,bb)=>bb.reduce((s,i)=>s+wallLength(out[i]),0)-aa.reduce((s,i)=>s+wallLength(out[i]),0));
    const keep=new Set(comps[0]||[]);
    for(let ci=1;ci<comps.length;ci++)for(const idx of comps[ci]){
      if((out[idx].confidence==='high'||out[idx].confidence==='medium')&&[...keep].some(k=>wallConnected(out[idx],out[k],22)))keep.add(idx);
    }
    return out.filter((_,i)=>keep.has(i));
  }

  function updateQuality45(q,skew){
    const cg=q.sd>=32,sg=q.sharp>=9;
    if($('qContrast40'))$('qContrast40').textContent=Math.round(q.sd)+(cg?' good':' low');
    if($('qSharp40'))$('qSharp40').textContent=q.sharp.toFixed(1)+(sg?' good':' soft');
    if($('qSkew40'))$('qSkew40').textContent=(skew===0?'0°':(skew>0?'+':'')+skew+'°')+' after flatten';
    if($('qPhoto40'))$('qPhoto40').textContent=(cg&&sg)?'GOOD':'REVIEW';
  }

  async function scan45(){
    if(!sourceImg){$('status').textContent='Choose or take a photo first.';return}
    $('scanBtn').disabled=true;$('resultCard').classList.add('hidden');$('review45').classList.add('hidden');
    try{
      $('scanSteps40').innerHTML='<b>Scanner:</b> flattening photo and checking evidence';
      const q=qualitySample45(),skew=estimateSkew45(q);updateQuality45(q,skew);
      const images=[];
      for(const width of [560,760,960]){images.push(prepared(width,-skew));await new Promise(r=>setTimeout(r,0))}
      const raw=await workerDetect45(images,Math.max(35,+$('minLength').value-8),+$('sensitivity').value);
      $('scanSteps40').innerHTML='<b>Scanner:</b> calculating consensus wall endpoints';
      lastFused=fuse45(raw);
      walls=conservativeTopology45(lastFused);
      walls=removeEnvelopeStubs(walls);
      walls=safeJoin45(walls);
      history=[];selected=-1;$('resultCard').classList.remove('hidden');renderAll();
      const hi=walls.filter(w=>w.confidence==='high').length,med=walls.filter(w=>w.confidence==='medium').length,rev=walls.filter(w=>w.confidence==='review').length;
      $('status').textContent='V45 evidence-first scan: '+walls.length+' walls retained. '+hi+' high confidence, '+med+' medium confidence'+(rev?', '+rev+' require review':'')+'. Wall ends are based on multi-pass consensus rather than the longest detection.';
      if(rev){
        $('review45').classList.remove('hidden');
        $('review45').innerHTML='<b>'+rev+' wall section'+(rev===1?'':'s')+' need review.</b> These came from strong but single-pass evidence. Compare them with the photo and delete anything that is not a real wall in Edit walls.';
      }
      $('scanSteps40').innerHTML='<b>Scanner:</b> complete — evidence preserved; large automatic extensions disabled';
      $('resultCard').scrollIntoView({behavior:'smooth'});
    }catch(e){
      $('status').textContent='V45 scan error: '+e.message+'. You can retry or use manual drawing.';
    }finally{$('scanBtn').disabled=false}
  }

  function refresh45(){
    if(!sourceImg)return;
    renderCorners();
  }
  $('camera').addEventListener('change',()=>setTimeout(refresh45,180));
  $('picker').addEventListener('change',()=>setTimeout(refresh45,180));
  if(sourceImg)refresh45();

  const baseRenderSvg45=renderSvg;
  renderSvg=function(svgId,interactive=false){
    if(svgId!=='plan'&&svgId!=='editPlan'){baseRenderSvg45(svgId,interactive);return}
    const svg=$(svgId);
    let s='<rect width="760" height="500" fill="white"/>';
    walls.forEach((w,i)=>{
      const review=w.confidence==='review',medium=w.confidence==='medium';
      const cls='wall '+(selected===i?'selected ':'')+(review?'review45wall ':medium?'medium45wall ':'');
      const stroke=review?'#c47a00':medium?'#365f78':'#1b313b';
      s+='<g class="'+cls+'" data-i="'+i+'"><line class="wallLine" stroke="'+stroke+'" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>';
      if(interactive)s+='<line class="wallHit" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>';
      if(interactive&&selected===i)s+='<circle class="handle" data-end="1" cx="'+w.x1+'" cy="'+w.y1+'" r="10"/><circle class="handle" data-end="2" cx="'+w.x2+'" cy="'+w.y2+'" r="10"/>';
      s+='</g>';
    });
    svg.innerHTML=s;
  };

  $('scanBtn').textContent='Run V45 evidence-first scan';
  runScan=scan45;$('scanBtn').onclick=scan45;$('rescanBtn').onclick=scan45;
})();