# v10.33 — Repository + Demo Foundation

## Product changes

- Added a persistent public-demo notice explaining that all learners are fictional and all changes remain browser-local.
- Added **Load Demo Family**, which installs a deterministic active synthetic scenario for Jordan and Avery.
- Added **Reset Demo Data**, which restores a deterministic clean synthetic state.
- Added the same controls to the adult Data / Setup screen.
- Added an in-app v10.33 release note and stable `data-release="v10.33"` marker.

## Engineering changes

- Kept the sanitized v10.32 HTML immutable.
- Added a deterministic v10.33 release builder and current-release pointer.
- Added exact SHA-256 and byte validation for the generated single-file output.
- Added Playwright tests for demo loading, reset repeatability, persistence, and v10.33 dock ownership.
- Published the validated single-file release as a GitHub Actions artifact.

## Privacy boundary

The public build contains only Demo Family, Jordan, Avery, and Guest Student. It has no accounts, telemetry, tracking, cloud student records, or required backend.

## Validation contract

- Expected SHA-256: `cbf2ba20c3f22571b542e6980c70ea1a2d924ce512c1ecfb71df051dbcefb9c7`
- Expected bytes: `5278792`
- Expected dock owner: `BLHMobileDock@v10.33`
- Expected title: `Beaufort Learning Harbor v10.33`
