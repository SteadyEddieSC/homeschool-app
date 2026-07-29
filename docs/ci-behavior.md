# CI Behavior

The `Validate` workflow has two stages:

1. `foundation` always validates the repository contract and required files.
2. `browser` activates automatically when the sanitized v10.32 HTML artifact exists at the manifest path.

The browser stage builds the static site, checks integrity and privacy, installs Chromium, runs Playwright and axe-core tests, and uploads failure artifacts.
