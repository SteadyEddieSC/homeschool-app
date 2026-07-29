import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1033 } from './build-v10.33.mjs';

function replaceAll(text, oldValue, newValue) {
  return text.split(oldValue).join(newValue);
}

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.33.1 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

export async function buildRelease(manifest) {
  const v1033 = JSON.parse(await readFile('source/releases/v10.33/release.json', 'utf8'));
  await buildV1033({ ...v1033, output: manifest.output });
  let text = await readFile(manifest.output, 'utf8');

  text = replaceAll(text, 'Beaufort Learning Harbor v10.33', 'Beaufort Learning Harbor v10.33.1');
  text = replaceAll(text, 'BLHMobileDock@v10.33', 'BLHMobileDock@v10.33.1');
  text = replaceAll(text, 'data-release="v10.33"', 'data-release="v10.33.1"');
  text = replaceAll(text, "const APP_VERSION = 'v10.33';", "const APP_VERSION = 'v10.33.1';");
  text = replaceAll(text, "appVersion: '10.33',", "appVersion: '10.33.1',");
  text = replaceAll(text, "version:'v10.33',", "version:'v10.33.1',");
  text = replaceAll(text, "const DEMO_META_KEY = 'beaufortLearningHarbor.v10.33.demoMeta';", "const DEMO_META_KEY = 'beaufortLearningHarbor.v10.33.1.demoMeta';");

  const legacyVersion = "const VERSION='v10.32';";
  const legacyCount = text.split(legacyVersion).length - 1;
  if (legacyCount !== 13) throw new Error(`Expected 13 legacy hero version declarations, found ${legacyCount}`);
  text = replaceAll(text, legacyVersion, "const VERSION='v10.33.1';");

  const idempotentReplacements = new Map([
    ['document.title = TITLE;', 'if(document.title !== TITLE) document.title = TITLE;'],
    ['document.title=TITLE;', 'if(document.title!==TITLE) document.title=TITLE;'],
    ['document.title=APP_TITLE;', 'if(document.title!==APP_TITLE) document.title=APP_TITLE;'],
    ['if(t) t.textContent=TITLE;', 'if(t && t.textContent!==TITLE) t.textContent=TITLE;'],
    ['if(title) title.textContent=TITLE;', 'if(title && title.textContent!==TITLE) title.textContent=TITLE;'],
    ['if(titleEl) titleEl.textContent=TITLE;', 'if(titleEl && titleEl.textContent!==TITLE) titleEl.textContent=TITLE;'],
    ["$$('title').forEach(x=>x.textContent=TITLE);", "$$('title').forEach(x=>{if(x.textContent!==TITLE) x.textContent=TITLE;});"],
    ["$$('title').forEach(t=>t.textContent=TITLE);", "$$('title').forEach(t=>{if(t.textContent!==TITLE) t.textContent=TITLE;});"],
    ['el.textContent=APP;', 'if(el.textContent!==APP) el.textContent=APP;'],
    ['el.textContent=TITLE;', 'if(el.textContent!==TITLE) el.textContent=TITLE;'],
    ['b.textContent=VERSION;', 'if(b.textContent!==VERSION) b.textContent=VERSION;'],
    ['badge.textContent=VERSION;', 'if(badge.textContent!==VERSION) badge.textContent=VERSION;'],
    ["kicker.textContent='Offline-first learning harbor · '+VERSION;", "if(kicker.textContent!=='Offline-first learning harbor · '+VERSION) kicker.textContent='Offline-first learning harbor · '+VERSION;"],
    ["if(/Offline-first/i.test(el.textContent||'')) el.textContent='Offline-first learning harbor';", "if(/Offline-first/i.test(el.textContent||'') && el.textContent!=='Offline-first learning harbor · '+VERSION) el.textContent='Offline-first learning harbor · '+VERSION;"],
    ["if(kicker&&/Offline-first/i.test(kicker.textContent||'')) kicker.textContent='Offline-first learning harbor';", "if(kicker&&/Offline-first/i.test(kicker.textContent||'')&&kicker.textContent!=='Offline-first learning harbor · v10.33.1') kicker.textContent='Offline-first learning harbor · v10.33.1';"]
  ]);
  for (const [oldValue, newValue] of idempotentReplacements) text = replaceAll(text, oldValue, newValue);

  const stableOld = `    document.querySelectorAll('h1,.brand-title,.app-title').forEach(el=>{\n      if(/Homeschool Quest Lab|Beaufort Learning Harbor/i.test(el.textContent||'')) el.textContent = el.textContent.replace(/Homeschool Quest Lab/gi, APP_NAME).replace(/Beaufort Learning Harbor\\s*v[\\d.]+/i, TITLE);\n    });\n    const kicker = document.querySelector('.kicker');\n    if(kicker && /Offline-first/i.test(kicker.textContent||'')) kicker.textContent = \`Offline-first learning harbor · \${APP_VERSION}\`;`;
  const stableNew = `    document.querySelectorAll('h1,.brand-title,.app-title').forEach(el=>{\n      if(/Homeschool Quest Lab|Beaufort Learning Harbor/i.test(el.textContent||'')){\n        const next=el.textContent.replace(/Homeschool Quest Lab/gi, APP_NAME).replace(/Beaufort Learning Harbor\\s*v[\\d.]+/i, TITLE);\n        if(el.textContent!==next) el.textContent=next;\n      }\n    });\n    const kicker = document.querySelector('.v25-title .kicker,.kicker');\n    const nextKicker=\`Offline-first learning harbor · \${APP_VERSION}\`;\n    if(kicker && /Offline-first/i.test(kicker.textContent||'') && kicker.textContent!==nextKicker) kicker.textContent=nextKicker;`;
  text = replaceOnce(text, stableOld, stableNew, 'legacy stableTitle block');

  const ownerScript = `\n<script>\n/* v10.33.1 — authoritative hero/title owner */\n(function(){\n  'use strict';\n  const OWNER='BLHHero@v10.33.1';\n  const TITLE='Beaufort Learning Harbor v10.33.1';\n  const APP='Beaufort Learning Harbor';\n  const KICKER='Offline-first learning harbor · v10.33.1';\n  let queued=false;\n  function sync(){\n    if(document.title!==TITLE) document.title=TITLE;\n    const hero=document.querySelector('.v25-title');\n    if(!hero) return;\n    if(hero.dataset.blhHeroOwner!==OWNER) hero.dataset.blhHeroOwner=OWNER;\n    const heading=hero.querySelector('h1');\n    const kicker=hero.querySelector('.kicker');\n    if(heading && heading.textContent!==APP) heading.textContent=APP;\n    if(kicker && kicker.textContent!==KICKER) kicker.textContent=KICKER;\n  }\n  function schedule(){\n    if(queued) return;\n    queued=true;\n    queueMicrotask(function(){queued=false;sync();});\n  }\n  function start(){\n    sync();\n    const hero=document.querySelector('.v25-title');\n    if(hero){\n      const observer=new MutationObserver(schedule);\n      observer.observe(hero,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-blh-hero-owner']});\n    }\n    const title=document.querySelector('title');\n    if(title){\n      const titleObserver=new MutationObserver(schedule);\n      titleObserver.observe(title,{childList:true,characterData:true,subtree:true});\n    }\n  }\n  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();\n})();\n</script>\n`;
  const bodyClose = text.lastIndexOf('</body>');
  if (bodyClose < 0) throw new Error('v10.33.1 body close missing');
  text = text.slice(0, bodyClose) + ownerScript + text.slice(bodyClose);

  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with hero/title stabilization from v10.33`);
}
