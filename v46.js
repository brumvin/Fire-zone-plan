// V46 - balanced evidence scanner: preserve genuine door-separated wall components.
(function(){
  if(!$('scanBtn')||typeof runScan!=='function')return;

  const css=document.createElement('style');
  css.textContent=`
    .v46note{margin-top:8px;padding:9px;border-radius:9px;background:#eef6fb;border-left:4px solid #1769aa}
  `;
  document.head.appendChild(css);

  const host=$('scanControls')?.querySelector('.perspective45')||$('scanControls');
  if(host&&!$('v46note')){
    const n=document.createElement('div');n.id='v46note';n.className='v46note small';
    n.innerHTML='<b>V46 balance:</b> door gaps and separated room walls are allowed to remain as separate structural components. The scanner no longer throws away the rest of the building just because one cluster is more connected.';
    host.appendChild(n);
  }

  function median46(a){
    if(!a.length)return 0;
    const s=a.slice().sort((x,y)=>x-y),m=Math.floor(s.length/2);
    return s.length%2?s[m]:(s[m-1]+s[m])/2;
  }
  function ov46(a1,a2,b1,b2){return Math.min(Math.max(a1,a2),Math.max(b1,b2))-Math.max(Math.min(a1,a2),Math.min(b1,b2))}
  function rank46(c){return c==='high'?3:c==='medium'?2:1}

  // Re-use the existing V45 perspective preparation by driving its public scanner,
  // but override the overly aggressive post-filtering through an independent scan.
  function workerSource46(){
    return `
      function bin(gray,w,h,r,bias){
        const iw=w+1,I=new Uint32Array((w+1)*(h+1));
        for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){row+=gray[(y-1)*w+x-1];I[y*iw+x]=I[(y-1)*iw+x]+row}}
        const out=new Uint8Array(w*h);
        for(let y=0;y<h;y++){const y0=Math.max(0,y-r),y1=Math.min(h-1,y+r);for(let x=0;x<w;x++){
          const x0=Math.max(0,x-r),x1=Math.min(w-1,x+r),A=I[y0*iw+x0],B=I[y0*iw+x1+1],C=I[(y1+1)*iw+x0],D=I[(y1+1)*iw+x1+1];
          const mean=(D-B-C+A)/((x1-x0+1)*(y1-y0+1));out[y*w+x]=gray[y*w+x]<mean-bias?1:0;
        }}return out;
      }
      function scan(b,w,h,minOut,gapAllow,pass){
        const sx=760/w,sy=500/h,minH=minOut/sx,minV=minOut/sy,hs=[],vs=[],step=w>=850?2:1;
        function rh(y,x){for(let d=-2;d<=2;d++){const yy=y+d;if(yy>=0&&yy<h&&b[yy*w+x])return 1}return 0}
        function ch(x,y){for(let d=-2;d<=2;d++){const xx=x+d;if(xx>=0&&xx<w&&b[y*w+xx])return 1}return 0}
        for(let y=2;y<h-2;y+=step){let st=-1,last=-1,g=0,hits=0;for(let x=1;x<w-1;x++){
          if(rh(y,x)){if(st<0)st=x;last=x;hits++;g=0}else if(st>=0&&++g>gapAllow){const len=last-st,d=hits/Math.max(1,len);if(len>=minH&&d>.43)hs.push({x1:st*sx,y1:y*sy,x2:last*sx,y2:y*sy,axis:'H',pass,score:hits,dens:d});st=-1;last=-1;g=0;hits=0}
        }}
        for(let x=2;x<w-2;x+=step){let st=-1,last=-1,g=0,hits=0;for(let y=1;y<h-1;y++){
          if(ch(x,y)){if(st<0)st=y;last=y;hits++;g=0}else if(st>=0&&++g>gapAllow){const len=last-st,d=hits/Math.max(1,len);if(len>=minV&&d>.43)vs.push({x1:x*sx,y1:st*sy,x2:x*sx,y2:last*sy,axis:'V',pass,score:hits,dens:d});st=-1;last=-1;g=0;hits=0}
        }}
        return hs.concat(vs);
      }
      self.onmessage=e=>{const p=e.data,all=[];for(let i=0;i<p.images.length;i++){self.postMessage({type:'progress',message:'balanced evidence pass '+(i+1)+' of '+p.images.length});const im=p.images[i];all.push(...scan(bin(new Uint8Array(im.gray),im.w,im.h,im.radius,im.bias),im.w,im.h,p.minLen,im.gap,i))}self.postMessage({type:'done',segments:all})};
    `;
  }

  // Pull V45's prepared image by temporarily using an offscreen reconstruction of the source.
  // Corners are already applied by V45 only inside its closure, so V46 deliberately starts
  // from the displayed source image and keeps perspective correction optional via V45.
  function simplePrepared46(sw){
    const sh=Math.round(sw*H/W),c=document.createElement('canvas');c.width=sw;c.height=sh;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,sw,sh);
    const s=Math.min(sw/sourceImg.width,sh/sourceImg.height)*.965,dw=sourceImg.width*s,dh=sourceImg.height*s;
    ctx.drawImage(sourceImg,(sw-dw)/2,(sh-dh)/2,dw,dh);
    const rgba=ctx.getImageData(0,0,sw,sh).data,gray=new Uint8Array(sw*sh);
    for(let i=0,p=0;i<rgba.length;i+=4,p++)gray[p]=Math.round(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]);
    return {gray,sw,sh};
  }
  function detect46(images,minLen,sens){
    return new Promise((resolve,reject)=>{
      let w;try{w=new Worker(URL.createObjectURL(new Blob([workerSource46()],{type:'application/javascript'})))}catch(e){reject(e);return}
      w.onmessage=e=>{if(e.data.type==='progress'&&$('scanSteps40'))$('scanSteps40').innerHTML='<b>Scanner:</b> '+e.data.message;else if(e.data.type==='done'){w.terminate();resolve(e.data.segments)}};
      w.onerror=e=>{w.terminate();reject(new Error(e.message||'V46 worker failed'))};
      const adj=(58-sens)*.15;
      const p=images.map((im,i)=>({w:im.sw,h:im.sh,gray:im.gray.buffer,radius:[9,14,20][i],bias:Math.max(3,Math.min(18,[6,9,12][i]+adj)),gap:[4,5,6][i]}));
      w.postMessage({images:p,minLen},p.map(x=>x.gray));
    });
  }
  function fuse46(raw){
    const groups=[];
    for(const r of raw.slice().sort((a,b)=>(b.score||0)-(a.score||0))){
      const s=normaliseWall(r),coord=s.axis==='H'?s.y1:s.x1,lo=s.axis==='H'?s.x1:s.y1,hi=s.axis==='H'?s.x2:s.y2;
      let g=null,bd=1e9;
      for(const q of groups){
        if(q.axis!==s.axis)continue;
        const d=Math.abs(q.coord-coord),ov=ov46(q.lo,q.hi,lo,hi);
        if(d<=10&&ov>=Math.min(10,Math.min(q.hi-q.lo,hi-lo)*.16)&&d<bd){g=q;bd=d}
      }
      if(!g)groups.push({axis:s.axis,coord,lo,hi,m:[{pass:r.pass,lo,hi,coord,score:r.score||1}]});
      else{g.m.push({pass:r.pass,lo,hi,coord,score:r.score||1});g.lo=Math.min(g.lo,lo);g.hi=Math.max(g.hi,hi);g.coord=median46(g.m.map(x=>x.coord))}
    }
    const out=[],minLen=+$('minLength').value;
    for(const g of groups){
      const per=[...new Set(g.m.map(x=>x.pass))].map(p=>{
        const m=g.m.filter(x=>x.pass===p);
        return {lo:median46(m.map(x=>x.lo)),hi:median46(m.map(x=>x.hi)),coord:median46(m.map(x=>x.coord))};
      });
      const passes=per.length;
      // For two/three-pass evidence use median extents. For a single strong long line keep as review.
      let lo=median46(per.map(x=>x.lo)),hi=median46(per.map(x=>x.hi)),coord=median46(per.map(x=>x.coord));
      if(passes<2&&(hi-lo)<Math.max(125,minLen*2.15))continue;
      if(hi-lo<Math.max(32,minLen*.72))continue;
      const c=snap(coord),a=snap(lo),b=snap(hi);
      const w=g.axis==='H'?{x1:a,y1:c,x2:b,y2:c,axis:'H'}:{x1:c,y1:a,x2:c,y2:b,axis:'V'};
      w.confidence=passes>=3?'high':passes===2?'medium':'review';w.passCount=passes;out.push(w);
    }
    return out;
  }

  function balancedTopology46(input){
    let a=input.map(w=>({...w}));
    // Ignore only extreme canvas-edge lines. Do not infer a single dominant component.
    a=a.filter(w=>!(w.axis==='H'&&(w.y1<16||w.y1>H-16))&&!(w.axis==='V'&&(w.x1<16||w.x1>W-16)));

    const xs=clusterCoords(a.filter(w=>w.axis==='V').map(w=>w.x1),9);
    const ys=clusterCoords(a.filter(w=>w.axis==='H').map(w=>w.y1),9);
    a=a.map(w=>{
      if(w.axis==='H'){const y=nearestCluster(w.y1,ys);return {...w,y1:y,y2:y,x1:snap(w.x1),x2:snap(w.x2)}}
      const x=nearestCluster(w.x1,xs);return {...w,x1:x,x2:x,y1:snap(w.y1),y2:snap(w.y2)}
    });

    // Keep all high/medium evidence. Review lines survive only if they touch or nearly
    // align with confirmed structure; this rejects page folds without deleting door-separated walls.
    const confirmed=a.filter(w=>w.confidence!=='review');
    a=a.filter(w=>{
      if(w.confidence!=='review')return true;
      if(wallLength(w)>=180)return true;
      return confirmed.some(o=>wallConnected(w,o,20));
    });

    // Deduplicate only near-identical segments. Never union their endpoints.
    const out=[];
    for(const w of a){
      const idx=out.findIndex(o=>{
        if(o.axis!==w.axis)return false;
        const dc=Math.abs((o.axis==='H'?o.y1:o.x1)-(w.axis==='H'?w.y1:w.x1));
        if(dc>4)return false;
        const ov=w.axis==='H'?ov46(o.x1,o.x2,w.x1,w.x2):ov46(o.y1,o.y2,w.y1,w.y2);
        const min=Math.min(wallLength(o),wallLength(w));
        return ov>min*.72;
      });
      if(idx<0)out.push({...w});
      else{
        const o=out[idx];
        if(rank46(w.confidence)>rank46(o.confidence)||(rank46(w.confidence)===rank46(o.confidence)&&wallLength(w)>wallLength(o)))out[idx]={...w};
      }
    }

    // Only tiny endpoint correction to make visible junctions meet. Door-sized gaps remain.
    const hs=out.filter(w=>w.axis==='H'),vs=out.filter(w=>w.axis==='V'),gap=6;
    for(const h of hs)for(const v of vs){
      const x=v.x1,y=h.y1;
      if(x>=h.x1-gap&&x<=h.x2+gap&&y>=v.y1-gap&&y<=v.y2+gap){
        if(Math.abs(h.x1-x)<=gap)h.x1=x;if(Math.abs(h.x2-x)<=gap)h.x2=x;
        if(Math.abs(v.y1-y)<=gap)v.y1=y;if(Math.abs(v.y2-y)<=gap)v.y2=y;
      }
    }
    return out;
  }

  async function scan46(){
    if(!sourceImg){$('status').textContent='Choose or take a photo first.';return}
    $('scanBtn').disabled=true;$('resultCard').classList.add('hidden');
    try{
      if($('scanSteps40'))$('scanSteps40').innerHTML='<b>Scanner:</b> preserving wall evidence across the whole floor plan';
      const images=[560,760,960].map(simplePrepared46);
      const raw=await detect46(images,Math.max(30,+$('minLength').value-12),+$('sensitivity').value);
      const fused=fuse46(raw);
      walls=balancedTopology46(fused);
      // V24 removes obvious external arrows/symbol loops, but no dominant-component pruning is used.
      walls=removeEnvelopeStubs(walls);
      history=[];selected=-1;$('resultCard').classList.remove('hidden');renderAll();
      const hi=walls.filter(w=>w.confidence==='high').length,med=walls.filter(w=>w.confidence==='medium').length,rev=walls.filter(w=>w.confidence==='review').length;
      $('status').textContent='V46 balanced scan: '+walls.length+' structural wall sections retained ('+hi+' high, '+med+' medium, '+rev+' review). Door-separated and disconnected room walls are no longer discarded just because they are not part of one dominant component.';
      if($('review45')){
        $('review45').classList.toggle('hidden',rev===0);
        if(rev)$('review45').innerHTML='<b>'+rev+' uncertain section'+(rev===1?'':'s')+'.</b> Orange lines are retained for engineer review rather than automatically deleted.';
      }
      if($('scanSteps40'))$('scanSteps40').innerHTML='<b>Scanner:</b> complete — full-plan evidence retained';
      $('resultCard').scrollIntoView({behavior:'smooth'});
    }catch(e){$('status').textContent='V46 scan error: '+e.message+'. Use manual drawing if required.'}
    finally{$('scanBtn').disabled=false}
  }

  $('scanBtn').textContent='Run V46 balanced scan';
  runScan=scan46;$('scanBtn').onclick=scan46;$('rescanBtn').onclick=scan46;
})();