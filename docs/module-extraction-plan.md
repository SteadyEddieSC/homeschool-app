# Module Extraction Plan

Do not split the current application merely to make the repository look modular. Extract one boundary at a time only after relevant browser tests exist.

Recommended order:

1. shared utilities with no DOM ownership
2. data schema, migration, and import/export adapters
3. route registry and navigation helpers
4. mobile dock component
5. app shell and role session
6. assessment and evidence boundaries
7. portfolio and adult workflows
8. learning/content presentation

Every extraction must still produce the single-file release artifact and preserve offline behavior.
