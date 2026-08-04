# Evidence, Knowledge Checks, and Weekly Planning

## Objective knowledge checks

A Knowledge Check belongs to one learner and one Quiz / Test Today item. Questions are limited to multiple choice and true/false in beta.3. Every question carries an explicit correct option. The scoring function compares submitted option indexes to that answer key and records a per-question result.

The result is a tool result only. It does not create or imply a grade, mastery decision, attendance record, XP award, portfolio approval, or automatic completion. The associated Today item enters adult review with the score in its learner note.

## Subjective proof

Proof is learner-authored evidence and is not objectively scored. A submission records its evidence kind, content, note, revision number, prior submission, and review state.

The only review states are:

- `pending`
- `accepted`
- `returned`

Returning proof requires adult feedback. A later learner revision creates a new record linked to the returned submission. Accepting proof is the explicit adult action that completes the associated reviewed Today item.

## Weekly plans

A weekly plan belongs to one household and starts on a specific date. Plan items must fall from the start date through six days later. They identify a learner, date, title, and activity type. They may later reference a Today item, but planning alone does not create a learning outcome.

## Local and hosted behavior

Beta.3 is fully usable in Local preview. `?sync-sim=1` exercises stable operation IDs and the beta.2 queue without transmitting data. Real hosted beta.3 writes remain blocked until beta.4 adds and validates a hosted repository implementation.

## Recovery

Encrypted beta.3 backups include the application-owned learning studio store. Valid beta.2 backups can be restored after preview; beta.3 initializes their studio store empty. Credentials, sessions, provider secrets, OAuth/BAND tokens, and active invitation tokens remain excluded.
