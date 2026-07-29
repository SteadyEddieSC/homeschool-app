# Cloudflare Pages Demo

Planned configuration after the sanitized release artifact is committed:

- Framework preset: None
- Production branch: `main`
- Build command: `npm install && npm run verify:release`
- Build output directory: `site`
- Preview deployments: enabled
- Initial custom domain: none
- Data model: browser-local synthetic demo only

Protect previews with Cloudflare Access until the demo reset, privacy messaging, and automated browser checks are verified.
