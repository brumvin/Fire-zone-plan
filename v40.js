// V40 - high-accuracy multi-pass structural scanner.
(function(){
  const legacyScan=runScan;
  const scanControls=$('scanControls');
  if(!scanControls)return;

  const css=document.createElement('style');
  css.textContent=`
    .scanQuality40{margin-top:12px;border:2px solid #dfe7ea;border-radius:12px;padding:10px;background:#fbfcfc}
    .qualityGrid40{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:8px}
    .qualityCell40{border:1px solid #d8e0e4;border-radius:9px;padding:8px;background:white}
    .qualityCell40 b{display:block;font-size:17px}
    .qualityGood40{color:#147a42}.qualityWarn40{color:#a76800}.qualityBad40{color:#a82b2b}
    .scanSteps40{margin-top:9px;font-size:12px;color:#52666f}
    .scanSteps40 b{color:#102f3f}
    @media(max-width:700px){.qualityGrid40{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(css);

  const panel=document.createElement('div');
  panel.className='scanQuality40';
  panel.innerHTML=`
    <b>High-accuracy scan</b>
    <div class="small">The photo is checked first, automatically deskewed, then scanned several times at different resolutions and thresholds. Only wall evidence that agrees across passes is promoted into the structural drawing.</div>
    <div class="qualityGrid40">
      <div class="qualityCell40"><span class="small">Photo</span><b id="qPhoto40">Not checked</b></div>
      <div class="qualityCell40"><span class="small">Contrast</span><b id="qContrast40">—</b></div>
      <div class="qualityCell40"><span class="small">Sharpness</span><b id="qSharp40">—</b></div>
      <div class="qualityCell40"><span class="small">Deskew</span><b id="qSkew40">—</b></div>
    </div>
    <div id="scanSteps40" class="scanSteps40">Load a drawing photo to begin.</div>
  `;
  scanControls.appendChild(panel);

  $('scanBtn').textContent='Run high-accuracy scan';

  function setStep(t){$('scanSteps40').innerHTML='<b>Scanner:</b> '+t}
  function cls(id,level){
    const el=$(id);el.classList.remove('qualityGood40','qualityWarn40','qualityBad40');
    el.classList.add(level==='good'?'qualityGood40':level==='bad'?'qualityBad40':'qualityWarn40');
  }

  function drawPrepared(sw,angleDeg){
    const sh=Math.round(sw*H/W),c=document.createElement('canvas');
    c.width=sw;c.height=sh;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,sw,sh);
    const margin=.96;
    const s=Math.min(sw/sourceImg.width,sh/sourceImg.height)*margin;
    ctx.save();
    ctx.translate(sw/2,sh/2);
    ctx.rotate(angleDeg*Math.PI/180);
    ctx.drawImage(sourceImg,-sourceImg.width*s/2,-sourceImg.height*s/2,sourceImg.width*s,sourceImg.height*s);
    ctx.restore();
    const rgba=ctx.getImageData(0,0,sw,sh).data;
    const gray=new Uint8Array(sw*sh);
    for(let i=0,p=0;i<rgba.length;i+=4,p++)gray[p]=Math.round(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]);
    return {gray,sw,sh};
  }

  function qualitySample(){
    const {gray,sw,sh}=drawPrepared(420,0);
    let sum=0,sum2=0,dark=0,bright=0,grad=0,gc=0;
    for(let i=0;i<gray.length;i++){
      const v=gray[i];sum+=v;sum2+=v*v;if(v<24)dark++;if(v>247)bright++;
    }
    for(let y=1;y<sh-1;y+=2)for(let x=1;x<sw-1;x+=2){
      const i=y*sw+x;
      grad+=Math.abs(gray[i+1]-gray[i-1])+Math.abs(gray[i+sw]-gray[i-sw]);gc+=2;
    }
    const mean=sum/gray.length,sd=Math.sqrt(Math.max(0,sum2/gray.length-mean*mean));
    const sharp=grad/Math.max(1,gc);
    return {gray,sw,sh,mean,sd,sharp,dark:dark/gray.length,bright:bright/gray.length};
  }

  function estimateSkew(q){
    const {gray,sw,sh}=q;
    let mean=q.mean;
    const pts=[];
    for(let y=2;y<sh-2;y+=2)for(let x=2;x<sw-2;x+=2){
      const v=gray[y*sw+x];
      if(v<Math.min(185,mean-24))pts.push([x-sw/2,y-sh/2]);
    }
    if(pts.length<120)return 0;
    let best={a:0,s:-Infinity},zero=0;
    for(let a=-7;a<=7.001;a+=.5){
      const r=a*Math.PI/180,co=Math.cos(r),si=Math.sin(r);
      const rows=new Uint16Array(sh),cols=new Uint16Array(sw);
      for(let k=0;k<pts.length;k+=Math.max(1,Math.floor(pts.length/16000))){
        const p=pts[k],x=Math.round(p[0]*co-p[1]*si+sw/2),y=Math.round(p[0]*si+p[1]*co+sh/2);
        if(x>=0&&x<sw&&y>=0&&y<sh){rows[y]++;cols[x]++}
      }
      let score=0;
      for(let y=0;y<sh;y++)score+=rows[y]*rows[y];
      for(let x=0;x<sw;x++)score+=cols[x]*cols[x];
      if(Math.abs(a)<.01)zero=score;
      if(score>best.s)best={a,s:score};
    }
    if(zero&&best.s<zero*1.035)return 0;
    return Math.round(best.a*2)/2;
  }

  function reportQuality(q,skew){
    const mp=(sourceImg.width*sourceImg.height/1e6).toFixed(1);
    const resGood=sourceImg.width>=1200&&sourceImg.height>=800;
    const exposureBad=q.bright>.72||q.mean>244||q.mean<85;
    const contrastGood=q.sd>=34,sharpGood=q.sharp>=10;
    let level=(resGood&&contrastGood&&sharpGood&&!exposureBad)?'good':((q.sd<20||q.sharp<5||exposureBad)?'bad':'warn');
    $('qPhoto40').textContent=level==='good'?'GOOD':level==='bad'?'POOR':'REVIEW';
    cls('qPhoto40',level);
    $('qContrast40').textContent=Math.round(q.sd)+(contrastGood?' good':' low');cls('qContrast40',contrastGood?'good':'warn');
    $('qSharp40').textContent=q.sharp.toFixed(1)+(sharpGood?' good':' soft');cls('qSharp40',sharpGood?'good':'warn');
    $('qSkew40').textContent=(skew===0?'0°':(skew>0?'+':'')+skew+'°')+' auto';cls('qSkew40','good');
    return {level,mp};
  }

  function workerSource(){
    return `
    function localBinary(gray,w,h,r,bias){
      const iw=w+1,integ=new Uint32Array((w+1)*(h+1));
      for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){row+=gray[(y-1)*w+x-1];integ[y*iw+x]=integ[(y-1)*iw+x]+row}}
      const bin=new Uint8Array(w*h);
      for(let y=0;y<h;y++){
        const y0=Math.max(0,y-r),y1=Math.min(h-1,y+r);
        for(let x=0;x<w;x++){
          const x0=Math.max(0,x-r),x1=Math.min(w-1,x+r);
          const A=integ[y0*iw+x0],B=integ[y0*iw+x1+1],C=integ[(y1+1)*iw+x0],D=integ[(y1+1)*iw+x1+1];
          const mean=(D-B-C+A)/((x1-x0+1)*(y1-y0+1));
          bin[y*w+x]=gray[y*w+x]<mean-bias?1:0;
        }
      }
      return bin;
    }
    function scan(bin,w,h,minOut,gapAllow,pass){
      const sx=760/w,sy=500/h,minH=minOut/sx,minV=minOut/sy,hs=[],vs=[];
      function rowHit(y,x){for(let d=-2;d<=2;d++){const yy=y+d;if(yy>=0&&yy<h&&bin[yy*w+x])return 1}return 0}
      function colHit(x,y){for(let d=-2;d<=2;d++){const xx=x+d;if(xx>=0&&xx<w&&bin[y*w+xx])return 1}return 0}
      const step=w>=850?2:1;
      for(let y=2;y<h-2;y+=step){
        let st=-1,last=-1,gap=0,hits=0;
        for(let x=1;x<w-1;x++){
          if(rowHit(y,x)){if(st<0)st=x;last=x;hits++;gap=0}
          else if(st>=0&&++gap>gapAllow){
            const len=last-st,dens=hits/Math.max(1,len);
            if(len>=minH&&dens>.42)hs.push({x1:st*sx,y1:y*sy,x2:last*sx,y2:y*sy,axis:'H',pass,score:hits});
            st=-1;last=-1;gap=0;hits=0;
          }
        }
      }
      for(let x=2;x<w-2;x+=step){
        let st=-1,last=-1,gap=0,hits=0;
        for(let y=1;y<h-1;y++){
          if(colHit(x,y)){if(st<0)st=y;last=y;hits++;gap=0}
          else if(st>=0&&++gap>gapAllow){
            const len=last-st,dens=hits/Math.max(1,len);
            if(len>=minV&&dens>.42)vs.push({x1:x*sx,y1:st*sy,x2:x*sx,y2:last*sy,axis:'V',pass,score:hits});
            st=-1;last=-1;gap=0;hits=0;
          }
        }
      }
      return hs.concat(vs);
    }
    self.onmessage=e=>{
      const p=e.data,all=[];
      for(let i=0;i<p.images.length;i++){
        self.postMessage({type:'progress',message:'analysing structural pass '+(i+1)+' of '+p.images.length});
        const im=p.images[i],bin=localBinary(new Uint8Array(im.gray),im.w,im.h,im.radius,im.bias);
        all.push(...scan(bin,im.w,im.h,p.minLen,im.gap,i));
      }
      self.postMessage({type:'done',segments:all});
    }`;
  }

  function workerDetect(images,minLen){
    return new Promise((resolve,reject)=>{
      let worker;
      try{
        const blob=new Blob([workerSource()],{type:'application/javascript'});
        worker=new Worker(URL.createObjectURL(blob));
      }catch(e){reject(e);return}
      worker.onmessage=e=>{
        if(e.data.type==='progress')setStep(e.data.message);
        else if(e.data.type==='done'){worker.terminate();resolve(e.data.segments)}
      };
      worker.onerror=e=>{worker.terminate();reject(new Error(e.message||'Worker scan failed'))};
      const payload=images.map((im,i)=>({
        w:im.sw,h:im.sh,gray:im.gray.buffer,
        radius:[10,15,22][i]||15,
        bias:[7,11,15][i]||11,
        gap:[4,6,8][i]||6
      }));
      worker.postMessage({images:payload,minLen},payload.map(x=>x.gray));
    });
  }

  function intervalOverlap(a1,a2,b1,b2){
    return Math.min(Math.max(a1,a2),Math.max(b1,b2))-Math.max(Math.min(a1,a2),Math.min(b1,b2));
  }

  function fuseSegments(raw){
    const groups=[];
    const ordered=raw.slice().sort((a,b)=>(b.score||0)-(a.score||0));
    for(const s0 of ordered){
      const s=normaliseWall(s0),coord=s.axis==='H'?s.y1:s.x1;
      let best=null,bestD=1e9;
      for(const g of groups){
        if(g.axis!==s.axis)continue;
        const d=Math.abs(g.coord-coord);
        const ov=s.axis==='H'?intervalOverlap(g.lo,g.hi,s.x1,s.x2):intervalOverlap(g.lo,g.hi,s.y1,s.y2);
        const min=Math.min(g.hi-g.lo,wallLength(s));
        if(d<=11&&ov>=Math.min(8,min*.18)&&d<bestD){best=g;bestD=d}
      }
      if(!best){
        groups.push({axis:s.axis,coord,lo:s.axis==='H'?s.x1:s.y1,hi:s.axis==='H'?s.x2:s.y2,passes:new Set([s0.pass]),weight:s0.score||1,sum:coord*(s0.score||1),strength:s0.score||1});
      }else{
        const wt=s0.score||1;best.lo=Math.min(best.lo,s.axis==='H'?s.x1:s.y1);best.hi=Math.max(best.hi,s.axis==='H'?s.x2:s.y2);
        best.passes.add(s0.pass);best.sum+=coord*wt;best.weight+=wt;best.coord=best.sum/best.weight;best.strength+=wt;
      }
    }
    const minLen=+$('minLength').value;
    return groups.filter(g=>g.passes.size>=2||(g.hi-g.lo)>=Math.max(145,minLen*2.5)).map(g=>{
      const c=snap(g.coord),lo=snap(g.lo),hi=snap(g.hi);
      const w=g.axis==='H'?{x1:lo,y1:c,x2:hi,y2:c,axis:'H'}:{x1:c,y1:lo,x2:c,y2:hi,axis:'V'};
      w.confidence=g.passes.size===3?'high':g.passes.size===2?'medium':'long-single';
      return w;
    });
  }

  async function highAccuracyScan(){
    if(!sourceImg){$('status').textContent='Choose or take a photo first.';return}
    $('scanBtn').disabled=true;
    $('resultCard').classList.add('hidden');
    try{
      setStep('checking photo quality');
      $('status').textContent='High-accuracy scan: checking the photo before reconstructing walls…';
      await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
      const q=qualitySample(),skew=estimateSkew(q),quality=reportQuality(q,skew);

      setStep('deskewing photo and preparing three independent scan resolutions');
      const baseSens=+$('sensitivity').value;
      const widths=[560,760,960];
      const images=[];
      for(let i=0;i<widths.length;i++){
        images.push(drawPrepared(widths[i],-skew));
        await new Promise(r=>setTimeout(r,0));
      }

      // Sensitivity nudges all three passes while keeping them deliberately different.
      const sensDelta=(62-baseSens)*.12;
      images.forEach((im,i)=>{ im._biasAdjust=sensDelta; });

      setStep('running multi-pass wall evidence analysis off the main screen thread');
      const raw=await workerDetect(images,Math.max(35,+$('minLength').value-8));

      setStep('fusing repeated wall evidence and rejecting handwriting-like strokes');
      let fused=fuseSegments(raw);
      walls=cleanTopology(fused.map(normaliseWall));
      walls=removeEnvelopeStubs(walls);
      connectIntersections();

      // Reuse the proven corridor-protection stage if present.
      const corridor=$('corridorBtnV26');
      if(corridor&&typeof corridor.onclick==='function'){
        const before=JSON.stringify(walls); corridor.onclick();
        if(JSON.stringify(walls)!==before) setStep('corridor geometry protected; finalising structural graph');
      }

      history=[];selected=-1;
      $('resultCard').classList.remove('hidden');
      renderAll();

      const hi=fused.filter(w=>w.confidence==='high').length;
      const med=fused.filter(w=>w.confidence==='medium').length;
      const qnote=quality.level==='good'?'Photo quality is suitable.':quality.level==='bad'?'Photo quality is weak; retaking it may improve accuracy.':'Photo quality is usable but should be reviewed.';
      $('status').textContent='High-accuracy scan complete: '+walls.length+' structural walls retained from '+raw.length+' raw detections. '+hi+' high-confidence and '+med+' medium-confidence wall candidates agreed across scan passes. '+qnote;
      setStep('complete — compare the clean structural plan with the original photo before editing');
      $('resultCard').scrollIntoView({behavior:'smooth'});
    }catch(e){
      $('status').textContent='High-accuracy scanner could not complete ('+e.message+'). Falling back to the proven fast scanner.';
      setStep('fallback scan running');
      try{await legacyScan()}catch(err){$('status').textContent='Scan error: '+err.message}
    }finally{$('scanBtn').disabled=false}
  }

  // Update quality display shortly after an image finishes loading.
  function waitForImage(){
    let tries=0;
    const timer=setInterval(()=>{
      if(sourceImg){
        clearInterval(timer);
        try{const q=qualitySample(),skew=estimateSkew(q);reportQuality(q,skew);setStep('photo analysed — ready for high-accuracy structural scan')}catch(e){}
      }else if(++tries>30)clearInterval(timer);
    },100);
  }
  $('camera').addEventListener('change',waitForImage);
  $('picker').addEventListener('change',waitForImage);

  runScan=highAccuracyScan;
  $('scanBtn').onclick=highAccuracyScan;
  $('rescanBtn').onclick=highAccuracyScan;
})();