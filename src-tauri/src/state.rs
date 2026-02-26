use std::collections::HashMap;
use tokio::sync::{oneshot, Mutex};

use crate::commands::proxy::FrontendResponsePayload;

#[derive(Default)]
pub struct RequestBridgeState {
    pub pending: Mutex<HashMap<String, oneshot::Sender<FrontendResponsePayload>>>,
}
