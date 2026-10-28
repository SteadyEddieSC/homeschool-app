CREATE TABLE adult_accounts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  created_at TEXT NOT NULL
);

CREATE TABLE household_adults (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  adult_id TEXT NOT NULL REFERENCES adult_accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'adult')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (household_id, adult_id)
);
CREATE INDEX household_adults_by_adult ON household_adults(adult_id, household_id);

CREATE TABLE learners (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  preferred_name TEXT NOT NULL CHECK (length(preferred_name) BETWEEN 1 AND 120),
  grade_band TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX learners_by_household ON learners(household_id, status, id);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  created_at TEXT NOT NULL
);

CREATE TABLE organization_adults (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  adult_id TEXT NOT NULL REFERENCES adult_accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'instructor', 'admin')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, adult_id)
);
CREATE INDEX organization_adults_by_adult ON organization_adults(adult_id, organization_id);

CREATE TABLE academic_years (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  instructional_day_target INTEGER NOT NULL DEFAULT 180 CHECK (instructional_day_target BETWEEN 1 AND 366),
  record_pack TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  CHECK (starts_on <= ends_on)
);
CREATE INDEX academic_years_by_household ON academic_years(household_id, starts_on);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX courses_by_learner_year ON courses(learner_id, academic_year_id);

CREATE TABLE class_sections (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX classes_by_org ON class_sections(organization_id, id);

CREATE TABLE class_enrollments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  granted_by_adult_id TEXT NOT NULL REFERENCES adult_accounts(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TEXT NOT NULL,
  UNIQUE (class_id, learner_id)
);
CREATE INDEX enrollments_by_household ON class_enrollments(household_id, status, class_id);
CREATE INDEX enrollments_by_class ON class_enrollments(class_id, status, learner_id);

CREATE TABLE work_items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  due_on TEXT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in-progress', 'ready-for-review', 'completed', 'returned')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  assigned_by_adult_id TEXT NOT NULL REFERENCES adult_accounts(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX work_items_by_household_day ON work_items(household_id, due_on, status);
CREATE INDEX work_items_by_learner_day ON work_items(learner_id, due_on, status);

CREATE TABLE work_logs (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in-progress', 'ready-for-review', 'completed', 'returned')),
  note TEXT NOT NULL DEFAULT '',
  recorded_by_adult_id TEXT NOT NULL REFERENCES adult_accounts(id),
  occurred_at TEXT NOT NULL
);
CREATE INDEX work_logs_by_household_item ON work_logs(household_id, work_item_id, occurred_at);
CREATE INDEX work_logs_by_household_time ON work_logs(household_id, occurred_at, learner_id);

CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
  attended_on TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 1440),
  note TEXT NOT NULL DEFAULT '',
  recorded_by_adult_id TEXT NOT NULL REFERENCES adult_accounts(id),
  created_at TEXT NOT NULL,
  UNIQUE (learner_id, attended_on)
);
CREATE INDEX attendance_by_household_date ON attendance_records(household_id, attended_on, learner_id);

CREATE TABLE evidence_metadata (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  work_item_id TEXT REFERENCES work_items(id) ON DELETE SET NULL,
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('text', 'link', 'object-reference')),
  label TEXT NOT NULL,
  reference TEXT NOT NULL,
  submitted_by_adult_id TEXT NOT NULL REFERENCES adult_accounts(id),
  created_at TEXT NOT NULL
);
CREATE INDEX evidence_by_household_learner ON evidence_metadata(household_id, learner_id, created_at);

CREATE TABLE adult_reviews (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence_metadata(id) ON DELETE CASCADE,
  reviewer_adult_id TEXT NOT NULL REFERENCES adult_accounts(id),
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'returned')),
  feedback TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX reviews_by_household_evidence ON adult_reviews(household_id, evidence_id, created_at);

CREATE TABLE class_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  due_on TEXT,
  assigned_by_adult_id TEXT NOT NULL REFERENCES adult_accounts(id),
  created_at TEXT NOT NULL
);
CREATE INDEX assignments_by_class ON class_assignments(class_id, due_on, id);
CREATE INDEX assignments_by_due_date ON class_assignments(due_on, class_id);

CREATE TABLE class_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES class_assignments(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  enrollment_id TEXT NOT NULL REFERENCES class_enrollments(id),
  result TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE (assignment_id, learner_id)
);
CREATE INDEX submissions_by_class ON class_submissions(class_id, submitted_at, learner_id);

CREATE TABLE sync_operations (
  operation_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  claim_token TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- R2 stays an interface only in this local architecture proof. This pack is
-- descriptive configuration, not legal advice or a compliance certification.
CREATE TABLE record_pack_profiles (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  instructional_day_target INTEGER NOT NULL CHECK (instructional_day_target BETWEEN 1 AND 366),
  tracks_subject_activities INTEGER NOT NULL CHECK (tracks_subject_activities IN (0, 1)),
  tracks_portfolio_references INTEGER NOT NULL CHECK (tracks_portfolio_references IN (0, 1)),
  tracks_attendance INTEGER NOT NULL CHECK (tracks_attendance IN (0, 1)),
  tracks_individual_progress INTEGER NOT NULL CHECK (tracks_individual_progress IN (0, 1)),
  created_at TEXT NOT NULL
);
