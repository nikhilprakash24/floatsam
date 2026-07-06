# Tempo & best scores

## Tempo

Before choosing a mode you pick the world's speed:

| Tempo | Multiplier | Who it's for |
|---|---|---|
| **Base** | ×1.0 | The tuned, canonical experience |
| **Faster** | ×1.2 | You've cleared 20+ gates and want pressure |
| **Turbo** | ×1.4 | A reflex test |

Tempo scales scroll speed only — your creature's physics is untouched. The level generator automatically tightens its fairness constraints as the world speeds up (less time between gates = smaller allowed altitude jumps), so faster is *harder but never impossible*: all three tempos are bot-verified clearable.

## Best scores

Every combination keeps its own persisted best: **3 modes × 4 creatures = 12 leaderboard slots** (per tempo choice, best is shared). You'll see the relevant best on the creature card, in the HUD, and on the game-over panel — "new best!" only fires against the combination you're actually playing.

Scores live in your browser's local storage (they survive reloads and offline play; clearing site data resets them).

## Seeded runs

Add `?seed=N` to the URL and the obstacle course is identical every run — same gaps, same order, on any machine. That's not a gimmick: the entire physics core is deterministic, which is how the game proves its fairness. Race a friend on seed 42.
