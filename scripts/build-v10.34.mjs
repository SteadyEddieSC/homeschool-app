import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV10331 } from './build-v10.33.1.mjs';

function replaceAll(text, oldValue, newValue) {
  return text.split(oldValue).join(newValue);
}

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.34 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

export async function buildRelease(manifest) {
  const v10331 = JSON.parse(await readFile('source/releases/v10.33.1/release.json', 'utf8'));
  await buildV10331({ ...v10331, output: manifest.output });
  let text = await readFile(manifest.output, 'utf8');

  text = replaceAll(text, 'v10.33.1', 'v10.34');
  text = replaceAll(text, '10.33.1', '10.34');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.34">';
  if (!text.includes(htmlAnchor)) throw new Error('v10.34 HTML release anchor missing');
  text = text.replace(htmlAnchor, '<html lang="en" data-demo-build="synthetic" data-release="v10.34" data-route-contract="v10.34">');

  const legacyRouteIdentity = `  function role(){try{return String(window.activeRole?window.activeRole():'student').toLowerCase();}catch(e){return 'student';}}\n  function isAdult(){return ['parent','teacher','director','admin'].includes(role());}\n  function student(){try{const s=window.activeStudent?window.activeStudent():null; if(s) return s;}catch(e){} return {id:'student',name:'Student',levelId:'lower'};}`;
  const storageAwareRouteIdentity = `  function coreState(){try{return JSON.parse(localStorage.getItem('beaufortLearningHarbor.v10.19.state')||'null')||{};}catch(e){return {};}}\n  function role(){try{if(typeof window.activeRole==='function') return String(window.activeRole()||'student').toLowerCase();}catch(e){} const d=coreState(); return String(d?.ui?.role||'student').toLowerCase();}\n  function isAdult(){return ['parent','teacher','director','admin'].includes(role());}\n  function student(){try{if(typeof window.activeStudent==='function'){const s=window.activeStudent(); if(s) return s;}}catch(e){} const d=coreState(); const list=Array.isArray(d.students)?d.students:[]; return list.find(s=>s.id===d.activeStudentId)||list[0]||{id:'student',name:'Student',levelId:d.currentStudyLevelId||'lower'};}`;
  text = replaceOnce(text, legacyRouteIdentity, storageAwareRouteIdentity, 'exact-route identity bridge');

  const legacyDockRole = `  function role(){\n    try{if(typeof window.activeRole==='function') return String(window.activeRole()||'student').toLowerCase();}catch(e){}\n    const select=document.getElementById('roleSelect');\n    return String(select&&select.value||'student').toLowerCase();\n  }`;
  const storageAwareDockRole = `  function role(){\n    try{if(typeof window.activeRole==='function') return String(window.activeRole()||'student').toLowerCase();}catch(e){}\n    try{const d=JSON.parse(localStorage.getItem('beaufortLearningHarbor.v10.19.state')||'null')||{}; if(d?.ui?.role) return String(d.ui.role).toLowerCase();}catch(e){}\n    const select=document.getElementById('roleSelect');\n    return String(select&&select.value||'student').toLowerCase();\n  }`;
  text = replaceOnce(text, legacyDockRole, storageAwareDockRole, 'mobile-dock role bridge');

  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.34 route and role regression contract`);
}
