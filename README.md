# Pokémon Region Builder

A web app for designing and organizing a custom Pokémon region — complete with an interactive map builder, a regional Pokédex, and consistency validation tools.

🌐 **[Try it live at felker.dev/pokemon-region-builder](https://felker.dev/pokemon-region-builder)**

---

## Overview

Ever visited a place and thought, *"this would make a great Pokémon region"?* This tool gives you everything you need to turn that idea into a structured, shareable region design — no coding required.

The app was originally built to support designing **Obbygor**, a fan-made region inspired by Iceland, and has been designed to make it easy to spin up new region ideas quickly.

---

## Features

### 🗺️ Map Builder

- Layered canvas with separate layers for **water**, **terrain**, **routes**, and **landmarks**
- Upload a reference image (e.g. a real-world map) to trace over, with support for scaling and rotation
- Terrain layer includes multiple colors and a fine-tuned brush
- Each landmark stores basic details and the Pokémon that can be encountered there

### 📖 Pokédex Builder

- Build and reorder a **regional dex** that mixes existing Pokémon and newly created ones
- Custom Pokémon support: define types, abilities, moves, and other details
- Switch freely between the map and Pokédex views as you work

### ✅ Validation & Analysis

- **Type distribution chart** — see which types dominate your regional dex at a glance
- **Consistency checks** — flags Pokémon that appear on the map but aren't in the dex, and vice versa
- Helps ensure your region has enough variety before you share it

### 💾 Save & Export

- Save region data locally
- Export specific parts of the region (map, dex, etc.)
- Share via URL (note: URL-based sharing embeds data as a query parameter and has size limitations)

---

## Development

### Tech Stack

- **Angular** (TypeScript)
- HTML / CSS
- GitHub Actions for CI/CD

### Project Structure

```
src/         # Angular app source
public/      # Static assets
.github/
  workflows/ # CI/CD pipeline
```

### Getting Started

```bash
# Clone the repo
git clone https://github.com/Fleker/pokemon-region-builder.git
cd pokemon-region-builder

# Install dependencies
npm install

# Start the development server
ng serve
```

Navigate to `http://localhost:4200/`. The app will automatically reload on file changes.

### Build

```bash
ng build
```

The build artifacts are output to the `dist/` directory.

### Development Notes

This project was bootstrapped with [Claude Code](https://www.anthropic.com/claude-code). The initial build started from a `SPEC.md` file laying out all app requirements, which proved helpful for guiding the AI like a project manager through the feature set. The first iteration took roughly half an hour, after which bugs were fixed and changes were made iteratively.

The URL-sharing mechanism (embedding region data as a query parameter) is a known limitation — it doesn't scale well for large regions. Local save/export is the recommended way to persist and share your work.

---

## Background

This project grew out of a trip to Iceland. The country's distinct geography and fauna made it feel like a natural Pokémon region waiting to be designed — but before the region itself could be built, the tooling needed to exist. This app was the result.

Read more about the design process on Medium: [Designing a Pokémon Region Builder](https://fleker.medium.com/designing-a-pok%C3%A9mon-region-builder-18622c2116b0)

---

## Disclaimer

This is a fan-made tool. Pokémon and all related names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc. This project is not affiliated with or endorsed by The Pokémon Company.