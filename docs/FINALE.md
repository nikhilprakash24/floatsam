# FINALE — the last-day-of-Fable battle plan
**Branch:** `finale` (main stays stable & deployed; merge increments only when green) · **Window:** ~1 day
**Rule of engagement:** graphics first (owner priority), everything ships behind the existing quality gates (suite green, golden untouched, fx/reduced-motion tiers respected). Owner picks & reorders freely — this is a menu, not a contract.

## Tier A — GRAPHICS OVERHAUL (the priority)
| # | Item | Payoff | Cost |
|---|---|---|---|
| A1 | **Depth-gradient water** (light near surface → abyssal below) + surface shimmer band | whole game instantly reads "ocean" | S |
| A2 | **Reef variety**: 3 column palettes/coral layouts, swapped per gate recycle; swaying kelp sprites in midground | kills the repeated-pipe look | S |
| A3 | **WebGL postFX**: camera vignette (replaces static texture), subtle glow on light shafts — tiered off on weak GPUs / reduced-motion | free "lighting pass" | S |
| A4 | **Death burst** (bubble explosion + creature spin during slow-mo drift) + per-character trail colors | juice where it matters most | S |
| A5 | **Plankton motes** — slow parallax drift specks | depth & life | S |
| A6 | **Animated creatures**: 2–3 frame swim cycles + nose-down dive pose per creature (procedural frames) | biggest single visual upgrade | **L** |
| A7 | **Mode water grading**: Classic neutral · Dive deeper/cooler · Power Dive warmer/current-lit | modes feel like places | S |
| A8 | Menu title treatment (wave motion, bubbles rising through letters) + card portrait polish | first impression | M |

## Tier B — SPRINT 2 CORE (the plan of record)
| B1 | Feel-sim suite (§4.1 numeric targets: Otter tap-rate, Dive depth-hold, reversal fight) | M |
| B2 | **Currents inside Power Dive** — drifting zones + Lab-style telegraph arrows, fairness re-swept | **L** |
| B3 | Public Currents mode from graduated Lab presets | M |

## Tier C — DETERMINISM FREEBIES (cheap because the sim is replayable)
| C1 | **Replay ghost** — race a translucent recording of your best run (record tap frames, replay in parallel sim) | M |
| C2 | **Daily seed** — same course for everyone each day, menu button | S |
| C3 | Stats panel (per mode/creature/tempo bests in one screen) | S |

## Tier D — DISTRIBUTION / PERF
| D1 | GitBook connect (3-min owner click-through) | owner |
| D2 | Android TWA package attempt (PWA → Play-ready .aab via Bubblewrap) | M |
| D3 | Perf 61→85+: splash + deferred Phaser boot, prune unused engine modules | M |

## Wildcard ideas (taking votes)
Screenshot/share button (canvas snapshot + score card) · near-miss slow-mo flourish · colorblind-safe gate lips · Lab "photo mode" · seasonal palettes · creature-unlock celebration animation · CRT/retro filter toggle · background whale silhouette fly-by (rare event).

## Suggested day plan (if owner just says "go")
1. **A1+A2+A3+A4+A5+A7 now** (this increment) → screenshots → owner eyeball
2. **A6 animated creatures** (the big one) → screenshots regen → merge to main = *visible new game*
3. **B2 currents in Power Dive** (+B1 feel sims inside it)
4. **C1 ghost or C2 daily seed** as the cherry
5. Merge green increments to main continuously; final tag **v0.7.0** + Handoff v3 before Fable signs off.
