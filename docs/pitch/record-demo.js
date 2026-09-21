/* The screen recording in this folder (FineX-demo-90s.webm), as a script.
 *
 * How it is run: start a production build with the frozen cases serving —
 *   npm run build ; DEMO_MODE=true npx next start -p 3021
 * — then execute this function against a Playwright session (it takes `page`
 * only to borrow the browser type, and opens its own recording context).
 *
 * It should look like someone using the tool, not like a script: a cursor
 * travels to each control and clicks it, navigation happens by pressing the
 * buttons on screen rather than jumping to URLs, scrolling is done with the
 * wheel in uneven steps, and the pauses vary. Captions are few and plain.
 *
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
      cap.style.cssText = [
        'position:fixed', 'left:26px', 'bottom:24px', 'z-index:2147483646',
        'max-width:620px', 'padding:9px 16px',
        'background:rgba(10,10,10,0.92)', 'border:1px solid rgba(122,99,56,0.9)',
        'color:#f0ead8', 'font:400 16px/1.4 "Segoe UI",Inter,system-ui,sans-serif',
        'pointer-events:none', 'opacity:0', 'transition:opacity 300ms linear',
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
  const beat = (a = 700, z = 1200) => wait(rnd(a, z));
  const cap = async (t) => { await p.evaluate((x) => window.__cap && window.__cap(x), t); };

  /** Travel to a control, pause the way a person does, then click it. */
  const click = async (locator, { settle = 450 } = {}) => {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded();
    await wait(280);
    const box = await el.boundingBox();
    if (!box) return false;
    const x = Math.round(box.x + box.width * (0.35 + Math.random() * 0.3));
    const y = Math.round(box.y + box.height * (0.4 + Math.random() * 0.25));
    await p.evaluate(({ x, y, ms }) => window.__cursorTo(x, y, ms), { x, y, ms: rnd(520, 820) });
    await p.mouse.move(x, y);
    await wait(settle);
    await p.evaluate(() => window.__cursorPulse());
    await el.click();
    return true;
  };

  /** Wheel scrolling in uneven steps, the way a hand does it. */
  const wheel = async (total, steps = 5) => {
    const dir = Math.sign(total);
    let leftToGo = Math.abs(total);
    for (let i = 0; i < steps && leftToGo > 0; i++) {
      const d = Math.min(leftToGo, Math.round((Math.abs(total) / steps) * (0.7 + Math.random() * 0.6)));
      await p.mouse.wheel(0, dir * d);
      leftToGo -= d;
      await wait(rnd(90, 210));
    }
    await wait(rnd(260, 520));
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
    if (y !== null && Math.abs(y) > 40) await wheel(y, Math.max(3, Math.round(Math.abs(y) / 260)));
  };

  // ------------------------------------------------------------- the landing
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await wait(1100);
  await p.evaluate(() => window.__cursorTo(760, 300, 700));
  await cap('A victim reports one wallet. Where did the money go?');
  await beat(2600, 3200);
  await wheel(620, 4);
  await cap('241 exchange deposit addresses, derived from public data.');
  await beat(2800, 3400);
  await wheel(-620, 3);
  await cap('');

  // ---------------------------------------------------------------- the case
  await click(p.getByRole('link', { name: 'Open a case' }));
  await p.waitForLoadState('networkidle');
  await wait(1200);
  await cap('Paste the wallet from the complaint.');
  await click(p.locator('#address'), { settle: 300 });
  for (const ch of W) await p.keyboard.type(ch, { delay: rnd(28, 95) });
  await beat(900, 1400);
  await cap('');
  await click(p.getByRole('button', { name: 'Run trace' }));
  await p.waitForTimeout(rnd(3200, 4200));

  await toElement('Customer deposit address', 170);
  await cap('The exit is an account, not just an exchange.');
  await beat(3800, 4400);
  await cap('Confidence and evidence tier, on every label.');
  await beat(3000, 3600);

  await toElement('What next', 140);
  await cap('Which wallet to open next, ranked.');
  await beat(3600, 4200);

  await toElement('Why', 140);
  await cap('Six rules. Each one says why it fired.');
  await beat(3600, 4200);

  await toElement('Fund flow', 140);
  await cap('Amber: forwarded in under ten minutes.');
  await beat(4200, 4800);
  await cap('');

  // ------------------------------------------------------------ the evidence
  const packet = p.getByRole('link', { name: /Evidence packet/i });
  if (await packet.count()) { await click(packet); } else { await p.goto(B + '/report/' + W); }
  await p.waitForLoadState('networkidle');
  await wait(1800);
  await cap('An evidence packet, with the hash of every chain response.');
  await beat(3200, 3800);
  await wheel(900, 5);
  await beat(2600, 3200);
  await cap('');

  // --------------------------------------------------------------- the queue
  const batch = p.getByRole('link', { name: /Batch triage/i });
  if (await batch.count()) { await click(batch); } else { await p.goto(B + '/queue'); }
  await p.waitForLoadState('networkidle');
  await wait(1200);
  await cap('One wallet is a demo. A morning of complaints is the job.');
  await beat(2400, 3000);
  const load = p.getByRole('button', { name: /Load the recorded cases/i });
  if (await load.count()) { await click(load); await wait(900); }
  const build = p.getByRole('button', { name: /Build the queue/i });
  if (await build.count()) { await click(build); await wait(900); }
  await cap('');
  const run = p.getByRole('button', { name: /^Run the queue/i });
  if (await run.count()) await click(run);
  await p.waitForFunction(() => /10 of 10 traced/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
  await wait(1400);
  await cap('Ten complaints. Which still hold recoverable money.');
  await toElement('Traced', 130);
  await beat(4200, 4800);
  await wheel(560, 4);
  await beat(3600, 4200);
  await cap('');

  // ---------------------------------------------------------------- the sign
  await click(p.getByRole('link', { name: 'FineX' }));
  await p.waitForLoadState('networkidle');
  await wait(1300);
  await cap('TRON · USDT. No database, no model, no licence fee.');
  await beat(4000, 4600);
  await cap('');
  await wait(900);

  const videoPath = await p.video().path();
  await ctx.close();
  await b.close();
  return { videoPath };
};
