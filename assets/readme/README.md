# README terminal views

Nothing in this directory is drawn by hand. Every SVG is rendered by
`scripts/render-readme.mjs` from real command output, with the source data
saved next to it as a JSON capture:

| Image | Source | Data |
| --- | --- | --- |
| `doctor.svg` | a live `gemhog doctor` run at render time | `doctor-snapshot.json` |
| `certificate-demo.svg` | `gemhog demo` (synthetic, every line marked DEMO) | `certificate-snapshot.json` |
| `json-export.svg` | `gemhog demo --format json` excerpt | `certificate-snapshot.json` |

Refresh all of them with:

```bash
pnpm render:readme
```

The doctor image is a historical capture: its time is printed inside the frame
and provider status can change. The certificate and export images are
synthetic walkthroughs until the live engine lands in 0.2.0, and say so on
every line.
