const rowsPerFamily = {
  adult_accounts: 2,
  households: 1,
  household_adults: 2,
  learners: 3,
  organization_adults: 2,
  academic_years: 1,
  courses: 18,
  class_enrollments: 6,
  work_items: 540,
  work_logs: 540,
  attendance_records: 540,
  evidence_metadata: 90,
  adult_reviews: 90,
  class_submissions: 72,
  record_pack_profiles: 1
};

// Approximate serialized row sizes for the normalized schema. The additional
// 35% factor accounts for SQLite record framing and B-tree indexes; it is a
// planning allowance, not a measured Cloudflare D1 file-size result.
const estimatedBytesPerRow = {
  adult_accounts: 80,
  households: 120,
  household_adults: 120,
  learners: 180,
  organizations: 80,
  organization_adults: 120,
  academic_years: 160,
  courses: 160,
  class_sections: 150,
  class_enrollments: 180,
  work_items: 300,
  work_logs: 200,
  attendance_records: 130,
  evidence_metadata: 220,
  adult_reviews: 180,
  class_assignments: 200,
  class_submissions: 180,
  sync_operations: 220,
  record_pack_profiles: 120
};

function model(families) {
  const learners = families * 3;
  const classes = Math.ceil(families * 0.3); // 30 co-op sections per 100 families.
  const rows = { ...Object.fromEntries(Object.keys(estimatedBytesPerRow).map((table) => [table, 0])) };
  for (const [table, count] of Object.entries(rowsPerFamily)) rows[table] = families * count;
  rows.organizations = families > 0 ? 1 : 0;
  rows.class_sections = classes;
  rows.class_assignments = classes * 12; // One assignment per month/section.
  rows.sync_operations = families * 1885 + classes * 13 + 1;
  const totalRows = Object.values(rows).reduce((sum, count) => sum + count, 0);
  const logicalBytes = Object.entries(rows).reduce((sum, [table, count]) => sum + count * estimatedBytesPerRow[table], 0);
  const estimatedBytes = Math.ceil(logicalBytes * 1.35);
  return { families, learners, classes, totalRows, logicalBytes, estimatedBytes, rows };
}

const scenarios = [25, 50, 100].map(model);
const report = {
  method: 'normalized row-count model with deterministic synthetic workload assumptions',
  assumptions: {
    adultsPerFamily: 2,
    learnersPerFamily: 3,
    instructionDaysPerLearnerPerYear: 180,
    familyWorkItemsPerLearnerPerYear: 180,
    workLogsPerLearnerPerYear: 180,
    attendanceRecordsPerLearnerPerYear: 180,
    evidenceAndAdultReviewsPerLearnerPerYear: 30,
    coursesPerLearner: 6,
    coOpSectionsPer100Families: 30,
    enrollmentsPerLearner: 2,
    assignmentsPerSectionPerYear: 12,
    submittedClassResultsPerLearnerPerYear: 24,
    operationReceiptsRetainedPerDomainWrite: 1,
    largeEvidenceBytesStoredInD1: 0
  },
  scenarios
};

console.log(JSON.stringify(report, null, 2));
