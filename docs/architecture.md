# Architecture

## Current release model

The validated application remains a single HTML release under `source/releases/<version>/`. The build copies the selected immutable release into `site/index.html` for local testing and Cloudflare Pages.

## Controlled module extraction

Future releases will extract code behind these boundaries:

1. app shell and role session
2. navigation and routing
3. learning/content presentation
4. assessment and evidence
5. portfolio and records
6. adult workflows
7. versioned data/import/export
8. shared UI and utilities

The project must continue producing a downloadable single-file artifact after source modules are introduced.
