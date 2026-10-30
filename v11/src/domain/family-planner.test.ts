import { describe, expect, it } from 'vitest';
import {
  BLH_FAMILY_PLANNER_TEMPLATE_FORMAT,
  BLH_FAMILY_PLANNER_V2_VERSION,
  BLHFamilyPlannerV2Error,
  analyzeWeek,
  applyWeekTemplate,
  copyWeek,
  createLearnerSafeCsv,
  createLearnerSafePrintModel,
  createWeekTemplate,
  normalizeTemplateLibrary,
} from './family-planner';

const fixedNow = '2026-08-02T02:50:00.000Z';

function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Item ${id}`,
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    targetKind: 'student',
    targetId: 'avery',
    subject: 'Botany',
    itemType: 'lesson',
    status: 'planned',
    location: 'Home',
    sourceScreen: 'assignments',
    sourceId: `src_${id}`,
    coOp: { enabled: false, eventName: '', role: '', materials: '', arrivalNotes: '', followUpOwner: '' },
    studentDirections: 'Complete the synthetic activity.',
    adultNotes: 'PRIVATE ADULT NOTE',
    order: 0,
    carriedFromId: '',
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  };
}

function week(weekId: string, items: unknown[] = [], overrides: Record<string, unknown> = {}) {
  return { weekId, mode: 'standard', familyNotes: 'Family note', coOpNotes: 'PRIVATE COOP NOTE', items, updatedAt: fixedNow, ...overrides };
}

describe('family planner v2 TypeScript parity', () => {
  it('creates a normalized reusable template from active items only', () => {
    const template = createWeekTemplate({
      week: week('week_1', [item('a'), item('archived', { status: 'archived' })]),
      id: 'tpl_week_1',
      name: 'Normal week',
      description: 'Synthetic reusable plan',
      createdAt: fixedNow,
    });
    expect(template.format).toBe(BLH_FAMILY_PLANNER_TEMPLATE_FORMAT);
    expect(template.items).toHaveLength(1);
    expect(template.items.at(0)?.sourceItemId).toBe('a');
    expect(template.name).toBe('Normal week');
  });

  it('applies templates additively, deterministically, and idempotently', () => {
    const template = createWeekTemplate({ week: week('week_1', [item('a')]), id: 'tpl_week_1', name: 'Normal week', createdAt: fixedNow });
    const first = applyWeekTemplate({ template, targetWeek: week('week_2'), now: fixedNow });
    expect(first.added).toBe(1);
    expect(first.week.items.at(0)?.carriedFromId).toBe('template:tpl_week_1:a');
    const second = applyWeekTemplate({ template, targetWeek: first.week, now: fixedNow });
    expect(second.added).toBe(0);
    expect(second.skipped).toEqual(['a']);
    expect(second.week.items).toHaveLength(1);
  });

  it('duplicates a week without mutating source or duplicating linked copies', () => {
    const source = week('week_1', [item('a'), item('b', { day: 'Tuesday', status: 'ready' })]);
    const first = copyWeek({ sourceWeek: source, targetWeek: week('week_2'), operation: 'duplicate', now: fixedNow });
    expect(first.added).toBe(2);
    expect((source.items as Array<{ id: string }>).map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(first.week.items.at(1)?.status).toBe('ready');
    const second = copyWeek({ sourceWeek: source, targetWeek: first.week, operation: 'duplicate', now: fixedNow });
    expect(second.added).toBe(0);
    expect(second.week.items).toHaveLength(2);
  });

  it('rolls active work forward as explicit carryover and skips archived work', () => {
    const source = week('week_1', [item('a'), item('archived', { status: 'archived' })]);
    const result = copyWeek({ sourceWeek: source, targetWeek: week('week_2'), operation: 'roll-forward', now: fixedNow });
    expect(result.added).toBe(1);
    expect(result.week.items.at(0)?.status).toBe('carryover');
    expect(result.week.items.at(0)?.carriedFromId).toBe('roll-forward:week_1:a');
  });

  it('fails closed on same-week copying', () => {
    expect(() => copyWeek({ sourceWeek: week('week_1'), targetWeek: week('week_1') })).toThrowError(BLHFamilyPlannerV2Error);
    try {
      copyWeek({ sourceWeek: week('week_1'), targetWeek: week('week_1') });
    } catch (error) {
      expect(error).toMatchObject({ code: 'SAME_WEEK' });
    }
  });

  it('detects overloads, target-aware conflicts, and co-op responsibility gaps', () => {
    const entries = [
      item('a', { startTime: '09:00', endTime: '10:30' }),
      item('b', { startTime: '10:00', endTime: '11:00' }),
      item('c', { day: 'Tuesday', targetKind: 'track', targetId: 'lower', coOp: { enabled: true, eventName: 'Lab day', role: '', materials: 'Cards', arrivalNotes: 'PRIVATE', followUpOwner: '' } }),
    ];
    const analysis = analyzeWeek({
      week: week('week_1', entries),
      students: [{ id: 'avery', name: 'Avery', levelId: 'lower' }],
      learningLevels: [{ id: 'lower', name: 'Lower track' }],
      maxItemsPerDay: 1,
      maxItemsPerTarget: 1,
    });
    expect(analysis.version).toBe(BLH_FAMILY_PLANNER_V2_VERSION);
    expect(analysis.conflicts).toHaveLength(1);
    expect(analysis.responsibilityGaps).toHaveLength(1);
    expect(analysis.workloadWarnings.some((entry) => entry.code === 'DAY_OVERLOAD')).toBe(true);
    expect(analysis.workloadWarnings.some((entry) => entry.code === 'TARGET_OVERLOAD')).toBe(true);
  });

  it('does not create false conflicts between unrelated learners', () => {
    const analysis = analyzeWeek({
      week: week('week_1', [item('a', { targetId: 'avery' }), item('b', { targetId: 'jordan' })]),
      students: [{ id: 'avery', levelId: 'lower' }, { id: 'jordan', levelId: 'upper' }],
    });
    expect(analysis.conflicts).toHaveLength(0);
  });

  it('redacts adult-only and arrival notes from learner-safe print and CSV', () => {
    const source = week('week_1', [item('a', { coOp: { enabled: true, eventName: 'Lab', role: 'Teacher', materials: 'Paper', arrivalNotes: 'PRIVATE ARRIVAL', followUpOwner: 'Parent' } })]);
    const model = createLearnerSafePrintModel({ week: source, students: [{ id: 'avery', name: 'Avery' }] });
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain('PRIVATE ADULT NOTE');
    expect(serialized).not.toContain('PRIVATE COOP NOTE');
    expect(serialized).not.toContain('PRIVATE ARRIVAL');
    const csv = createLearnerSafeCsv({ week: source, students: [{ id: 'avery', name: 'Avery' }] });
    expect(csv).not.toContain('PRIVATE');
    expect(csv).toContain('"Avery"');
  });

  it('fails closed on dangerous keys and duplicate template IDs', () => {
    const template = createWeekTemplate({ week: week('week_1', [item('a')]), id: 'tpl_one', name: 'One', createdAt: fixedNow });
    expect(() => normalizeTemplateLibrary([template, template])).toThrow(/Duplicate template id/);
    const dangerous = JSON.parse('{"id":"tpl_bad","name":"Bad","mode":"standard","items":[],"__proto__":{"polluted":true}}');
    expect(() => normalizeTemplateLibrary([dangerous])).toThrowError(BLHFamilyPlannerV2Error);
    try {
      normalizeTemplateLibrary([dangerous]);
    } catch (error) {
      expect(error).toMatchObject({ code: 'DANGEROUS_KEY' });
    }
    expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
  });
});
