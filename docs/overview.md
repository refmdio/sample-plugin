# Sample Plugin Overview

This document explains how the sample plugin works inside RefMD. The goal is to provide a minimal yet complete example that authors can inspect and adapt.

## Creating a demo document (`sample.create`)

1. The toolbar exposes a “New Sample Document” command wired to `sample.create`.
2. The Extism backend issues a `createDocument` effect (type defaults to `document`).
3. A `putKv` effect stores `{"isSample": true}` under `kv('sample', docId, 'meta')`.
4. A navigation effect redirects the client to `/sample/:createdDocId`.

## What happens on mount?

1. `mount(container, host)` is called by the app when the `/sample/<docId>` route is matched.
2. The plugin reads `docId` from the current path/query parameters.
3. Records for that document are fetched via `host.api.listRecords('sample', docId, 'sample')`.
4. Markdown entered in the textarea is rendered using `host.api.renderMarkdown`, and `host.ui.hydrateAll` enhances the output.

From this point, the user can:

- Click “Create” to send `sample.create_record` through Extism, which issues a `createRecord` effect.
- Edit or delete existing records (again through Extism effects).
- Re-render markdown using the input textarea.
- Hit “Reload records” to refresh the list from the server.

Everything happens against the demo document that the plugin itself created. No prior doc selection is necessary.

## Command wiring

| Action                | Backend effect                                    | UI feedback                    |
|-----------------------|----------------------------------------------------|--------------------------------|
| `sample.hello`        | `showToast`                                        | Toast notification             |
| `sample.create_record`| `createRecord` + `showToast`                       | List refresh, toast            |
| `sample.update_record`| `updateRecord` + `showToast`                       | List refresh, toast            |
| `sample.delete_record`| `deleteRecord` + `showToast`                       | List refresh, toast            |

The Extism backend lives in `backend/src/lib.rs` and uses the shared helper `SAMPLE_KIND = "sample"` for consistency.

## Host bridge usage

The frontend relies on the bridge utilities exposed by the RefMD host:

- `host.exec` → dispatch Extism commands (`sample.*`)
- `host.api.listRecords`, `host.api.renderMarkdown`, `host.api.putKv`
- `host.ui.hydrateAll` → rehydrate attachment/wiki-link widgets after markdown render

## Re-opening demo documents

Documents created by the command are marked in plugin KV (`meta.isSample = true`).
`canOpen` fetches that flag via `host.api.getKv` to decide if a document should be
handled by this plugin. When the route matcher runs, `/document/<id>` can be
remapped to `/sample/<id>` whenever the flag is present.

## Distribution layout

The GitHub Actions workflow packages the distributable files into
`sample-plugin.zip`, containing:

- `backend/plugin.wasm`
- `frontend/index.mjs`
- `plugin.json`

Use that artifact to install the plugin in RefMD.
