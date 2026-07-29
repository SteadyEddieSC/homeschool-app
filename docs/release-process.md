# Release Process

1. Create `agent/<description>` from `main`.
2. Make behavioral changes in a new versioned release path.
3. Update the release manifest, SHA-256, and byte count.
4. Run `npm run verify:release`.
5. Run Playwright smoke, mobile, accessibility, and visual tests.
6. Open a pull request with validation and privacy notes.
7. Squash merge after checks pass.
8. Tag the release after mobile verification.
9. Deploy the generated `site/` directory to the Cloudflare Pages demo.
