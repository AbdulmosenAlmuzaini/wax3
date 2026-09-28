import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push('Console Error: ' + msg.text()) });
  page.on('pageerror', err => errors.push('Page Error: ' + err.toString()));
  page.on('requestfailed', req => errors.push('Network Fail: ' + req.url() + ' - ' + req.failure().errorText));

  try {
    console.log('Opening local dev server...');
    await page.goto('http://localhost:5173/#/train', { waitUntil: 'networkidle0', timeout: 5000 });
    
    console.log('Testing empty name validation...');
    await page.click('.type-card[data-type="general"]');
    await new Promise(r => setTimeout(r, 200));
    await page.click('.scen-card[data-scen="fire-basic"]');
    
    await page.evaluate(() => document.querySelector('#inpName').value = '');
    await page.click('#btnStart');
    
    const errText = await page.evaluate(() => document.querySelector('#setupErr').textContent);
    console.log('Validation message received:', errText);

    console.log('Testing admin page without login...');
    await page.goto('http://localhost:5173/#/admin', { waitUntil: 'networkidle0', timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));
    
    const loginHeader = await page.evaluate(() => document.querySelector('h2').textContent);
    console.log('Admin Page Header:', loginHeader); // Should be "دخول المشرف"

    console.log('Errors caught:', errors);
  } catch (e) {
    console.error('Test script exception:', e);
  } finally {
    await browser.close();
  }
})();
