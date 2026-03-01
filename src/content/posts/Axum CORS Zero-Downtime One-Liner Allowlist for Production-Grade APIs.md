---
title: "🦀 Axum CORS 零翻车：一行代码放行合法源，生产级安全直接上线"
description: "tower-http CorsLayer 官方加持，Rust Axum 一行配置精准匹配源、方法与头，自带预检缓存与凭据开关，Docker 秒启，SPA/API 跨域零痛点。"
date: 2025-12-31T12:11:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-murat-halici-294274529-35494496.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","tokio","axum","tower-http"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","rustls","tokio","axum","openssl","rustls-pemfile","axum_server","tower-http","tracing","tracing-subscriber","ipnet","tls","hsts","CORS"]
keywords: "rust,实战指南,Rust 生态,2024,Edition,Async,Trait,Future,rustls,tokio,axum,openssl,rustls-pemfile,axum_server,tower-http,tracing,tracing-subscriber,ipnet,tls,hsts,CORS"
draft: false
---

# Rust Axum 框架中生产级 CORS 中间件实现最佳实践

## 引言背景

CORS（Cross-Origin Resource Sharing）是浏览器安全机制，要求服务器明确允许哪些来源（Origin）可以跨域访问资源。在现代 Web 应用中（尤其是前后端分离、SPA、API 服务），正确配置 CORS 是必需的。

Axum 生态中，最推荐的方式是使用 **tower-http** 提供的 `CorsLayer`，它基于 Tower 架构，性能高、可配置性强、工业级标准。

本文基于前文完整实现（可信代理 IP 处理 + Forwarded 支持 + rustls TLS + HSTS），添加**生产级 CORS 中间件**，并说明最佳实践配置。

## 最佳实践要点

- 使用 `tower-http::cors::CorsLayer` 而非自定义（避免重造轮子）
- 生产环境：**严格限制允许的 Origin**（不要使用 `Any` 通配符，除非公共 API）
- 支持预检请求（OPTIONS）自动处理
- 允许必要的头部（如 Authorization、Content-Type）
- 允许 credentials（如果需要 cookie 或 HTTP 认证）
- 与其他中间件层叠顺序：CORS 应放在较外层（在 TraceLayer 之前）

## 完整实例代码（含生产级 CORS）

### Cargo.toml

```toml
[package]
name = "axum-trusted-proxies-tls-hsts-cors"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
axum_server = "0.7"
tokio = { version = "1.48.0", features = ["full"] }
tower-http = {
    version = "0.6.8",
    features = ["trace", "cors"]  # 启用 cors feature
}
rustls = "0.23.35"
rustls-pemfile = "2.2.0"
ipnet = "2.10.1"
tracing = "0.1.40"
tracing-subscriber = "0.3.18"
```

### src/main.rs

```rust
use axum::{
    extract::{ConnectInfo, Extension},
    http::{HeaderMap, HeaderValue},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use axum_server::tls_rustls::RustlsConfig;
use ipnet::IpNet;
use std::collections::HashSet;
use std::net::{IpAddr, SocketAddr};
use std::path::Path;
use std::str::FromStr;
use std::sync::Arc;
use tower_http::{
    cors::{CorsLayer, Any},
    trace::TraceLayer,
};
use tracing::{error, info, warn};

// 真实客户端 IP 扩展
#[derive(Clone, Copy, Debug)]
pub struct ClientIp(pub IpAddr);

// 可信代理配置
#[derive(Clone, Debug)]
pub struct TrustedProxies {
    proxies: HashSet<IpNet>,
    max_hops: Option<usize>,
}

impl TrustedProxies {
    pub fn new(proxies: Vec<String>, max_hops: Option<usize>) -> Self {
        let mut set = HashSet::new();
        for proxy in proxies {
            if let Ok(net) = IpNet::from_str(&proxy) {
                set.insert(net);
            } else {
                error!("Invalid proxy CIDR: {}", proxy);
            }
        }
        Self { proxies: set, max_hops }
    }

    pub fn is_trusted(&self, ip: IpAddr) -> bool {
        self.proxies.iter().any(|net| net.contains(&ip))
    }
}

// HSTS 配置
#[derive(Clone)]
pub struct HstsConfig {
    pub max_age: u64,
    pub include_subdomains: bool,
    pub preload: bool,
}

impl Default for HstsConfig {
    fn default() -> Self {
        Self {
            max_age: 63072000,         // 2 年
            include_subdomains: true,
            preload: false,
        }
    }
}

// HSTS 中间件
async fn hsts_middleware(
    Extension(hsts_config): Extension<Arc<HstsConfig>>,
    mut req: axum::http::Request<axum::body::Body>,
    next: Next,
) -> Response {
    let mut res = next.run(req).await;

    let mut value = format!("max-age={}", hsts_config.max_age);
    if hsts_config.include_subdomains {
        value.push_str("; includeSubDomains");
    }
    if hsts_config.preload {
        value.push_str("; preload");
    }

    if let Ok(header_value) = HeaderValue::from_str(&value) {
        res.headers_mut().insert("strict-transport-security", header_value);
    }

    res
}

// Forwarded 解析（同前）
fn parse_forwarded_for_ips(value: &str) -> Vec<IpAddr> {
    let mut ips = Vec::new();
    for pair in value.split(';') {
        let pair = pair.trim();
        if pair.to_lowercase().starts_with("for=") {
            let mut for_val = pair[4..].trim().to_string();
            if (for_val.starts_with('"') && for_val.ends_with('"'))
                || (for_val.starts_with('[') && for_val.ends_with(']'))
            {
                for_val = for_val[1..for_val.len() - 1].to_string();
            }
            if matches!(for_val.as_str(), "_hidden" | "unknown" | "") {
                continue;
            }
            if let Ok(ip) = IpAddr::from_str(&for_val) {
                ips.push(ip);
            }
        }
    }
    ips
}

// 提取真实客户端 IP
fn extract_client_ip_from_headers(
    headers: &HeaderMap,
    trusted_proxies: &TrustedProxies,
) -> Option<IpAddr> {
    let mut all_for_ips: Vec<IpAddr> = headers
        .get_all("forwarded")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(parse_forwarded_for_ips)
        .collect();

    if !all_for_ips.is_empty() {
        for ip in all_for_ips.iter().rev() {
            if !trusted_proxies.is_trusted(*ip) {
                return Some(*ip);
            }
        }
    }

    if let Some(xff) = headers.get("x-forwarded-for") {
        if let Ok(xff_str) = xff.to_str() {
            let ips: Vec<IpAddr> = xff_str
                .split(',')
                .map(str::trim)
                .filter_map(|s| IpAddr::from_str(s).ok())
                .collect();
            for ip in ips.iter().rev() {
                if !trusted_proxies.is_trusted(*ip) {
                    return Some(*ip);
                }
            }
        }
    }

    if let Some(real_ip) = headers.get("x-real-ip") {
        if let Ok(ip_str) = real_ip.to_str() {
            if let Ok(ip) = IpAddr::from_str(ip_str.trim()) {
                return Some(ip);
            }
        }
    }

    None
}

// 可信代理中间件
async fn trusted_proxy_middleware(
    Extension(trusted_proxies): Extension<Arc<TrustedProxies>>,
    ConnectInfo(socket_addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    mut req: axum::http::Request<axum::body::Body>,
    next: Next,
) -> impl IntoResponse {
    let socket_ip = socket_addr.ip();
    info!("Connection from: {}", socket_ip);

    let client_ip = if trusted_proxies.is_trusted(socket_ip) {
        extract_client_ip_from_headers(&headers, trusted_proxies.as_ref())
            .unwrap_or(socket_ip)
    } else {
        socket_ip
    };

    info!("Real client IP: {}", client_ip);
    req.extensions_mut().insert(ClientIp(client_ip));

    next.run(req).await
}

// Handler 示例
async fn root(Extension(client_ip): Extension<ClientIp>) -> impl IntoResponse {
    format!(
        "Secure API endpoint\n\
         Your real IP: {}\n\
         CORS, HSTS, TLS enabled",
        client_ip.0
    )
}

async fn health() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let trusted_proxies = Arc::new(TrustedProxies::new(
        vec![
            "127.0.0.1/32".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "192.168.0.0/16".to_string(),
        ],
        Some(10),
    ));

    let hsts_config = Arc::new(HstsConfig::default());

    // === 生产级 CORS 配置 ===
    let cors = CorsLayer::new()
        // 严格限制允许的来源（推荐！不要用 .allow_origin(Any)）
        .allow_origin("https://your-frontend.com".parse::<HeaderValue>()?)
        .allow_origin("https://app.yourdomain.com".parse::<HeaderValue>()?)
        // 允许的方法
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::OPTIONS])
        // 允许的头部
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ])
        // 是否允许携带凭证（如 cookie）
        .allow_credentials(true)
        // 预检请求缓存时间（秒）
        .max_age(86400);

    // 开发环境可放宽（仅限开发！）
    // let cors = CorsLayer::permissive(); // 允许所有来源（不推荐生产）

    let tls_config = RustlsConfig::from_pem_file(
        "certs/fullchain.pem",
        "certs/privkey.pem",
    )
    .await?;

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/api/*path", get(root)) // 示例 API 路径
        .layer(cors)  // CORS 放在最外层或靠近外层
        .layer(middleware::from_fn_with_state(
            trusted_proxies.clone(),
            trusted_proxy_middleware,
        ))
        .layer(middleware::from_fn_with_state(
            hsts_config.clone(),
            hsts_middleware,
        ))
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], 443));
    info!("Starting secure server with CORS, HSTS, TLS on https://{}", addr);

    axum_server::bind_rustls(addr, tls_config)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await?;

    Ok(())
}
```

### 生产 vs 开发 CORS 配置建议

| 环境        | 配置方式                                    | 说明         |
| ----------- | ------------------------------------------- | ------------ |
| 生产        | 明确列出允许的 Origin（如上例）             | 最安全       |
| 开发        | `CorsLayer::permissive()`                   | 方便本地开发 |
| 动态 Origin | 从数据库或配置加载，构建 `Vec<HeaderValue>` | 适用于多租户 |

## 测试 CORS（浏览器或 curl）

```bash
# 预检请求
curl -I -X OPTIONS https://your-api.com/ \
  -H "Origin: https://your-frontend.com" \
  -H "Access-Control-Request-Method: POST"

# 实际请求
curl https://your-api.com/ \
  -H "Origin: https://your-frontend.com" \
  -v
```

检查响应头是否包含：

```
access-control-allow-origin: https://your-frontend.com
access-control-allow-credentials: true
```

## 参考资料

- tower-http CorsLayer 文档：https://docs.rs/tower-http/latest/tower\_http/cors/index.html
- MDN CORS：https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- Axum + CORS 示例：https://github.com/tokio-rs/axum/tree/main/examples
- OWASP CORS 配置指南：https://cheatsheetseries.owasp.org/cheatsheets/CORS\_Cheat\_Sheet.html

现在你的 Axum 服务已具备完整的生产级安全特性：

- 真实客户端 IP 提取（支持 Forwarded + 多级代理）
- rustls TLS 加密
- HSTS 强制 HTTPS
- **严格安全的 CORS 配置**

代码结构清晰、可维护、可扩展，完全符合工业级标准。
