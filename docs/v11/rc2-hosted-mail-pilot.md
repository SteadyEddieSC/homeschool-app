# RC.2 Hosted Auth Mail Pilot

This runbook defines the bounded provider-backed email slice for Gate C. It is synthetic-only, non-production, and does not advance the application beyond `11.0.0-rc.1`.

The currently approved deployed application runtime for this slice is commit `138a33fe7703ce0c9729392f26f42d90bdb022df`. The protected workflow refuses to execute against a branch that differs from that deployment in runtime-affecting v11 files.

## Provider boundary

Supabase Auth is configured to use a Mailtrap Email Sandbox as custom SMTP. The sandbox captures messages instead of delivering them to public recipients.

The protected GitHub environment `v11-preview` owns these additional values:

- secret `PILOT_SUPABASE_SECRET_KEY` — dedicated server-side Supabase secret key used only to delete the synthetic Auth user after the test;
- secret `PILOT_MAILTRAP_API_TOKEN` — sandbox-scoped API token used only to read captured messages;
- variable `PILOT_MAILTRAP_ACCOUNT_ID` — Mailtrap account identifier required by the sandbox API;
- variable `PILOT_MAILTRAP_SANDBOX_ID` — Mailtrap sandbox/inbox identifier required by the sandbox API.

The workflow also reuses the already-protected preview URL, Supabase URL/publishable key, and disposable schema-verifier credentials. No SMTP username or SMTP password is copied into GitHub for this test; Supabase owns the SMTP configuration directly.

Never paste any protected value into chat, source control, workflow output, issue comments, pull-request comments, reports, or artifacts.

## What one run proves

The manual **Run v11 Hosted Mail Pilot** workflow requires the exact confirmation phrase `RUN_V11_HOSTED_MAIL_PILOT` and the `v11-preview` protected environment.

A passing run must prove, using one disposable synthetic adult identity:

1. the Mailtrap sandbox is readable with the bounded API token;
2. account creation is submitted through the deployed hosted UI;
3. Supabase custom SMTP delivers the confirmation message into the sandbox;
4. the confirmation link stays on the protected Supabase verification endpoint and redirects only to the isolated v11 preview origin;
5. the browser consumes that confirmation and establishes the expected hosted session;
6. the session can sign out;
7. password recovery is submitted through the deployed hosted UI with enumeration-safe user-facing copy;
8. an immediate duplicate recovery request is rejected with HTTP 429 instead of sending another recovery message;
9. Supabase custom SMTP delivers the recovery message into the sandbox;
10. the recovery link stays inside the same protected Supabase and preview boundaries;
11. the browser consumes the recovery link and enters the password-recovery UI;
12. the password is replaced through the hosted UI;
13. the prior password no longer authenticates;
14. the replacement password authenticates;
15. the final session signs out; and
16. the synthetic Supabase Auth user is deleted with the dedicated protected server-side key.

The intended run therefore causes at most two provider email deliveries: one confirmation and one recovery. The immediate duplicate recovery request must be rate-limited and must not be relied upon to create a third message.

## Privacy and evidence handling

The synthetic email address, generated passwords, Mailtrap message bodies, confirmation/recovery links, session values, user identifier, provider identifiers, and all credentials remain in process memory only. They are never written into the sanitized report or artifact.

The Mailtrap API token is intentionally read-only for this slice. Captured sandbox messages may therefore remain inside the provider sandbox after the workflow finishes. This is recorded explicitly as `sandboxMessagesProviderRetained: true`; it is not represented as mailbox cleanup. The links are single-use and the associated synthetic Auth user is deleted.

The sanitized evidence may contain only:

- release and exact Git commit markers;
- workflow-run identifier;
- bounded booleans for each tested behavior;
- HTTP 429 and a bounded provider error code for duplicate recovery;
- cleanup booleans;
- explicit boundary flags.

The validator rejects evidence containing email addresses, UUIDs, JWT-shaped values, verification URLs, privileged Supabase key material, Mailtrap API-token material, protected provider identifiers, or sensitive credential values.

## What this does not prove

A passing Mailtrap sandbox run does **not** prove delivery to a real external mailbox, sender-domain reputation, SPF/DKIM/DMARC effectiveness, production SMTP capacity, production readiness, production data authorization, real-family readiness, cutover approval, or complete Gate C.

Real-recipient delivery remains explicitly false for this evidence class. Production SMTP/domain work, if ever approved, belongs to a separate later decision.

## Runtime-equivalence stop condition

Before touching any provider, the workflow compares the current branch with the approved deployed runtime commit. It stops if deploy-affecting v11 files differ. Test scripts, protected workflows, validators, and documentation may advance without requiring another Cloudflare deployment; application runtime changes may not.

If the runtime-equivalence check fails, redeploy and revalidate the exact application head before collecting hosted email evidence.

## Release boundary

After this slice passes:

- package/runtime remains `11.0.0-rc.1`;
- PR #48 remains draft;
- Gate C remains incomplete until the other required hosted evidence classes and defect closure are complete;
- Gate D remains blocked;
- v10.43 remains the stable production/downloadable fallback;
- no production migration, DNS change, automatic promotion, or production cutover is authorized.
