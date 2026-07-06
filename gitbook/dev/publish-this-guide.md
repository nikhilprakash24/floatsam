# Publishing this guide

This guide is plain Markdown in `gitbook/` with a `.gitbook.yaml` at the repo root — **GitBook-ready via Git Sync**. Nothing to build; GitBook renders it directly from GitHub.

## One-time setup (~3 minutes, after the repo is on GitHub)

1. Sign in at **gitbook.com** (use the games GitHub account — "Sign in with GitHub" keeps it one identity).
2. **New Space** → name it (e.g. *Floatsam Guide*).
3. Space **⋯ menu → Synchronize with Git → GitHub** → authorize the GitBook app for the game repo only.
4. Pick the repo + `main` branch. GitBook finds `.gitbook.yaml` automatically:
   * `root: ./gitbook/` — only this folder is published
   * `README.md` → landing page, `SUMMARY.md` → the sidebar
5. Choose sync direction **GitHub → GitBook** (the repo stays the source of truth; edits happen in git, not the GitBook editor).
6. **Publish** the space (public link or unlisted) — Space settings → Publish.

Every push to `main` now republishes the guide automatically, screenshots included.

## Updating content

* Edit the Markdown under `gitbook/`, commit, push — done.
* New page? Add the file **and** a line in `SUMMARY.md` (GitBook's sidebar is explicit, not inferred).
* Visual changes in the game? `node scripts/capture-docs-shots.mjs` regenerates every screenshot deterministically, then commit the new PNGs.

## Gotchas

* Image paths are relative to the page (`../assets/foo.png` from a chapter) — GitBook and GitHub both render them, so the guide is fully readable in the repo too.
* Keep diagrams as **SVG files** in `assets/` (as done here) rather than Mermaid blocks — they render identically everywhere without a GitBook integration.
* `SUMMARY.md` group headings (`## Player guide`) become sidebar sections.
