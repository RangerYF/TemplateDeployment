# Crystal Data Repository

`data/crystals/` contains one folder per crystal structure used by C-05.

Each crystal folder contains:

- `document.json`
  The document-mode structure used by the viewer, including the requirement snapshot,
  fractional coordinates, lattice parameters, and rendering hints.
- `materials-project.json`
  Materials Project download metadata, match status, chosen material ID, and source URL.
- `materials-project.cif`
  The CIF written from Materials Project structure data when a match exists.
- `demo.json`
  Small animation/view presets for teaching demonstrations.

Top-level supporting files:

- `crystal-manifest.json`
  Index of all crystal folders.
- `materials-project-download-report.md`
  Full download report.
- `materials-project-missing.md`
  Exact-target gaps or partial matches against the requirement document.

Maintenance commands:

```bash
npm run data:export
MP_API_KEY=... npm run data:download:mp
```
