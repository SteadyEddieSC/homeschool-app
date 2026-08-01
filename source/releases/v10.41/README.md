# Beaufort Learning Harbor v10.41

## Learner Route and Assignment Resolver

v10.41 centralizes learner-track matching, completion-aware next-assignment selection, direct assignment destination resolution, and safe route fallbacks behind one schema-1 module.

### Added

- `modules/learner-route-resolver.mjs`
- Lower/upper/exact learner target normalization
- Deterministic lower-track fallback for incomplete learner records
- First-unfinished, then first-matching assignment selection
- Direct assignment applicability enforcement
- Safe route-kind and Home fallbacks
- Duplicate, malformed, unsupported, dangerous, and polluted assignment diagnostics
- Read-only browser resolver/runtime surfaces
- Adult Route QA resolver explanations
- Node and desktop/touch-tablet/Pixel 7 regression coverage

### Preserved

- Existing Jordan and Avery Learn, Practice, Quiz/Test, Proof, and Feedback outcomes
- Student/adult role boundaries
- Local route completion markers as planning/QA only
- Formal quiz/test versus adult-reviewed proof separation
- Reward, attendance, mastery, portfolio, and source-record boundaries
- Deterministic single-file offline delivery
- Preliminary curriculum-source status without live pacing

### Artifact

The validated standalone artifact is `beaufort_learning_harbor_v10_41.html`. Its exact byte length and SHA-256 are recorded in `release.json` and verified by CI before publication.
