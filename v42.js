// V42 - responsive engineer survey workflow, multi-floor capture, local submission/review prototype.
(function(){
  const $id=id=>document.getElementById(id);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const storageKey='fireZoneSurveyDraftV42';
  const submissionsKey='fireZoneSubmissionsV42';
  let activeFloorId=null;
  let autosaveBusy=false;

  const css=document.createElement('style');
  css.textContent=`
    body.engineerMode42 #zoneCard35,
    body.engineerMode42 #finalCard35{display:none!important}
    .workflow42{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:12px}
    .surveySide42{border:2px solid #dfe7ea;border-radius:12px;padding:11px;background:#fbfcfc;align-self:start}
    .floorTabs42{display:flex;gap:8px;overflow-x:auto;padding:4px 0 9px;scrollbar-width:thin}
    .floorTab42{width:auto;min-width:132px;flex:0 0 auto;text-align:left}
    .floorTab42.active{background:var(--navy);color:#fff;border-color:var(--navy)}
    .floorTab42.ready:after{content:' ✓';color:#1d8a4e}
    .floorTab42.active.ready:after{color:#9ff0be}
    .floorActions42{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .floorCard42{border:1px solid #d8e0e4;border-radius:11px;padding:10px;background:#fff;margin:8px 0}
    .statusPill42{display:inline-block;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:800;background:#e8eef1;color:#52666f}
    .statusPill42.ready{background:#dcf3e5;color:#16683d}
    .statusPill42.progress{background:#fff0d7;color:#8b5c00}
    .check42{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;align-items:start;padding:7px 0;border-bottom:1px solid #eef2f4}
    .check42:last-child{border-bottom:0}
    .check42 input{width:22px;height:22px;min-height:auto;margin:0}
    .bigSubmit42{min-height:58px;font-size:17px}
    .roleBar42{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .roleBar42 button{width:auto;min-width:150px}
    .desktopQueue42{display:grid;gap:9px}
    .submission42{border:1px solid #d8e0e4;border-radius:11px;padding:10px;background:#fff}
    .submission42 .meta{font-size:12px;color:var(--muted)}
    .reviewFloors42{display:flex;gap:7px;overflow-x:auto;padding:6px 0}
    .reviewFloors42 button{width:auto;min-width:120px;flex:0 0 auto}
    .deviceHint42{font-size:12px;color:var(--muted);margin-top:6px}
    .engineerSticky42{display:none}
    #manualPlan41,#editPlan,#reviewPlan32{touch-action:none!important;overscroll-behavior:none!important}
    .manualCanvas41,.canvasWrap:has(#manualPlan41){touch-action:none!important;overscroll-behavior:none!important}
    body.drawingGesture42{overscroll-behavior:none!important}
    @media(max-width:1050px){
      .workflow42{grid-template-columns:1fr}
      .surveySide42{position:static}
    }
    @media(min-width:701px) and (max-width:1050px){
      .surveySide42{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .surveySide42>h3,.surveySide42>.floorTabs42,.surveySide42>.floorActions42,.surveySide42>.deviceHint42{grid-column:1/-1}
    }
    @media(max-width:700px){
      main{padding:6px!important;padding-bottom:76px!important}
      .card{padding:11px!important;margin:8px 0!important;border-radius:12px!important}
      header{padding:10px 12px!important}
      header b{font-size:18px!important}
      button,input,select{min-height:50px!important;font-size:16px!important}
      .floorTabs42{margin-left:-3px;margin-right:-3px}
      .floorTab42{min-width:118px;min-height:54px!important}
      .floorActions42{grid-template-columns:1fr 1fr}
      .workflow42{gap:8px}
      .surveySide42{padding:9px}
      .manualStage41,.roomStage,.reviewStage,.zoneStage35{grid-template-columns:1fr!important}
      .manualDock41,.roomDock,.reviewDock,.zoneDock35{position:static!important}
      .manualCanvas41,.canvasWrap:has(#manualPlan41){min-height:58vh!important}
      #manualPlan41{min-height:58vh!important}
      .engineerSticky42{display:grid;grid-template-columns:1fr 1fr;gap:7px;position:fixed;left:0;right:0;bottom:0;z-index:80;padding:7px calc(7px + env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom)) calc(7px + env(safe-area-inset-left));background:#fff;border-top:1px solid #cad5da;box-shadow:0 -3px 14px #0002}
      .engineerSticky42 button{min-height:48px!important}
      body.desktopMode42 .engineerSticky42{display:none}
    }
  `;
  document.head.appendChild(css);

  // Hard-stop page scrolling while the engineer is actually drawing.
  function lockTouchSurface(el){
    if(!el)return;
    el.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
    el.addEventListener('pointerdown',()=>document.body.classList.add('drawingGesture42'));
    ['pointerup','pointercancel','pointerleave'].forEach(type=>el.addEventListener(type,()=>document.body.classList.remove('drawingGesture42')));
  }
  lockTouchSurface($id('manualPlan41'));
  lockTouchSurface($id('editPlan'));
  lockTouchSurface($id('reviewPlan32'));

  const main=document.querySelector('main');
  const siteCard=$id('customer')?.closest('section');
  if(!main||!siteCard)return;

  document.body.classList.add('engineerMode42');

  // Engineer survey shell.
  const surveyCard=document.createElement('section');
  surveyCard.id='engineerSurvey42';surveyCard.className='card';
  surveyCard.innerHTML=`
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
      <div><h2 style="margin-bottom:4px">Engineer Zone Plan Survey</h2><div class="small">Capture the building accurately. The office team will create and verify the final fire alarm zone plan.</div></div>
      <span id="surveyStatus42" class="statusPill42 progress">IN PROGRESS</span>
    </div>
    <div class="roleBar42">
      <button id="engineerModeBtn42" class="navy">Engineer survey</button>
      <button id="desktopModeBtn42">Desktop review</button>
    </div>
    <div id="engineerPanel42" class="workflow42" style="margin-top:10px">
      <div>
        <h3>Floors</h3>
        <div id="floorTabs42" class="floorTabs42"></div>
        <div class="floorActions42">
          <button id="addFloor42">+ Add floor</button>
          <button id="duplicateFloor42">Duplicate floor</button>
          <button id="renameFloor42">Rename floor</button>
          <button id="deleteFloor42" class="danger">Delete floor</button>
        </div>
        <div id="activeFloorSummary42" class="status">No floor selected.</div>
        <div class="tip"><b>Field workflow:</b> choose a floor, then either scan a sketch or draw the plan. Review rooms, doors, exits, stairs and panel markers before marking the floor ready.</div>
      </div>
      <aside class="surveySide42">
        <h3>Floor readiness</h3>
        <div id="floorChecklist42"></div>
        <label class="small" for="floorNotes42">Engineer notes / uncertainties</label>
        <textarea id="floorNotes42" rows="3" placeholder="Optional notes for the desktop reviewer" style="width:100%;border:1px solid #c9d3d7;border-radius:9px;padding:9px;font:inherit;resize:vertical"></textarea>
        <button id="markReady42" class="green" style="margin-top:8px">Mark floor ready</button>
        <button id="markWorking42" style="margin-top:8px">Return to in progress</button>
        <div class="deviceHint42">Autosaves locally on this device. Phone, tablet and laptop layouts adapt automatically.</div>
      </aside>
    </div>
    <div id="desktopPanel42" class="hidden" style="margin-top:10px">
      <h3>Desktop Review Queue</h3>
      <div class="tip"><b>Prototype workflow.</b> Submissions created in this browser appear here. A production deployment will replace this local queue with the shared server/database so engineer devices feed the desktop team automatically.</div>
      <div id="desktopQueue42" class="desktopQueue42"></div>
    </div>
  `;
  siteCard.insertAdjacentElement('afterend',surveyCard);

  const submitCard=document.createElement('section');
  submitCard.id='submitSurvey42';submitCard.className='card';
  submitCard.innerHTML=`
    <h2>Submit site survey</h2>
    <div id="submissionSummary42" class="status">Complete each floor before submitting the site survey.</div>
    <button id="submitSurveyBtn42" class="green bigSubmit42" disabled>Submit for Zone Plan</button>
  `;
  main.appendChild(submitCard);

  const sticky=document.createElement('div');
  sticky.className='engineerSticky42';
  sticky.innerHTML='<button id="stickyFloors42">Floors</button><button id="stickySave42" class="green">Save floor</button>';
  document.body.appendChild(sticky);

  function uid(prefix='f'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
  function blankSurvey(){
    return {id:uid('survey'),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'In Progress',floors:[
      {id:uid(),name:'Ground Floor',status:'Not started',walls:[],source:'',rooms:null,detail:null,notes:'',checks:{exits:false,panel:false,stairs:false},updatedAt:null}
    ]};
  }
  let survey=blankSurvey();

  function safeSource(s){
    if(!s)return '';
    // Keep local autosave reliable on phones: very large photos remain in the live session
    // but are not written into localStorage.
    return s.length<=900000?s:'';
  }
  function floorById(id=activeFloorId){return survey.floors.find(f=>f.id===id)}
  function currentRoomState(){
    const card=$id('roomCard');
    if(!card||card.classList.contains('hidden'))return null;
    try{return window.fireZoneRoomModel?.getRooms?.()||null}catch{return null}
  }
  function currentDetailState(){
    const card=$id('doorLabelCard32');
    if(!card||card.classList.contains('hidden'))return null;
    try{return window.fireZoneDoorEditor?.getState?.()||window.fireZoneDoorLabelModel||null}catch{return null}
  }
  function saveCurrentFloor(persist=true){
    const f=floorById();if(!f)return;
    f.walls=clone(walls||[]);
    f.source=source||f.source||'';
    if($id('floorNotes42'))f.notes=$id('floorNotes42').value||'';
    const rooms=currentRoomState();if(rooms?.length)f.rooms=clone(rooms);
    const detail=currentDetailState();if(detail&&(detail.rooms?.length||detail.doors?.length||detail.markers?.length))f.detail=clone(detail);
    if(f.status==='Not started'&&f.walls.length)f.status='In progress';
    f.updatedAt=new Date().toISOString();
    survey.updatedAt=f.updatedAt;
    if(persist)persistDraft();
    renderSurvey();
  }
  function draftForStorage(){
    const d=clone(survey);
    d.floors.forEach(f=>f.source=safeSource(f.source));
    return d;
  }
  function persistDraft(){
    survey.meta={customer:$id('customer')?.value||'',site:$id('site')?.value||'',engineer:$id('engineer')?.value||'',date:$id('date')?.value||''};
    try{localStorage.setItem(storageKey,JSON.stringify(draftForStorage()))}catch(e){
      const el=$id('submissionSummary42');if(el)el.textContent='Local autosave is full on this device. The live survey is still available; submit or remove large photo data before closing.';
    }
  }
  function restoreDraft(){
    try{
      const raw=localStorage.getItem(storageKey);
      if(raw){
        const d=JSON.parse(raw);
        if(d&&Array.isArray(d.floors)&&d.floors.length)survey=d;
      }
    }catch{}
    activeFloorId=survey.floors[0]?.id||null;
    if(survey.meta){
      if($id('customer'))$id('customer').value=survey.meta.customer||'';
      if($id('site'))$id('site').value=survey.meta.site||'';
      if($id('engineer'))$id('engineer').value=survey.meta.engineer||'';
      if($id('date')&&survey.meta.date)$id('date').value=survey.meta.date;
    }
  }

  function hideFloorStages(){
    ['resultCard','editCard','approvedCard','roomCard','roomApprovedV25','doorLabelCard32','doorApproved32','zoneCard35','finalCard35'].forEach(id=>$id(id)?.classList.add('hidden'));
  }
  function restoreSource(f){
    source=f.source||'';
    sourceImg=null;
    if(source){
      $id('preview').innerHTML='<img src="'+source+'" alt="Saved floor source">';
      $id('originalPane').innerHTML='<img src="'+source+'" alt="Saved floor source">';
      const img=new Image();img.onload=()=>{sourceImg=img;$id('scanControls')?.classList.remove('hidden')};img.src=source;
    }else{
      $id('preview').textContent='No image loaded';
      $id('originalPane').innerHTML='<div class="status">No source photo saved for this floor.</div>';
    }
  }
  function loadFloor(id){
    if(activeFloorId&&activeFloorId!==id)saveCurrentFloor(false);
    const f=floorById(id);if(!f)return;
    activeFloorId=id;
    hideFloorStages();
    restoreSource(f);
    walls=clone(f.walls||[]).map(normaliseWall);selected=-1;history=[];
    $id('floor').value=f.name;
    if($id('floorNotes42'))$id('floorNotes42').value=f.notes||'';
    renderAll();
    if(walls.length){
      $id('resultCard').classList.remove('hidden');
      $id('status').textContent='Loaded '+f.name+': '+walls.length+' structural walls.';
    }
    if(f.rooms?.length&&window.fireZoneRoomModel){
      $id('approvedCard')?.classList.remove('hidden');
      $id('roomCard')?.classList.remove('hidden');
      window.fireZoneRoomModel.setRooms(f.rooms);
    }
    if(f.detail&&window.fireZoneDoorEditor){
      if(f.rooms?.length)window.fireZoneRoomModel?.setRooms?.(f.rooms);
      window.fireZoneDoorEditor.setState(f.detail);
      $id('doorLabelCard32')?.classList.remove('hidden');
    }
    persistDraft();renderSurvey();
  }

  function derived(f){
    const rooms=f.detail?.rooms||f.rooms||[];
    const doors=f.detail?.doors||[];
    const markers=f.detail?.markers||[];
    return {
      plan:(f.walls||[]).length>=4,
      rooms:rooms.length>0,
      doors:!!f.detail && doors.every(d=>d.status!=='review'),
      exit:markers.some(m=>m.type==='exit'||m.type==='entrance'),
      panel:markers.some(m=>m.type==='facp'),
      stairs:markers.some(m=>m.type==='stairs')
    };
  }
  function renderChecklist(){
    const f=floorById(),box=$id('floorChecklist42');
    if(!f){box.innerHTML='';return}
    const d=derived(f),rows=[
      ['Plan captured',d.plan,true],
      ['Rooms reviewed',d.rooms,true],
      ['Doors reviewed',d.doors,true],
      ['Entrances / fire exits checked',f.checks?.exits||false,false,'exits'],
      ['FACP location checked / not on this floor',f.checks?.panel||false,false,'panel'],
      ['Stairs checked / not on this floor',f.checks?.stairs||false,false,'stairs']
    ];
    box.innerHTML=rows.map(r=>'<label class="check42"><input type="checkbox" '+(r[1]?'checked':'')+' '+(r[2]?'disabled':'')+' '+(!r[2]?'data-check42="'+r[3]+'"':'')+'><span><b>'+r[0]+'</b><br><span class="small">'+(r[2]?(r[1]?'Complete':'Complete this stage in the plan workflow'):'Engineer confirmation')+'</span></span></label>').join('');
    box.querySelectorAll('[data-check42]').forEach(c=>c.onchange=()=>{f.checks=f.checks||{};f.checks[c.dataset.check42]=c.checked;persistDraft();renderSurvey()});
  }
  function canReady(f){
    const d=derived(f);
    return d.plan&&d.rooms&&d.doors&&f.checks?.exits&&f.checks?.panel&&f.checks?.stairs;
  }
  function renderSurvey(){
    const tabs=$id('floorTabs42');
    tabs.innerHTML=survey.floors.map(f=>'<button class="floorTab42 '+(f.id===activeFloorId?'active ':'')+(f.status==='Ready'?'ready':'')+'" data-floor42="'+f.id+'"><b>'+f.name+'</b><br><span style="font-size:11px">'+f.status+'</span></button>').join('');
    tabs.querySelectorAll('[data-floor42]').forEach(b=>b.onclick=()=>loadFloor(b.dataset.floor42));
    const f=floorById();
    if(f){
      const d=derived(f),pill=f.status==='Ready'?'ready':f.status==='In progress'?'progress':'';
      $id('activeFloorSummary42').innerHTML='<b>'+f.name+'</b> · <span class="statusPill42 '+pill+'">'+f.status.toUpperCase()+'</span><br><span class="small">'+(f.walls?.length||0)+' walls · '+((f.detail?.rooms||f.rooms||[]).length)+' rooms · '+((f.detail?.doors||[]).length)+' doors · '+((f.detail?.markers||[]).length)+' markers</span>';
      $id('markReady42').disabled=!canReady(f);
    }
    renderChecklist();
    const ready=survey.floors.filter(f=>f.status==='Ready').length,total=survey.floors.length;
    $id('submissionSummary42').textContent=ready+' of '+total+' floors ready. '+(ready===total&&total?'The site survey can now be submitted for desktop zone-plan preparation.':'Finish the remaining floor checks before submission.');
    $id('submitSurveyBtn42').disabled=!(total&&ready===total);
    $id('surveyStatus42').textContent=survey.status.toUpperCase();
    renderQueue();
  }

  function floorNamePrompt(){
    const options=['Ground Floor','First Floor','Second Floor','Third Floor','Basement','Mezzanine','Roof / Plant','Custom'];
    const choice=prompt('Floor type:\n'+options.map((x,i)=>(i+1)+'. '+x).join('\n')+'\n\nEnter a name or number:','First Floor');
    if(!choice)return null;
    const n=Number(choice);
    if(Number.isInteger(n)&&n>=1&&n<=options.length){
      if(options[n-1]==='Custom')return prompt('Custom floor name:','New Floor')||null;
      return options[n-1];
    }
    return choice.trim()||null;
  }
  $id('addFloor42').onclick=()=>{
    saveCurrentFloor(false);
    const name=floorNamePrompt();if(!name)return;
    const f={id:uid(),name,status:'Not started',walls:[],source:'',rooms:null,detail:null,notes:'',checks:{exits:false,panel:false,stairs:false},updatedAt:null};
    survey.floors.push(f);persistDraft();loadFloor(f.id);
  };
  $id('duplicateFloor42').onclick=()=>{
    const f=floorById();if(!f)return;saveCurrentFloor(false);
    const name=prompt('Name for duplicated floor:',f.name+' Copy');if(!name)return;
    const n=clone(f);n.id=uid();n.name=name;n.status='In progress';n.updatedAt=new Date().toISOString();
    survey.floors.push(n);persistDraft();loadFloor(n.id);
  };
  $id('renameFloor42').onclick=()=>{
    const f=floorById();if(!f)return;const n=prompt('Floor name:',f.name);if(!n)return;f.name=n.trim()||f.name;$id('floor').value=f.name;persistDraft();renderSurvey();
  };
  $id('deleteFloor42').onclick=()=>{
    if(survey.floors.length<=1){$id('activeFloorSummary42').textContent='A site survey must contain at least one floor.';return}
    const f=floorById();if(!f||!confirm('Delete '+f.name+' from this survey?'))return;
    survey.floors=survey.floors.filter(x=>x.id!==f.id);activeFloorId=survey.floors[0].id;persistDraft();loadFloor(activeFloorId);
  };
  $id('markReady42').onclick=()=>{saveCurrentFloor(false);const f=floorById();if(!canReady(f)){renderSurvey();return}f.status='Ready';persistDraft();renderSurvey()};
  $id('markWorking42').onclick=()=>{const f=floorById();if(!f)return;f.status='In progress';persistDraft();renderSurvey()};

  function siteMeta(){
    return {customer:$id('customer').value,site:$id('site').value,engineer:$id('engineer').value,date:$id('date').value};
  }
  function getSubmissions(){
    try{return JSON.parse(localStorage.getItem(submissionsKey)||'[]')}catch{return []}
  }
  function setSubmissions(v){localStorage.setItem(submissionsKey,JSON.stringify(v))}
  $id('submitSurveyBtn42').onclick=()=>{
    saveCurrentFloor(false);
    if(survey.floors.some(f=>f.status!=='Ready')){renderSurvey();return}
    const submission={...clone(survey),meta:siteMeta(),submittedAt:new Date().toISOString(),status:'Awaiting Review'};
    // Keep local prototype submissions small and dependable.
    submission.floors.forEach(f=>{if((f.source||'').length>900000)f.source=''});
    const all=getSubmissions();all.unshift(submission);
    try{setSubmissions(all)}catch(e){
      submission.floors.forEach(f=>f.source='');
      try{setSubmissions([submission,...getSubmissions().slice(0,8)])}catch{}
    }
    survey.status='Submitted';persistDraft();
    $id('submissionSummary42').textContent='Survey submitted successfully. It is now in the desktop review queue as Awaiting Review.';
    $id('submitSurveyBtn42').disabled=true;renderSurvey();
  };

  function renderQueue(){
    const box=$id('desktopQueue42');if(!box)return;
    const all=getSubmissions();
    if(!all.length){box.innerHTML='<div class="status">No submitted surveys yet.</div>';return}
    box.innerHTML=all.map((s,si)=>{
      const meta=s.meta||{};
      return '<div class="submission42"><div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><div><b>'+(meta.site||'Unnamed site')+'</b><div class="meta">'+(meta.customer||'Customer not entered')+' · '+s.floors.length+' floor'+(s.floors.length===1?'':'s')+' · '+new Date(s.submittedAt).toLocaleString()+'</div></div><span class="statusPill42 '+(s.status==='Verified'?'ready':'progress')+'">'+s.status+'</span></div><div class="reviewFloors42">'+s.floors.map((f,fi)=>'<button data-open-sub42="'+si+'" data-open-floor42="'+fi+'">'+f.name+'</button>').join('')+'</div><div class="floorActions42"><button data-review42="'+si+'">Start / continue review</button><button data-verify42="'+si+'" class="green">Mark verified</button></div></div>';
    }).join('');
    box.querySelectorAll('[data-open-sub42]').forEach(b=>b.onclick=()=>openReviewFloor(+b.dataset.openSub42,+b.dataset.openFloor42));
    box.querySelectorAll('[data-review42]').forEach(b=>b.onclick=()=>updateSubmission(+b.dataset.review42,'In Review'));
    box.querySelectorAll('[data-verify42]').forEach(b=>b.onclick=()=>updateSubmission(+b.dataset.verify42,'Verified'));
  }
  function updateSubmission(i,status){
    const all=getSubmissions();if(!all[i])return;all[i].status=status;setSubmissions(all);renderQueue();
  }
  function openReviewFloor(si,fi){
    const all=getSubmissions(),s=all[si],f=s?.floors?.[fi];if(!f)return;
    all[si].status='In Review';setSubmissions(all);
    document.body.classList.remove('engineerMode42');document.body.classList.add('desktopMode42');
    $id('customer').value=s.meta?.customer||'';$id('site').value=s.meta?.site||'';$id('engineer').value=s.meta?.engineer||'';$id('date').value=s.meta?.date||'';
    $id('floor').value=f.name;
    walls=clone(f.walls||[]).map(normaliseWall);selected=-1;history=[];renderAll();
    if(f.rooms?.length)window.fireZoneRoomModel?.setRooms?.(f.rooms);
    const detail=f.detail||{rooms:f.rooms||[],doors:[],markers:[]};
    if(detail.rooms?.length){
      window.fireZoneDoorEditor?.setState?.(detail);
      window.dispatchEvent(new CustomEvent('firezone:doors-approved',{detail:clone(detail)}));
    }
    $id('zoneCard35')?.classList.remove('hidden');
    $id('zoneCard35')?.scrollIntoView({behavior:'smooth'});
    renderQueue();
  }

  function showEngineer(){
    document.body.classList.add('engineerMode42');document.body.classList.remove('desktopMode42');
    $id('engineerPanel42').classList.remove('hidden');$id('desktopPanel42').classList.add('hidden');
    $id('engineerModeBtn42').classList.add('navy');$id('desktopModeBtn42').classList.remove('navy');
  }
  function showDesktop(){
    saveCurrentFloor();
    document.body.classList.remove('engineerMode42');document.body.classList.add('desktopMode42');
    $id('engineerPanel42').classList.add('hidden');$id('desktopPanel42').classList.remove('hidden');
    $id('desktopModeBtn42').classList.add('navy');$id('engineerModeBtn42').classList.remove('navy');
    renderQueue();
  }
  $id('engineerModeBtn42').onclick=showEngineer;
  $id('desktopModeBtn42').onclick=showDesktop;
  $id('stickyFloors42').onclick=()=>surveyCard.scrollIntoView({behavior:'smooth'});
  $id('stickySave42').onclick=()=>{saveCurrentFloor();$id('activeFloorSummary42').scrollIntoView({behavior:'smooth',block:'center'})};

  // Keep site/floor state safe during normal use.
  ['customer','site','engineer','date'].forEach(id=>$id(id)?.addEventListener('change',persistDraft));
  $id('floorNotes42')?.addEventListener('input',()=>{const f=floorById();if(f){f.notes=$id('floorNotes42').value;persistDraft()}});
  if($id('floor')){$id('floor').readOnly=true;$id('floor').placeholder='Active floor';$id('floor').title='Managed from the floor selector above';}
  window.addEventListener('beforeunload',()=>{try{saveCurrentFloor()}catch{}});
  setInterval(()=>{if(autosaveBusy)return;autosaveBusy=true;try{saveCurrentFloor()}finally{autosaveBusy=false}},6000);

  restoreDraft();
  loadFloor(activeFloorId);
  showEngineer();
})();