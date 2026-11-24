const { test, expect } = require('@playwright/test');

function pt(box,x,y){ return {x:box.x+x, y:box.y+y}; }
async function pointerDrag(page, locator, x1, y1, x2, y2, pointerId=21) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('No bounding box for pointer drag target');
  const sx=box.x+x1, sy=box.y+y1, ex=box.x+x2, ey=box.y+y2;
  await locator.dispatchEvent('pointerdown',{pointerId,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:sx,clientY:sy});
  await locator.dispatchEvent('pointermove',{pointerId,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:ex,clientY:ey});
  await locator.dispatchEvent('pointerup',{pointerId,pointerType:'mouse',isPrimary:true,button:0,buttons:0,clientX:ex,clientY:ey});
}
async function pointerClick(page, locator, x, y, pointerId=31) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('No bounding box for pointer click target');
  const cx=box.x+x, cy=box.y+y;
  await locator.dispatchEvent('pointerdown',{pointerId,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:cx,clientY:cy});
  await locator.dispatchEvent('pointerup',{pointerId,pointerType:'mouse',isPrimary:true,button:0,buttons:0,clientX:cx,clientY:cy});
}

test('engineer to office to final plan workflow', async ({ page }) => {
  test.setTimeout(60000);
  const stage=s=>console.log('STAGE:',s);
  const pageErrors=[];
  page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGEERROR:', e.stack || e.message); });
  page.on('console', m => console.log('BROWSER:', m.type(), m.text()));
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('h1')).toContainText('Fire Zone Plan');
  await page.waitForTimeout(300);
  if(pageErrors.length) throw new Error('Runtime page error: '+pageErrors.join(' | '));

  await page.fill('#customer','Test Customer');
  await page.fill('#site','Test Site');
  await page.fill('#building','Block A');
  await page.fill('#engineer','Test Engineer');

  const svg = page.locator('#engineerSvg');
  const box = await svg.boundingBox();
  expect(box).toBeTruthy();

  stage('draw footprint');
  // Draw a rectangular room footprint.
  const lines = [
    [120,100,420,100],
    [420,100,420,330],
    [420,330,120,330],
    [120,330,120,100]
  ];
  let pid=40;
  for (const [x1,y1,x2,y2] of lines) {
    await pointerDrag(page, svg, x1,y1,x2,y2,pid++);
  }
  await expect(page.locator('#engineerSvg [data-kind="wall"]')).toHaveCount(4);

  stage('new adjacent wall');
  // Drawing a new wall near an existing one must not move the original.
  const firstBefore = await page.locator('#engineerSvg [data-kind="wall"]').first().locator('line.wall').getAttribute('x1');
  await pointerDrag(page, svg, 120,120,300,120,60);
  await expect(page.locator('#engineerSvg [data-kind="wall"]')).toHaveCount(5);
  const firstAfter = await page.locator('#engineerSvg [data-kind="wall"]').first().locator('line.wall').getAttribute('x1');
  expect(firstAfter).toBe(firstBefore);

  stage('wall endpoint resize');
  // Select first wall and drag endpoint handle to change length.
  await page.click('[data-tool="select"]');
  await page.locator('#engineerSvg [data-kind="wall"]').first().locator('line.wallHit').click({position:{x:80,y:1}});
  await expect(page.locator('#engineerSvg [data-kind="wallhandle"]')).toHaveCount(2);
  const h2 = page.locator('#engineerSvg [data-kind="wallhandle"][data-end="2"]');
  const hb = await h2.boundingBox();
  await h2.dispatchEvent('pointerdown',{pointerId:61,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:hb.x+hb.width/2,clientY:hb.y+hb.height/2});
  await svg.dispatchEvent('pointermove',{pointerId:61,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:hb.x+70,clientY:hb.y+hb.height/2});
  await svg.dispatchEvent('pointerup',{pointerId:61,pointerType:'mouse',isPrimary:true,button:0,buttons:0,clientX:hb.x+70,clientY:hb.y+hb.height/2});
  await expect(page.locator('#engineerSvg [data-kind="wallhandle"]')).toHaveCount(2);

  stage('single door');
  // Add single door.
  await page.click('[data-tool="door"]');
  await pointerClick(page, svg, 250,100,70);
  await expect(page.locator('#engineerSvg [data-kind="door"]')).toHaveCount(1);

  stage('double door');
  // Add double door and confirm two swing paths are rendered.
  await page.click('[data-tool="doubleDoor"]');
  await pointerClick(page, svg, 330,100,71);
  await expect(page.locator('#engineerSvg [data-kind="door"]')).toHaveCount(2);
  const doubleDoor = page.locator('#engineerSvg [data-kind="door"]').nth(1);
  await expect(doubleDoor.locator('path.door')).toHaveCount(2);

  stage('stairs');
  // Add staircase, select it, and verify direct resize handle exists.
  await page.click('[data-tool="stairs"]');
  await pointerClick(page, svg, 260,220,72);
  await expect(page.locator('#engineerSvg [data-kind="stairs"]')).toHaveCount(1);
  await page.click('[data-tool="select"]');
  await page.locator('#engineerSvg [data-kind="stairs"]').click();
  await expect(page.locator('#engineerSvg [data-kind="stairhandle"]')).toHaveCount(1);

  stage('room label');
  // Add a room and move its label independently.
  await page.click('[data-tool="room"]');
  await pointerDrag(page, svg, 135,135,395,305,73);
  await expect(page.locator('#engineerSvg [data-kind="room"]')).toHaveCount(1);
  await page.click('[data-tool="select"]');
  const labelHit = page.locator('#engineerSvg [data-kind="roomlabel"]');
  await expect(labelHit).toHaveCount(1);
  const lb = await labelHit.boundingBox();
  await labelHit.dispatchEvent('pointerdown',{pointerId:74,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:lb.x+lb.width/2,clientY:lb.y+lb.height/2});
  await svg.dispatchEvent('pointermove',{pointerId:74,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:lb.x+80,clientY:lb.y+40});
  await svg.dispatchEvent('pointerup',{pointerId:74,pointerType:'mouse',isPrimary:true,button:0,buttons:0,clientX:lb.x+80,clientY:lb.y+40});

  stage('markers');
  // Engineer fire-safety markers.
  await page.click('[data-eng-marker="Main Entrance"]');
  await pointerClick(page, svg, 150,345,75);
  await page.click('[data-eng-marker="Fire Exit"]');
  await pointerClick(page, svg, 390,345,76);
  await page.click('[data-eng-marker="FACP"]');
  await pointerClick(page, svg, 170,180,77);
  await expect(page.locator('#engineerSvg [data-kind="marker"]')).toHaveCount(3);

  stage('submit');
  // Mark ready and submit to office.
  await page.click('#markFloorReady');
  await expect(page.locator('#readinessSummary')).toContainText('Ready to submit to office');
  await page.click('#submitSurvey');
  await expect(page.locator('#desktopMode')).toBeVisible();
  await expect(page.locator('#queue .queueItem')).toHaveCount(1);

  stage('open office review');
  // Open office review.
  await page.locator('#queue [data-open]').first().click();
  await expect(page.locator('#desktopWorkspace')).toBeVisible();
  await expect(page.locator('#desktopSvg [data-kind="door"]')).toHaveCount(2);
  await expect(page.locator('#desktopSvg [data-kind="stairs"]')).toHaveCount(1);
  await expect(page.locator('#desktopSvg [data-kind="marker"]')).toHaveCount(3);

  stage('desktop door edit');
  // Door editing parity on desktop.
  const deskDoor = page.locator('#desktopSvg [data-kind="door"]').first();
  await deskDoor.click();
  await page.click('#desktopToggleDoor');
  await expect(page.locator('#desktopSvg [data-kind="door"]').first().locator('path.door')).toHaveCount(2);
  await page.click('#desktopFlipDoor');
  await page.click('#desktopHandDoor');
  await page.click('#desktopLarger');

  stage('desktop room label');
  // Room label remains directly draggable on office side.
  const deskLabel = page.locator('#desktopSvg [data-kind="roomlabel"]').first();
  await expect(deskLabel).toHaveCount(1);

  stage('zone assignment');
  // Assign Zone 1 to room.
  await page.locator('#desktopSvg [data-kind="room"]').first().click();
  await page.click('#zoneButtons [data-zone="1"]');
  await expect(page.locator('#roomList')).toContainText('Zone 1');

  await page.fill('#preparedBy','Office Preparer');
  await page.fill('#verifiedBy','Competent Verifier');
  await page.fill('#revision','A');
  await page.click('#markVerified');
  await expect(page.locator('#reviewStatus')).toHaveText('Verified');

  stage('final output');
  // Final output.
  await page.click('#modeFinal');
  await expect(page.locator('#finalMode')).toBeVisible();
  await page.click('#renderFinal');
  await expect(page.locator('#finalSvg [data-kind="door"]')).toHaveCount(2);
  await expect(page.locator('#finalLegend')).toContainText('Zone 1');
  await expect(page.locator('#issueBox')).toContainText('Office Preparer');
  await expect(page.locator('#issueBox')).toContainText('Competent Verifier');
});

test('submission is blocked when floor is not ready', async ({ page }) => {
  const pageErrors=[];
  page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGEERROR:', e.stack || e.message); });
  page.on('console', m => console.log('BROWSER:', m.type(), m.text()));
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(300);
  if(pageErrors.length) throw new Error('Runtime page error: '+pageErrors.join(' | '));
  const svg=page.locator('#engineerSvg');
  const box=await svg.boundingBox();
  await pointerDrag(page, svg, 100,100,300,100,90);
  await page.click('#submitSurvey');
  await expect(page.locator('#submitMessage')).toContainText('not marked Ready');
  await expect(page.locator('#engineerMode')).toBeVisible();
});
