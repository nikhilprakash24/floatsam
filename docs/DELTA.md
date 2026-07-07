# DELTA LOG
Rolling record of what changed between versions — the companion to `BRIEFING.md` (the meta view) and `DECISIONS.md` (the why). **Versioning policy:** pre-1.0 semver — *patch* = fixes only; *minor* = features or any behavior/save-format change (with migration notes); golden-master regeneration always = ADR + minor bump; breaking changes named here and in the tag message.

---

## v0.6.1 — the Fable audit fix batch (2026-07-06)
**Type:** patch (fixes only; no API/save-format breaks; golden master untouched by construction — all changes are scene/platform-level).
**Origin:** first full-codebase review under Fable (findings register: BRIEFING §7). Owner approved Q2 ("go").

| ID | Fix | Player-visible effect |
|---|---|---|
| F-1 | Ignore OS key auto-repeat in the keyboard handler | **Balance fix:** holding ↑ no longer grants unlimited climb in Classic — one press = one stroke |
| F-2 | Menu copy corrected to "3 modes · 4 creatures · 3 tempos" | honest menu |
| F-3 | `window.__sim` debug hook gated behind `?seed/?play/?debug` | no per-frame allocation in normal play (mobile perf hygiene) |
| F-4 | One-time migration of the legacy `uf.bestScore` into `uf.best.classic.seal` (never overwrites a newer keyed record) | pre-roster best scores reappear |
| F-5 | `prefers-reduced-motion` honored: no camera shake/flash, static light shafts, no menu-seal bob | accessibility |
| F-6 | PNG icon set (180 apple-touch / 192 / 512 maskable, full-bleed) generated from icon.svg + manifest/index wiring; `scripts/gen-icons.mjs` | proper Android/iOS install icons |
| H-1 | Coverage now enforced in CI (`vitest --coverage`, 80% floor on core) | — |
| H-3 | Service-worker cache name versioned (`uwflappy-v0.6.1`), bump-per-release policy noted | cleaner offline updates |

**Evidence:** typecheck clean · **98 unit/sim tests green** (4 new registry tests) · coverage on core 94.3% stmts / 85.8% branches / 90.1% funcs / 96.4% lines (floor 80, enforced) · **11/11 e2e green** · build 1.24 MB (<3 MB) · docs screenshots regenerated · golden master green (Classic(Seal) bit-identical).

**Explicitly not fixed (documented, deferred):** DEAD-phase seabed sink-through (cosmetic, golden-coupled — needs its own ADR if ever), sprite-vs-hitbox visual scale (by design), FSM PLAY→MENU path (when a quit button exists), ESLint/Prettier (H-2, optional), ARCHITECTURE v3.3 doc drift (planning-chat task).

---

## v0.6.0 — modes × characters × currents (2026-06-14)
G6 closed (80,000-run fairness matrix, 0 failures) · GameMode/CharacterProfile refactors (two bit-identical gates) · Dive + Power Dive modes · 4-creature trading-card roster · pace wrapper · Currents Lab (vector fields + visualizer) · button UI · GitBook guide + PDF/HTML exporters. ADRs 005–013.

## v0.3.0 — the original web release (2026-06-12)
Phases 1–3: Classic mode complete with sandbox, polish, synthesized audio, PWA; first 10k fairness sweep. ADRs 001–004.
