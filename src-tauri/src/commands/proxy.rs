use anyhow::Result;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::redirect::Policy;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::oneshot;

use crate::state::RequestBridgeState;

const FRONTEND_REQUEST_EVENT: &str = "frontend-request-task";
static REQUEST_SEQ: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RequestMode {
    Frontend,
    Backend,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyRequestPayload {
    pub request_mode: RequestMode,
    pub method: String,
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
    pub follow_redirects: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResponsePayload {
    pub ok: bool,
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendRequestTask {
    pub request_id: String,
    pub method: String,
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
    pub follow_redirects: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendResponsePayload {
    pub request_id: String,
    pub ok: bool,
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub error: Option<String>,
}

fn next_request_id() -> String {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let seq = REQUEST_SEQ.fetch_add(1, Ordering::Relaxed);
    format!("req-{now_ms}-{seq}")
}

#[tauri::command]
pub async fn proxy_request(
    app: AppHandle,
    state: State<'_, RequestBridgeState>,
    payload: ProxyRequestPayload,
) -> Result<ProxyResponsePayload, String> {
    match payload.request_mode {
        RequestMode::Backend => perform_backend_request(&payload)
            .await
            .map_err(|e| format!("backend requester failed: {e}")),
        RequestMode::Frontend => {
            let request_id = next_request_id();
            let task = FrontendRequestTask {
                request_id: request_id.clone(),
                method: payload.method,
                url: payload.url,
                headers: payload.headers,
                body: payload.body,
                timeout_ms: payload.timeout_ms,
                follow_redirects: payload.follow_redirects,
            };

            let (tx, rx) = oneshot::channel();
            {
                let mut pending = state.pending.lock().await;
                pending.insert(request_id.clone(), tx);
            }

            if let Err(err) = app.emit(FRONTEND_REQUEST_EVENT, &task) {
                let mut pending = state.pending.lock().await;
                pending.remove(&request_id);
                return Err(format!("emit frontend task failed: {err}"));
            }

            let timeout_ms = task.timeout_ms.unwrap_or(30_000);
            match tokio::time::timeout(Duration::from_millis(timeout_ms), rx).await {
                Ok(Ok(front_result)) => Ok(ProxyResponsePayload {
                    ok: front_result.ok,
                    status: front_result.status,
                    headers: front_result.headers,
                    body: front_result.body,
                    error: front_result.error,
                }),
                Ok(Err(_)) => Err("frontend requester channel closed".to_string()),
                Err(_) => {
                    let mut pending = state.pending.lock().await;
                    pending.remove(&request_id);
                    Err(format!("frontend requester timeout ({timeout_ms}ms)"))
                }
            }
        }
    }
}

#[tauri::command]
pub async fn proxy_submit_frontend_response(
    state: State<'_, RequestBridgeState>,
    payload: FrontendResponsePayload,
) -> Result<(), String> {
    let tx = {
        let mut pending = state.pending.lock().await;
        pending.remove(&payload.request_id)
    };

    match tx {
        Some(ch) => ch
            .send(payload)
            .map_err(|_| "failed to send frontend response".to_string()),
        None => Err("no pending frontend request found".to_string()),
    }
}

fn reqwest_headers(raw: Option<&HashMap<String, String>>) -> Result<HeaderMap> {
    let mut map = HeaderMap::new();
    if let Some(headers) = raw {
        for (k, v) in headers {
            let name = HeaderName::from_bytes(k.as_bytes())
                .map_err(|e| anyhow::anyhow!("invalid header name `{k}`: {e}"))?;
            let value = HeaderValue::from_str(v)
                .map_err(|e| anyhow::anyhow!("invalid header value for `{k}`: {e}"))?;
            map.insert(name, value);
        }
    }
    Ok(map)
}

async fn perform_backend_request(payload: &ProxyRequestPayload) -> Result<ProxyResponsePayload> {
    let timeout_ms = payload.timeout_ms.unwrap_or(30_000);
    let method = reqwest::Method::from_bytes(payload.method.as_bytes())
        .map_err(|e| anyhow::anyhow!("invalid method `{}`: {}", payload.method, e))?;
    let mut request = Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .redirect(if payload.follow_redirects.unwrap_or(false) {
            Policy::limited(10)
        } else {
            Policy::none()
        })
        .build()?
        .request(method, &payload.url)
        .headers(reqwest_headers(payload.headers.as_ref())?);

    if let Some(body) = &payload.body {
        request = request.body(body.clone());
    }

    let response = request.send().await?;
    let status = response.status().as_u16();
    let mut headers = HashMap::new();
    for (k, v) in response.headers() {
        let value = v.to_str().unwrap_or_default().to_string();
        headers.insert(k.as_str().to_string(), value);
    }

    let body = response.text().await?;
    Ok(ProxyResponsePayload {
        ok: (200..300).contains(&status),
        status,
        headers,
        body,
        error: None,
    })
}
