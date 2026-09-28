const puppeteer = require('puppeteer');
const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  console.log('Navigating...');
  await page.goto('http://localhost:5176/#/train', { waitUntil: 'networkidle0' });

  console.log('Waiting for ready...');
  await page.waitForFunction('window.WORLD !== undefined');

  // Inject a script to override the start and bypass some things
  await page.evaluate(() => {
    // Select the scenario and start
    const els = Array.from(document.querySelectorAll('.card'));
    const smokeCard = els.find(e => e.textContent.includes('دخان يحجب'));
    if (smokeCard) smokeCard.click();
    
    // Choose general user type and start
    setTimeout(() => {
      document.querySelector('button[onclick="startSelectedTraining()"]').click();
    }, 500);
  });

  await delay(2000);
  
  // Click "Click to start" (lock screen)
  await page.evaluate(() => {
    document.querySelector('#btnLock').click();
  });

  await delay(1000);
  
  // Teleport player to view the smoke from a distance
  // Classroom door is x=4, main exit is x=15.
  // We place player at x=6, z=9, looking at x=11.5
  await page.evaluate(() => {
    if (window.player) {
      window.player.pos.set(6, 1.6, 9);
      window.player.yaw = -Math.PI / 2 + 0.15; // looking mostly right
      window.player.applyPose();
    }
  });

  await delay(1000);
  await page.screenshot({ path: 'smoke_distance.png' });
  console.log('Saved smoke_distance.png');

  // Teleport next to the smoke
  await page.evaluate(() => {
    if (window.player) {
      window.player.pos.set(11.5, 1.6, 8.6); // safe path
      window.player.yaw = -Math.PI / 2; // looking right
      window.player.applyPose();
    }
  });

  await delay(1000);
  await page.screenshot({ path: 'smoke_side.png' });
  console.log('Saved smoke_side.png');
  
  // Test safe passage: move slightly forward safely
  let resultSafe = await page.evaluate(() => {
    if (window.player) {
      window.player.pos.set(12, 1.6, 8.6); 
      // trigger a manual update if needed, but loop handles it
      return document.querySelector('.report-overlay') === null;
    }
    return false;
  });
  console.log('Safe passage test (no report shown):', resultSafe);

  // Test intentional entry: move into the smoke
  let resultFail = await page.evaluate(async () => {
    if (window.player) {
      window.player.pos.set(11.5, 1.6, 11.0); // right in the center of smoke
      return new Promise(resolve => {
        setTimeout(() => {
          const rep = document.querySelector('.report-overlay');
          resolve(rep ? rep.innerText.includes('دخان') : false);
        }, 1000);
      });
    }
    return false;
  });
  console.log('Intentional entry test (smoke fail report shown):', resultFail);

  await browser.close();
})();
