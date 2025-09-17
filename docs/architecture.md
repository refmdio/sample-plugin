# Sample Plugin Architecture

This document describes the structure of the sample plugin at a more detailed level.

```
sample-plugin/
├── backend/
│   ├── Cargo.toml
│   └── src/lib.rs         # Extism entry point
├── frontend/
│   └── index.mjs          # ESM frontend module
├── plugin.json            # Manifest for distribution
├── README.md
└── docs/
    ├── overview.md
    └── architecture.md    # (this file)
```

## Backend (Extism)

- Rust crate (`sample_plugin_backend`) compiled to `wasm32-wasip1`.
- Single entry function `exec(Json<ExecInput>)` matching RefMD’s ABI.
- Pattern matches on `sample.*` actions and emits effects like `createDocument`, `createRecord`, `deleteRecord`, `showToast`, `navigate`.
- Helper functions guard required fields (`require_doc_id`, `require_record_id`) and reduce duplication.
- The WASM artifact is copied to `plugins/sample/0.1.0/backend/plugin.wasm` by the publish script.

## Frontend (ESM)

- Default export `mount(container, host)` builds the DOM using template literals—no framework dependency.
- Relies on the `sample.create` Extism command to provision demo documents via effects (`createDocument`, `putKv`, `navigate`).
- When mounted on `/sample/<docId>`, resolves the identifier from the current path and operates on that document only. It expects the document to have `meta.isSample = true` (set by the backend command) so the host can reroute it.
- Simple event delegation handles button clicks (`say-hello`, `reload-records`, etc.) and form submission for creating records.
- Markdown rendering uses the host’s server-side pipeline so it stays consistent with the main app features.
- `canOpen` and `getRoute` are exported so the host router can map documents with `type: 'sample'` back to `/sample/<docId>`.

## Manifest


- `plugin.json` declares:
  - `id: "sample"`
  - `frontend.entry: "index.mjs", mode: "esm"`
  - `backend.wasm: "backend/plugin.wasm"`
  - `mounts: ["/sample/*"]`
  - `commands: ["sample.create", "sample.hello", ...]`
  - `ui.toolbar` exposing "New Sample Document" (`sample.create`)
  - `ui.fileTree.identify` using `kvFlag(meta.isSample == true)` to reacquire demo documents
  - `author` / `repository` metadata exposed to the host UI
