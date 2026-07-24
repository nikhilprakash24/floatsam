# Obstacles / Difficulty / AI — Program Log & Meta-Commentary

A running log of the obstacles-difficulty-AI program. Newest first. Each entry = what happened, why, and the honest meta-commentary.

---

## 2026-07-13 — O0: design workflow, adversarially verified, corrected

**What.** Ran a 23-agent design workflow (`wf_b58683e9-c0c`): 5 subsystem maps → 4 parallel designs (difficulty curve · obstacle system · AI/bot · testing sandboxes) → each design adversarially verified through 3 lenses (determinism · fairness · integration) → synthesis → critique. Produced [OBSTACLES_DIFFICULTY_AI_PLAN.md](OBSTACLES_DIFFICULTY_AI_PLAN.md).

**Status of the program:** PLAN complete and corrected. No production code yet (by design — the review changed the architecture). Next: O1 difficulty pure module, O2 corridor solver.

**The headline result — the review earned its keep.** Verification returned **major-flaws on 3 of the 4 designs**, and they all failed the *same way*: they proved fairness **empirically** (a bot clears N seeds; per-piece force clamps bound each current) when the owner asked for fairness **by construction**. The sharpest line, from the AI verifier: *"a bot clearing 10k seeds is sampling, not a proof — seed 10,001 can still contain an unescapable state."* That is exactly right, and it would have been an expensive lesson to learn in code.

**What the adversarial pass caught that a single pass would have shipped:**
- **Per-piece clamps don't compose.** A current within its clamp + an obstacle within its AABB + a gate gap can still jointly leave zero feasible trajectory. Escapability is a property of the *joint* geometry over traversal time, not of each piece being individually bounded.
- **Temporal desync.** Obstacles were placed against the field state *at spawn* (right edge) but traversed *seconds later*, after cells scrolled and a surge could fire. The co-solve was against the wrong world.
- **Geometric ≠ dynamical.** "A gap exists in `[lo,hi]`" ≠ "the weakest body can *be* there given its entry velocity and clamps."
- **The fissure ate its own mechanic.** `buildZoneUpdraft(rectW,…)` made the lift zone identical to the kill rect — "ride the current *beside* the plume" was false; the only lift was inside the death box. Two independent verifiers caught this.
- **"Weakest character" is multi-dimensional.** Weakest-in-rise ≠ weakest-in-sink. One "weakest" bot clearing everything proves nothing about a course that stresses a different axis.
- **The validation was vacuous.** The existing fairness bots track only the gate center and are *blind to obstacles*; "0 failures with obstacles=true" was guaranteed by construction and proved nothing.
- Plus a stack of concrete integration bugs the maps grounded precisely: constructor ordering (obstacle spawner built before gates exist), the single `extra` slot causing a **double-clamp → 2× escape budget** hole, a hook that can't be one collision mask, and a new config file that would have overwritten the shipped tuning-locked `difficulty.json`.

**The correction (now the plan's keystone):** a real **Reachable Corridor solver** — a constructed spine + dynamically-flyable tube that every hazard is placed *outside* of, co-scheduled on the gate x-grid so there's no temporal drift. The AI is demoted from *guarantee* to *falsifier*: it tries to break the construction, and a bot failure escalates search before it's ever called "unfair." This is the single most important design change and it came entirely from the adversarial layer.

**Meta on process.** The workflow hit the session usage limit with 17/23 agents done — the synthesis and critique agents died. But every completed agent's output was in `journal.jsonl`, so the 4 designs + 8 verdicts were fully recovered and synthesized by hand. Net: the failure cost nothing but a manual synthesis pass, which was *better* — full visibility let me make the hard architectural call (corridor solver over bot-sweep) that a synthesis agent might have smoothed over. Lesson logged: long fan-out workflows should checkpoint the synthesis input, which the journal already does.

**Honest state of confidence.** The plan is sound and the fairness model is now constructively grounded, but the **corridor solver is unbuilt and is the hardest new code in the whole game** (R1). Everything is staged so the two riskiest pieces (O2 corridor, O8 free-x 2D) are isolated, pure, and independently testable before any of it touches play. Fixed-x Dive obstacles ship before free-x Power Dive obstacles on purpose.

---

*Log convention: one dated entry per increment; keep the meta honest — what the step got right, what it punted, and what we're still unsure of.*
