# Cloudflare Readiness Gate

Connect Cloudflare Pages after:

- the sanitized HTML artifact is committed and integrity-verified
- Playwright smoke/mobile tests pass in GitHub Actions
- the critical axe-core gate is reviewed
- demo privacy language and reset behavior are present
- preview access policy is selected

Initial deployment should be a demo preview, not a cloud student-record system.
