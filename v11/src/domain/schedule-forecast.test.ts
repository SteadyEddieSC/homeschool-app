import { describe, expect, it } from 'vitest';
import {
  ScheduleForecastError,
  buildTodayReview,
  forecastCourseSchedule,
  type AcademicYear,
  type ForecastBreak,
  type ForecastCourse,
  type ForecastInput,
  type SourceAuthority,
} from './schedule-forecast';

const householdAuthority: SourceAuthority = { kind: 'household', householdId: 'household_1' };
const coopAuthority: SourceAuthority = { kind: 'coop', householdId: 'household_1', organizationId: 'coop_1', shareId: 'share_1' };
const academicYear: AcademicYear = {
  id: 'year_2026',
  startDate: '2026-09-01',
  endDate: '2027-05-31',
  learningDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
};

function course(overrides: Partial<ForecastCourse> = {}): ForecastCourse {
  return {
    id: 'math',
    learnerId: 'avery',
    title: 'Math',
    active: true,
    meetingDays: ['monday', 'wednesday', 'friday'],
    sourceAuthority: householdAuthority,
    workItems: [
      { id: 'work_1', order: 1, title: 'Lesson 1', durationMinutes: 30, resourceId: 'book_1' },
      { id: 'work_2', order: 2, title: 'Lesson 2', durationMinutes: 35, resourceId: 'book_1' },
      { id: 'work_3', order: 3, title: 'Lesson 3', durationMinutes: 40, resourceId: 'book_2' },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    today: '2026-09-01',
    academicYear,
    course: course(),
    completions: [],
    breaks: [],
    ...overrides,
  };
}

function plannedDates(value: ForecastInput): Array<string | null> {
  return forecastCourseSchedule(value).items.map((item) => item.plannedDate);
}

describe('schedule forecast', () => {
  it('returns no finish date when a course has no work', () => {
    const result = forecastCourseSchedule(input({ course: course({ workItems: [] }) }));
    expect(result.items).toEqual([]);
    expect(result.projectedFinishDate).toBeNull();
    expect(result.remainingCount).toBe(0);
  });

  it('projects remaining work onto successive valid course days', () => {
    const result = forecastCourseSchedule(input());
    expect(result.items.map((item) => [item.workItemId, item.plannedDate])).toEqual([
      ['work_1', '2026-09-02'],
      ['work_2', '2026-09-04'],
      ['work_3', '2026-09-07'],
    ]);
    expect(result.projectedFinishDate).toBe('2026-09-07');
  });

  it('uses the latest actual completion date when all work is complete', () => {
    const result = forecastCourseSchedule(input({
      completions: [
        { workItemId: 'work_1', completedDate: '2026-09-01' },
        { workItemId: 'work_2', completedDate: '2026-09-03' },
        { workItemId: 'work_3', completedDate: '2026-09-02' },
      ],
    }));
    expect(result.items.every((item) => item.status === 'completed')).toBe(true);
    expect(result.projectedFinishDate).toBe('2026-09-03');
  });

  it('starts a future academic year at the actual year start, not today', () => {
    const result = forecastCourseSchedule(input({
      today: '2026-03-10',
      academicYear: { ...academicYear, startDate: '2026-09-01' },
    }));
    expect(result.items.at(0)?.plannedDate).toBe('2026-09-02');
  });

  it('does not manufacture dates for inactive or unscheduled courses', () => {
    const inactive = forecastCourseSchedule(input({ course: course({ active: false }) }));
    expect(inactive.items.every((item) => item.plannedDate === null && item.unplannedReason === 'inactive_course')).toBe(true);
    expect(inactive.projectedFinishDate).toBeNull();

    const unscheduled = forecastCourseSchedule(input({ course: course({ meetingDays: [] }) }));
    expect(unscheduled.items.every((item) => item.plannedDate === null && item.unplannedReason === 'unscheduled_course')).toBe(true);
    expect(unscheduled.projectedFinishDate).toBeNull();
  });

  it('skips household breaks inclusively', () => {
    const breaks: ForecastBreak[] = [{
      id: 'labor_week',
      startDate: '2026-09-02',
      endDate: '2026-09-07',
      scope: 'household',
    }];
    expect(plannedDates(input({ breaks }))).toEqual(['2026-09-09', '2026-09-11', '2026-09-14']);
  });

  it('applies learner-specific breaks only to the matching learner', () => {
    const breaks: ForecastBreak[] = [{
      id: 'avery_break',
      startDate: '2026-09-02',
      endDate: '2026-09-02',
      scope: 'learner',
      learnerId: 'avery',
    }];
    const avery = forecastCourseSchedule(input({ breaks }));
    const jordan = forecastCourseSchedule(input({ breaks, course: course({ id: 'jordan_math', learnerId: 'jordan' }) }));
    expect(avery.items.at(0)?.plannedDate).toBe('2026-09-04');
    expect(jordan.items.at(0)?.plannedDate).toBe('2026-09-02');
  });

  it('rolls incomplete current-week work forward from current reality', () => {
    const result = forecastCourseSchedule(input({ today: '2026-09-04' }));
    expect(result.items.map((item) => item.plannedDate)).toEqual(['2026-09-04', '2026-09-07', '2026-09-09']);
  });

  it('plans from the next valid week on a weekend without double-counting unfinished work', () => {
    const weekend = forecastCourseSchedule(input({ today: '2026-09-05' }));
    const repeated = forecastCourseSchedule(input({ today: '2026-09-05' }));
    expect(weekend.items.map((item) => item.plannedDate)).toEqual(['2026-09-07', '2026-09-09', '2026-09-11']);
    expect(repeated).toEqual(weekend);
  });

  it('recomputes future work after an item is completed today', () => {
    const before = forecastCourseSchedule(input({ today: '2026-09-02' }));
    expect(before.items.at(0)?.plannedDate).toBe('2026-09-02');

    const after = forecastCourseSchedule(input({
      today: '2026-09-02',
      completions: [{ workItemId: 'work_1', completedDate: '2026-09-02' }],
    }));
    expect(after.items.at(0)).toMatchObject({ status: 'completed', actualCompletedDate: '2026-09-02', plannedDate: null });
    expect(after.items.at(1)?.plannedDate).toBe('2026-09-04');
    expect(after.items.at(2)?.plannedDate).toBe('2026-09-07');
  });

  it('keeps a back-dated completion as historical truth without moving the forecast backward', () => {
    const result = forecastCourseSchedule(input({
      today: '2026-09-09',
      completions: [{ workItemId: 'work_1', completedDate: '2026-09-02' }],
    }));
    expect(result.items.at(0)).toMatchObject({ status: 'completed', actualCompletedDate: '2026-09-02' });
    expect(result.items.at(1)?.plannedDate).toBe('2026-09-09');
    expect(result.items.at(2)?.plannedDate).toBe('2026-09-11');
  });

  it('preserves household and co-op source authority in the same Today projection', () => {
    const householdForecast = forecastCourseSchedule(input({
      today: '2026-09-02',
      course: course({ workItems: [{ id: 'home_1', order: 1, title: 'Household lesson' }] }),
    }));
    const coopForecast = forecastCourseSchedule(input({
      today: '2026-09-02',
      course: course({
        id: 'coop_science',
        title: 'Co-op Science',
        sourceAuthority: coopAuthority,
        workItems: [{ id: 'coop_1', order: 1, title: 'Co-op lab', sourceAuthority: coopAuthority }],
      }),
    }));
    const today = buildTodayReview([householdForecast, coopForecast], '2026-09-02');
    expect(today).toHaveLength(2);
    expect(today.find((entry) => entry.workItemId === 'home_1')?.sourceAuthority).toEqual(householdAuthority);
    expect(today.find((entry) => entry.workItemId === 'coop_1')?.sourceAuthority).toEqual(coopAuthority);
  });

  it('produces identical projections for identical offline/server inputs', () => {
    const source = input({
      today: '2026-09-04',
      breaks: [{ id: 'day_off', startDate: '2026-09-07', endDate: '2026-09-07', scope: 'household' }],
      completions: [{ workItemId: 'work_1', completedDate: '2026-09-02' }],
    });
    const offline = forecastCourseSchedule(source);
    const server = forecastCourseSchedule(structuredClone(source));
    expect(server).toEqual(offline);
  });

  it('returns no finish date when the academic year cannot fit all remaining work', () => {
    const result = forecastCourseSchedule(input({
      academicYear: { ...academicYear, endDate: '2026-09-04' },
    }));
    expect(result.items.at(0)?.plannedDate).toBe('2026-09-02');
    expect(result.items.at(1)?.plannedDate).toBe('2026-09-04');
    expect(result.items.at(2)).toMatchObject({ plannedDate: null, unplannedReason: 'academic_year_exhausted' });
    expect(result.projectedFinishDate).toBeNull();
  });

  it('fails closed for invalid dates, unknown completion IDs, and duplicate completion records', () => {
    expect(() => forecastCourseSchedule(input({ today: '2026-02-31' }))).toThrowError(ScheduleForecastError);
    expect(() => forecastCourseSchedule(input({ completions: [{ workItemId: 'missing', completedDate: '2026-09-01' }] }))).toThrow(/unknown work item/);
    expect(() => forecastCourseSchedule(input({ completions: [
      { workItemId: 'work_1', completedDate: '2026-09-01' },
      { workItemId: 'work_1', completedDate: '2026-09-02' },
    ] }))).toThrow(/duplicate completion/);
  });
});
