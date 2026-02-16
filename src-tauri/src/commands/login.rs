use anyhow::Result;
use base64::Engine;
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, USER_AGENT};
use reqwest::redirect::Policy;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

const LOGIN_URL: &str = "https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fportal.ksu.edu.cn%2F%3Fpath%3Dhttps%253A%252F%252Fportal.ksu.edu.cn%252Fmain.html%2523%252F";

lazy_static::lazy_static! {
    static ref INPUT_TAG_REGEX: Regex = Regex::new(r#"<input[^>]*>"#).expect("failed to compile INPUT_TAG_REGEX");
    static ref HTML_ATTR_REGEX: Regex = Regex::new(
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

#[tauri::command]
pub async fn login(username: String, password: String, remember: bool) -> Result<LoginResponse, String> {
    match perform_login(&username, &password).await {
        Ok(token) => {
            let _ = remember;
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

fn default_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
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
        #[cfg(debug_assertions)]
        let debug_path = {
            let mut path = std::env::temp_dir();
            path.push(format!(
                "ksu_cas_login_page_{}.html",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            ));
            let _ = std::fs::write(&path, &html);
            Some(path)
        };
        #[cfg(not(debug_assertions))]
        let debug_path: Option<std::path::PathBuf> = None;

        return Err(anyhow::anyhow!(
            "{}",
            match debug_path {
                Some(p) => format!(
                    "获取登录页面失败。HTTP 状态：{}，最终 URL：{}，已将返回内容保存到：{}",
                    status,
                    final_url,
                    p.display()
                ),
                None => format!("获取登录页面失败。HTTP 状态：{}，最终 URL：{}", status, final_url),
            }
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
        #[cfg(debug_assertions)]
        let debug_path = {
            let mut path = std::env::temp_dir();
            path.push(format!(
                "ksu_cas_login_page_{}.html",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            ));
            let _ = std::fs::write(&path, &html);
            Some(path)
        };
        #[cfg(not(debug_assertions))]
        let debug_path: Option<std::path::PathBuf> = None;

        return Err(anyhow::anyhow!(
            "{}",
            match debug_path {
                Some(p) => format!(
                    "无法获取登录参数（未找到 execution）。HTTP 状态：{}，最终 URL：{}，已将返回页面保存到：{}",
                    status,
                    final_url,
                    p.display()
                ),
                None => format!(
                    "无法获取登录参数（未找到 execution）。HTTP 状态：{}，最终 URL：{}",
                    status, final_url
                ),
            }
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
