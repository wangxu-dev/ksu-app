mod commands;
mod state;

use commands::login::login;
use commands::proxy::{proxy_request, proxy_submit_frontend_response};
use state::RequestBridgeState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(RequestBridgeState::default())
        .invoke_handler(tauri::generate_handler![
            login,
            proxy_request,
            proxy_submit_frontend_response
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
