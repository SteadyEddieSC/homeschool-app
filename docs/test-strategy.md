# Automated Test Strategy

## Layer 1: deterministic static checks

- repository foundation and required-file checks
- release SHA-256 and byte count
- generated output equality
- stable title/version markers
- authoritative mobile-dock owner and five required routes
- inline JavaScript syntax parsing
- privacy and common-secret scanning

## Layer 2: Playwright browser checks

- desktop and mobile Chromium smoke tests
- mobile dock node stability
- role and route regressions
- axe-core critical-violation gate
- screenshots, video, and traces retained on failure

## Layer 3: planned expansion

- screenshot comparison baselines after layout stabilization
- import/export round trips
- migration fixtures for prior localStorage schemas
- offline/network-blocked execution
- Firefox and WebKit projects
- Cloudflare preview smoke tests
