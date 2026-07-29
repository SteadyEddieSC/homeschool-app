# One-time release artifact upload

The sanitized v10.32 HTML is intentionally not represented by a truncated or altered API payload. The expected file is:

`source/releases/v10.32/beaufort_learning_harbor_v10_32.html`

Expected integrity:

- SHA-256: `b01a707ba20a7f997b662f999ce25f2440b222cde30800f0efaf131da3b11036`
- Bytes: `5272653`
- Synthetic identities: Jordan, Avery, Guest Student

After the file is uploaded, `npm run verify:release` and the browser CI job will enforce its integrity, privacy, mobile-dock ownership, JavaScript syntax, Playwright smoke behavior, and axe-core gate.
