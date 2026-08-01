import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1040 } from './build-v10.40.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.41 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function replaceExactCount(text, oldValue, newValue, expected, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== expected) throw new Error(`v10.41 expected ${expected} ${label} anchors, found ${count}`);
  return text.split(oldValue).join(newValue);
}

function replaceBlock(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`v10.41 block start missing: ${label}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`v10.41 block end missing: ${label}`);
  return text.slice(0, start) + replacement + text.slice(end);
}

function browserResolverModuleScript(moduleSource) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) throw new Error('v10.41 learner-route resolver contains an unsupported browser export');
  return `<script data-blh-learner-route-resolver="v10.41" data-blh-learner-route-resolver-schema="1">\n(function(){\n  'use strict';\n${browserSource}\n  window.BLHLearnerRouteResolver = Object.freeze({\n    version: BLH_LEARNER_ROUTE_RESOLVER_VERSION,\n    schema: BLH_LEARNER_ROUTE_RESOLVER_SCHEMA,\n    routeKinds: Object.freeze([...BLH_ROUTE_KINDS]),\n    fallbacks: Object.freeze({...BLH_ROUTE_FALLBACKS}),\n    normalizeLearner,\n    normalizeAssignment,\n    assignmentMatchesLearner,\n    completionKey,\n    isAssignmentComplete,\n    matchingAssignments,\n    resolveLearnerRoute,\n    resolveAssignmentDestination,\n    resolveLearnerRouteMatrix\n  });\n})();\n</script>\n`;
}

export function transformV1041(source, moduleSource) {
  let text = source.split('v10.40').join('__BLH_V1041__');
  text = replaceOnce(text, "appVersion: '10.40'", "appVersion: '10.41'", 'core app version');
  text = replaceExactCount(text, "productVersion: '10.40'", "productVersion: '10.41'", 3, 'portable product-version');
  text = replaceOnce(text, "productVersion:'10.40'", "productVersion:'10.41'", 'Family Planner product-version');
  text = text.split('__BLH_V1041__').join('v10.41');

  const routeScriptAnchor = `<script>\n\n\n/* Beaufort Learning Harbor v10.31 - Exact Student Routing + Completion QA */`;
  text = replaceOnce(
    text,
    routeScriptAnchor,
    `${browserResolverModuleScript(moduleSource)}${routeScriptAnchor}`,
    'learner-route resolver browser module'
  );

  text = replaceBlock(
    text,
    '  function level(stu){',
    '  function screenExists(screen){',
    `  function routeResolverContext(stu=student(), manifest=loadManifest()){\n    return {\n      learner:stu,\n      assignments:Array.isArray(manifest?.assignments) ? manifest.assignments : [],\n      completed:manifest?.completed || {},\n      availableScreens:$$('.screen[id^="screen-"]').map(node => node.id.replace(/^screen-/, '')),\n      fallbacks:FALLBACKS\n    };\n  }\n  function level(stu){return window.BLHLearnerRouteResolver.normalizeLearner(stu).track;}\n  function matches(item,stu){\n    try{return window.BLHLearnerRouteResolver.assignmentMatchesLearner(item,stu);}catch(e){return false;}\n  }\n  function completionKey(stuId,itemId){return window.BLHLearnerRouteResolver.completionKey(stuId,itemId);}\n  function isDone(d,stu,item){return window.BLHLearnerRouteResolver.isAssignmentComplete(d?.completed||{},stu?.id,item?.id);}\n  function routeItems(kind){\n    const context=routeResolverContext();\n    return window.BLHLearnerRouteResolver.matchingAssignments({assignments:context.assignments,learner:context.learner,kind}).items;\n  }\n  function resolveRoute(kind,stu=student(),manifest=loadManifest()){\n    return window.BLHLearnerRouteResolver.resolveLearnerRoute({kind,...routeResolverContext(stu,manifest)});\n  }\n  function nextItem(kind){return resolveRoute(kind).assignment;}\n`,
    'legacy learner and assignment resolution'
  );

  text = replaceOnce(
    text,
    `  function screenExists(screen){return !!document.getElementById('screen-'+screen);}\n  function openScreen(screen){`,
    `  function screenExists(screen){return !!document.getElementById('screen-'+screen);}\n  function resolveAssignmentRoute(assignmentId,stu=student(),manifest=loadManifest()){\n    return window.BLHLearnerRouteResolver.resolveAssignmentDestination({assignmentId,...routeResolverContext(stu,manifest)});\n  }\n  window.BLHLearnerRouteRuntime = Object.freeze({\n    version:'v10.41',\n    schema:1,\n    resolve:(kind,learner=student()) => resolveRoute(kind,learner),\n    resolveAssignment:(assignmentId,learner=student()) => resolveAssignmentRoute(assignmentId,learner),\n    matrix:(learner=student()) => window.BLHLearnerRouteResolver.resolveLearnerRouteMatrix(routeResolverContext(learner)),\n    snapshot:(learner=student()) => {\n      const matrix=window.BLHLearnerRouteResolver.resolveLearnerRouteMatrix(routeResolverContext(learner));\n      return {\n        version:matrix.version,\n        schema:matrix.schema,\n        learner:matrix.learner,\n        routes:Object.fromEntries(Object.entries(matrix.routes).map(([kind,result]) => [kind,{assignmentId:result.assignment?.id||null,screen:result.screen,reasonCode:result.reasonCode,exactDestination:result.exactDestination,usedFallback:result.usedFallback}]))\n      };\n    }\n  });\n  function openScreen(screen){`,
    'learner-route runtime diagnostics'
  );

  text = replaceOnce(
    text,
    `  function route(kind){\n    kind=String(kind||'').toLowerCase(); if(kind==='path'||kind==='manifest') return openRouteQa(); if(kind==='roadmap') return openRoadmap();\n    const item=nextItem(kind); if(item){openScreen(item.screen); setTimeout(()=>injectTarget(item),180); return;}\n    openScreen(FALLBACKS[kind]||'home');\n  }\n  function openItem(id){const d=loadManifest(); const item=(d.assignments||[]).find(x=>x.id===id); if(!item) return; openScreen(item.screen); setTimeout(()=>injectTarget(item),180);}`,
    `  function route(kind){\n    kind=String(kind||'').toLowerCase(); if(kind==='path'||kind==='manifest') return openRouteQa(); if(kind==='roadmap') return openRoadmap();\n    const resolution=resolveRoute(kind);\n    openScreen(resolution.screen||'home');\n    if(resolution.assignment && resolution.exactDestination) setTimeout(()=>injectTarget(resolution.assignment),180);\n  }\n  function openItem(id){\n    const resolution=resolveAssignmentRoute(id);\n    if(!resolution.assignment) return;\n    openScreen(resolution.screen||'home');\n    if(resolution.exactDestination) setTimeout(()=>injectTarget(resolution.assignment),180);\n  }`,
    'route and direct-assignment destination resolution'
  );

  text = replaceOnce(
    text,
    `  function routeAuditCard(kind){\n    const item=nextItem(kind); const exists=item?screenExists(item.screen):false; const q=loadQa(); const validated=!!(q.validated||{})[kind]; const note=(q.routeNotes||{})[kind]||'';\n    return \`<article class="blh26-card"><div class="blh26-row blh26-between"><span class="blh26-pill route">\${esc(ROUTE_LABELS[kind]||kind)}</span><span class="blh26-pill \${exists?'ok':'warn'}">\${exists?'Target exists':'Fallback needed'}</span></div><h3>\${esc(item?.label||'No assigned item')}</h3><p><b>Screen:</b> \${esc(item?.screen||FALLBACKS[kind]||'home')}</p><p><b>Route status:</b> \${validated?'Adult checked locally':'Not checked yet'}</p><p>\${esc(item?.why||'Uses safe fallback routing.')}</p><div class="blh26-row"><button class="btn primary" type="button" data-blh26-route="\${esc(kind)}">Test route</button>\${item?\`<button class="btn" type="button" data-blh26-complete="\${esc(item.id)}">Toggle done</button>\`:''}<button class="btn" type="button" data-blh26-validate="\${esc(kind)}">\${validated?'Uncheck':'Mark route checked'}</button></div>\${isAdult()?\`<label class="blh26-tight"><span class="blh26-kicker">parent/teacher override note</span><textarea data-blh26-note="\${esc(kind)}" placeholder="Example: Do Latin recitation before Biology quiz this week.">\${esc(note)}</textarea></label>\`:''}</article>\`;\n  }`,
    `  function routeAuditCard(kind){\n    const resolution=resolveRoute(kind); const item=resolution.assignment; const exists=resolution.exactDestination; const q=loadQa(); const validated=!!(q.validated||{})[kind]; const note=(q.routeNotes||{})[kind]||'';\n    const resolutionLabel=resolution.reasonCode==='NEXT_UNFINISHED_ASSIGNMENT'?'Next unfinished assignment':resolution.reasonCode==='REPEAT_FIRST_MATCHING_ASSIGNMENT'?'All matching items done; first item repeated':resolution.reasonCode==='NO_MATCHING_ASSIGNMENT'?'No matching assignment; safe fallback':resolution.reasonCode==='ASSIGNMENT_DESTINATION_MISSING'?'Assignment destination missing; safe fallback':'Destination unavailable; safe fallback';\n    return \`<article class="blh26-card"><div class="blh26-row blh26-between"><span class="blh26-pill route">\${esc(ROUTE_LABELS[kind]||kind)}</span><span class="blh26-pill \${exists?'ok':'warn'}">\${exists?'Exact target':'Safe fallback'}</span></div><h3>\${esc(item?.label||'No assigned item')}</h3><p><b>Resolved screen:</b> \${esc(resolution.screen||'home')}</p><p><b>Resolver:</b> \${esc(resolutionLabel)}</p><p><b>Route status:</b> \${validated?'Adult checked locally':'Not checked yet'}</p><p>\${esc(item?.why||'Uses safe fallback routing.')}</p><div class="blh26-row"><button class="btn primary" type="button" data-blh26-route="\${esc(kind)}">Test route</button>\${item?\`<button class="btn" type="button" data-blh26-complete="\${esc(item.id)}">Toggle done</button>\`:''}<button class="btn" type="button" data-blh26-validate="\${esc(kind)}">\${validated?'Uncheck':'Mark route checked'}</button></div>\${isAdult()?\`<label class="blh26-tight"><span class="blh26-kicker">parent/teacher override note</span><textarea data-blh26-note="\${esc(kind)}" placeholder="Example: Do Latin recitation before Biology quiz this week.">\${esc(note)}</textarea></label>\`:''}</article>\`;\n  }`,
    'route QA resolver diagnostics'
  );

  text = replaceOnce(
    text,
    `  function releaseNote(){const list=$('#screen-updates .v27-release-list'); if(list && !list.querySelector('[data-release="v10.26"]')) list.insertAdjacentHTML('afterbegin',\`<div class="v27-release-item" data-release="v10.26"><b>v10.26 Exact Student Routing + Completion QA</b><p>Learning Path buttons now use exact next-item routing with target banners, next-item badges, local completion toggles, adult-only route QA, route notes, and the full roadmap through v10.33.</p></div>\`);}`,
    `  function releaseNote(){const list=$('#screen-updates .v27-release-list'); if(list && !list.querySelector('[data-release="v10.26"]')) list.insertAdjacentHTML('afterbegin',\`<div class="v27-release-item" data-release="v10.26"><b>v10.26 Exact Student Routing + Completion QA</b><p>Learning Path buttons now use exact next-item routing with target banners, next-item badges, local completion toggles, adult-only route QA, route notes, and the full roadmap through v10.33.</p></div>\`); if(list && !list.querySelector('[data-release="v10.41-learner-route-resolver"]')) list.insertAdjacentHTML('afterbegin','<div class="v27-release-item" data-release="v10.41-learner-route-resolver"><b>v10.41 Learner Route + Assignment Resolver</b><p>Centralized learner-track matching, next-assignment selection, completion-aware routing, direct assignment destinations, and safe fallback diagnostics behind one deterministic tested resolver while preserving current Jordan/Avery route outcomes.</p></div>');}`,
    'v10.41 release note'
  );

  text = replaceOnce(
    text,
    'data-app-shell-role-policy="v10.41" data-app-shell-role-policy-schema="1">',
    'data-app-shell-role-policy="v10.41" data-app-shell-role-policy-schema="1" data-learner-route-resolver="v10.41" data-learner-route-resolver-schema="1">',
    'learner-route resolver release markers'
  );

  return text;
}

export async function buildRelease(manifest) {
  const v1040 = JSON.parse(await readFile('source/releases/v10.40/release.json', 'utf8'));
  await buildV1040({ ...v1040, output: manifest.output });
  const [source, moduleSource] = await Promise.all([
    readFile(manifest.output, 'utf8'),
    readFile('modules/learner-route-resolver.mjs', 'utf8')
  ]);
  const text = transformV1041(source, moduleSource);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.41 learner route and assignment resolver`);
}
