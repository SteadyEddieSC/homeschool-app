# Evidence, Knowledge Checks, and Weekly Planning

## Objective knowledge checks

A Knowledge Check belongs to one learner and one Quiz / Test Today item. Questions are limited to multiple choice and true/false. Every question carries an explicit correct option. The scoring function compares submitted option indexes to that answer key and records a per-question result.

The result is a tool result only. It does not create or imply a grade, mastery decision, attendance record, XP award, portfolio approval, or automatic completion. The associated Today item enters adult review with the score in its learner note.

During hosted synchronization, the original local attempt UUID and operation UUID are preserved. Repeating the same operation returns the existing hosted attempt rather than creating another record.

## Subjective proof

Proof is learner-authored evidence and is not objectively scored. A submission records its evidence kind, content, note, revision number, prior submission, and review state.

The only review states are:

- `pending`
- `accepted`
- `returned`

Returning proof requires adult feedback. A later learner revision creates a new record linked to the returned submission. Accepting proof is the explicit adult action that completes the associated reviewed Today item.

Proof review remains constrained by an authenticated database function. Direct client updates cannot forge acceptance or return decisions.

## Weekly plans

A weekly plan belongs to one household and starts on a specific date. Plan items must fall from the start date through six days later. They identify a learner, date, title, and activity type. They may reference a Today item, but planning alone does not create a learning outcome. Both local validation and the database trigger reject an eighth-day item.

## Local-first and hosted behavior

Beta.4 remains fully usable in Local preview. `?sync-sim=1` exercises stable operation and record IDs without transmitting data.

When the owner later activates a non-production Supabase pilot:

1. authorized writes are committed to the application-owned local mirror;
2. the same stable operation enters the ordered queue;
3. synchronization remains disabled while signed out;
4. the hosted repository acknowledges the operation idempotently;
5. later reads reconcile hosted data with the local mirror.

A remote-only record can enter the local mirror, and an identical local/remote record can accept the hosted representation. A divergent record remains local and creates a visible conflict digest. Beta.4 never silently overwrites divergent local studio data.

## Recovery

Encrypted beta.4 backups include the application-owned learning studio store and queue. Valid beta.2 and beta.3 backups can be restored after verification and preview. Beta.2 backups initialize the studio store empty because those records did not yet exist.

Credentials, sessions, provider secrets, OAuth/BAND tokens, active invitation tokens, and hosted conflict diagnostics remain excluded. Conflict metadata is available separately through the sanitized pilot-diagnostic report, which excludes learner content and queue payloads.
