# Add a creature

A creature is **one JSON file + one procedural sprite + one registry line**. No engine code. The level generator derives a fair course for it automatically; your job is the identity and the sweep.

## 1. Create the profile

`src/config/characters/turtle.json`:

```json
{
  "id": "turtle",
  "name": "Turtle",
  "massScale": 1.2,
  "thrustScale": 0.85,
  "dragScale": 1.25,
  "buoyancyScale": 1.05,
  "hitboxRadius": 22,
  "card": {
    "number": "05",
    "role": "Tank",
    "rarity": "uncommon",
    "flavor": "Slow and steady. Mostly slow.",
    "traits": { "power": 2, "agility": 1, "glide": 2, "float": 4, "stealth": 2 }
  }
}
```

**What the scales do:** `massScale` divides all continuous forces (heavier = more sluggish); `thrustScale` multiplies stroke/lunge strength; `dragScale` thickens the water for this body; `buoyancyScale` biases float vs sink; `hitboxRadius` is the collision circle in px (Seal is 19.2). Card traits are presentation — curate them to *describe* the physics, 1–5.

## 2. Register it

In `src/core/character/CharacterProfile.ts`:

```ts
import turtleJson from '../../config/characters/turtle.json';
export const TURTLE: CharacterProfile = turtleJson as CharacterProfile;
export const CHARACTERS = [SEAL, OTTER, PUFFER, SEALION, TURTLE];
```

## 3. Draw the sprite

Add a `makeTurtle()` in `src/scenes/BootScene.ts` (Phaser Graphics → `generateTexture('turtle', w, h)` — copy the Otter's as a template). The texture key must equal the JSON `id`.

## 4. Tune by feel

`npm run dev` → `/?play=1&character=turtle` for each mode. The Sandbox (`/?scene=sandbox`) and the Currents Lab character switcher are your feel instruments.

## 5. Prove it's fair

The committed fairness matrix picks up new roster members automatically:

```bash
npm test        # runs 1,500 seeds × your creature × every mode
```

If a pair fails, don't touch the mode's difficulty files — adjust the *creature* (usually hitbox or thrust) or trust the derivation: `gapScaleFor` already widens gaps for big/strong bodies. Before shipping, run a full 10k sweep and record it in `docs/DECISIONS.md` — that's the house rule.
