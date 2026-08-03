# v11 Hosted Preview Runbook

This runbook covers the account-owner actions required after alpha 2 is merged. The repository can validate and deploy the preview, but it cannot create or own external accounts on the user's behalf.

## 1. Create a Supabase preview project

Create a dedicated non-production Supabase project. Do not reuse a production database or a project containing real family information.

Record:

- project reference;
- HTTPS project URL;
- publishable browser key;
- database password for owner-controlled CLI linking;
- personal access token for owner-controlled remote migration workflows, when later enabled.

The service-role key is not needed by the browser and must not be placed in GitHub variables beginning with `VITE_`.

## 2. Apply the migrations

From `v11/`:

```bash
npm install --no-package-lock
npx supabase login
npx supabase link --project-ref PROJECT_REFERENCE
npx supabase db push --dry-run
npx supabase db push
```

Review the dry-run output before applying. Alpha 2 migrations create only application schema, policies, helper functions, invitations, and audit records.

## 3. Configure Supabase authentication

In the preview project:

1. Keep email/password sign-up enabled.
2. Require email confirmation before inviting outside testers.
3. Set the Site URL to the future v11 preview origin.
4. Add the preview origin to allowed redirect URLs.
5. Configure a recognizable sender before sending invitations to real addresses.
6. Keep anonymous sign-in disabled.
7. Do not enable social providers until their redirect and privacy boundaries are reviewed.

## 4. Create the protected GitHub environment

Create a GitHub Actions environment named exactly:

```text
v11-preview
```

Recommended environment protections:

- required reviewer: repository owner;
- prevent self-review when another trusted reviewer is available;
- deployment branch limited to `main`;
- no untrusted fork deployment.

Add environment secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
VITE_SUPABASE_PUBLISHABLE_KEY
```

Add environment variables:

```text
VITE_SUPABASE_URL
V11_PREVIEW_URL
```

The Cloudflare token should be scoped only to the intended account and Worker-edit permission needed for the isolated preview Worker.

## 5. Choose the preview URL

The Worker name is fixed:

```text
beaufort-learning-harbor-v11-preview
```

`V11_PREVIEW_URL` must be the HTTPS origin that will expose that Worker, without an application path. It may initially be a `workers.dev` address or a dedicated preview hostname.

Do not point the v10 production hostname to the v11 preview.

## 6. Run the manual deployment

From GitHub Actions, select **Deploy v11 Preview**, choose **Run workflow**, and select:

```text
DEPLOY_V11_PREVIEW
```

The workflow will:

1. install exact dependencies;
2. run TypeScript, boundary, and production-build checks;
3. validate all required protected values without printing them;
4. deploy only `beaufort-learning-harbor-v11-preview`;
5. verify `/api/health` returns alpha 2;
6. upload a deployment receipt.

If any required value is absent or unsafe, deployment stops before Wrangler runs.

## 7. Bootstrap the first organization

After deployment:

1. Create the first adult account.
2. Confirm the email address.
3. Sign in.
4. Select **Create a group**.
5. Enter the organization name and address.

That account becomes the first Group Administrator. It does not become a System Administrator.

## 8. Test with synthetic accounts first

Use non-personal synthetic test addresses or a controlled test-email domain. Validate at least:

- Group Administrator invitation creation and revocation;
- Parent, Teacher, Director, and Student invitation redemption;
- invitation expiration and replay denial;
- Student denial of membership administration;
- support ticket privacy and internal-note redaction;
- password recovery;
- sign-out and session renewal;
- mobile navigation on Pixel 7 dimensions.

Do not enter real student names, school records, accommodations, grades, or evidence during preview validation.

## 9. Rollback

The v10 application remains unchanged. To remove the hosted preview:

- disable or delete the isolated v11 preview Worker;
- remove its preview hostname;
- pause or delete the non-production Supabase project after exporting any required synthetic evidence;
- retain the deployment receipt and Git commit for audit history.

No v10 rollback is required because alpha 2 never changes the v10 Worker or stable release pointer.