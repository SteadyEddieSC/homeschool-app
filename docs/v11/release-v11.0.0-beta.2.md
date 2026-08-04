# Beaufort Learning Harbor v11.0.0-beta.2

## Offline Queue, Recovery, and Preview Readiness

Beta 2 makes the beta.1 household workflow resilient without requiring a hosted Supabase project. Supported family actions remain immediately available in an application-owned local mirror and can later synchronize through ordered, idempotent operations.

## Added

- A persistent mutation queue for household creation, learner creation, Today assignment creation, and Today status transitions.
- Pending, Syncing, Failed, Completed, and Cancelled operation states.
- Stable operation identifiers and semantic fingerprints.
- Duplicate-action rejection before a second local record is created.
- Ordered reconnect processing and explicit Retry, Cancel, and Clear completed controls.
- Visible Local only, Cloud simulation, Cloud connected, Offline, Pending, Failed, and Synced states.
- Synchronization disablement while a hosted user is signed out.
- Local cloud simulation for exercising the queue without transmitting data.
- Client operation IDs for idempotent household, learner, and Today creation.
- Server-side Today transition receipts that make repeated delivery safe.
- One receipt and one audit event per accepted transition operation.
- Encrypted portable local-preview backups using PBKDF2 and AES-256-GCM.
- SHA-256 ciphertext verification before decryption.
- Backup record counts, source release, export time, and explicit exclusions.
- Restore preview and confirmation before replacement.
- A local emergency pre-restore snapshot.
- A non-overlapping mobile shell with navigation outside the scroll region.
- Browser and database tests for retry idempotency, duplicate prevention, reconnect processing, cancellation, wrong-passphrase denial, verified restore, and responsive presentation.

## Backup contents

The encrypted backup contains application-owned local preview records:

- organization and member metadata;
- household and learner profiles;
- Today items and local transition receipts;
- support tickets and messages;
- retained synchronization operations.

The backup explicitly excludes:

- Supabase sessions and credentials;
- passwords and password-recovery state;
- service-role keys and deployment secrets;
- BAND and OAuth tokens;
- active invitation tokens.

The passphrase is never stored in the backup or application. Losing the passphrase makes the backup unrecoverable.

## Synchronization behavior

### Local-only mode

When Supabase is not configured, changes are written to the local preview store and the interface says **Local only**. The application does not claim a cloud synchronization occurred.

### Cloud simulation mode

Adding `?sync-sim=1` to the local preview URL enables a no-transmission test target. Offline changes enter the queue, and reconnecting acknowledges them in order. This mode exists only for validation.

### Future hosted mode

After Supabase is configured, the local mirror remains available during interruptions. Supported mutations receive stable IDs, enter the queue, and synchronize in order. Database operation receipts prevent Today transitions from applying twice if delivery is retried.

## Preserved boundaries

- v10.43 remains the stable production and downloadable fallback.
- No hosted Supabase project is created or configured by this release.
- No Cloudflare deployment occurs automatically.
- No v10.43 data is migrated.
- No real family or learner data belongs in public fixtures or artifacts.
- Synchronization does not run while a hosted account is signed out.
- Restore never silently overwrites local records.
- Today items still contain no automatic grade, XP, attendance, mastery, or portfolio approval.
- BAND remains deferred.

## Recommended next action

When convenient, create the non-production Supabase project, run `supabase db push --dry-run`, review migrations `001–006`, and then conduct a bounded hosted household pilot using synthetic or disposable records. Use beta.2 synchronization status and encrypted recovery during that pilot.

## Next recommended release

`v11.0.0-beta.3 — Evidence, Knowledge Checks, and Family Planning`

Beta 3 should add objective knowledge checks, subjective proof/evidence review, and a weekly household planning workflow while preserving explicit adult authority and the beta.2 queue/recovery boundaries.
