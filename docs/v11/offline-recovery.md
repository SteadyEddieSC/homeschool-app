# v11 Offline Queue and Recovery

## Purpose

Beta 2 separates three different states that must not be confused:

1. **Saved locally** — the current device has accepted the action.
2. **Waiting to synchronize** — the action has a stable operation ID and remains in the queue.
3. **Acknowledged remotely** — the cloud target accepted the operation or returned its existing idempotent result.

The interface never labels a local-only save as cloud synchronization.

## Supported queued operations

Only these bounded mutations enter the beta.2 queue:

- create household;
- create learner;
- create Today item;
- start, submit, complete, or return a Today item.

Support tickets, membership invitations, account recovery, uploads, and broader learning records are not silently added to this queue. Each new mutation family requires an explicit contract, conflict rule, privacy review, and test coverage.

## Operation lifecycle

### Pending

The local mirror contains the user-visible result, but the remote target has not acknowledged it.

### Syncing

The queue is sending the operation. Operations are processed in creation order.

### Failed

The last attempt returned an error. The record remains local, the error is retained in bounded form, and the user can Retry or Cancel.

### Completed

The remote target acknowledged the operation. The queue records the completion timestamp and last successful synchronization time.

### Cancelled

The user explicitly removed the operation from future synchronization. Cancelling does not silently delete the already-created local record. A later reconciliation workflow must decide whether to keep or remove that local-only record.

## Duplicate prevention

Before applying a new local mutation, beta.2 calculates a semantic fingerprint from the action's meaningful fields. If an equivalent Pending, Syncing, or Failed operation already exists, the second action is rejected before a duplicate local record is created.

Each accepted operation also receives a UUID. The hosted schema stores client operation IDs for creation records and a separate receipt for Today transitions.

Retrying the same Today transition:

- returns the already-produced Today item;
- does not apply the state transition twice;
- does not create a second audit event;
- rejects reuse of the same operation ID for a different action.

## Signed-out behavior

Hosted synchronization is disabled while the account is signed out. Local preview simulation can run without an account because it transmits nothing and exists solely for validation.

## Local cloud simulation

Append this query parameter to the local preview URL:

```text
?sync-sim=1
```

Simulation uses the real persistent queue and operation lifecycle but acknowledges operations locally. It does not contact Supabase or another provider.

Recommended simulation exercise:

1. Enable simulation.
2. Disconnect the browser network.
3. Create one household, learner, and Today item.
4. Confirm three Pending operations.
5. Attempt to repeat the same learner or assignment and confirm duplicate rejection.
6. Reconnect.
7. Confirm ordered completion and a last successful sync timestamp.
8. Repeat with a Pending operation and test Cancel.

## Encrypted backup format

The backup envelope uses:

- PBKDF2 with SHA-256;
- 120,000 derivation iterations;
- a random 128-bit salt;
- AES-256-GCM;
- a random 96-bit initialization vector;
- SHA-256 verification of the ciphertext.

AES-GCM also authenticates the ciphertext during decryption. The separate checksum allows the application to reject obvious corruption before spending time on key derivation and decryption.

## Restore workflow

1. Select an encrypted backup file.
2. Enter its passphrase.
3. Verify envelope schema and release compatibility.
4. Verify the ciphertext checksum.
5. Derive the decryption key and authenticate/decrypt the payload.
6. Validate record counts against the contained stores.
7. Display source release, export time, and counts.
8. Require an explicit replacement confirmation.
9. Save an emergency local pre-restore snapshot.
10. Replace only application-owned local stores and reload.

A malformed, unsupported, corrupted, or incorrectly decrypted file never changes local records.

## Recovery limitations

- The emergency pre-restore snapshot is stored on the same device and is not a substitute for the downloaded encrypted backup.
- Browser storage can be cleared by the user, device-management software, or browser policies.
- The beta.2 backup is intentionally release-specific. A future migration utility must explicitly support older backup schemas rather than guessing.
- Active invitation tokens are excluded and must be regenerated.
- Hosted database backup and restore are separate operational procedures to be added during the hosted pilot.

## Recommended next action

Create the non-production Supabase project later, review a migration dry run, and use these queue and recovery controls during a synthetic hosted household pilot.

## Next release

`v11.0.0-beta.3 — Evidence, Knowledge Checks, and Family Planning`.
