# v10.33.1 — Hero and Home Stability Patch

## Reported behavior

On a real Android phone, the version text in the hero bar blinked and parts of the main page appeared to change while idle. Demo loading/reset and the five bottom actions were otherwise working correctly.

## Root cause

Thirteen legacy compatibility layers still declared `VERSION='v10.32'`. Several of those layers ran short-lived timers or mutation observers that repeatedly rewrote the document title, hero heading, version kicker, or role-home visibility. Two layers also kept replacing the versioned hero kicker with an unversioned phrase, producing a visible ping-pong with the current release owner. The mobile dock did not flicker because v10.32 had already consolidated that component under one owner; the hero had not received the same treatment.

## Fix

- Align all thirteen legacy version declarations to v10.33.1.
- Make recurring title, badge, heading, and kicker writes conditional instead of replacing identical text nodes.
- Align the final two unversioned kicker writers with `Offline-first learning harbor · v10.33.1`.
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
- SHA-256: `cf865083621407cb284d8088d16bb70c12200aa9c76294e25afd456384bc2157`
- Bytes: `5281852`
- Title: `Beaufort Learning Harbor v10.33.1`
- Hero owner: `BLHHero@v10.33.1`
- Dock owner: `BLHMobileDock@v10.33.1`
