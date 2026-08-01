import { test, expect } from '@playwright/test';

const stateKey = 'beaufortLearningHarbor.v10.19.state';

async function loadDemo(page) {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('load-demo-family').click();
  await expect(page.getByTestId('demo-scenario-status')).toHaveText('Active sample progress');
}

const expectedMatrices = {
  stu_jordan: {
    learn: ['learn-upper-biology-life', 'lib-biology', true],
    practice: ['practice-upper-biology-notebook', 'biology', true],
    quiz: ['quiz-upper-biology-check', 'quizzes-tests', true],
    proof: ['proof-upper-latin-recitation', 'assignments', true],
    feedback: ['feedback-all-portfolio-review', 'portfolio', true]
  },
  stu_avery: {
    learn: ['learn-lower-botany-plant-parts', 'lib-botany', true],
    practice: ['practice-lower-botany-sort-lab', 'botany', true],
    quiz: ['quiz-lower-science-check', 'quizzes-tests', true],
    proof: [null, 'assignments', false],
    feedback: ['feedback-all-portfolio-review', 'portfolio', true]
  }
};

test('v10.41 exposes one read-only learner route resolver and preserves both demo route matrices', async ({ page }) => {
  await loadDemo(page);
  const result = await page.evaluate(() => {
    const resolver = window.BLHLearnerRouteResolver;
    const runtime = window.BLHLearnerRouteRuntime;
    const learners = [
      { id:'stu_jordan', name:'Jordan', levelId:'upper' },
      { id:'stu_avery', name:'Avery', levelId:'lower' }
    ];
    return {
      resolver: {
        version: resolver?.version,
        schema: resolver?.schema,
        kinds: resolver?.routeKinds,
        frozen: Object.isFrozen(resolver) && Object.isFrozen(resolver.routeKinds) && Object.isFrozen(resolver.fallbacks)
      },
      runtime: { version: runtime?.version, schema: runtime?.schema, frozen: Object.isFrozen(runtime) },
      matrices: Object.fromEntries(learners.map(learner => [learner.id, runtime.snapshot(learner).routes]))
    };
  });

  expect(result.resolver).toEqual({
    version:'v10.41', schema:1,
    kinds:['learn','practice','quiz','proof','feedback'],
    frozen:true
  });
  expect(result.runtime).toEqual({ version:'v10.41', schema:1, frozen:true });

  for (const [learnerId, routes] of Object.entries(expectedMatrices)) {
    for (const [kind, [assignmentId, screen, exactDestination]] of Object.entries(routes)) {
      expect(result.matrices[learnerId][kind].assignmentId).toBe(assignmentId);
      expect(result.matrices[learnerId][kind].screen).toBe(screen);
      expect(result.matrices[learnerId][kind].exactDestination).toBe(exactDestination);
    }
  }
});

test('incomplete learner, assignment, and destination mappings use deterministic fallbacks without mutating application state', async ({ page }) => {
  await loadDemo(page);
  const result = await page.evaluate(key => {
    const before = localStorage.getItem(key);
    const resolver = window.BLHLearnerRouteResolver;
    const availableScreens = ['home','study','lessonplayer','quizzes-tests','assignments','portfolio'];
    const incompleteLearner = resolver.resolveLearnerRoute({
      kind:'learn',
      learner:{ id:'guest' },
      assignments:[
        { id:'lower-route', student:'lower', kind:'learn', screen:'study' },
        { id:'upper-route', student:'upper', kind:'learn', screen:'study' }
      ],
      availableScreens
    });
    const noAssignment = resolver.resolveLearnerRoute({
      kind:'proof', learner:{ id:'guest' }, assignments:[], availableScreens
    });
    const missingDestination = resolver.resolveLearnerRoute({
      kind:'practice',
      learner:{ id:'guest', levelId:'lower' },
      assignments:[{ id:'missing-screen', student:'lower', kind:'practice', label:'No destination' }],
      availableScreens
    });
    const after = localStorage.getItem(key);
    return {
      unchanged: before === after,
      incompleteLearner: {
        track:incompleteLearner.learner.track,
        assignmentId:incompleteLearner.assignment?.id,
        screen:incompleteLearner.screen,
        reasonCode:incompleteLearner.reasonCode
      },
      noAssignment: {
        assignment:noAssignment.assignment,
        screen:noAssignment.screen,
        reasonCode:noAssignment.reasonCode
      },
      missingDestination: {
        assignmentId:missingDestination.assignment?.id,
        screen:missingDestination.screen,
        reasonCode:missingDestination.reasonCode,
        usedFallback:missingDestination.usedFallback
      }
    };
  }, stateKey);

  expect(result.unchanged).toBe(true);
  expect(result.incompleteLearner).toEqual({
    track:'lower', assignmentId:'lower-route', screen:'study', reasonCode:'NEXT_UNFINISHED_ASSIGNMENT'
  });
  expect(result.noAssignment).toEqual({
    assignment:null, screen:'assignments', reasonCode:'NO_MATCHING_ASSIGNMENT'
  });
  expect(result.missingDestination).toEqual({
    assignmentId:'missing-screen', screen:'lessonplayer', reasonCode:'ASSIGNMENT_DESTINATION_MISSING', usedFallback:true
  });
});

test('direct assignment resolution cannot widen work to the wrong learner and Route QA shows resolver diagnostics', async ({ page }) => {
  await loadDemo(page);
  const direct = await page.evaluate(() => ({
    jordan: window.BLHLearnerRouteRuntime.resolveAssignment('proof-upper-latin-recitation', { id:'stu_jordan', levelId:'upper' }),
    avery: window.BLHLearnerRouteRuntime.resolveAssignment('proof-upper-latin-recitation', { id:'stu_avery', levelId:'lower' })
  }));
  expect(direct.jordan.assignment.id).toBe('proof-upper-latin-recitation');
  expect(direct.jordan.screen).toBe('assignments');
  expect(direct.avery.assignment).toBeNull();
  expect(direct.avery.screen).toBe('home');
  expect(direct.avery.reasonCode).toBe('ASSIGNMENT_NOT_FOUND_OR_NOT_APPLICABLE');

  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    state.ui = state.ui || {};
    state.ui.role = 'parent';
    localStorage.setItem(key, JSON.stringify(state));
  }, stateKey);
  await page.reload();
  await page.locator('[data-blh26-open-qa]').first().dispatchEvent('click');
  await expect(page.locator('#screen-blh26-route-qa')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#screen-blh26-route-qa')).toContainText('Resolver:');
  await expect(page.locator('#screen-blh26-route-qa')).toContainText('Safe fallback');
});
