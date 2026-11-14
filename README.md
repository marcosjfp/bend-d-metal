# Bend Planner

Mobile-first web app for planning press brake work before it reaches the machine.
Default machine: **Ermaksan Speed-Bend Pro 4270×260** (4270 mm, 260 t) — editable on the Machine tab.

## What it does

| Tab | Purpose |
|---|---|
| **Part** | Draw the profile (flanges + bend angles, outside dimensions), pick material and thickness. Get the flat blank, V-die, inner radius, K-factor, minimum flange, force (t/m) and total press load, with warnings when the part exceeds the machine or tooling. |
| **Bends** | Side-view animation of each bend on the punch and die. Suggests a collision-free order with the fewest turn-overs, shows back-gauge side and distance, and lets you reorder steps by hand. |
| **Cut list** | Nests all blanks onto stock sheets (shear = straight edge-to-edge cuts, or laser/plasma) and shows sheets used and offcut. |
| **Machine** | Nameplate data, available V dies, punch type (straight / gooseneck), tool rating and the material library. |

Everything runs on the device and is saved in the browser. After the first visit it also works offline and can be added to the home screen.

## Formulas

- Force (air bending): `F [kN/m] = 1.42 · Rm · t² / V`
- Inner radius: `ri ≈ factor · V` (per material), never below the punch tip radius
- K-factor: `0.325 + 0.25 · log10(ri / t)`, clamped to 0.25–0.5
- Flat blank: `Σ outside flanges − Σ (2 · tan(β/2) · (ri + t) − β · (ri + K · t))`
- Default V: about 6× t (< 3 mm), 8× (3–10 mm), 10× (10–20 mm), 12× (> 20 mm), adjusted for short flanges and capacity

These are planning estimates. Confirm on a test piece; the controller handles springback.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test         # engine unit tests
npm run build    # static site in dist/
```

The `dist/` folder can be hosted on any static host.
