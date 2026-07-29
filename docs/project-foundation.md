# Project Foundation Decisions

## Source of truth

- GitHub repository and issues: durable product and engineering record
- ChatGPT project: planning, analysis, release preparation, and review
- Cloudflare Pages: sanitized demo deployment

## Branching

- `main` is the production-ready baseline
- use short-lived `agent/`, `fix/`, `feat/`, and `docs/` branches
- use pull requests even for solo development
- squash merge normal work

## Definition of done

A change is complete when its acceptance criteria are met, privacy impact is reviewed, relevant automated checks pass, mobile behavior is verified when affected, and the roadmap/release notes are updated.
