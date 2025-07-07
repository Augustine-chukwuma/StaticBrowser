const express = require('express');
const chromium = require('@sparticuz/chromium-min'); // 90% smaller Chrome
const puppeteer = require('puppeteer-core');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 3000;
const instanceCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Lightweight browser launcher
async function launchBrowser() {
  return await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    args: [
      ...chromium.args,
      '--single-process',
      '--no-zygote',
      '--disable-gpu',
      '--disk-cache-size=1'
    ],
    defaultViewport: chromium.defaultViewport,
    ignoreHTTPSErrors: true,
  });
}

let browser;
(async () => {
  try {
    browser = await launchBrowser();
    console.log('Chromium launched in Render-optimized mode');
  } catch (err) {
    console.error('Browser launch failed:', err);
  }
})();

// Endpoint: Create new instance
app.get('/new', async (req, res) => {
  if (!browser) return res.status(503).send('Browser not ready');
  
  const instanceId = req.query.id || uuidv4();
  if (instanceCache.has(instanceId)) {
    return res.status(409).json({ error: 'Instance exists' });
  }

  try {
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    
    // Memory optimization
    await page.setCacheEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) 
        req.abort();
      else 
        req.continue();
    });

    await page.goto(req.query.url || 'https://lite.duckduckgo.com', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    instanceCache.set(instanceId, { context, page });
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    
    res.set({
      'X-Instance-ID': instanceId,
      'Cache-Control': 'no-store'
    }).send(html);
  } catch (err) {
    console.error('Instance creation error:', err.message);
    res.status(500).send('Instance creation failed');
  }
});

// Endpoint: Load instance
app.get('/load', async (req, res) => {
  const instanceId = req.query.id;
  if (!instanceId) return res.status(400).send('ID required');
  
  const instance = instanceCache.get(instanceId);
  if (!instance) return res.status(404).send('Instance not found');

  try {
    const html = await instance.page.evaluate(() => 
      document.documentElement.outerHTML
    );
    res.send(html);
  } catch (err) {
    instanceCache.del(instanceId);
    res.status(410).send('Instance expired');
  }
});

// Endpoint: Close instance
app.get('/end', (req, res) => {
  const instanceId = req.query.id;
  if (!instanceId) return res.status(400).send('ID required');
  
  if (instanceCache.del(instanceId)) {
    res.send('Instance closed');
  } else {
    res.status(404).send('Instance not found');
  }
});

// Render-specific optimizations
app.use(express.text({ limit: '50kb' }));
app.use(express.json({ limit: '10kb' }));

process.on('SIGTERM', async () => {
  await browser?.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Render-optimized browser service running on port ${port}`);
});
