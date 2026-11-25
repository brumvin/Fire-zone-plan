
(function(){
'use strict';
var W=760,H=500;
var DRAFT_KEY='fireZoneSurveyDraftV50',QUEUE_KEY='fireZoneSubmissionsV50';
function $(id){return document.getElementById(id)}
function uid(){return 'fz_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function clone(x){return JSON.parse(JSON.stringify(x))}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function snap(v){return Math.round(v/5)*5}
function wallLen(w){return Math.hypot(w.x2-w.x1,w.y2-w.y1)}
function safePointerCapture(el,id){try{if(el&&el.setPointerCapture)el.setPointerCapture(id)}catch(e){}}
function newFloor(name){return {id:uid(),name:name||'Ground Floor',status:'Not started',walls:[],doors:[],stairs:[],rooms:[],markers:[],notes:'',checks:{exits:false,panel:false,stairs:false},source:'',updatedAt:null,history:[],redo:[]}}
function newState(){return {id:uid(),customer:'',site:'',building:'',engineer:'',date:new Date().toISOString().slice(0,10),status:'Draft',activeFloor:0,floors:[newFloor('Ground Floor')]}}
function loadDraft(){try{var x=JSON.parse(localStorage.getItem(DRAFT_KEY));return x&&x.floors?x:newState()}catch(e){return newState()}}
function loadQueue(){try{return JSON.parse(localStorage.getItem(QUEUE_KEY))||[]}catch(e){return []}}
function saveQueue(q){
  try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q));return true}
  catch(e){console.error('Queue storage failed',e);return false}
}
var state=loadDraft(),queue=loadQueue(),tool='wall',drag=null,selected=null,pendingEngineerMarker=null,reviewId=null,reviewFloor=0,desktopTool='select',desktopDrag=null,desktopSelected=null;
var engineerView={zoom:1,cx:W/2,cy:H/2,pan:false},desktopView={zoom:1,cx:W/2,cy:H/2,pan:false};
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function applyView(svg,v,labelId){
  var vw=W/v.zoom,vh=H/v.zoom;
  v.cx=vw>=W?W/2:clamp(v.cx,vw/2,W-vw/2);
  v.cy=vh>=H?H/2:clamp(v.cy,vh/2,H-vh/2);
  svg.setAttribute('viewBox',(v.cx-vw/2)+' '+(v.cy-vh/2)+' '+vw+' '+vh);
  if($(labelId))$(labelId).textContent=Math.round(v.zoom*100)+'%'
}
function changeZoom(svg,v,labelId,factor){
  v.zoom=clamp(v.zoom*factor,.5,5);applyView(svg,v,labelId)
}
function resetView(svg,v,labelId){v.zoom=1;v.cx=W/2;v.cy=H/2;v.pan=false;applyView(svg,v,labelId)}
function setPan(v,button,on){v.pan=on==null?!v.pan:!!on;if(button)button.setAttribute('aria-pressed',String(v.pan))}
function panMove(svg,v,d,e){
  var rect=svg.getBoundingClientRect(),vw=W/v.zoom,vh=H/v.zoom;
  v.cx=d.cx-(e.clientX-d.clientX)*(vw/rect.width);
  v.cy=d.cy-(e.clientY-d.clientY)*(vh/rect.height);
  applyView(svg,v,d.label)
}

function floor(){return state.floors[state.activeFloor]}
function saveDraft(silent){
  state.customer=$('customer').value;state.site=$('site').value;state.building=$('building').value;state.engineer=$('engineer').value;
  var f=floor();f.notes=$('floorNotes').value;f.status=$('floorStatus').value;f.checks={exits:$('checkExits').checked,panel:$('checkPanel').checked,stairs:$('checkStairs').checked};f.updatedAt=new Date().toISOString();
  var copy=clone(state);copy.floors.forEach(function(x){x.history=[];x.redo=[];if(x.source&&x.source.length>800000)x.source=''});
  try{localStorage.setItem(DRAFT_KEY,JSON.stringify(copy));if(!silent)$('submitMessage').textContent='Draft saved locally at '+new Date().toLocaleTimeString()+'.'}catch(e){if(!silent)$('submitMessage').textContent='Draft could not be fully saved. Large photo data may exceed browser storage.'}
}
function snapshot(){
  var f=floor(),snap={walls:clone(f.walls),doors:clone(f.doors),stairs:clone(f.stairs),rooms:clone(f.rooms),markers:clone(f.markers)};
  f.history=f.history||[];f.redo=f.redo||[];f.history.push(snap);if(f.history.length>30)f.history.shift();f.redo=[];
}
function restoreSnap(s){
  var f=floor();f.walls=clone(s.walls||[]);f.doors=clone(s.doors||[]);f.stairs=clone(s.stairs||[]);f.rooms=clone(s.rooms||[]);f.markers=clone(s.markers||[]);
}
function undo(){var f=floor();if(!f.history||!f.history.length)return;f.redo=f.redo||[];f.redo.push({walls:clone(f.walls),doors:clone(f.doors),stairs:clone(f.stairs),rooms:clone(f.rooms),markers:clone(f.markers)});restoreSnap(f.history.pop());selected=null;renderEngineer()}
function redo(){var f=floor();if(!f.redo||!f.redo.length)return;f.history=f.history||[];f.history.push({walls:clone(f.walls),doors:clone(f.doors),stairs:clone(f.stairs),rooms:clone(f.rooms),markers:clone(f.markers)});restoreSnap(f.redo.pop());selected=null;renderEngineer()}

function setMode(mode){
  $('engineerMode').classList.toggle('hidden',mode!=='engineer');$('desktopMode').classList.toggle('hidden',mode!=='desktop');$('finalMode').classList.toggle('hidden',mode!=='final');
  $('modeEngineer').classList.toggle('active',mode==='engineer');$('modeDesktop').classList.toggle('active',mode==='desktop');$('modeFinal').classList.toggle('active',mode==='final');
  if(mode==='desktop')renderQueue();if(mode==='final')populateFinal();
}
$('modeEngineer').onclick=function(){setMode('engineer')};$('modeDesktop').onclick=function(){setMode('desktop')};$('modeFinal').onclick=function(){setMode('final')};

function syncForm(){
  $('customer').value=state.customer||'';$('site').value=state.site||'';$('building').value=state.building||'';$('engineer').value=state.engineer||'';
  $('surveyStatus').textContent=state.status||'Draft';$('surveyStatus').className='pill '+(state.status==='Submitted'?'green':'orange');
  loadFloorForm();renderFloorTabs();renderEngineer();
}
function loadFloorForm(){
  var f=floor();$('floorNotes').value=f.notes||'';$('floorStatus').value=f.status||'Not started';$('checkExits').checked=!!f.checks.exits;$('checkPanel').checked=!!f.checks.panel;$('checkStairs').checked=!!f.checks.stairs;
  if(f.source){$('photoPreview').src=f.source;$('photoPreview').classList.remove('hidden');$('sourceBadge').textContent='Photo attached';$('sourceBadge').className='pill blue'}else{$('photoPreview').classList.add('hidden');$('sourceBadge').textContent='No source';$('sourceBadge').className='pill'}
}
function renderFloorTabs(){
  var h='';state.floors.forEach(function(f,i){h+='<button class="floorTab '+(i===state.activeFloor?'active':'')+'" data-fi="'+i+'"><b>'+esc(f.name)+'</b><span>'+esc(f.status)+'</span></button>'});$('floorTabs').innerHTML=h;
  Array.from($('floorTabs').querySelectorAll('[data-fi]')).forEach(function(b){b.onclick=function(){saveDraft(true);state.activeFloor=+b.dataset.fi;selected=null;loadFloorForm();renderFloorTabs();renderEngineer()}})
}
$('addFloor').onclick=function(){saveDraft(true);state.floors.push(newFloor('Floor '+state.floors.length));state.activeFloor=state.floors.length-1;selected=null;loadFloorForm();renderFloorTabs();renderEngineer()}
$('duplicateFloor').onclick=function(){saveDraft(true);var n=clone(floor());n.id=uid();n.name=floor().name+' Copy';n.status='In progress';n.history=[];n.redo=[];state.floors.push(n);state.activeFloor=state.floors.length-1;loadFloorForm();renderFloorTabs();renderEngineer()}
$('renameFloor').onclick=function(){var n=prompt('Floor name',floor().name);if(n&&n.trim()){floor().name=n.trim();renderFloorTabs();saveDraft(true)}}
$('deleteFloor').onclick=function(){if(state.floors.length===1){alert('At least one floor is required.');return}if(confirm('Delete '+floor().name+'?')){state.floors.splice(state.activeFloor,1);state.activeFloor=Math.max(0,state.activeFloor-1);selected=null;loadFloorForm();renderFloorTabs();renderEngineer();saveDraft(true)}}

function setTool(t){
  tool=t;selected=null;drag=null;Array.from(document.querySelectorAll('[data-tool]')).forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.tool===t))});
  var m={select:'Tap a wall to select it. Drag the orange end handles to change its length, or drag the wall itself to move it.',wall:'Drag to draw a horizontal or vertical wall. Existing walls stay fixed while you draw the next one.',angle:'Drag freely to draw an angled wall. Existing walls stay fixed.',arc:'Drag to create a curved wall. Existing walls stay fixed.',room:'Drag a rectangle to create a room outline.',door:'Tap close to a wall to place a single door.',doubleDoor:'Tap close to a wall to place a double door.',stairs:'Tap to place a staircase.',marker:'Tap the plan to place the selected fire-safety marker.'};
  $('toolHint').textContent=m[t]||'';renderEngineer()
}
Array.from(document.querySelectorAll('[data-tool]')).forEach(function(b){b.onclick=function(){pendingEngineerMarker=null;setTool(b.dataset.tool)}});
Array.from(document.querySelectorAll('[data-eng-marker]')).forEach(function(b){
  b.onclick=function(){
    pendingEngineerMarker=b.dataset.engMarker;
    tool='marker';selected=null;drag=null;
    Array.from(document.querySelectorAll('[data-tool]')).forEach(function(x){x.setAttribute('aria-pressed','false')});
    $('toolHint').textContent='Tap the plan to place '+pendingEngineerMarker+'. You can then use Select / move to drag, rotate or resize it.';
    renderEngineer()
  }
});

function svgPoint(svg,e){var p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;var q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:Math.max(0,Math.min(W,snap(q.x))),y:Math.max(0,Math.min(H,snap(q.y)))}}
function lineWall(a,b,free){if(free)return{x1:a.x,y1:a.y,x2:b.x,y2:b.y,axis:'A'};if(Math.abs(b.x-a.x)>=Math.abs(b.y-a.y))return{x1:a.x,y1:a.y,x2:b.x,y2:a.y,axis:'H'};return{x1:a.x,y1:a.y,x2:a.x,y2:b.y,axis:'V'}}
function nearestWall(list,x,y){var best=null;list.forEach(function(w,i){if(w.type==='ARC')return;var dx=w.x2-w.x1,dy=w.y2-w.y1,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(y-w.y1)*dy)/L)),qx=w.x1+t*dx,qy=w.y1+t*dy,d=Math.hypot(x-qx,y-qy);if(!best||d<best.d)best={i:i,x:qx,y:qy,d:d,angle:Math.atan2(dy,dx)*180/Math.PI}});return best}
function wallSvg(w,i,sel){
  var cls='wall '+(w.confidence==='review'?'review ':w.confidence==='medium'?'medium ':'')+(sel?'selected':'');
  var handles=sel?'<g class="wallHandles"><circle class="handle" data-kind="wallhandle" data-i="'+i+'" data-end="1" cx="'+w.x1+'" cy="'+w.y1+'" r="9"/><circle class="handle" data-kind="wallhandle" data-i="'+i+'" data-end="2" cx="'+w.x2+'" cy="'+w.y2+'" r="9"/></g>':'';
  if(w.type==='ARC')return '<g data-kind="wall" data-i="'+i+'"><path class="'+cls+'" fill="none" d="M'+w.x1+' '+w.y1+' Q'+w.cx+' '+w.cy+' '+w.x2+' '+w.y2+'"/><path class="wallHit" fill="none" d="M'+w.x1+' '+w.y1+' Q'+w.cx+' '+w.cy+' '+w.x2+' '+w.y2+'"/></g>'+handles;
  return '<g data-kind="wall" data-i="'+i+'"><line class="'+cls+'" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/><line class="wallHit" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/></g>'+handles;
}
function doorSvg(d,i,sel){
  var size=d.size||1,sw=d.swing===-1?-1:1,half=(d.type==='double'?28:22)*size;
  var depth=d.type==='double'?half:half*2,cls='door '+(sel?'selected':'');
  var out='<g data-kind="door" data-i="'+i+'" transform="translate('+d.x+' '+d.y+') rotate('+(d.angle||0)+')">';
  out+='<rect class="hitbox" x="'+(-half-5)+'" y="'+(Math.min(0,sw*depth)-5)+'" width="'+(2*half+10)+'" height="'+(depth+10)+'"/>';
  function leaf(h,c){var rad=Math.abs(c-h),y=sw*rad,flag=(c>h)===(sw>0)?1:0;
    return '<line class="'+cls+'" style="stroke-width:2.5" x1="'+h+'" y1="0" x2="'+h+'" y2="'+y+'"/><path class="door" style="stroke-width:1.3" d="M'+c+' 0 A'+rad+' '+rad+' 0 0 '+flag+' '+h+' '+y+'"/>';
  }
  if(d.type==='double')out+=leaf(-half,0)+leaf(half,0);
  else out+=d.hand===-1?leaf(half,-half):leaf(-half,half);
  if(sel)out+='<circle class="handle" data-kind="doorhandle" data-i="'+i+'" cx="'+(42*size)+'" cy="0" r="7"/>';
  return out+'</g>';
}
// Render actual openings in straight walls without deleting source geometry.
function wallsWithOpenings(f,w,i,sel){
  if(w.type==='ARC')return wallSvg(w,i,sel);
  var dx=w.x2-w.x1,dy=w.y2-w.y1,L=Math.hypot(dx,dy);if(!L)return wallSvg(w,i,sel);
  var ux=dx/L,uy=dy/L,gaps=[];
  (f.doors||[]).forEach(function(d){
    var q=nearestWall(f.walls,d.x,d.y);
    if(!q||q.i!==i||q.d>4)return;
    var a=(d.angle||0)*Math.PI/180;if(Math.abs(Math.sin(a-Math.atan2(dy,dx)))>.08)return;
    var t=(d.x-w.x1)*ux+(d.y-w.y1)*uy,h=(d.type==='double'?28:22)*(d.size||1);
    gaps.push([Math.max(0,t-h),Math.min(L,t+h)]);
  });
  if(!gaps.length)return wallSvg(w,i,sel);
  gaps.sort(function(a,b){return a[0]-b[0]});var pos=0,out='';
  function segment(a,b){if(b-a>.01)out+=wallSvg(Object.assign({},w,{x1:w.x1+a*ux,y1:w.y1+a*uy,x2:w.x1+b*ux,y2:w.y1+b*uy}),i,false)}
  gaps.forEach(function(g){segment(pos,g[0]);pos=Math.max(pos,g[1])});segment(pos,L);
  if(sel)out+='<circle class="handle" data-kind="wallhandle" data-i="'+i+'" data-end="1" cx="'+w.x1+'" cy="'+w.y1+'" r="9"/><circle class="handle" data-kind="wallhandle" data-i="'+i+'" data-end="2" cx="'+w.x2+'" cy="'+w.y2+'" r="9"/>';
  return out;
}
function stairSvg(s,i,sel,kind){
  var sc=s.size||1,z='',left=-22*sc,right=22*sc,top=-23*sc,step=9*sc;
  for(var n=0;n<6;n++)z+='<line x1="'+left+'" y1="'+(top+n*step)+'" x2="'+right+'" y2="'+(top+n*step)+'"/>';
  var handle=sel?'<circle class="handle" data-kind="stairhandle" data-i="'+i+'" cx="'+(30*sc)+'" cy="'+(34*sc)+'" r="9"/>':'';
  return '<g data-kind="'+(kind||'stairs')+'" data-i="'+i+'" transform="translate('+s.x+' '+s.y+') rotate('+(s.rot||0)+')"><rect class="hitbox" x="'+(-34*sc)+'" y="'+(-38*sc)+'" width="'+(68*sc)+'" height="'+(78*sc)+'"/><g class="stairs '+(sel?'selected':'')+'"><rect x="'+(-24*sc)+'" y="'+(-28*sc)+'" width="'+(48*sc)+'" height="'+(58*sc)+'"/>'+z+'<path d="M0 '+(22*sc)+'V'+(-18*sc)+'m0 0l'+(-6*sc)+' '+(8*sc)+'m'+(6*sc)+' '+(-8*sc)+'l'+(6*sc)+' '+(8*sc)+'" fill="none"/></g>'+handle+'</g>'
}
function markerSvg(m,i,sel){
  var label=esc(m.type),sc=m.size||1,w=Math.max(40,label.length*7+14)*sc,h=28*sc;
  var handle=sel?'<circle class="handle" data-kind="markerhandle" data-i="'+i+'" cx="'+(w/2+8)+'" cy="'+(h/2+8)+'" r="7"/>':'';
  return '<g data-kind="marker" data-i="'+i+'" transform="translate('+m.x+' '+m.y+') rotate('+(m.rot||0)+')"><rect class="hitbox" x="'+(-w/2-8)+'" y="'+(-h/2-8)+'" width="'+(w+16)+'" height="'+(h+16)+'"/><rect class="marker '+(sel?'selected':'')+'" x="'+(-w/2)+'" y="'+(-h/2)+'" rx="5" width="'+w+'" height="'+h+'"/><text x="0" y="'+(4*sc)+'" text-anchor="middle" font-size="'+(11*sc)+'" font-weight="700">'+label+'</text>'+handle+'</g>'
}
function roomSvg(r,i,sel){
  var cls='room zone'+(r.zone||0)+' '+(sel?'selected':''),
      lx=r.labelX!=null?r.labelX:r.x+r.w/2,ly=r.labelY!=null?r.labelY:r.y+r.h/2,
      label=esc(r.name||('Room '+(i+1)))+(r.zone?' · Z'+r.zone:''),
      lw=Math.max(54,String(r.name||('Room '+(i+1))).length*8+34);
  return '<g data-kind="room" data-i="'+i+'"><rect class="'+cls+'" x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'"/><rect class="hitbox" x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'"/><rect class="labelHit" data-kind="roomlabel" data-i="'+i+'" x="'+(lx-lw/2)+'" y="'+(ly-16)+'" width="'+lw+'" height="28"/><text class="roomLabel" x="'+lx+'" y="'+ly+'" text-anchor="middle">'+label+'</text></g>'
}

function renderEngineer(){
  var f=floor(),svg=$('engineerSvg'),s='<defs><pattern id="gridE" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 L0 0 0 20" fill="none" stroke="#edf1f2" stroke-width="1"/></pattern></defs><rect width="760" height="500" fill="url(#gridE)"/>';
  if(f.source)s+='<image href="'+f.source+'" x="0" y="0" width="760" height="500" preserveAspectRatio="xMidYMid meet" opacity=".18"/>';
  f.rooms.forEach(function(r,i){s+=roomSvg(r,i,selected&&selected.kind==='room'&&selected.i===i)});
  f.walls.forEach(function(w,i){s+=wallsWithOpenings(f,w,i,selected&&selected.kind==='wall'&&selected.i===i)});
  f.doors.forEach(function(d,i){s+=doorSvg(d,i,selected&&selected.kind==='door'&&selected.i===i)});
  f.stairs.forEach(function(x,i){s+=stairSvg(x,i,selected&&selected.kind==='stairs'&&selected.i===i)});
  f.markers.forEach(function(x,i){s+=markerSvg(x,i,selected&&selected.kind==='marker'&&selected.i===i)});
  if(drag&&drag.type==='draw'){
    var w=lineWall(drag.start,drag.now,tool==='angle');
    if(tool==='arc'){var mx=(drag.start.x+drag.now.x)/2,my=(drag.start.y+drag.now.y)/2,dx=drag.now.x-drag.start.x,dy=drag.now.y-drag.start.y,L=Math.hypot(dx,dy)||1,cx=mx-dy/L*35,cy=my+dx/L*35;s+='<path class="guide" d="M'+drag.start.x+' '+drag.start.y+' Q'+cx+' '+cy+' '+drag.now.x+' '+drag.now.y+'"/>'}
    else if(tool==='room'){var x=Math.min(drag.start.x,drag.now.x),y=Math.min(drag.start.y,drag.now.y),rw=Math.abs(drag.now.x-drag.start.x),rh=Math.abs(drag.now.y-drag.start.y);s+='<rect class="guide" x="'+x+'" y="'+y+'" width="'+rw+'" height="'+rh+'"/>'}
    else s+='<line class="guide" x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'"/>'
  }
  svg.innerHTML=s;applyView(svg,engineerView,'engZoomLabel');
  $('drawingStats').textContent=f.walls.length+' walls · '+f.rooms.length+' rooms · '+f.doors.length+' doors · '+f.stairs.length+' stairs';
  $('selectedInfo').textContent=selected?(selected.kind==='wall'?'Wall selected. Drag either orange end handle to change its length; drag the line itself to move the whole wall.':selected.kind+' selected. Drag it directly or use the controls below.'):'Nothing selected.';
  syncEngineerSizeControls()
}
function syncEngineerSizeControls(){
  var box=$('engineerSizeControls'),o=getSelected(),supported=!!(o&&selected&&(selected.kind==='door'||selected.kind==='stairs'||selected.kind==='marker'));
  box.classList.toggle('hidden',!supported);
  if(supported){
    var pct=Math.round((o.size||1)*100);
    $('engineerSizeRange').value=pct;$('engineerSizeNumber').value=pct;$('engineerSizeText').textContent=pct+'%'
  }
}
function setEngineerExactSize(value){
  var o=getSelected();if(!o||!selected||!(selected.kind==='door'||selected.kind==='stairs'||selected.kind==='marker'))return;
  var pct=clamp(parseInt(value,10)||100,25,300);snapshot();o.size=pct/100;renderEngineer();saveDraft(true)
}
function getSelected(){
  if(!selected)return null;var f=floor();var a=selected.kind==='wall'?f.walls:selected.kind==='door'?f.doors:selected.kind==='stairs'?f.stairs:selected.kind==='room'?f.rooms:f.markers;return a[selected.i]
}
function alterSize(dir){
  var o=getSelected();if(!o)return;snapshot();
  if(selected.kind==='wall'){var dx=o.x2-o.x1,dy=o.y2-o.y1,L=Math.hypot(dx,dy)||1,factor=dir>0?1.12:.88;o.x2=o.x1+dx/L*L*factor;o.y2=o.y1+dy/L*L*factor;if(o.type==='ARC'){o.cx=(o.x1+o.x2)/2;o.cy=(o.y1+o.y2)/2+30}}
  else if(selected.kind==='room'){o.w=Math.max(20,o.w+(dir>0?10:-10));o.h=Math.max(20,o.h+(dir>0?10:-10))}
  else if(selected.kind==='door'||selected.kind==='stairs'||selected.kind==='marker'){o.size=Math.max(.55,Math.min(2.5,(o.size||1)+(dir>0?.12:-.12)))}
  renderEngineer();saveDraft(true)
}
$('shorter').onclick=function(){alterSize(-1)};$('longer').onclick=function(){alterSize(1)}
$('engineerSizeRange').oninput=function(){setEngineerExactSize(this.value)}
$('engineerSizeNumber').onchange=function(){setEngineerExactSize(this.value)}
$('flipDoor').onclick=function(){var o=getSelected();if(!o||selected.kind!=='door'){$('selectedInfo').textContent='Select a door first.';return}snapshot();o.swing=(o.swing===-1?1:-1);renderEngineer();saveDraft(true)}
$('handDoor').onclick=function(){var o=getSelected();if(!o||selected.kind!=='door'){$('selectedInfo').textContent='Select a door first.';return}snapshot();o.hand=(o.hand===-1?1:-1);renderEngineer();saveDraft(true)}
$('toggleDoorType').onclick=function(){var o=getSelected();if(!o||selected.kind!=='door'){$('selectedInfo').textContent='Select a door first.';return}snapshot();o.type=(o.type||'single')==='double'?'single':'double';renderEngineer();saveDraft(true)}
$('renameRoom').onclick=function(){var o=getSelected();if(!o||selected.kind!=='room'){$('selectedInfo').textContent='Select a room first.';return}var n=prompt('Room name',o.name||'Room');if(n&&n.trim()){snapshot();o.name=n.trim();renderEngineer();saveDraft(true)}}
$('rotateSelected').onclick=function(){var o=getSelected();if(!o)return;snapshot();if(selected.kind==='door')o.angle=(o.angle+90)%360;else if(selected.kind==='stairs'||selected.kind==='marker')o.rot=((o.rot||0)+90)%360;else if(selected.kind==='wall'){var mx=(o.x1+o.x2)/2,my=(o.y1+o.y2)/2,dx=(o.x2-o.x1)/2,dy=(o.y2-o.y1)/2;o.x1=mx+dy;o.y1=my-dx;o.x2=mx-dy;o.y2=my+dx;o.axis='A'}renderEngineer();saveDraft(true)}
$('duplicateSelected').onclick=function(){var o=getSelected();if(!o)return;snapshot();var f=floor(),a=selected.kind==='wall'?f.walls:selected.kind==='door'?f.doors:selected.kind==='stairs'?f.stairs:selected.kind==='room'?f.rooms:f.markers,n=clone(o);if('x' in n)n.x+=15;if('y' in n)n.y+=15;if('x1' in n){n.x1+=15;n.x2+=15;n.y1+=15;n.y2+=15}a.push(n);selected={kind:selected.kind,i:a.length-1};renderEngineer();saveDraft(true)}
$('deleteSelected').onclick=function(){if(!selected)return;snapshot();var f=floor(),a=selected.kind==='wall'?f.walls:selected.kind==='door'?f.doors:selected.kind==='stairs'?f.stairs:selected.kind==='room'?f.rooms:f.markers;a.splice(selected.i,1);selected=null;renderEngineer();saveDraft(true)}
$('clearDrawing').onclick=function(){if(confirm('Clear the current floor drawing?')){snapshot();var f=floor();f.walls=[];f.doors=[];f.stairs=[];f.rooms=[];f.markers=[];selected=null;renderEngineer();saveDraft(true)}}
$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
$('tidyBtn').onclick=function(){snapshot();var f=floor();f.walls.forEach(function(w){if(w.type==='ARC')return;var dx=Math.abs(w.x2-w.x1),dy=Math.abs(w.y2-w.y1);if(dx>dy*3){w.y2=w.y1;w.axis='H'}else if(dy>dx*3){w.x2=w.x1;w.axis='V'}w.x1=snap(w.x1);w.x2=snap(w.x2);w.y1=snap(w.y1);w.y2=snap(w.y2)});renderEngineer();saveDraft(true)}

var esvg=$('engineerSvg');
$('engZoomIn').onclick=function(){changeZoom(esvg,engineerView,'engZoomLabel',1.25)}
$('engZoomOut').onclick=function(){changeZoom(esvg,engineerView,'engZoomLabel',.8)}
$('engZoomReset').onclick=function(){resetView(esvg,engineerView,'engZoomLabel');$('engPan').setAttribute('aria-pressed','false')}
$('engPan').onclick=function(){setPan(engineerView,this)}
esvg.addEventListener('wheel',function(e){if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();changeZoom(esvg,engineerView,'engZoomLabel',e.deltaY<0?1.12:.89)},{passive:false});
esvg.onpointerdown=function(e){
  e.preventDefault();
  if(engineerView.pan){drag={type:'pan',id:e.pointerId,clientX:e.clientX,clientY:e.clientY,cx:engineerView.cx,cy:engineerView.cy,label:'engZoomLabel'};safePointerCapture(esvg,e.pointerId);return}
  var p=svgPoint(esvg,e),hit=e.target.closest('[data-kind]');
  var direct=hit&&/^(door|stairs|marker|doorhandle|stairhandle|markerhandle|roomlabel)$/.test(hit.dataset.kind);

  // Drawing tools always win over existing hitboxes. This lets a new wall start
  // directly beside or from the end of an existing wall without moving it.
  if(!direct&&(tool==='wall'||tool==='angle'||tool==='arc'||tool==='room')){
    drag={type:'draw',id:e.pointerId,start:p,now:p};safePointerCapture(esvg,e.pointerId);renderEngineer();return
  }
  if(!direct&&(tool==='door'||tool==='doubleDoor')){var q=nearestWall(floor().walls,p.x,p.y);if(q&&q.d<60){snapshot();floor().doors.push({x:q.x,y:q.y,angle:q.angle,size:1,type:tool==='doubleDoor'?'double':'single',swing:1,hand:1});selected={kind:'door',i:floor().doors.length-1};renderEngineer();saveDraft(true)}return}
  if(!direct&&tool==='stairs'){snapshot();floor().stairs.push({x:p.x,y:p.y,rot:0,size:1});selected={kind:'stairs',i:floor().stairs.length-1};renderEngineer();saveDraft(true);return}
  if(!direct&&tool==='marker'&&pendingEngineerMarker){snapshot();floor().markers.push({type:pendingEngineerMarker,x:p.x,y:p.y,rot:0,size:1});selected={kind:'marker',i:floor().markers.length-1};pendingEngineerMarker=null;var keep=selected;setTool('select');selected=keep;renderEngineer();saveDraft(true);return}

  // Existing geometry is editable only in Select / move mode.
  if(hit&&(tool==='select'||direct)){
    var kind=hit.dataset.kind,i=+hit.dataset.i;
    if(kind==='wallhandle'){
      selected={kind:'wall',i:i};snapshot();
      drag={type:'wall-end',kind:'wall',i:i,end:+hit.dataset.end,id:e.pointerId,start:p,orig:clone(floor().walls[i])};
      safePointerCapture(esvg,e.pointerId);renderEngineer();return
    }
    if(kind==='markerhandle'){selected={kind:'marker',i:i};snapshot();drag={type:'marker-size',kind:'marker',i:i,id:e.pointerId,start:p,orig:clone(floor().markers[i])};safePointerCapture(esvg,e.pointerId);renderEngineer();return}
    if(kind==='stairhandle'){
      selected={kind:'stairs',i:i};snapshot();
      drag={type:'stair-size',kind:'stairs',i:i,id:e.pointerId,start:p,orig:clone(floor().stairs[i])};
      safePointerCapture(esvg,e.pointerId);renderEngineer();return
    }
    if(kind==='doorhandle'){
      selected={kind:'door',i:i};snapshot();
      drag={type:'door-size',kind:'door',i:i,id:e.pointerId,start:p,orig:clone(floor().doors[i])};
      safePointerCapture(esvg,e.pointerId);renderEngineer();return
    }
    if(kind==='roomlabel'){
      selected={kind:'room',i:i};snapshot();
      drag={type:'room-label',kind:'room',i:i,id:e.pointerId,start:p,orig:clone(floor().rooms[i])};
      safePointerCapture(esvg,e.pointerId);renderEngineer();return
    }
    selected={kind:kind,i:i};var o=getSelected();snapshot();
    drag={type:'move',kind:kind,i:i,id:e.pointerId,start:p,orig:clone(o)};
    safePointerCapture(esvg,e.pointerId);renderEngineer();return
  }
  if(tool==='select'){selected=null;renderEngineer()}
};
esvg.onpointermove=function(e){
  if(!drag||drag.id!==e.pointerId)return;e.preventDefault();
  if(drag.type==='pan'){panMove(esvg,engineerView,drag,e);return}
  var p=svgPoint(esvg,e);
  if(drag.type==='draw'){drag.now=p;renderEngineer();return}
  var o=getSelected();if(!o)return;

  if(drag.type==='wall-end'){
    var orig=drag.orig;
    if(orig.type==='ARC'){
      if(drag.end===1){o.x1=p.x;o.y1=p.y}else{o.x2=p.x;o.y2=p.y}
    }else if(orig.axis==='H'){
      if(drag.end===1){o.x1=p.x;o.y1=orig.y1}else{o.x2=p.x;o.y2=orig.y2}
    }else if(orig.axis==='V'){
      if(drag.end===1){o.x1=orig.x1;o.y1=p.y}else{o.x2=orig.x2;o.y2=p.y}
    }else{
      if(drag.end===1){o.x1=p.x;o.y1=p.y}else{o.x2=p.x;o.y2=p.y}
    }
    renderEngineer();return
  }
  if(drag.type==='stair-size'){
    var base=Math.hypot(30,34),dist=Math.hypot(p.x-drag.orig.x,p.y-drag.orig.y);
    o.size=clamp(dist/base,.25,3);renderEngineer();return
  }
  if(drag.type==='marker-size'){o.size=clamp((drag.orig.size||1)*Math.hypot(p.x-o.x,p.y-o.y)/Math.max(1,Math.hypot(drag.start.x-o.x,drag.start.y-o.y)),.25,3);renderEngineer();return}
  if(drag.type==='door-size'){
    var doorDist=Math.hypot(p.x-drag.orig.x,p.y-drag.orig.y);
    o.size=clamp(doorDist/42,.25,3);renderEngineer();return
  }
  if(drag.type==='room-label'){
    o.labelX=p.x;o.labelY=p.y;renderEngineer();return
  }

  var dx=p.x-drag.start.x,dy=p.y-drag.start.y;
  if(drag.kind==='wall'){o.x1=drag.orig.x1+dx;o.x2=drag.orig.x2+dx;o.y1=drag.orig.y1+dy;o.y2=drag.orig.y2+dy;if(o.type==='ARC'){o.cx=drag.orig.cx+dx;o.cy=drag.orig.cy+dy}}
  else if(drag.kind==='room'){o.x=drag.orig.x+dx;o.y=drag.orig.y+dy;if(drag.orig.labelX!=null){o.labelX=drag.orig.labelX+dx;o.labelY=drag.orig.labelY+dy}}
  else if(drag.kind==='door'){var q=nearestWall(floor().walls,drag.orig.x+dx,drag.orig.y+dy);if(q&&q.d<60){o.x=q.x;o.y=q.y;o.angle=q.angle}else{o.x=drag.orig.x+dx;o.y=drag.orig.y+dy}}
  else{o.x=drag.orig.x+dx;o.y=drag.orig.y+dy}renderEngineer()
};
function finishEngineer(e){
  if(!drag||drag.id!==e.pointerId)return;
  if(drag.type==='draw'){snapshot();var a=drag.start,b=drag.now;
    if(tool==='room'){var x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),rw=Math.abs(b.x-a.x),rh=Math.abs(b.y-a.y);if(rw>=30&&rh>=30){floor().rooms.push({id:uid(),x:x,y:y,w:rw,h:rh,name:'Room '+(floor().rooms.length+1),zone:0,labelX:null,labelY:null});selected={kind:'room',i:floor().rooms.length-1}}}
    else if(tool==='arc'){if(Math.hypot(b.x-a.x,b.y-a.y)>=20){var mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;floor().walls.push({type:'ARC',axis:'ARC',x1:a.x,y1:a.y,x2:b.x,y2:b.y,cx:mx-dy/L*35,cy:my+dx/L*35});selected={kind:'wall',i:floor().walls.length-1}}}
    else{var w=lineWall(a,b,tool==='angle');if(wallLen(w)>=15){floor().walls.push(w);selected={kind:'wall',i:floor().walls.length-1}}}
  }
  drag=null;renderEngineer();saveDraft(true)
}
esvg.onpointerup=finishEngineer;esvg.onpointercancel=finishEngineer;

$('saveDraft').onclick=function(){saveDraft(false)};$('mobileSave').onclick=function(){saveDraft(false)};$('mobileFloors').onclick=function(){$('floorTabs').scrollIntoView({behavior:'smooth'})};
['customer','site','building','engineer','floorNotes','floorStatus','checkExits','checkPanel','checkStairs'].forEach(function(id){$(id).addEventListener('change',function(){saveDraft(true);renderFloorTabs();updateReadiness()})});

function openPhotoPicker(inputId){
  var input=$(inputId);
  if(!input)return;
  input.value='';
  input.click();
}
function processPhotoFile(file,input){
  if(!file)return;
  if(!file.type||file.type.indexOf('image/')!==0){
    $('scanStatus').textContent='That file is not recognised as an image. Choose a JPG, PNG, HEIC or other image file supported by your browser.';
    if(input)input.value='';
    return;
  }
  $('scanStatus').textContent='Loading photo...';
  var img=new Image(),r=new FileReader(),done=false;
  function fail(msg){
    if(done)return;done=true;
    $('scanStatus').textContent=msg||'The photo could not be opened in this browser. Try JPG or PNG.';
    if(input)input.value='';
  }
  r.onerror=function(){fail('The selected file could not be read. Please choose the image again.')};
  r.onload=function(){
    img.onerror=function(){fail('The image format could not be decoded by this browser. If this is HEIC/HEIF, try sharing or saving it as JPG and upload again.')};
    img.onload=function(){
      if(done)return;
      try{
        var max=1400,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
        var ctx=c.getContext('2d');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
        floor().source=c.toDataURL('image/jpeg',.82);
        done=true;loadFloorForm();renderEngineer();saveDraft(true);
        $('scanStatus').textContent='Photo loaded successfully. You can now run the evidence scan or draw over it manually.';
      }catch(err){fail('The photo opened but could not be prepared for scanning. Try a JPG or PNG image.')}
      if(input)input.value='';
    };
    img.src=r.result;
  };
  r.readAsDataURL(file);
}
$('photoBtn').onclick=function(){openPhotoPicker('photoInput')};
$('cameraBtn').onclick=function(){openPhotoPicker('cameraInput')};
$('photoInput').onchange=function(e){processPhotoFile(e.target.files&&e.target.files[0],e.target)};
$('cameraInput').onchange=function(e){processPhotoFile(e.target.files&&e.target.files[0],e.target)};
$('clearPhoto').onclick=function(){floor().source='';$('photoInput').value='';$('cameraInput').value='';loadFloorForm();renderEngineer();$('scanStatus').textContent='Photo cleared. Upload another photo or draw the plan manually.';saveDraft(true)}

function detectLinesFromImage(img,sens){
  var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,W,H);
  var sc=Math.min(W/img.width,H/img.height),dw=img.width*sc,dh=img.height*sc,ox=(W-dw)/2,oy=(H-dh)/2;x.drawImage(img,ox,oy,dw,dh);
  var d=x.getImageData(0,0,W,H).data,g=new Uint8Array(W*H),sum=0;
  for(var i=0,p=0;i<d.length;i+=4,p++){var v=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];g[p]=v;sum+=v}
  var mean=sum/g.length,thr=Math.max(80,Math.min(205,mean-(sens-50)*.55-28)),raw=[];
  function dark(xx,yy){return g[yy*W+xx]<thr}
  for(var y=3;y<H-3;y+=2){var st=-1,last=-1,gap=0,hits=0;for(var xx=3;xx<W-3;xx++){var hit=false;for(var yy=y-2;yy<=y+2;yy++)if(dark(xx,yy)){hit=true;break}if(hit){if(st<0)st=xx;last=xx;hits++;gap=0}else if(st>=0&&++gap>5){if(last-st>48&&hits/Math.max(1,last-st)>.42)raw.push({axis:'H',coord:y,lo:st,hi:last});st=-1;last=-1;gap=0;hits=0}}}
  for(var xx=3;xx<W-3;xx+=2){var st2=-1,last2=-1,gap2=0,hits2=0;for(var yy2=3;yy2<H-3;yy2++){var hit2=false;for(var dx=-2;dx<=2;dx++)if(dark(xx+dx,yy2)){hit2=true;break}if(hit2){if(st2<0)st2=yy2;last2=yy2;hits2++;gap2=0}else if(st2>=0&&++gap2>5){if(last2-st2>48&&hits2/Math.max(1,last2-st2)>.42)raw.push({axis:'V',coord:xx,lo:st2,hi:last2});st2=-1;last2=-1;gap2=0;hits2=0}}}
  var groups=[];
  raw.forEach(function(s){var best=null;groups.forEach(function(gp){var ov=Math.min(gp.hi,s.hi)-Math.max(gp.lo,s.lo);if(!best&&gp.axis===s.axis&&Math.abs(gp.coord-s.coord)<=8&&ov>20)best=gp});if(best){best.m.push(s);best.coord=best.m.reduce(function(a,z){return a+z.coord},0)/best.m.length;best.lo=Math.min(best.lo,s.lo);best.hi=Math.max(best.hi,s.hi)}else groups.push({axis:s.axis,coord:s.coord,lo:s.lo,hi:s.hi,m:[s]})});
  var walls=[];groups.forEach(function(gp){if(gp.m.length<2)return;var coords=gp.m.map(function(z){return z.coord}).sort(function(a,b){return a-b}),los=gp.m.map(function(z){return z.lo}).sort(function(a,b){return a-b}),his=gp.m.map(function(z){return z.hi}).sort(function(a,b){return a-b}),mid=Math.floor(gp.m.length/2),co=snap(coords[mid]),lo=snap(los[mid]),hi=snap(his[mid]);if(hi-lo<55)return;var conf=gp.m.length>=5?'high':'medium';walls.push(gp.axis==='H'?{x1:lo,y1:co,x2:hi,y2:co,axis:'H',confidence:conf}:{x1:co,y1:lo,x2:co,y2:hi,axis:'V',confidence:conf})});
  var out=[];walls.sort(function(a,b){return wallLen(b)-wallLen(a)}).forEach(function(w){var dup=out.some(function(o){if(o.axis!==w.axis)return false;var dc=Math.abs((o.axis==='H'?o.y1:o.x1)-(w.axis==='H'?w.y1:w.x1));var ov=w.axis==='H'?Math.min(o.x2,w.x2)-Math.max(o.x1,w.x1):Math.min(o.y2,w.y2)-Math.max(o.y1,w.y1);return dc<=5&&ov>Math.min(wallLen(o),wallLen(w))*.7});if(!dup)out.push(w)});
  return out.slice(0,90)
}
$('scanBtn').onclick=function(){
  if(!floor().source){$('scanStatus').textContent='Choose/take a photo first.';return}
  $('scanStatus').textContent='Scanning wall evidence...';var img=new Image();img.onload=function(){snapshot();var found=detectLinesFromImage(img,+$('sensitivity').value);floor().walls=found;selected=null;renderEngineer();$('scanStatus').textContent='Evidence scan retained '+found.length+' likely wall sections. Compare every line with the source image and edit anything that is wrong.';saveDraft(true)};img.src=floor().source
};

function surveyReadiness(){
  var hard=[],warnings=[];
  if(!String(state.customer||$('customer').value||'').trim())warnings.push('Customer not entered');
  if(!String(state.site||$('site').value||'').trim())warnings.push('Site not entered');
  state.floors.forEach(function(f){
    if(!f.walls||!f.walls.length)hard.push(f.name+': no wall geometry');
    if(f.status!=='Ready')hard.push(f.name+': not marked Ready');
    if(!f.checks.exits)warnings.push(f.name+': exits not confirmed');
    if(!f.checks.panel)warnings.push(f.name+': panel not confirmed');
    if(f.stairs&&f.stairs.length&&!f.checks.stairs)warnings.push(f.name+': stairs not confirmed');
  });
  return {hard:hard,warnings:warnings}
}
function updateReadiness(){
  if(!$('readinessSummary'))return;var r=surveyReadiness();
  if(!r.hard.length){
    $('readinessSummary').className='notice';
    $('readinessSummary').innerHTML='<b>Ready to submit to office.</b>'+(r.warnings.length?'<br><span class="small">Review notes: '+esc(r.warnings.join(' · '))+'</span>':'')
  }else{
    $('readinessSummary').className='notice warn';
    $('readinessSummary').innerHTML='<b>Before submission:</b> '+esc(r.hard.join(' · '))+(r.warnings.length?'<br><span class="small">Checks to review: '+esc(r.warnings.join(' · '))+'</span>':'')
  }
}
$('markFloorReady').onclick=function(){
  saveDraft(true);var f=floor();
  if(!f.walls.length){$('submitMessage').textContent='Add or scan the floor walls before marking this floor Ready.';updateReadiness();return}
  f.status='Ready';$('floorStatus').value='Ready';renderFloorTabs();saveDraft(true);updateReadiness();$('submitMessage').textContent=f.name+' marked Ready.'
}
$('submitSurvey').onclick=function(){
  saveDraft(true);var ready=surveyReadiness();
  if(ready.hard.length){$('submitMessage').textContent='Cannot submit yet: '+ready.hard.join(' · ');updateReadiness();return}
  var sub=clone(state);sub.id=uid();sub.status='Awaiting Review';sub.submittedAt=new Date().toISOString();sub.preparedBy='';sub.verifiedBy='';sub.revision='A';sub.verifiedAt='';
  sub.floors.forEach(function(f){
    f.history=[];f.redo=[];
    if(f.source&&f.source.length>900000){f.source='';f.sourceOmittedFromQueue=true}
  });
  queue=loadQueue();queue.unshift(sub);
  if(!saveQueue(queue)){queue.shift();$('submitMessage').textContent='The office queue could not be saved because browser storage is full. Clear old test submissions or use a smaller source photo.';return}
  state.status='Submitted';$('surveyStatus').textContent='Submitted';$('surveyStatus').className='pill green';saveDraft(true);updateReadiness();
  $('submitMessage').textContent='Submitted successfully. Opening the Office Review queue…';
  renderQueue();setMode('desktop')
};

function renderQueue(){
  queue=loadQueue();var h='';if(!queue.length)h='<div class="notice">No submitted surveys are in this browser yet. Submit an Engineer Survey first.</div>';
  queue.forEach(function(s){h+='<div class="queueItem"><div><h4>'+esc(s.customer||'Customer')+' — '+esc(s.site||'Site')+'</h4><p>'+esc(s.building||'Building')+' · '+s.floors.length+' floor(s) · Submitted '+new Date(s.submittedAt).toLocaleString()+'</p><div style="margin-top:6px"><span class="pill '+(s.status==='Verified'?'green':'blue')+'">'+esc(s.status)+'</span></div></div><button data-open="'+s.id+'" class="primary">Open review</button></div>'});
  $('queue').innerHTML=h;Array.from($('queue').querySelectorAll('[data-open]')).forEach(function(b){b.onclick=function(){openReview(b.dataset.open)}})
}
$('refreshQueue').onclick=renderQueue;
function reviewSub(){return queue.find(function(x){return x.id===reviewId})}
function reviewCurrentFloor(){var s=reviewSub();return s?s.floors[reviewFloor]:null}
function openReview(id){
  queue=loadQueue();reviewId=id;reviewFloor=0;var s=reviewSub();if(!s)return;s.status=s.status==='Verified'?'Verified':'In Review';saveQueue(queue);$('desktopWorkspace').classList.remove('hidden');desktopSelected=null;desktopTool='select';loadReviewMeta();renderReviewFloorTabs();renderDesktop()
}
function loadReviewMeta(){
  var s=reviewSub();if(!s)return;$('reviewTitle').textContent=(s.customer||'Customer')+' — '+(s.site||'Site');$('reviewMeta').textContent=(s.building||'Building')+' · Surveyed by '+(s.engineer||'Engineer');$('reviewStatus').textContent=s.status;$('preparedBy').value=s.preparedBy||'';$('verifiedBy').value=s.verifiedBy||'';$('revision').value=s.revision||'A'
}
function renderReviewFloorTabs(){var s=reviewSub(),h='';if(!s)return;s.floors.forEach(function(f,i){h+='<button data-rf="'+i+'" class="'+(i===reviewFloor?'active':'')+'">'+esc(f.name)+'</button>'});$('reviewFloorTabs').innerHTML=h;Array.from($('reviewFloorTabs').querySelectorAll('[data-rf]')).forEach(function(b){b.onclick=function(){reviewFloor=+b.dataset.rf;desktopSelected=null;renderReviewFloorTabs();renderDesktop()}})}

function renderDesktop(){
  var f=reviewCurrentFloor();if(!f)return;f.rooms=f.rooms||[];f.markers=f.markers||[];var s='<rect width="760" height="500" fill="white"/>';
  f.rooms.forEach(function(r,i){s+=roomSvg(r,i,desktopSelected&&desktopSelected.kind==='room'&&desktopSelected.i===i)});
  f.walls.forEach(function(w,i){s+=wallsWithOpenings(f,w,i,false)});
  f.doors.forEach(function(d,i){s+=doorSvg(d,i,desktopSelected&&desktopSelected.kind==='door'&&desktopSelected.i===i)});
  f.stairs.forEach(function(x,i){s+=stairSvg(x,i,desktopSelected&&desktopSelected.kind==='stairs'&&desktopSelected.i===i)});
  f.markers.forEach(function(x,i){s+=markerSvg(x,i,desktopSelected&&desktopSelected.kind==='marker'&&desktopSelected.i===i)});
  if(desktopDrag&&desktopDrag.type==='room'){var x=Math.min(desktopDrag.start.x,desktopDrag.now.x),y=Math.min(desktopDrag.start.y,desktopDrag.now.y),rw=Math.abs(desktopDrag.now.x-desktopDrag.start.x),rh=Math.abs(desktopDrag.now.y-desktopDrag.start.y);s+='<rect class="guide" x="'+x+'" y="'+y+'" width="'+rw+'" height="'+rh+'"/>'}
  $('desktopSvg').innerHTML=s;applyView($('desktopSvg'),desktopView,'deskZoomLabel');
  syncDesktopSizeControls();
  if($('desktopSelectedInfo'))$('desktopSelectedInfo').textContent=desktopSelected?(desktopSelected.kind==='door'?'Door selected — edit type, swing, handing, size or rotation.':desktopSelected.kind==='stairs'?'Staircase selected — drag the orange handle or use size/rotate controls.':desktopSelected.kind==='room'?'Room selected — drag its label independently or assign a zone.':desktopSelected.kind+' selected.'):'Nothing selected.';
  renderRoomList()
}
function renderRoomList(){
  var f=reviewCurrentFloor(),h='';if(!f)return;if(!f.rooms.length)h='<div class="small">No rooms yet. Generate rooms or add them manually.</div>';
  f.rooms.forEach(function(r,i){h+='<div class="listItem"><div><input data-rname="'+i+'" value="'+esc(r.name||('Room '+(i+1)))+'" style="width:100%;border:0;background:transparent;font-weight:700"><div class="small">'+(r.zone?'Zone '+r.zone:'No zone assigned')+'</div></div><button data-rsel="'+i+'">Select</button></div>'});
  $('roomList').innerHTML=h;Array.from($('roomList').querySelectorAll('[data-rsel]')).forEach(function(b){b.onclick=function(){desktopSelected={kind:'room',i:+b.dataset.rsel};renderDesktop()}});Array.from($('roomList').querySelectorAll('[data-rname]')).forEach(function(inp){inp.onchange=function(){f.rooms[+inp.dataset.rname].name=inp.value;saveReviewData();renderDesktop()}})
}
function saveReviewData(){var s=reviewSub();if(!s)return;s.preparedBy=$('preparedBy').value;s.verifiedBy=$('verifiedBy').value;s.revision=$('revision').value||'A';saveQueue(queue)}
function lineCoversH(w,y,x1,x2){return w.type!=='ARC'&&Math.abs(w.y1-y)<=8&&Math.abs(w.y2-y)<=8&&Math.min(w.x1,w.x2)<=x1+10&&Math.max(w.x1,w.x2)>=x2-10}
function lineCoversV(w,x,y1,y2){return w.type!=='ARC'&&Math.abs(w.x1-x)<=8&&Math.abs(w.x2-x)<=8&&Math.min(w.y1,w.y2)<=y1+10&&Math.max(w.y1,w.y2)>=y2-10}
$('autoRooms').onclick=function(){
  var f=reviewCurrentFloor();if(!f)return;var xs=[],ys=[];f.walls.forEach(function(w){if(w.type==='ARC')return;if(Math.abs(w.x1-w.x2)<6)xs.push(snap(w.x1));if(Math.abs(w.y1-w.y2)<6)ys.push(snap(w.y1))});xs=Array.from(new Set(xs)).sort(function(a,b){return a-b});ys=Array.from(new Set(ys)).sort(function(a,b){return a-b});
  var rooms=[];for(var yi=0;yi<ys.length-1;yi++)for(var xi=0;xi<xs.length-1;xi++){var x1=xs[xi],x2=xs[xi+1],y1=ys[yi],y2=ys[yi+1];if((x2-x1)*(y2-y1)<1200||x2-x1<35||y2-y1<35)continue;var top=f.walls.some(function(w){return lineCoversH(w,y1,x1,x2)}),bot=f.walls.some(function(w){return lineCoversH(w,y2,x1,x2)}),lef=f.walls.some(function(w){return lineCoversV(w,x1,y1,y2)}),rig=f.walls.some(function(w){return lineCoversV(w,x2,y1,y2)});if(top&&bot&&lef&&rig)rooms.push({id:uid(),x:x1+3,y:y1+3,w:x2-x1-6,h:y2-y1-6,name:'Room '+(rooms.length+1),zone:0,labelX:null,labelY:null})}
  if(rooms.length)f.rooms=rooms;else $('verifyMessage').textContent='No complete rectangular rooms could be generated automatically. Use Add room manually for this plan.';desktopSelected=null;saveReviewData();renderDesktop()
};
$('addRoom').onclick=function(){desktopTool='room';desktopSelected=null;$('verifyMessage').textContent='Drag a rectangle on the plan to add a room manually.'}
$('addReviewDoor').onclick=function(){desktopTool='door';desktopSelected=null;$('verifyMessage').textContent='Tap close to a wall to add a single door.'}
$('addReviewDoubleDoor').onclick=function(){desktopTool='doubleDoor';desktopSelected=null;$('verifyMessage').textContent='Tap close to a wall to add a double door.'}
Array.from(document.querySelectorAll('[data-marker]')).forEach(function(b){b.onclick=function(){desktopTool='marker';desktopSelected=null;b.dataset.pending='1';Array.from(document.querySelectorAll('[data-marker]')).forEach(function(x){if(x!==b)delete x.dataset.pending});$('verifyMessage').textContent='Tap the plan to place '+b.dataset.marker+'.'}})
var zoneH='';for(var z=1;z<=9;z++)zoneH+='<button data-zone="'+z+'">Zone '+z+'</button>';$('zoneButtons').innerHTML=zoneH;
Array.from($('zoneButtons').querySelectorAll('[data-zone]')).forEach(function(b){b.onclick=function(){var f=reviewCurrentFloor();if(!desktopSelected||desktopSelected.kind!=='room'){ $('verifyMessage').textContent='Select a room first.';return}f.rooms[desktopSelected.i].zone=+b.dataset.zone;saveReviewData();renderDesktop()}})
$('clearZones').onclick=function(){var f=reviewCurrentFloor();if(!f)return;f.rooms.forEach(function(r){r.zone=0});saveReviewData();renderDesktop()}
$('deleteDesktopItem').onclick=function(){var f=reviewCurrentFloor();if(!f||!desktopSelected)return;var a=desktopSelected.kind==='room'?f.rooms:desktopSelected.kind==='door'?f.doors:desktopSelected.kind==='marker'?f.markers:f.stairs;a.splice(desktopSelected.i,1);desktopSelected=null;saveReviewData();renderDesktop()}
function getDesktopSelected(){
  var f=reviewCurrentFloor();if(!f||!desktopSelected)return null;
  var a=desktopSelected.kind==='room'?f.rooms:desktopSelected.kind==='door'?f.doors:desktopSelected.kind==='marker'?f.markers:f.stairs;
  return a[desktopSelected.i]
}
function desktopResize(dir){
  var o=getDesktopSelected();if(!o)return;
  if(desktopSelected.kind==='room'){o.w=Math.max(20,o.w+(dir>0?10:-10));o.h=Math.max(20,o.h+(dir>0?10:-10))}
  else if(desktopSelected.kind==='door'||desktopSelected.kind==='stairs'||desktopSelected.kind==='marker'){o.size=clamp((o.size||1)+(dir>0?.12:-.12),.25,3)}
  saveReviewData();renderDesktop()
}
function syncDesktopSizeControls(){
  var box=$('desktopSizeControls'),o=getDesktopSelected(),supported=!!(o&&desktopSelected&&(desktopSelected.kind==='door'||desktopSelected.kind==='stairs'||desktopSelected.kind==='marker'));
  box.classList.toggle('hidden',!supported);
  if(supported){
    var pct=Math.round((o.size||1)*100);
    $('desktopSizeRange').value=pct;$('desktopSizeNumber').value=pct;$('desktopSizeText').textContent=pct+'%'
  }
}
function setDesktopExactSize(value){
  var o=getDesktopSelected();if(!o||!desktopSelected||!(desktopSelected.kind==='door'||desktopSelected.kind==='stairs'||desktopSelected.kind==='marker'))return;
  var pct=clamp(parseInt(value,10)||100,25,300);o.size=pct/100;saveReviewData();renderDesktop()
}
$('desktopSmaller').onclick=function(){desktopResize(-1)}
$('desktopLarger').onclick=function(){desktopResize(1)}
$('desktopSizeRange').oninput=function(){setDesktopExactSize(this.value)}
$('desktopSizeNumber').onchange=function(){setDesktopExactSize(this.value)}
$('desktopRotate').onclick=function(){var o=getDesktopSelected();if(!o)return;if(desktopSelected.kind==='door')o.angle=((o.angle||0)+90)%360;else if(desktopSelected.kind==='stairs'||desktopSelected.kind==='marker')o.rot=((o.rot||0)+90)%360;saveReviewData();renderDesktop()}
$('desktopFlipDoor').onclick=function(){var o=getDesktopSelected();if(!o||desktopSelected.kind!=='door'){$('verifyMessage').textContent='Select a door first.';return}o.swing=(o.swing===-1?1:-1);saveReviewData();renderDesktop()}
$('desktopHandDoor').onclick=function(){var o=getDesktopSelected();if(!o||desktopSelected.kind!=='door'){$('verifyMessage').textContent='Select a door first.';return}o.hand=(o.hand===-1?1:-1);saveReviewData();renderDesktop()}
$('desktopToggleDoor').onclick=function(){var o=getDesktopSelected();if(!o||desktopSelected.kind!=='door'){$('verifyMessage').textContent='Select a door first.';return}o.type=(o.type||'single')==='double'?'single':'double';saveReviewData();renderDesktop()}

var dsvg=$('desktopSvg');
$('deskZoomIn').onclick=function(){changeZoom(dsvg,desktopView,'deskZoomLabel',1.25)}
$('deskZoomOut').onclick=function(){changeZoom(dsvg,desktopView,'deskZoomLabel',.8)}
$('deskZoomReset').onclick=function(){resetView(dsvg,desktopView,'deskZoomLabel');$('deskPan').setAttribute('aria-pressed','false')}
$('deskPan').onclick=function(){setPan(desktopView,this)}
dsvg.addEventListener('wheel',function(e){if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();changeZoom(dsvg,desktopView,'deskZoomLabel',e.deltaY<0?1.12:.89)},{passive:false});
dsvg.onpointerdown=function(e){
  e.preventDefault();var f=reviewCurrentFloor();if(!f)return;
  if(desktopView.pan){desktopDrag={type:'pan',id:e.pointerId,clientX:e.clientX,clientY:e.clientY,cx:desktopView.cx,cy:desktopView.cy,label:'deskZoomLabel'};safePointerCapture(dsvg,e.pointerId);return}
  var p=svgPoint(dsvg,e),hit=e.target.closest('[data-kind]');
  if(hit&&(/^(door|stairs|marker|doorhandle|stairhandle|markerhandle|roomlabel)$/.test(hit.dataset.kind)||desktopTool==='select')){
    var k=hit.dataset.kind,i=+hit.dataset.i;
    if(k==='wall')return;
    if(k==='markerhandle'){desktopSelected={kind:'marker',i:i};desktopDrag={type:'marker-size',kind:'marker',i:i,id:e.pointerId,start:p,orig:clone(f.markers[i])};safePointerCapture(dsvg,e.pointerId);renderDesktop();return}
    if(k==='stairhandle'){desktopSelected={kind:'stairs',i:i};desktopDrag={type:'stair-size',kind:'stairs',i:i,id:e.pointerId,start:p,orig:clone(f.stairs[i])};safePointerCapture(dsvg,e.pointerId);renderDesktop();return}
    if(k==='doorhandle'){desktopSelected={kind:'door',i:i};desktopDrag={type:'door-size',kind:'door',i:i,id:e.pointerId,start:p,orig:clone(f.doors[i])};safePointerCapture(dsvg,e.pointerId);renderDesktop();return}
    if(k==='roomlabel'){desktopSelected={kind:'room',i:i};desktopDrag={type:'room-label',kind:'room',i:i,id:e.pointerId,start:p,orig:clone(f.rooms[i])};safePointerCapture(dsvg,e.pointerId);renderDesktop();return}
    desktopSelected={kind:k,i:i};var a=k==='room'?f.rooms:k==='door'?f.doors:k==='marker'?f.markers:f.stairs,oo=a[desktopSelected.i];desktopDrag={type:'move',kind:k,i:desktopSelected.i,id:e.pointerId,start:p,orig:clone(oo)};safePointerCapture(dsvg,e.pointerId);renderDesktop();return
  }
  if(desktopTool==='room'){desktopDrag={type:'room',id:e.pointerId,start:p,now:p};safePointerCapture(dsvg,e.pointerId);renderDesktop();return}
  if(desktopTool==='door'||desktopTool==='doubleDoor'){var q=nearestWall(f.walls,p.x,p.y);if(q&&q.d<60){f.doors.push({x:q.x,y:q.y,angle:q.angle,size:1,type:desktopTool==='doubleDoor'?'double':'single',swing:1,hand:1});desktopSelected={kind:'door',i:f.doors.length-1};desktopTool='select';saveReviewData();renderDesktop()}return}
  if(desktopTool==='marker'){var b=document.querySelector('[data-marker][data-pending="1"]'),type=b?b.dataset.marker:'Marker';f.markers.push({type:type,x:p.x,y:p.y,rot:0,size:1});desktopSelected={kind:'marker',i:f.markers.length-1};if(b)delete b.dataset.pending;desktopTool='select';saveReviewData();renderDesktop()}
};
dsvg.onpointermove=function(e){
  if(!desktopDrag||desktopDrag.id!==e.pointerId)return;e.preventDefault();
  if(desktopDrag.type==='pan'){panMove(dsvg,desktopView,desktopDrag,e);return}
  var p=svgPoint(dsvg,e),f=reviewCurrentFloor();
  if(desktopDrag.type==='room'){desktopDrag.now=p;renderDesktop();return}
  var a=desktopDrag.kind==='room'?f.rooms:desktopDrag.kind==='door'?f.doors:desktopDrag.kind==='marker'?f.markers:f.stairs,o=a[desktopDrag.i];
  if(desktopDrag.type==='stair-size'){var base=Math.hypot(30,34),dist=Math.hypot(p.x-desktopDrag.orig.x,p.y-desktopDrag.orig.y);o.size=clamp(dist/base,.25,3);renderDesktop();return}
  if(desktopDrag.type==='marker-size'){o.size=clamp((desktopDrag.orig.size||1)*Math.hypot(p.x-o.x,p.y-o.y)/Math.max(1,Math.hypot(desktopDrag.start.x-o.x,desktopDrag.start.y-o.y)),.25,3);renderDesktop();return}
  if(desktopDrag.type==='door-size'){var doorDist=Math.hypot(p.x-desktopDrag.orig.x,p.y-desktopDrag.orig.y);o.size=clamp(doorDist/42,.25,3);renderDesktop();return}
  if(desktopDrag.type==='room-label'){o.labelX=p.x;o.labelY=p.y;renderDesktop();return}
  var dx=p.x-desktopDrag.start.x,dy=p.y-desktopDrag.start.y;
  if(desktopDrag.kind==='room'){o.x=desktopDrag.orig.x+dx;o.y=desktopDrag.orig.y+dy;if(desktopDrag.orig.labelX!=null){o.labelX=desktopDrag.orig.labelX+dx;o.labelY=desktopDrag.orig.labelY+dy}}
  else if(desktopDrag.kind==='door'){var q=nearestWall(f.walls,desktopDrag.orig.x+dx,desktopDrag.orig.y+dy);if(q&&q.d<60){o.x=q.x;o.y=q.y;o.angle=q.angle}else{o.x=desktopDrag.orig.x+dx;o.y=desktopDrag.orig.y+dy}}
  else{o.x=desktopDrag.orig.x+dx;o.y=desktopDrag.orig.y+dy}
  renderDesktop()
};
function finishDesktop(e){if(!desktopDrag||desktopDrag.id!==e.pointerId)return;var f=reviewCurrentFloor();if(desktopDrag.type==='room'){var a=desktopDrag.start,b=desktopDrag.now,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),rw=Math.abs(b.x-a.x),rh=Math.abs(b.y-a.y);if(rw>30&&rh>30){f.rooms.push({id:uid(),x:x,y:y,w:rw,h:rh,name:'Room '+(f.rooms.length+1),zone:0,labelX:null,labelY:null});desktopSelected={kind:'room',i:f.rooms.length-1}}desktopTool='select'}desktopDrag=null;saveReviewData();renderDesktop()}
dsvg.onpointerup=finishDesktop;dsvg.onpointercancel=finishDesktop;

$('saveReview').onclick=function(){saveReviewData();$('verifyMessage').textContent='Review saved locally.'}
$('markVerified').onclick=function(){
  var s=reviewSub();if(!s)return;saveReviewData();var issues=[];s.floors.forEach(function(f){if(!f.rooms||!f.rooms.length)issues.push(f.name+' has no rooms');else if(f.rooms.some(function(r){return !r.zone}))issues.push(f.name+' has unzoned rooms')});if(!$('preparedBy').value.trim())issues.push('Prepared by is required');if(!$('verifiedBy').value.trim())issues.push('Verified by is required');
  if(issues.length){$('verifyMessage').textContent='Cannot verify: '+issues.join(' · ');return}s.status='Verified';s.verifiedAt=new Date().toISOString();saveQueue(queue);$('reviewStatus').textContent='Verified';$('reviewStatus').className='pill green';$('verifyMessage').textContent='Plan verified and available in Final Plan mode.'
};

function populateFinal(){
  queue=loadQueue();var sel=$('finalSubmission'),h='';queue.forEach(function(s){h+='<option value="'+s.id+'">'+esc(s.customer||'Customer')+' — '+esc(s.site||'Site')+' ['+esc(s.status)+']</option>'});sel.innerHTML=h;if(queue.length){renderFinalFloorOptions();renderFinal()}
}
$('finalSubmission').onchange=function(){renderFinalFloorOptions();renderFinal()};$('finalFloor').onchange=renderFinal;$('renderFinal').onclick=renderFinal;$('printFinal').onclick=function(){window.print()}
function finalSub(){return queue.find(function(s){return s.id===$('finalSubmission').value})}
function renderFinalFloorOptions(){var s=finalSub(),h='';if(!s)return;s.floors.forEach(function(f,i){h+='<option value="'+i+'">'+esc(f.name)+'</option>'});$('finalFloor').innerHTML=h}
function finalPlanSvg(f){
  var s='<rect width="760" height="500" fill="white"/>';f.rooms.forEach(function(r,i){s+=roomSvg(r,i,false)});f.walls.forEach(function(w,i){s+=wallsWithOpenings(f,w,i,false)});f.doors.forEach(function(d,i){s+=doorSvg(d,i,false)});f.stairs.forEach(function(x,i){s+=stairSvg(x,i,false)});(f.markers||[]).forEach(function(m,i){s+=markerSvg(m,i,false)});return s
}
function renderFinal(){
  var s=finalSub();if(!s)return;var f=s.floors[+$('finalFloor').value||0];if(!f)return;$('finalSvg').innerHTML=finalPlanSvg(f);$('finalSite').textContent=(s.customer||'')+' · '+(s.site||'')+' · '+(s.building||'')+' · '+f.name;$('finalRev').textContent='Revision '+(s.revision||'A')+' · '+(s.status||'');
  var zones=Array.from(new Set((f.rooms||[]).map(function(r){return r.zone}).filter(Boolean))).sort();$('finalLegend').innerHTML=zones.map(function(z){return '<span class="zone'+z+'">Zone '+z+'</span>'}).join('');
  $('issueBox').innerHTML='<b>Controlled issue</b><br>Surveyed by: '+esc(s.engineer||'')+' &nbsp; | &nbsp; Prepared by: '+esc(s.preparedBy||'')+' &nbsp; | &nbsp; Verified by: '+esc(s.verifiedBy||'')+' &nbsp; | &nbsp; Issue date: '+(s.verifiedAt?new Date(s.verifiedAt).toLocaleDateString():'Not verified')+'<br><span class="small">Zone colours are visual aids. The zone number is the controlling identification.</span>';
  var paper=$('paper').value;$('finalSheet').style.maxWidth=paper.indexOf('A3')===0?'1180px':'900px';$('finalSvg').style.minHeight=paper.indexOf('Portrait')>0?'720px':'500px'
}
$('paper').onchange=renderFinal;

setInterval(function(){if(!$('engineerMode').classList.contains('hidden'))saveDraft(true)},6000);
window.addEventListener('beforeunload',function(){try{saveDraft(true)}catch(e){}});
syncForm();renderQueue();updateReadiness();
})();
