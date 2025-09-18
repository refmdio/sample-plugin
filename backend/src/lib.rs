use extism_pdk::*;
use serde::{Deserialize, Serialize};

const SAMPLE_KIND: &str = "sample";

#[derive(Deserialize)]
struct ExecInput {
    action: String,
    payload: serde_json::Value,
    ctx: serde_json::Value,
}

#[derive(Serialize, Default)]
struct ExecOutput {
    ok: bool,
    data: Option<serde_json::Value>,
    effects: Vec<serde_json::Value>,
    error: Option<serde_json::Value>,
}

/// Extism entry point. Dispatches high-level commands that return effects for the host to apply.
#[plugin_fn]
pub fn exec(input: Json<ExecInput>) -> FnResult<Json<ExecOutput>> {
    let inx = input.0;
    let mut out = ExecOutput {
        ok: false,
        ..Default::default()
    };

    match inx.action.as_str() {
        "sample.hello" => {
            // Simple health-check style command to demonstrate toast output.
            out.ok = true;
            out.effects.push(serde_json::json!({
                "type": "showToast",
                "level": "success",
                "message": "Hello from Sample plugin!",
            }));
        }
        "sample.create" => {
            // Provision a sandbox document and tag it via plugin KV so the frontend can recognise it.
            let title = inx
                .payload
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Sample Plugin Demo");
            out.ok = true;
            out.effects.push(serde_json::json!({
                "type": "createDocument",
                "title": title,
                "docType": "document",
            }));
            out.effects.push(serde_json::json!({
                "type": "putKv",
                "scope": "doc",
                "key": "meta",
                "value": {"isSample": true},
            }));
            out.effects.push(success_toast("Sample document created"));
            out.effects.push(serde_json::json!({
                "type": "navigate",
                "to": "/sample/:createdDocId",
            }));
        }
        "sample.create_record" => match (require_doc_id(&inx.payload), inx.payload.get("data")) {
            (Ok(doc_id), data) => {
                let data = data.cloned().unwrap_or_else(|| {
                    serde_json::json!({
                        "message": "sample",
                    })
                });
                out.ok = true;
                out.effects.push(serde_json::json!({
                    "type": "createRecord",
                    "scope": "doc",
                    "docId": doc_id,
                    "kind": SAMPLE_KIND,
                    "data": data,
                }));
                out.effects.push(success_toast("Created a sample record"));
            }
            (Err(err), _) => out.error = Some(err),
        },
        "sample.update_record" => match require_record_id(&inx.payload) {
            Ok(record_id) => {
                let patch = inx
                    .payload
                    .get("patch")
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));
                out.ok = true;
                out.effects.push(serde_json::json!({
                    "type": "updateRecord",
                    "recordId": record_id,
                    "patch": patch,
                }));
                out.effects.push(success_toast("Record updated"));
            }
            Err(err) => out.error = Some(err),
        },
        "sample.delete_record" => match require_record_id(&inx.payload) {
            Ok(record_id) => {
                out.ok = true;
                out.effects.push(serde_json::json!({
                    "type": "deleteRecord",
                    "recordId": record_id,
                }));
                out.effects.push(success_toast("Record deleted"));
            }
            Err(err) => out.error = Some(err),
        },
        _ => {
            out.error = Some(serde_json::json!({ "code": "UNKNOWN_ACTION" }));
        }
    }

    Ok(Json(out))
}

fn require_doc_id(payload: &serde_json::Value) -> Result<&str, serde_json::Value> {
    payload
        .get("docId")
        .and_then(|v| v.as_str())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| serde_json::json!({ "code": "BAD_REQUEST", "message": "docId required" }))
}

fn require_record_id(payload: &serde_json::Value) -> Result<&str, serde_json::Value> {
    payload
        .get("recordId")
        .and_then(|v| v.as_str())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| serde_json::json!({ "code": "BAD_REQUEST", "message": "recordId required" }))
}

fn success_toast(message: &str) -> serde_json::Value {
    serde_json::json!({
        "type": "showToast",
        "level": "success",
        "message": message,
    })
}
