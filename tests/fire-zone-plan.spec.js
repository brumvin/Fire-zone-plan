const { test, expect } = require('@playwright/test');

function pt(box,x,y){ return {x:box.x+x, y:box.y+y}; }

test('engineer to office to final plan workflow', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('h1')).toContainText('Fire Zone Plan');

  await page.fill('#customer','Test Customer');
  await page.fill('#site','Test Site');
  await page.fill('#building','Block A');
  await page.fill('#engineer','Test Engineer');

  const svg = page.locator('#engineerSvg');
  const box = await svg.boundingBox();
  expect(box).toBeTruthy();

  // Draw a rectangular room footprint.
  const lines = [
    [120,100,420,100],
    [420,100,420,330],
    [420,330,120,330],
    [120,330,120,100]
  ];
  for (const [x1,y1,x2,y2] of lines) {
    await page.mouse.move(box.x+x1,box.y+y1);
    await page.mouse.down();
    await page.mouse.move(box.x+x2,box.y+y2);
    await page.mouse.up();
  }
  await expect(page.locator('#engineerSvg [data-kind="wall"]')).toHaveCount(4);

  // Drawing a new wall near an existing one must not move the original.
  const firstBefore = await page.locator('#engineerSvg [data-kind="wall"]').first().locator('line.wall').getAttribute('x1');
  await page.mouse.move(box.x+120,box.y+120);
  await page.mouse.down();
  await page.mouse.move(box.x+300,box.y+120);
  await page.mouse.up();
  await expect(page.locator('#engineerSvg [data-kind="wall"]')).toHaveCount(5);
  const firstAfter = await page.locator('#engineerSvg [data-kind="wall"]').first().locator('line.wall').getAttribute('x1');
  expect(firstAfter).toBe(firstBefore);

  // Select first wall and drag endpoint handle to change length.
  await page.click('[data-tool="select"]');
  await page.locator('#engineerSvg [data-kind="wall"]').first().locator('line.wallHit').click({position:{x:80,y:1}});
  await expect(page.locator('#engineerSvg [data-kind="wallhandle"]')).toHaveCount(2);
  const h2 = page.locator('#engineerSvg [data-kind="wallhandle"][data-end="2"]');
  const hb = await h2.boundingBox();
  await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);
  await page.mouse.down();
  await page.mouse.move(hb.x+70,hb.y+hb.height/2);
  await page.mouse.up();
  await expect(page.locator('#engineerSvg [data-kind="wallhandle"]')).toHaveCount(2);

  // Add single door.
  await page.click('[data-tool="door"]');
  await page.mouse.click(box.x+250,box.y+100);
  await expect(page.locator('#engineerSvg [data-kind="door"]')).toHaveCount(1);

  // Add double door and confirm two swing paths are rendered.
  await page.click('[data-tool="doubleDoor"]');
  await page.mouse.click(box.x+330,box.y+100);
  await expect(page.locator('#engineerSvg [data-kind="door"]')).toHaveCount(2);
  const doubleDoor = page.locator('#engineerSvg [data-kind="door"]').nth(1);
  await expect(doubleDoor.locator('path.door')).toHaveCount(2);

  // Add staircase, select it, and verify direct resize handle exists.
  await page.click('[data-tool="stairs"]');
  await page.mouse.click(box.x+260,box.y+220);
  await expect(page.locator('#engineerSvg [data-kind="stairs"]')).toHaveCount(1);
  await page.click('[data-tool="select"]');
  await page.locator('#engineerSvg [data-kind="stairs"]').click();
  await expect(page.locator('#engineerSvg [data-kind="stairhandle"]')).toHaveCount(1);

  // Add a room and move its label independently.
  await page.click('[data-tool="room"]');
  await page.mouse.move(box.x+135,box.y+135);
  await page.mouse.down();
  await page.mouse.move(box.x+395,box.y+305);
  await page.mouse.up();
  await expect(page.locator('#engineerSvg [data-kind="room"]')).toHaveCount(1);
  await page.click('[data-tool="select"]');
  const labelHit = page.locator('#engineerSvg [data-kind="roomlabel"]');
  await expect(labelHit).toHaveCount(1);
  const lb = await labelHit.boundingBox();
  await page.mouse.move(lb.x+lb.width/2,lb.y+lb.height/2);
  await page.mouse.down();
  await page.mouse.move(lb.x+80,lb.y+40);
  await page.mouse.up();

  // Engineer fire-safety markers.
  await page.click('[data-eng-marker="Main Entrance"]');
  await page.mouse.click(box.x+150,box.y+345);
  await page.click('[data-eng-marker="Fire Exit"]');
  await page.mouse.click(box.x+390,box.y+345);
  await page.click('[data-eng-marker="FACP"]');
  await page.mouse.click(box.x+170,box.y+180);
  await expect(page.locator('#engineerSvg [data-kind="marker"]')).toHaveCount(3);

  // Mark ready and submit to office.
  await page.click('#markFloorReady');
  await expect(page.locator('#readinessSummary')).toContainText('Ready to submit to office');
  await page.click('#submitSurvey');
  await expect(page.locator('#desktopMode')).toBeVisible();
  await expect(page.locator('#queue .queueItem')).toHaveCount(1);

  // Open office review.
  await page.locator('#queue [data-open]').first().click();
  await expect(page.locator('#desktopWorkspace')).toBeVisible();
  await expect(page.locator('#desktopSvg [data-kind="door"]')).toHaveCount(2);
  await expect(page.locator('#desktopSvg [data-kind="stairs"]')).toHaveCount(1);
  await expect(page.locator('#desktopSvg [data-kind="marker"]')).toHaveCount(3);

  // Door editing parity on desktop.
  const deskDoor = page.locator('#desktopSvg [data-kind="door"]').first();
  await deskDoor.click();
  await page.click('#desktopToggleDoor');
  await expect(page.locator('#desktopSvg [data-kind="door"]').first().locator('path.door')).toHaveCount(2);
  await page.click('#desktopFlipDoor');
  await page.click('#desktopHandDoor');
  await page.click('#desktopLarger');

  // Room label remains directly draggable on office side.
  const deskLabel = page.locator('#desktopSvg [data-kind="roomlabel"]').first();
  await expect(deskLabel).toHaveCount(1);

  // Assign Zone 1 to room.
  await page.locator('#desktopSvg [data-kind="room"]').first().click();
  await page.click('#zoneButtons [data-zone="1"]');
  await expect(page.locator('#roomList')).toContainText('Zone 1');

  await page.fill('#preparedBy','Office Preparer');
  await page.fill('#verifiedBy','Competent Verifier');
  await page.fill('#revision','A');
  await page.click('#markVerified');
  await expect(page.locator('#reviewStatus')).toHaveText('Verified');

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
  await page.goto('http://127.0.0.1:4173/');
  const svg=page.locator('#engineerSvg');
  const box=await svg.boundingBox();
  await page.mouse.move(box.x+100,box.y+100);
  await page.mouse.down();
  await page.mouse.move(box.x+300,box.y+100);
  await page.mouse.up();
  await page.click('#submitSurvey');
  await expect(page.locator('#submitMessage')).toContainText('not marked Ready');
  await expect(page.locator('#engineerMode')).toBeVisible();
});
