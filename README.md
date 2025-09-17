# Sample Plugin

This repository contains the reference sample plugin for RefMD. It showcases:

- A minimal Extism backend and ESM frontend
- Commands (`sample.*`) that return host-applied effects
- The `sample.create` command flow for provisioning sandbox documents
- Manifest metadata (`author`, `repository`) consumed by the host UI

## Build & Distribution

GitHub Actions (see `.github/workflows/build-plugin.yml`) builds the plugin and
uploads `sample-plugin.zip` as an artifact. The workflow executes:

1. Checkout repository
2. Install Rust `stable` with the `wasm32-wasip1` target
3. `cargo build --release --target wasm32-wasip1`
4. Package `backend/plugin.wasm`, `frontend/index.mjs`, and `plugin.json`
5. Upload the bundle as `sample-plugin`

Use the CI artifact as the distributable bundle. In RefMD, open the **Plugins**
page (`/plugins`) and use “Install from URL” to provide the artifact link.

For detailed structure and execution flow, see
[`docs/overview.md`](docs/overview.md) and [`docs/architecture.md`](docs/architecture.md).
