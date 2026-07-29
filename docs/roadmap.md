# Beaufort Learning Harbor Roadmap

## v10.32 — Mobile Dock Stabilization

Completed: one authoritative student mobile dock with stable Learn, Practice, Quiz/Test, Proof, and Feedback actions; legacy competing dock creators neutralized; role visibility preserved.

## v10.33 — Repository and Demo Foundation

Completed:

- Sanitized immutable v10.32 baseline and reproducible v10.33 builder
- Full Playwright, mobile-dock, visual-capture, and axe-core CI
- Deterministic Load Demo Family and Reset Demo Data behavior
- Persistent public-demo privacy explanation and browser-local scenario status
- Versioned current-release manifest and downloadable CI artifact
- GitHub issue/PR release workflow

Cloudflare Pages preview connection remains an operational deployment step after the merged v10.33 build is green on `main`.

## v10.34 — Route and Role Regression Coverage

- Student navigation coverage for Learn, Practice, Quiz/Test, Proof, and Feedback
- Parent/Teacher/Director/Admin role-boundary checks
- Direct-route and return-navigation tests
- Mobile/tablet/desktop viewport matrix
- Real Android phone regression confirmation

## v10.35 — Versioned Data Adapter

- Formalize synthetic fixture schema
- Import/export round trips
- Migration tests for prior localStorage versions
- Scenario-loader adapter instead of release-specific demo mutation code

## Later releases

- Controlled module extraction behind regression coverage
- Screenshot comparison baselines
- Offline/network-blocked tests
- Firefox and WebKit coverage
- Protected Cloudflare preview and optional sanitized public demo
