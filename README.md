# WB Data-Driven Demo

A React + TypeScript demo application built on the
[Workflow Builder SDK](https://www.npmjs.com/package/@workflowbuilder/sdk), in which the
editor itself is described by data. The node palette, the property panels, the seeded diagram
and the whole visual theme come from JSON that the app fetches over HTTP at startup — none of
it is hard-coded in React.

The sample domain is a human-in-the-loop **Invoice Approval** workflow: an automated run
pauses for a person to approve a payment, then continues. A second profile, **AI Content
Pipeline**, runs the exact same code with different JSON — a different palette, different
panels, a different diagram, a different brand and font.

## Requirements

- **Node.js 18+** (the SDK declares `engines: { "node": ">=18" }`; Vite 5 expects 18 or 20+).
  Developed on Node 20.
- **npm** — the repository ships a `package-lock.json` (lockfile v3); there is no pnpm or yarn
  lockfile.
- Nothing else: no `.env` file, no backend, no auth. Everything runs locally.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

A production build works the same way:

```bash
npm run build
npm run preview
```

The mock config API is a Vite plugin registered on **both** `configureServer` and
`configurePreviewServer` (`vite-plugins/config-api.ts`), so `preview` serves the profile JSON
just like `dev` does.

## Scripts

| Script                    | What it does                                                  |
| ------------------------- | ------------------------------------------------------------- |
| `npm run dev`             | Vite dev server on port 5173                                  |
| `npm run build`           | `tsc -b && vite build` — type-check, then bundle into `dist/` |
| `npm run preview`         | Serve the production build locally                            |
| `npm run typecheck`       | `tsc --noEmit`                                                |
| `npm run typecheck:watch` | The same, in watch mode                                       |
| `npm run lint`            | ESLint 9 (flat config)                                        |
| `npm run lint:fix`        | ESLint with `--fix`                                           |
| `npm run file-lint`       | ls-lint — enforces kebab-case file and folder names           |
| `npm run format`          | Prettier over `css/ts/tsx/json/md`, with import sorting       |
| `npm run check`           | `lint` + `typecheck` + `file-lint` in one go                  |

There are **no tests and no CI** in this repository, and no pre-commit hooks —
`npm run check` is the quality gate.

## Tech stack

- **UI** — React 18.3, TypeScript 5.5, Vite 5.4 (`@vitejs/plugin-react`), CSS Modules.
- **Editor** — `@workflowbuilder/sdk` 3.0 (Apache-2.0, public npm registry) on top of
  `@xyflow/react` 12.
- **Forms** — `@jsonforms/core` and `@jsonforms/react` 3.8. The property panels are JSON
  Schema plus a JSON Forms uischema, both supplied by the config.
- **State** — `zustand` 5 (the run store and the provenance toggle) and `immer`.
- **i18n** — `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- **Utilities** — `clsx`.
- **Tooling** — ESLint 9 flat config with `typescript-eslint`, `eslint-plugin-react` and
  `eslint-plugin-react-hooks`; Prettier 3 with `@trivago/prettier-plugin-sort-imports`;
  `@ls-lint/ls-lint`.

Every runtime dependency except `clsx` is a **peer dependency of the SDK**, so the list is not
prunable even though the app does not import all of them directly.

## Project structure

```text
index.html                     # Vite entry; pre-paint script that reads the stored theme,
                               # and the Google Fonts the SDK does not ship
vite.config.ts                 # react plugin + the local configApi() plugin, alias @ -> ./src
tsconfig.json                  # strict, bundler resolution, paths @/* -> src/*
eslint.config.mjs              # ESLint 9 flat config
.prettierrc.json               # single quotes, 100 cols, import-sort plugin
.ls-lint.yml                   # kebab-case file and folder names

config/                        # the config payload a backend would serve — pure JSON,
  profiles/                    # never imported by src
    index.json                 # the profile switcher menu: id, label, description, icon
    invoice-approval/          # profile.json, theme.json, palette.json, workflow.json
    content-pipeline/          # the same four files, a different domain

vite-plugins/
  config-api.ts                # mock config API middleware; runs in dev and in preview

src/
  main.tsx                     # entry: SDK stylesheet, global CSS, i18n, mounts <App/>

  app/                         # the application shell around the SDK: one <Root>, the
                               # header, hash routing, theme application
    app.tsx                    # composes <WorkflowBuilder.Root>: canvas, palette,
                               # properties panel, app bar, views, Config Studio
    app.module.css             # shell layout and the SDK fixups our elements can scope
    app-bar/                   # header: brand, nav, profile dropdown, theme switch, Run
    builder-focus/             # calls useFitView() when the canvas becomes visible
    theme-switch/              # the SDK's icon switch, rebuilt from its own tokens
    use-hash-route.ts          # routing over window.location.hash; route ids come from config
    use-profile-runtime.ts     # loads, compiles and swaps profiles; owns the <Root> key

  config/                      # the JSON <-> React boundary: contract, loader, compiler and
                               # token engine. Nothing here renders.
    types/                     # the whole config contract, as TypeScript types: one file per
                               # domain, no barrel — import the domain you need
      profile.ts               # the profile index, a profile's meta, and EditorProfile
      theme.ts                 # token maps, the two modes, the inspector's controls
      palette.ts               # the compact authoring format for a node type
      workflow.ts              # the seed diagram: nodes, edges, layout direction
      compiled.ts              # what the compiler hands to <WorkflowBuilder.Root>
    load-profile.ts            # fetch wrappers + runtime validation of the payload
    compile-profile/           # config -> SDK palette items, xyflow nodes and edges
      compile-profile.ts       # the entry point, and the only file imported from outside
      build-palette-item.ts    # where the three builders below converge into a palette item
      build-schema.ts          # splices the SDK's sharedProperties under the config's fields
      build-ui-schema.ts       # splices in generalInformation and globalControls
      build-defaults.ts        # the values a node opens with; the seed inherits them
      with-resolved-captions.ts # carries label/placeholder from the property to the element
      general-preset.ts        # what ui.preset "general" means, for schema and for defaults
      compile-initial-diagram.ts # seed entries -> xyflow nodes and edges
      profile-error.ts         # the one error a wrong config throws
    theme.ts                   # the token engine: applies tokens, exports a theme patch
    use-profile-theme.ts       # applies a profile's theme and re-applies on mode change
    use-theme-mode.ts          # subscribes to the current light/dark mode

  run/                         # the simulated durable-execution layer: an interpreter and a
                               # store that outlive React
    engine.ts                  # module-singleton interpreter that walks the live diagram
    store.ts                   # zustand store: executions, node statuses, logs, tasks

  plugins/                     # WB SDK plugins (component decorators)
    node-annotations/          # run badges and provenance labels drawn onto nodes
    provenance.ts              # the Fingerprint toggle and the node-type lookup

  renderers/                   # custom JSON Forms controls
    currency-amount/           # opt-in per field: options.customRenderer "CurrencyAmount"
    iso-date/                  # opt-in "IsoDate" — a date input that satisfies format:"date"
    switch-field/              # matches uischema type "Switch": every boolean field
    renderers.module.css       # the field shell the three controls share

  studio/                      # Config Studio — edits at runtime the config the editor was
                               # built from
    config-studio.tsx          # the dock and its three tabs
    token-panel.tsx            # live token controls generated from theme.json's inspector
    schema-panel.tsx           # fetch a raw config part, edit the JSON, Apply
    diagram-panel.tsx          # a snapshot of the current diagram, with Copy
    helpers/                   # colour normalisation and tolerant font-stack matching

  views/                       # the two screens that are not the canvas
    tasks-view/                # the human-task inbox and the configured summary
    executions-view/           # the run list, step list and log timeline
    status-pill/               # one tone-mapped status pill, shared by both views

  components/                  # three primitives the SDK does not export
    dropdown/                  # dropdown.tsx + dropdown.module.css
    switch/                    # switch.tsx + switch.module.css
    tooltip/                   # tooltip.tsx + tooltip.module.css

  helpers/
    format-money.ts            # Intl currency formatting

  wb/                          # module singletons the SDK needs to be reference-stable
    runtime.ts                 # CUSTOM_RENDERERS, JSON_FORM, PLUGINS, INTEGRATION
    i18n.ts                    # overrides one SDK string in en and pl

  styles/                      # the CSS that deliberately stays global
    tokens.css                 # the --app-* alias layer and the --tone-* status palette
    base.css                   # html / body / #root element rules
    primitives.module.css      # classes shared by Tasks and Executions
    css-modules.decision-log.md  # what is global and what is a CSS module, and why
```

Two invariants worth knowing: nothing is `import`ed from `config/`, and there is no `public/`
directory. The JSON genuinely arrives over HTTP and is visible in the Network tab.

## Configuration profiles

A **profile** is one complete editor definition. Each lives in its own directory and is made
of four files:

```text
config/profiles/index.json
config/profiles/<id>/profile.json
config/profiles/<id>/theme.json
config/profiles/<id>/palette.json
config/profiles/<id>/workflow.json
```

| File            | Contents                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile.json`  | app chrome (document title, tagline, nav), the status vocabulary, `taskFields`, and `run` — the mocked run context plus the task summary          |
| `theme.json`    | design tokens keyed by the SDK's real custom-property names, split into `base` / `light` / `dark`, plus `inspector` — which tokens get live controls |
| `palette.json`  | node types **and** their property panels: JSON Schema `properties`, `required` and `allOf`, and the JSON Forms `ui.elements` with `rule` show/hide   |
| `workflow.json` | the seeded diagram: `layoutDirection`, `seed.nodes` and `seed.edges`                                                                                 |

Two profiles ship: `invoice-approval` and `content-pipeline`. Switch between them with the
**Profile** dropdown in the app bar.

`vite-plugins/config-api.ts` stands in for the config backend and exposes three GET routes:

| Route                     | Response                                                   |
| ------------------------- | ---------------------------------------------------------- |
| `/api/profiles`           | the profile index                                          |
| `/api/profiles/:id`       | the four files assembled into one document                 |
| `/api/profiles/:id/:part` | one raw file (`profile`, `theme`, `palette` or `workflow`) |

Files are read from disk on every request and served with `Cache-Control: no-store` — edit a
JSON file, reload the page, and the editor changes.

## How it works

**Load, compile, render.** `src/config/load-profile.ts` fetches the profile and validates the
shape of the payload. `src/config/compile-profile/` turns the authoring format into what the
SDK accepts: palette items with their schema and uischema, and xyflow nodes and edges compiled
from the seed. `src/app/use-profile-runtime.ts` orchestrates that and derives a `rootKey`;
`src/app/app.tsx` renders a single `<WorkflowBuilder.Root>` keyed by it. A schema edit bumps
the key, so `<Root>` remounts with the live diagram snapshotted and re-validated against the
new schema.

**Theming.** `src/config/theme.ts` writes the profile's tokens as inline style on `<html>` and
tracks which properties it owns, so overrides can be layered and cleared per mode. It has to
be `<html>`: the SDK declares its own semantic tokens on `html[data-theme=…]`, and custom
properties resolve on the element that declares them — the long comment in that file explains
the specificity trap in full. `src/styles/tokens.css` adds the `--app-*` alias layer and the
`--tone-*` status palette on top.

**The run engine.** `src/run/engine.ts` is a module-level singleton, not a hook, so a run
survives navigation between views. It walks the diagram currently held in the SDK store — not
the config — which means retuning a condition in the properties panel changes the next run.
Node roles are recognised by shape rather than by name (`/\.human$/`, the presence of
`decisionBranches`), and `{{nodes.<id>.<output>}}` operands resolve through the palette type
into `profile.run.context`. A human node suspends the run and creates a task; the Tasks view
resumes it. `src/run/store.ts` keeps executions, node statuses, logs and tasks in a separate
zustand store, so run state never lands in the diagram's saved data. Runs are scoped to the
profile that started them, and everything is in memory.

**Extension points.** `src/plugins/node-annotations` is the one SDK plugin: it decorates the
`OptionalNodeContent` slot with run badges and provenance labels. `src/renderers/*` are JSON
Forms controls — two are opted into per field from `palette.json` via
`options.customRenderer`, and one matches every boolean. Both sets are registered once, as
stable module-level references, in `src/wb/runtime.ts`.

**Config Studio.** A dock with three tabs. _Tokens_ generates live controls from
`theme.json`'s `inspector` section and can copy back a complete `theme.json`. _Schema_
refetches a raw config part, lets you edit the JSON and recompiles the palette on **Apply**.
_Diagram_ captures `getStoreDataForIntegration()` with a Copy button.

## Conventions

- kebab-case files and folders, enforced by `.ls-lint.yml`
- a folder per component, with its `<name>.module.css` beside it
- named exports, and arrow-function components (enforced by
  `react/function-component-definition`)
- `@/` for any import outside the current folder
- import order enforced by Prettier's sort-imports plugin
- what stays global CSS and what becomes a module is recorded in
  [`src/styles/css-modules.decision-log.md`](src/styles/css-modules.decision-log.md)

## Limitations

- No backend, no auth, no persistence — run state is in memory, and a reload clears it.
- No real workflow engine, AI or payment provider; the run is simulated.
- No tests and no CI.
