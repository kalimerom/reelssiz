// Gizleme motorunu Instagram'a benzeyen sahte bir sayfada dener.
// Çalıştırma: node test/engine.test.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('typescript');
const { chromium } = require('playwright');

function load(file) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2019' } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
  return mod.exports;
}
const { buildEngineScript } = load('engine.ts');
const { DEFAULT_RULES, DEFAULT_SETTINGS } = load('rules.ts');

const PAGE = `<!doctype html><html><body>
<main><div id="feed">
  <article id="normal"><a href="/p/abc/">foto</a><div role="button">Like</div></article>
  <article id="reelpost"><a href="/reel/R1/">video</a></article>
  <div id="strip"><div><a href="/reel/R2/">r2</a><a href="/reel/R3/">r3</a></div></div>
  <article id="suggested"><div role="button">Follow</div><a href="/p/def/">foto</a></article>
  <article id="recycled"><a id="recycledLink" href="/reel/R9/">video</a></article>
</div></main>
<nav id="nav">
  <div id="homeItem"><span><a href="/">home</a></span></div>
  <div id="reelsItem"><span><a href="/reels/">reels</a></span></div>
  <div id="dmItem"><span><a href="/direct/inbox/">dm</a></span></div>
</nav>
<div id="scroller" style="height:300px;overflow-y:scroll"><div style="height:3000px">uzun</div></div>
</body></html>`;

const results = [];
function check(name, ok) {
  results.push(ok);
  console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name);
}

(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(PAGE);
  }).listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const visible = (page, sel) => page.locator(sel).isVisible();
  const settle = (page) => page.waitForTimeout(700);

  async function open(settings, url) {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
    const page = await ctx.newPage();
    await page.addInitScript(buildEngineScript(DEFAULT_RULES, { ...DEFAULT_SETTINGS, ...settings }));
    await page.goto(base + (url || '/'));
    await settle(page);
    return page;
  }

  // Ana akış
  let page = await open();
  check('Reels sekmesi (sarmalayıcısıyla) gizli', !(await visible(page, '#reelsItem')));
  check('Diğer sekmeler duruyor', (await visible(page, '#homeItem')) && (await visible(page, '#dmItem')));
  check('Normal gönderi duruyor', await visible(page, '#normal'));
  check('Akıştaki Reels gönderisi gizli', !(await visible(page, '#reelpost')));
  check('Önerilen Reels şeridi gizli', !(await visible(page, '#strip')));
  check('Akış kapsayıcısı gizlenmedi', await visible(page, '#feed'));
  check('Önerilen gönderi gizli', !(await visible(page, '#suggested')));

  // Instagram aynı öğeyi başka içerikle yeniden kullanırsa tekrar görünmeli
  check('Yeniden kullanılacak öğe başta gizli', !(await visible(page, '#recycled')));
  await page.evaluate(() => { document.getElementById('recycledLink').href = '/p/yeni/'; document.body.appendChild(document.createElement('i')); });
  await settle(page);
  check('İçeriği değişen öğe tekrar görünür', await visible(page, '#recycled'));

  // Sonradan eklenen içerik
  await page.evaluate(() => {
    const a = document.createElement('article'); a.id = 'late';
    a.innerHTML = '<a href="/reel/R7/">video</a>'; document.getElementById('feed').appendChild(a);
  });
  await settle(page);
  check('Sonradan yüklenen Reels gönderisi gizli', !(await visible(page, '#late')));

  // Reels akışı engeli (sayfa içi geçiş)
  await page.evaluate(() => history.pushState({}, '', '/reels/'));
  await page.waitForURL(base + '/');
  check('Reels akışına sayfa içi geçiş ana sayfaya döner', new URL(page.url()).pathname === '/');

  // Tek video: açılır, kaydırma kilitli
  await page.evaluate(() => history.pushState({}, '', '/reels/AAA/'));
  await settle(page);
  check('Mesajla gelen tek video açılır', new URL(page.url()).pathname === '/reels/AAA/');
  const box = await page.locator('#scroller').boundingBox();
  const swipe = async () => {
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + 50, y = box.y + 250;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 20 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    return page.evaluate(() => document.getElementById('scroller').scrollTop);
  };
  check('Video sayfasında kaydırma kilitli', (await swipe()) === 0);

  // Kilide rağmen sonraki videoya geçilirse ilk videoya dönülür
  await page.evaluate(() => history.replaceState({}, '', '/reels/BBB/'));
  await page.waitForURL(base + '/reels/AAA/');
  check('Sonraki videoya geçiş ilk videoya geri alınır', new URL(page.url()).pathname === '/reels/AAA/');

  // Videodan çıkınca kaydırma serbest
  await page.evaluate(() => history.pushState({}, '', '/direct/inbox/'));
  await settle(page);
  check('Videodan çıkınca kaydırma serbest', (await swipe()) > 0);
  await page.context().close();

  // Doğrudan adresle
  page = await open({}, '/reels/');
  check('Reels akışı adresi doğrudan açılınca ana sayfaya döner', new URL(page.url()).pathname === '/');
  await page.context().close();

  // Ayarlar kapalıyken dokunulmaz
  page = await open({ hideReelsTab: false, hideFeedReels: false, hideSuggested: false });
  check('Ayarlar kapalıyken hiçbir şey gizlenmez',
    (await visible(page, '#reelsItem')) && (await visible(page, '#reelpost')) &&
    (await visible(page, '#strip')) && (await visible(page, '#suggested')));
  await page.context().close();

  // Keşfet: varsayılan açık, ayar açılınca içerik gizlenir ama sayfa kalır
  page = await open({}, '/explore/');
  check('Keşfet varsayılan olarak dokunulmaz', await visible(page, '#normal a'));
  await page.context().close();
  page = await open({ hideExplore: true }, '/explore/');
  check('Keşfet ayarı açıkken içerik kutuları gizli', !(await visible(page, '#normal a')) && (await visible(page, '#nav')));
  await page.context().close();

  await browser.close();
  server.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} test geçti`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
