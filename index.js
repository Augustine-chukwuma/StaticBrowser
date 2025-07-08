const express = require('express');
const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 3000;
const instances = new NodeCache({ 
  stdTTL: 1800, 
  deleteOnExpire: true,
  useClones: false
});


let browser;
(async () => {
  browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: 'new', 
    args: [
      ...chromium.args,
      '--single-process',
      '--no-zygote',
      '--disable-gpu',
      '--max-old-space-size=128'
    ],
    ignoreHTTPSErrors: true,
    userDataDir: '/tmp/puppeteer' // ✅ safe, free-tier-compatible
  });

  console.log('✅ Browser ready');
})();


// Create new instance
app.get('/new', async (req, res) => {
  const id = req.query.id || uuidv4();
  if (instances.has(id)) return res.status(409).send('ID exists');
  
  try {
    const ctx = await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    
    // Optimize resource usage
    await page.setRequestInterception(true);
    page.on('request', req => 
      ['image', 'font', 'stylesheet'].includes(req.resourceType()) 
        ? req.abort() 
        : req.continue()
    );

    await page.goto(req.query.url || 'https://www.google.com', {
      waitUntil: 'domcontentloaded',
      timeout: 8000
    });

    instances.set(id, { ctx, page });
    res.set('X-Instance-ID', id).send(await page.content());
  } catch (err) {
    res.status(500).send(`Launch failed: ${err.message}`);
  }
});

// Load instance
app.get('/load', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send('ID required');
  
  const instance = instances.get(id);
  if (!instance) return res.status(404).send('Not found');
  
  try {
    res.send(await instance.page.content());
  } catch (err) {
    instances.del(id);
    res.status(410).send('Instance expired');
  }
});

// Close instance
app.get('/end', (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send('ID required');
  
  const instance = instances.get(id);
  if (!instance) return res.status(404).send('Not found');
  
  instance.ctx.close();
  instances.del(id);
  res.send('Instance closed');
});

// Health check
app.get('/health', (req, res) => 
  res.json({ 
    status: browser ? 'OK' : 'BOOTING', 
    instances: instances.keys().length 
  })
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await browser?.close();
  process.exit(0);
});

app.listen(port, () => console.log(`Server running on port ${port}`));
