// Scheduling behavior is adapted from mature School Desk edge-case semantics.
// This implementation is Learning Harbor-native TypeScript; see
// docs/v11/THIRD_PARTY_NOTICES.md for provenance and MIT notice.

export type IsoDate = string;
export type Weekday = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

const WEEKDAYS: readonly Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_LEARNING_DAYS: readonly Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FORECAST_DAYS = 3700;

export interface AcademicYear {
  readonly id: string;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
  readonly learningDays?: readonly Weekday[];
}

export interface HouseholdAuthority {
  readonly kind: 'household';
  readonly householdId: string;
}

export interface CoOpAuthority {
  readonly kind: 'coop';
  readonly householdId: string;
  readonly organizationId: string;
  readonly shareId: string;
}

export type SourceAuthority = HouseholdAuthority | CoOpAuthority;

export interface ForecastWorkItem {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly durationMinutes?: number;
  readonly resourceId?: string;
  readonly sourceAuthority?: SourceAuthority;
}

export interface ForecastCourse {
  readonly id: string;
  readonly learnerId: string;
  readonly title: string;
  readonly active: boolean;
  readonly meetingDays: readonly Weekday[];
  readonly sourceAuthority: SourceAuthority;
  readonly workItems: readonly ForecastWorkItem[];
}

export interface CompletionLog {
  readonly workItemId: string;
  readonly completedDate: IsoDate;
}

export interface ForecastBreak {
  readonly id: string;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
  readonly scope: 'household' | 'learner';
  readonly learnerId?: string;
}

export interface ForecastInput {
  readonly today: IsoDate;
  readonly academicYear: AcademicYear;
  readonly course: ForecastCourse;
  readonly completions: readonly CompletionLog[];
  readonly breaks?: readonly ForecastBreak[];
}

export type ForecastItemStatus = 'completed' | 'planned' | 'unplanned';
export type UnplannedReason = 'inactive_course' | 'unscheduled_course' | 'academic_year_exhausted';

export interface ForecastItemProjection {
  readonly workItemId: string;
  readonly courseId: string;
  readonly learnerId: string;
  readonly title: string;
  readonly order: number;
  readonly durationMinutes: number | null;
  readonly resourceId: string | null;
  readonly sourceAuthority: SourceAuthority;
  readonly status: ForecastItemStatus;
  readonly actualCompletedDate: IsoDate | null;
  readonly plannedDate: IsoDate | null;
  readonly unplannedReason: UnplannedReason | null;
}

export interface CourseForecast {
  readonly academicYearId: string;
  readonly courseId: string;
  readonly learnerId: string;
  readonly courseTitle: string;
  readonly sourceAuthority: SourceAuthority;
  readonly items: readonly ForecastItemProjection[];
  readonly completedCount: number;
  readonly remainingCount: number;
  readonly unplannedCount: number;
  readonly projectedFinishDate: IsoDate | null;
}

export interface TodayReviewItem {
  readonly date: IsoDate;
  readonly courseId: string;
  readonly learnerId: string;
  readonly workItemId: string;
  readonly title: string;
  readonly status: 'completed' | 'planned';
  readonly sourceAuthority: SourceAuthority;
}

export class ScheduleForecastError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ScheduleForecastError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function requireText(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ScheduleForecastError('INVALID_VALUE', `${path} is required`);
  return value.trim();
}

function parseDate(value: unknown, path: string): Date {
  const normalized = requireText(value, path);
  if (!ISO_DATE.test(normalized)) throw new ScheduleForecastError('INVALID_DATE', `${path} must use YYYY-MM-DD`);
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (toIsoDate(date) !== normalized) throw new ScheduleForecastError('INVALID_DATE', `${path} is not a calendar date`);
  return date;
}

function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseDate(value, 'date');
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function maxDate(...dates: readonly (IsoDate | null | undefined)[]): IsoDate | null {
  const present = dates.filter((value): value is IsoDate => typeof value === 'string');
  return present.length ? present.reduce((latest, value) => (value > latest ? value : latest)) : null;
}

function weekdayFor(value: IsoDate): Weekday {
  return WEEKDAYS[parseDate(value, 'date').getUTCDay()]!;
}

function uniqueWeekdays(values: readonly Weekday[] | undefined, fallback: readonly Weekday[] = []): readonly Weekday[] {
  const source = values ?? fallback;
  const seen = new Set<Weekday>();
  for (const value of source) {
    if (!WEEKDAYS.includes(value)) throw new ScheduleForecastError('INVALID_WEEKDAY', `Unsupported weekday: ${String(value)}`);
    seen.add(value);
  }
  return [...seen];
}

function normalizeAuthority(value: SourceAuthority, path: string): SourceAuthority {
  if (!value || typeof value !== 'object') throw new ScheduleForecastError('INVALID_AUTHORITY', `${path} is required`);
  const householdId = requireText(value.householdId, `${path}.householdId`);
  if (value.kind === 'household') return { kind: 'household', householdId };
  if (value.kind === 'coop') {
    return {
      kind: 'coop',
      householdId,
      organizationId: requireText(value.organizationId, `${path}.organizationId`),
      shareId: requireText(value.shareId, `${path}.shareId`),
    };
  }
  throw new ScheduleForecastError('INVALID_AUTHORITY', `${path}.kind is unsupported`);
}

function normalizeBreaks(values: readonly ForecastBreak[]): readonly ForecastBreak[] {
  return values.map((entry, index) => {
    const startDate = toIsoDate(parseDate(entry.startDate, `breaks[${index}].startDate`));
    const endDate = toIsoDate(parseDate(entry.endDate, `breaks[${index}].endDate`));
    if (endDate < startDate) throw new ScheduleForecastError('INVALID_BREAK', `breaks[${index}] ends before it starts`);
    if (entry.scope === 'learner' && !entry.learnerId) throw new ScheduleForecastError('INVALID_BREAK', `breaks[${index}].learnerId is required`);
    if (entry.scope !== 'household' && entry.scope !== 'learner') throw new ScheduleForecastError('INVALID_BREAK', `breaks[${index}].scope is unsupported`);
    return {
      id: requireText(entry.id, `breaks[${index}].id`),
      startDate,
      endDate,
      scope: entry.scope,
      learnerId: entry.scope === 'learner' ? requireText(entry.learnerId, `breaks[${index}].learnerId`) : undefined,
    } satisfies ForecastBreak;
  });
}

function dateIsBreak(date: IsoDate, learnerId: string, breaks: readonly ForecastBreak[]): boolean {
  return breaks.some((entry) => (
    entry.startDate <= date
    && date <= entry.endDate
    && (entry.scope === 'household' || entry.learnerId === learnerId)
  ));
}

function nextValidDate(input: {
  cursor: IsoDate;
  yearEnd: IsoDate;
  academicDays: ReadonlySet<Weekday>;
  courseDays: ReadonlySet<Weekday>;
  learnerId: string;
  breaks: readonly ForecastBreak[];
}): IsoDate | null {
  let date = input.cursor;
  for (let guard = 0; guard < MAX_FORECAST_DAYS && date <= input.yearEnd; guard += 1) {
    const weekday = weekdayFor(date);
    if (
      input.academicDays.has(weekday)
      && input.courseDays.has(weekday)
      && !dateIsBreak(date, input.learnerId, input.breaks)
    ) return date;
    date = addDays(date, 1);
  }
  return null;
}

export function forecastCourseSchedule(input: ForecastInput): CourseForecast {
  const today = toIsoDate(parseDate(input.today, 'today'));
  const yearStart = toIsoDate(parseDate(input.academicYear.startDate, 'academicYear.startDate'));
  const yearEnd = toIsoDate(parseDate(input.academicYear.endDate, 'academicYear.endDate'));
  if (yearEnd < yearStart) throw new ScheduleForecastError('INVALID_ACADEMIC_YEAR', 'academic year ends before it starts');

  const courseId = requireText(input.course.id, 'course.id');
  const learnerId = requireText(input.course.learnerId, 'course.learnerId');
  const courseTitle = requireText(input.course.title, 'course.title');
  const courseAuthority = normalizeAuthority(input.course.sourceAuthority, 'course.sourceAuthority');
  const academicDays = new Set(uniqueWeekdays(input.academicYear.learningDays, DEFAULT_LEARNING_DAYS));
  const courseDays = new Set(uniqueWeekdays(input.course.meetingDays));
  const breaks = normalizeBreaks(input.breaks ?? []);

  const workIds = new Set<string>();
  const workItems = input.course.workItems.map((entry, index) => {
    const id = requireText(entry.id, `course.workItems[${index}].id`);
    if (workIds.has(id)) throw new ScheduleForecastError('DUPLICATE_WORK_ITEM', `duplicate work item id: ${id}`);
    workIds.add(id);
    if (!Number.isInteger(entry.order) || entry.order < 0) throw new ScheduleForecastError('INVALID_ORDER', `course.workItems[${index}].order must be a non-negative integer`);
    if (entry.durationMinutes !== undefined && (!Number.isInteger(entry.durationMinutes) || entry.durationMinutes < 0)) {
      throw new ScheduleForecastError('INVALID_DURATION', `course.workItems[${index}].durationMinutes must be a non-negative integer`);
    }
    return {
      ...entry,
      id,
      title: requireText(entry.title, `course.workItems[${index}].title`),
      sourceAuthority: entry.sourceAuthority ? normalizeAuthority(entry.sourceAuthority, `course.workItems[${index}].sourceAuthority`) : courseAuthority,
    };
  }).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  const completionByWorkId = new Map<string, IsoDate>();
  input.completions.forEach((entry, index) => {
    const workItemId = requireText(entry.workItemId, `completions[${index}].workItemId`);
    if (!workIds.has(workItemId)) throw new ScheduleForecastError('UNKNOWN_COMPLETION', `completion references unknown work item: ${workItemId}`);
    if (completionByWorkId.has(workItemId)) throw new ScheduleForecastError('DUPLICATE_COMPLETION', `duplicate completion for work item: ${workItemId}`);
    completionByWorkId.set(workItemId, toIsoDate(parseDate(entry.completedDate, `completions[${index}].completedDate`)));
  });

  const latestCompletion = maxDate(...completionByWorkId.values());
  const remaining = workItems.filter((entry) => !completionByWorkId.has(entry.id));
  const plannedDates = new Map<string, IsoDate>();
  const unplannedReasons = new Map<string, UnplannedReason>();

  if (remaining.length) {
    if (!input.course.active) {
      remaining.forEach((entry) => unplannedReasons.set(entry.id, 'inactive_course'));
    } else if (!courseDays.size || !academicDays.size) {
      remaining.forEach((entry) => unplannedReasons.set(entry.id, 'unscheduled_course'));
    } else {
      let cursor = maxDate(today, yearStart)!;
      if (latestCompletion && latestCompletion >= cursor) cursor = addDays(latestCompletion, 1);
      for (const entry of remaining) {
        const plannedDate = nextValidDate({ cursor, yearEnd, academicDays, courseDays, learnerId, breaks });
        if (!plannedDate) {
          unplannedReasons.set(entry.id, 'academic_year_exhausted');
          continue;
        }
        plannedDates.set(entry.id, plannedDate);
        cursor = addDays(plannedDate, 1);
      }
    }
  }

  const items: ForecastItemProjection[] = workItems.map((entry) => {
    const actualCompletedDate = completionByWorkId.get(entry.id) ?? null;
    const plannedDate = plannedDates.get(entry.id) ?? null;
    const unplannedReason = unplannedReasons.get(entry.id) ?? null;
    return {
      workItemId: entry.id,
      courseId,
      learnerId,
      title: entry.title,
      order: entry.order,
      durationMinutes: entry.durationMinutes ?? null,
      resourceId: entry.resourceId ?? null,
      sourceAuthority: entry.sourceAuthority,
      status: actualCompletedDate ? 'completed' : plannedDate ? 'planned' : 'unplanned',
      actualCompletedDate,
      plannedDate,
      unplannedReason,
    };
  });

  const completedCount = completionByWorkId.size;
  const unplannedCount = unplannedReasons.size;
  const projectedFinishDate = workItems.length === 0
    ? null
    : remaining.length === 0
      ? latestCompletion
      : unplannedCount > 0
        ? null
        : maxDate(...plannedDates.values());

  return {
    academicYearId: requireText(input.academicYear.id, 'academicYear.id'),
    courseId,
    learnerId,
    courseTitle,
    sourceAuthority: courseAuthority,
    items,
    completedCount,
    remainingCount: remaining.length,
    unplannedCount,
    projectedFinishDate,
  };
}

export function buildTodayReview(forecasts: readonly CourseForecast[], dateValue: IsoDate): readonly TodayReviewItem[] {
  const date = toIsoDate(parseDate(dateValue, 'date'));
  const items: TodayReviewItem[] = [];
  for (const forecast of forecasts) {
    for (const item of forecast.items) {
      if (item.actualCompletedDate === date) {
        items.push({
          date,
          courseId: item.courseId,
          learnerId: item.learnerId,
          workItemId: item.workItemId,
          title: item.title,
          status: 'completed',
          sourceAuthority: item.sourceAuthority,
        });
      } else if (item.plannedDate === date) {
        items.push({
          date,
          courseId: item.courseId,
          learnerId: item.learnerId,
          workItemId: item.workItemId,
          title: item.title,
          status: 'planned',
          sourceAuthority: item.sourceAuthority,
        });
      }
    }
  }
  return items.sort((left, right) => (
    left.learnerId.localeCompare(right.learnerId)
    || left.courseId.localeCompare(right.courseId)
    || left.workItemId.localeCompare(right.workItemId)
  ));
}
