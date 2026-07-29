# v10.33.1 — Hero and Home Stability Patch

## Reported behavior

On a real Android phone, the version text in the hero bar blinked and parts of the main page appeared to change while idle. Demo loading/reset and the five bottom actions were otherwise working correctly.

## Root cause

Thirteen legacy compatibility layers still declared `VERSION='v10.32'`, and several timers or mutation observers repeatedly rewrote title/hero content. The largest loop came from a v10.24 cleanup routine that scanned every text-only element and assigned `textContent` even when replacing `v10.23 route QA` changed nothing. Its MutationObserver then scheduled the cleanup again. This repeatedly replaced the hero heading, version kicker, intro paragraph, document title, and other text nodes with identical content.

## Fix

- Align all thirteen legacy version declarations to v10.33.1.
- Make recurring title, badge, heading, intro, and kicker writes conditional.
- Change the v10.24 cleanup routine to write only when its replacement actually changes text.
- Add one authoritative hero owner: `BLHHero@v10.33.1`.
- Keep the mobile dock under `BLHMobileDock@v10.33.1`.
- Add Playwright coverage that observes the hero and home screen for four seconds after startup and fails on title/hero mutations or changing home content.

## Preserved behavior

- Load Demo Family and Reset Demo Data remain deterministic and browser-local.
- Public identities remain Demo Family, Jordan, Avery, and Guest Student.
- The five-action mobile dock retains Learn, Practice, Quiz/Test, Proof, and Feedback.
- The downloadable single-file/offline contract is unchanged.

## Artifact contract

- File: `beaufort_learning_harbor_v10_33_1.html`
- SHA-256: `cfdb6d1714f45a928ee67163e7efe72a300c93b94b4438de40153569e080f8c4`
- Bytes: `5282189`
- Title: `Beaufort Learning Harbor v10.33.1`
- Hero owner: `BLHHero@v10.33.1`
- Dock owner: `BLHMobileDock@v10.33.1`
