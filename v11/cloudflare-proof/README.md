# Learning Harbor local Cloudflare data-plane proof

This is an isolated architecture spike. It is not wired into the v11 preview, has no deploy script, and refuses API requests unless `APP_ENV=local-proof`. Wrangler runs the Worker and D1 locally; no account, token, remote database, R2 bucket, student identity, email provider, or real family data is used.

The synthetic `AdultIdentity` contract is a placeholder for a future authentication adapter. It deliberately does not claim production authentication, under-13 access, legal compliance, or co-op readiness.

## Run

From `v11/`:

```sh
npm install --no-package-lock
npm run d1:proof
```

The proof command creates a fresh temporary local D1 database, applies the migration, and runs the Worker in Miniflare without opening a network port. It drives a deterministic synthetic household → evidence review → explicit co-op share → class assignment/submission flow. It checks idempotent replay, household isolation, class-share authorization, and a visible stale-write conflict. The temporary database is removed at the end.

To inspect the model without running the proof, read `migrations/0001_household_first.sql` and `capacity-model.md`. `npm run d1:capacity-model` regenerates the first-pass row/storage estimates. The scale database-size and Cloudflare query-metadata run is still required before treating the free-tier estimate as accepted.

This is a schema/configuration proof for an optional South Carolina record pack (180 instructional-day target, subject/activity diary, portfolio references, attendance, and individual progress fields). It is not legal advice or a compliance certification.

The spike remains `$0` and local-only. A later Cloudflare account setup, hosted pilot, authentication choice, domain, migration, or production deployment requires a separate owner-approved decision.
