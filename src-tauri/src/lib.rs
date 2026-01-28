use anyhow::Result;
use base64::Engine;
use regex::Regex;
use reqwest::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, USER_AGENT};
use reqwest::redirect::Policy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tauri_plugin_store::StoreBuilder;

const LOGIN_URL: &str = "https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fportal.ksu.edu.cn%2F%3Fpath%3Dhttps%253A%252F%252Fportal.ksu.edu.cn%252Fmain.html%2523%252F";
const USER_INFO_URL: &str = "https://authx-service.ksu.edu.cn/personal/api/v1/personal/me/user";
const STORE_KEY: &str = "auth";

lazy_static::lazy_static! {
    static ref INPUT_TAG_REGEX: Regex = Regex::new(r#"<input[^>]*>"#).expect("failed to compile INPUT_TAG_REGEX");
    static ref HTML_ATTR_REGEX: Regex = Regex::new(
        // Note: Rust `regex` does not support backreferences, so match both quoting styles explicitly.
        r#"([A-Za-z_:\-][A-Za-z0-9_:\-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')"#
    )
    .expect("failed to compile HTML_ATTR_REGEX");
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub token: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfoResponse {
    pub success: bool,
    pub data: Option<UserInfoData>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfoData {
    pub username: String,
    pub user_name: String,
    pub user_uid: String,
    pub user_id: String,
    pub organization_name: Option<String>,
    pub identity_type_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserInfoAttributes {
    pub organization_id: Option<String>,
    pub identity_type_code: Option<String>,
    pub account_id: Option<String>,
    pub organization_name: Option<String>,
    pub organization_code: Option<String>,
    pub image_url: Option<String>,
    pub identity_type_name: Option<String>,
    pub identity_type_id: Option<String>,
    pub user_name: Option<String>,
    pub user_id: Option<String>,
    pub user_uid: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserInfoEnvelope {
    pub username: String,
    pub roles: Option<Vec<String>>,
    pub attributes: Option<UserInfoAttributes>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum UserInfoDataAny {
    // Older / alternate payloads (flat fields).
    Flat(UserInfoData),
    // Current payload nested under `attributes`.
    Envelope(UserInfoEnvelope),
}

#[derive(Debug, Deserialize)]
struct UserInfoRaw {
    #[serde(default)]
    pub acknowleged: Option<bool>,
    pub code: i32,
    pub message: Option<String>,
    pub data: Option<UserInfoDataAny>,
}

#[tauri::command]
async fn login(
    app: tauri::AppHandle,
    username: String,
    password: String,
    remember: bool,
) -> Result<LoginResponse, String> {
    match perform_login(&username, &password).await {
        Ok(token) => {
            if remember {
                save_token(&app, &token).map_err(|e| e.to_string())?;
            }
            Ok(LoginResponse {
                success: true,
                token: Some(token),
                message: "登录成功".to_string(),
            })
        }
        Err(e) => Ok(LoginResponse {
            success: false,
            token: None,
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
async fn get_user_info(token: String) -> Result<UserInfoResponse, String> {
    let client = create_client();
    let response = client
        .get(USER_INFO_URL)
        .header("x-id-token", &token)
        .header("x-device-info", "PC")
        .header("x-terminal-info", "PC")
        .header("Referer", "https://portal.ksu.edu.cn/main.html")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let text = response.text().await.map_err(|e| e.to_string())?;
        if let Ok(data) = serde_json::from_str::<UserInfoRaw>(&text) {
            if data.code == 0 {
                let user_data = match data.data {
                    Some(UserInfoDataAny::Flat(d)) => Some(d),
                    Some(UserInfoDataAny::Envelope(env)) => {
                        let attrs = env.attributes.unwrap_or(UserInfoAttributes {
                            organization_id: None,
                            identity_type_code: None,
                            account_id: None,
                            organization_name: None,
                            organization_code: None,
                            image_url: None,
                            identity_type_name: None,
                            identity_type_id: None,
                            user_name: None,
                            user_id: None,
                            user_uid: None,
                        });
                        Some(UserInfoData {
                            username: env.username,
                            user_name: attrs.user_name.unwrap_or_default(),
                            user_uid: attrs.user_uid.unwrap_or_default(),
                            user_id: attrs.user_id.unwrap_or_default(),
                            organization_name: attrs.organization_name,
                            identity_type_name: attrs.identity_type_name,
                        })
                    }
                    None => None,
                };
                Ok(UserInfoResponse {
                    success: true,
                    data: user_data,
                    message: "获取成功".to_string(),
                })
            } else {
                Ok(UserInfoResponse {
                    success: false,
                    data: None,
                    message: data.message.unwrap_or_else(|| "未知错误".to_string()),
                })
            }
        } else {
            let mut debug_path = std::env::temp_dir();
            debug_path.push(format!(
                "ksu_user_info_response_{}.txt",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            ));
            let _ = std::fs::write(&debug_path, &text);
            Ok(UserInfoResponse {
                success: false,
                data: None,
                message: format!("解析响应失败，已保存响应到：{}", debug_path.display()),
            })
        }
    } else {
        Ok(UserInfoResponse {
            success: false,
            data: None,
            message: format!("请求失败: {}", response.status()),
        })
    }
}

#[tauri::command]
async fn get_saved_token(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = StoreBuilder::new(&app, "ksu_app_store.json")
        .build()
        .map_err(|e| e.to_string())?;
    Ok(store
        .get(STORE_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string())))
}

fn save_token(app: &tauri::AppHandle, token: &str) -> Result<()> {
    let store = StoreBuilder::new(app, "ksu_app_store.json").build()?;
    store.set(STORE_KEY, token.to_string());
    store.save()?;
    Ok(())
}

fn default_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ),
    );
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
    );
    headers.insert(
        ACCEPT_LANGUAGE,
        HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8"),
    );
    headers
}

fn create_client() -> Client {
    Client::builder()
        .default_headers(default_headers())
        .timeout(Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .expect("Failed to create HTTP client")
}

async fn perform_login(username: &str, password: &str) -> Result<String> {
    let client = create_client();

    let resp = client.get(LOGIN_URL).send().await?;
    let status = resp.status();
    let final_url = resp.url().to_string();
    let html = resp.text().await?;

    if !status.is_success() {
        let mut debug_path = std::env::temp_dir();
        debug_path.push(format!(
            "ksu_cas_login_page_{}.html",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        ));
        let _ = std::fs::write(&debug_path, &html);

        return Err(anyhow::anyhow!(
            "获取登录页面失败。HTTP 状态：{}，最终 URL：{}，已将返回内容保存到：{}",
            status,
            final_url,
            debug_path.display()
        ));
    }

    let mut execution = String::new();
    let mut current_menu = String::from("1");
    let mut fail_n = String::from("0");
    let mut geolocation = String::new();
    let mut fp_visitor_id = String::new();

    for m in INPUT_TAG_REGEX.find_iter(&html) {
        let tag = m.as_str();
        let mut attrs: HashMap<String, String> = HashMap::new();
        for cap in HTML_ATTR_REGEX.captures_iter(tag) {
            let key = cap.get(1).unwrap().as_str().to_ascii_lowercase();
            let value = cap
                .get(2)
                .or_else(|| cap.get(3))
                .unwrap()
                .as_str()
                .to_string();
            attrs.insert(key, value);
        }

        let is_hidden = attrs
            .get("type")
            .map(|t| t.eq_ignore_ascii_case("hidden"))
            .unwrap_or(false);
        if !is_hidden {
            continue;
        }

        let (Some(name), Some(value)) = (attrs.get("name"), attrs.get("value")) else {
            continue;
        };

        match name.as_str() {
            "execution" => execution = value.to_string(),
            "currentMenu" => current_menu = value.to_string(),
            "failN" => fail_n = value.to_string(),
            "geolocation" => geolocation = value.to_string(),
            "fpVisitorId" => fp_visitor_id = value.to_string(),
            _ => {}
        }
    }

    if execution.is_empty() {
        let mut debug_path = std::env::temp_dir();
        debug_path.push(format!(
            "ksu_cas_login_page_{}.html",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        ));
        let _ = std::fs::write(&debug_path, &html);

        return Err(anyhow::anyhow!(
            "无法获取登录参数（未找到 execution）。HTTP 状态：{}，最终 URL：{}，已将返回页面保存到：{}",
            status,
            final_url,
            debug_path.display()
        ));
    }

    let params = [
        ("username", username),
        ("password", password),
        ("captcha", ""),
        ("mfaState", ""),
        ("currentMenu", &current_menu),
        ("failN", &fail_n),
        ("execution", &execution),
        ("_eventId", "submit"),
        ("geolocation", &geolocation),
        ("fpVisitorId", &fp_visitor_id),
    ];

    // 不自动跟随重定向：我们需要读取 Location 里的 ticket。
    let login_client = Client::builder()
        .default_headers(default_headers())
        .timeout(Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .redirect(Policy::none())
        .build()
        .expect("Failed to create login HTTP client");

    let resp = login_client
        .post(LOGIN_URL)
        .form(&params)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .header(
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        .header("Origin", "https://cas.ksu.edu.cn")
        .header("Referer", LOGIN_URL)
        .send()
        .await?;

    let location = resp
        .headers()
        .get("Location")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| anyhow::anyhow!("登录失败，用户名或密码错误"))?;

    if !location.contains("ticket=") {
        return Err(anyhow::anyhow!("登录失败，用户名或密码错误"));
    }

    extract_id_token_from_ticket(location)
}

fn extract_id_token_from_ticket(location: &str) -> Result<String> {
    let ticket = urlencoding::decode(location)
        .map(|s| s.to_string())
        .unwrap_or_else(|_| location.to_string());

    if let Some(ticket_start) = ticket.find("ticket=") {
        let ticket_part = &ticket[ticket_start + 6..];
        let ticket_end = ticket_part.find('&').unwrap_or(ticket_part.len());
        let ticket = &ticket_part[..ticket_end];

        let parts: Vec<&str> = ticket.split('.').collect();
        if parts.len() != 3 {
            return Err(anyhow::anyhow!("ticket 格式错误"));
        }

        let payload = parts[1];
        let decoded =
            base64_url_decode(payload).map_err(|e| anyhow::anyhow!("解析 JWT 失败: {}", e))?;

        let payload_json: serde_json::Value = serde_json::from_str(&decoded)
            .map_err(|e| anyhow::anyhow!("解析 payload 失败: {}", e))?;

        if let Some(id_token) = payload_json.get("idToken").and_then(|v| v.as_str()) {
            Ok(id_token.to_string())
        } else {
            Err(anyhow::anyhow!("无法获取 idToken"))
        }
    } else {
        Err(anyhow::anyhow!("无法提取 ticket"))
    }
}

fn base64_url_decode(input: &str) -> Result<String> {
    let decoded = urlencoding::decode(input)?.to_string();
    let normalized = decoded.replace('-', "+").replace('_', "/");
    let pad_len = (4 - normalized.len() % 4) % 4;
    let padded: String = normalized + &"=".repeat(pad_len);
    let bytes = base64::engine::general_purpose::STANDARD.decode(&padded)?;
    String::from_utf8(bytes).map_err(|e| anyhow::anyhow!("UTF-8 解码失败: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            login,
            get_user_info,
            get_saved_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
