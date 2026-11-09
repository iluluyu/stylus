# Reproducible checks

From the slides skill directory, after the install steps in [export](export.md):

```sh
npm test
npm run typecheck
npm run build
npm run test:smoke
npm run test:install
```

- `npm test`: Node entry/path/example contracts plus all migrated exporter
  unit tests, including animation, timing, gradients, vendor hooks, and CJK.
- `typecheck`: strict TypeScript checks in the tool package.
- `build`: bundles both CLI and in-page capture code from local source/vendor.
- `test:smoke`: real Chromium, loopback ephemeral HTTP server, small-viewport
  geometry, keyboard/API/click-build navigation, print CSS, PDF page count
  and dimensions, CLI editable and screenshot exports, native text/shape XML,
  CJK East-Asian font slot, animation timing, and notes.
- `test:install`: copies this directory to a temporary location, excluding
  node_modules/dist/artifacts; runs npm ci, unit tests, typecheck, build, and
  browser smoke there. It does not copy/install design. npm may require network.
  Set `SLIDES_NPM_OFFLINE=1` to demand a fully cached npm install instead.
  Playwright's browser binary is a machine-level cache prerequisite; installation
  does not bundle it. The temporary installation is removed on success/failure.

Smoke writes to `artifacts/` (git-ignored): editable PPTX, screenshot PPTX, PDF,
standalone HTML, PNGs, and JSON evidence. `pdfinfo` and `pdftotext` from
Poppler are required by the smoke test to verify real printed pages and text.
The ordinary PDF helper does not require Poppler.

The scripts do not use a model or external browser service. Chromium is owned
and closed by each test. Local export is covered; desktop PowerPoint rendering
and cross-machine font availability still need manual inspection.
