# Sample Plugin

This repository hosts the reference sample plugin for RefMD. It demonstrates:

- A minimal Extism backend + ESM frontend
- Commands (`sample.*`) that return host-applied effects
- Keeping plugin metadata (`author`, `repository`) in the manifest
- Provisioning sandbox documents via the `sample.create` command

## Build & Release

GitHub Actions (`.github/workflows/build-plugin.yml`) builds the plugin and:

1. Checks out the repository
2. Installs Rust `stable` with the `wasm32-wasip1` target
3. Runs `cargo build --release --target wasm32-wasip1`
4. Packages `backend/plugin.wasm`, `frontend/index.mjs`, `plugin.json` into a
   zip named `${PLUGIN_ID}-plugin.zip`
5. Uploads that zip as both an Actions artifact and a GitHub Release asset (when
   the ref is a tag like `v*`)

## Installation

To install in RefMD:

1. Open the Plugins page (`/plugins`)
2. Use “Install from URL” and paste
   `https://github.com/refmdio/sample-plugin/releases/download/<tag>/sample-plugin.zip`

After installation, the toolbar exposes **New Sample Document** (`sample.create`).
When invoked, it provisions a demo document marked with `meta.isSample = true`.
Opening that document routes to `/sample/<docId>` where the frontend handles
records and markdown rendering.

See [`docs/overview.md`](docs/overview.md) and [`docs/architecture.md`](docs/architecture.md)
for a detailed walkthrough.
