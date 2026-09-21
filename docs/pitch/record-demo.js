/* The screen recording in this folder (FineX-demo-60s.webm), as a script.
 *
 * How it is run: start a production build with the frozen cases serving —
 *   npm run build ; DEMO_MODE=true npx next start -p 3021
 * — then execute this function against a Playwright session (it takes `page`
 * only to borrow the browser type, and opens its own recording context).
 *
 * Two rules it is cut to. It must stand alone: someone who has never seen the
 * tool should understand the product from the film without narration, so the
 * captions are subtitle-sized and each beat states one thing. And it must look
 * like someone using the tool, not like a script: a cursor travels to each
 * control and clicks it, navigation happens by pressing the buttons on screen
 * rather than jumping to URLs, scrolling is done with the wheel in uneven
 * steps, and the pauses vary.
 *
 * Target length is 60 seconds; the returned timeline reports where it went.
 * Re-record whenever a screen it walks through changes.
 */
async (page) => {
  const DIR = './video';
  const B = 'http://localhost:3021';
  const W = 'TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex';

  const bt = page.context().browser().browserType();
  const b = await bt.launch({ headless: false, channel: 'chrome', args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: DIR, size: { width: 1280, height: 720 } },
  });

  // Cursor + caption layer, re-installed on every document.
  await ctx.addInitScript(() => {
    const install = () => {
      if (document.getElementById('__cap')) return;
      const cap = document.createElement('div');
      cap.id = '__cap';
      // Subtitle-sized: the film is watched small, in a slide or on a phone.
      cap.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:34px', 'transform:translateX(-50%)',
        'z-index:2147483646', 'max-width:1040px', 'padding:14px 26px', 'text-align:center',
        'background:rgba(10,10,10,0.93)', 'border:1px solid rgba(122,99,56,0.9)',
        'color:#f0ead8', 'font:600 26px/1.35 "Segoe UI",Inter,system-ui,sans-serif',
        'pointer-events:none', 'opacity:0', 'transition:opacity 260ms linear',
        'box-shadow:0 10px 50px rgba(0,0,0,0.75)',
      ].join(';');
      document.documentElement.appendChild(cap);

      const cur = document.createElement('div');
      cur.id = '__cur';
      cur.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;';
      cur.innerHTML =
        '<svg width="22" height="30" viewBox="0 0 22 30" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.85))">' +
        '<path d="M2 1 L2 22 L7.5 17 L11 26 L15 24 L11.5 15.5 L19 15.5 Z" fill="#f4f1e9" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
      document.documentElement.appendChild(cur);

      const state = { x: 640, y: 380 };
      const put = () => { cur.style.transform = `translate(${state.x}px, ${state.y}px)`; };
      put();

      window.__cap = (t) => {
        const c = document.getElementById('__cap');
        if (!c) return;
        if (!t) { c.style.opacity = '0'; return; }
        c.textContent = t;
        c.style.opacity = '1';
      };
      window.__cursorTo = (x, y, ms) =>
        new Promise((done) => {
          const sx = state.x, sy = state.y, t0 = performance.now();
          // A slight arc, so the path is not dead straight.
          const bow = (Math.random() - 0.5) * Math.min(90, Math.hypot(x - sx, y - sy) * 0.25);
          const step = (now) => {
            const k = Math.min(1, (now - t0) / ms);
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            state.x = sx + (x - sx) * e + Math.sin(e * Math.PI) * bow * 0.35;
            state.y = sy + (y - sy) * e - Math.sin(e * Math.PI) * Math.abs(bow) * 0.25;
            put();
            if (k < 1) requestAnimationFrame(step); else { state.x = x; state.y = y; put(); done(); }
          };
          requestAnimationFrame(step);
        });
      window.__cursorPulse = () => {
        const r = document.createElement('div');
        r.style.cssText = `position:fixed;left:${state.x - 13}px;top:${state.y - 13}px;width:26px;height:26px;border:2px solid rgba(198,161,91,0.95);border-radius:50%;z-index:2147483645;pointer-events:none;transition:transform 380ms ease-out,opacity 380ms ease-out;`;
        document.documentElement.appendChild(r);
        requestAnimationFrame(() => { r.style.transform = 'scale(2.1)'; r.style.opacity = '0'; });
        setTimeout(() => r.remove(), 420);
        cur.style.transform = `translate(${state.x}px, ${state.y}px) scale(0.86)`;
        setTimeout(put, 120);
      };
    };
    if (document.documentElement) install();
    document.addEventListener('DOMContentLoaded', install);
  });

  const p = await ctx.newPage();
  const rnd = (a, z) => Math.round(a + Math.random() * (z - a));
  const wait = (ms) => p.waitForTimeout(ms);
  const cap = async (t) => { await p.evaluate((x) => window.__cap && window.__cap(x), t); };

  const started = Date.now();
  const timeline = [];
  const mark = (label) => timeline.push(`${((Date.now() - started) / 1000).toFixed(1)}s ${label}`);

  /** Travel to a control, pause briefly, then click it. */
  const click = async (locator, { settle = 300 } = {}) => {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded();
    await wait(180);
    const box = await el.boundingBox();
    if (!box) return false;
    const x = Math.round(box.x + box.width * (0.35 + Math.random() * 0.3));
    const y = Math.round(box.y + box.height * (0.4 + Math.random() * 0.25));
    await p.evaluate(({ x, y, ms }) => window.__cursorTo(x, y, ms), { x, y, ms: rnd(380, 560) });
    await p.mouse.move(x, y);
    await wait(settle);
    await p.evaluate(() => window.__cursorPulse());
    await el.click();
    return true;
  };

  /** Wheel scrolling in uneven steps, the way a hand does it. */
  const wheel = async (total, steps = 4) => {
    const dir = Math.sign(total);
    let leftToGo = Math.abs(total);
    for (let i = 0; i < steps && leftToGo > 0; i++) {
      const d = Math.min(leftToGo, Math.round((Math.abs(total) / steps) * (0.7 + Math.random() * 0.6)));
      await p.mouse.wheel(0, dir * d);
      leftToGo -= d;
      await wait(rnd(70, 150));
    }
    await wait(rnd(160, 300));
  };

  // CSS uppercases many labels, so match the real text, case-insensitively.
  const toElement = async (text, gap = 150) => {
    const y = await p.evaluate(({ s, g }) => {
      const want = s.toLowerCase();
      const hits = [...document.querySelectorAll('h1,h2,h3,p,span,div,dt')]
        .filter((n) => n.textContent.trim().toLowerCase().startsWith(want))
        .sort((a, b) => a.textContent.length - b.textContent.length);
      return hits.length ? hits[0].getBoundingClientRect().top - g : null;
    }, { s: text, g: gap });
    if (y !== null && Math.abs(y) > 40) await wheel(y, Math.max(3, Math.round(Math.abs(y) / 300)));
  };

  // 0s — what the tool is for
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await wait(800);
  await p.evaluate(() => window.__cursorTo(720, 320, 600));
  await cap('A fraud victim reports one wallet. Where did the money go?');
  await wait(4100);
  mark('landing');

  // ~6s — the officer's one input
  await click(p.getByRole('link', { name: 'Open a case' }));
  await p.waitForLoadState('networkidle');
  await wait(700);
  await cap('Paste the wallet from the complaint. Nothing else is needed.');
  await click(p.locator('#address'), { settle: 220 });
  for (const ch of W) await p.keyboard.type(ch, { delay: rnd(22, 70) });
  await wait(700);
  await cap('');
  await click(p.getByRole('button', { name: 'Run trace' }));
  await p.waitForTimeout(2600);
  mark('traced');

  // ~18s — the finding, which is the whole product
  await toElement('Customer deposit address', 175);
  await cap('It names the exchange account the money landed in — the one that can be frozen.');
  await wait(6200);
  mark('deposit address');

  // ~26s — why an officer should believe it
  await toElement('Why', 140);
  await cap('Six rules say why it is suspicious, in plain words.');
  await wait(4300);
  mark('rules');

  // ~32s — the trail
  await toElement('Fund flow', 140);
  await cap('The whole trail, hop by hop. Amber: forwarded in under ten minutes.');
  await wait(5200);
  await cap('');
  mark('fund flow');

  // ~38s — what gets filed
  const packet = p.getByRole('link', { name: /Evidence packet/i });
  if (await packet.count()) { await click(packet); } else { await p.goto(B + '/report/' + W); }
  await p.waitForLoadState('networkidle');
  await wait(1100);
  await cap('One evidence packet, with the hash of every blockchain response behind it.');
  await wait(4100);
  await cap('');
  mark('packet');

  // ~45s — the part that scales
  const batch = p.getByRole('link', { name: /Batch triage/i });
  if (await batch.count()) { await click(batch); } else { await p.goto(B + '/queue'); }
  await p.waitForLoadState('networkidle');
  await wait(600);
  const load = p.getByRole('button', { name: /Load the recorded cases/i });
  if (await load.count()) { await click(load, { settle: 200 }); await wait(400); }
  const build = p.getByRole('button', { name: /Build the queue/i });
  if (await build.count()) { await click(build, { settle: 200 }); await wait(400); }
  const run = p.getByRole('button', { name: /^Run the queue/i });
  if (await run.count()) await click(run, { settle: 200 });
  await cap('A whole morning of complaints, traced in one run.');
  await p.waitForFunction(() => /10 of 10 traced/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
  await wait(900);
  mark('queue run');

  await cap('Which cases still hold recoverable money — and which are really one case.');
  await toElement('Traced', 130);
  await wait(5200);
  mark('register');

  await cap('FineX · TRON · USDT. No database, no model, no licence fee.');
  await wheel(420, 3);
  await wait(3600);
  await cap('');
  await wait(600);
  mark('close');

  const videoPath = await p.video().path();
  await ctx.close();
  await b.close();
  return { videoPath, timeline };
};
