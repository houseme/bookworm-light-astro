---
title: "🦀 Axum 真 IP + TLS1.3 + HSTS：三行代码锁死 HTTPS，代理白名单秒配"
description: "Rust Axum 官方中间件，自动识别可信代理 IP，强制 TLS1.3，一键注入 HSTS 头，防 SSL 剥离与中间人，Docker 直接跑，生产级安全开箱即用。"
date: 2025-12-30T10:11:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-abdullahoguk-35519310.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","tokio","axum"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","rustls","tokio","axum","openssl","rustls-pemfile","axum_server","tower-http","tracing","tracing-subscriber","ipnet","tls","hsts"]
keywords: "rust,实战指南,Rust 生态,2024,Edition,Async,Trait,Future,rustls,tokio,axum,openssl,rustls-pemfile,axum_server,tower-http,tracing,tracing-subscriber,ipnet,tls,hsts"
draft: false
---


# Rust Axum 框架中可信代理 IP 处理 + TLS + HSTS 头部支持最佳实践

## 引言背景

在生产环境中，启用 HTTPS 后，必须通过 **HSTS (HTTP Strict Transport Security)** 头部强制浏览器始终使用 HTTPS 访问你的站点，防止 SSL 剥离攻击（SSL Stripping）和中间人攻击。

HSTS 头部格式：
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age`：秒数，推荐至少 31536000（1 年），生产建议 2 年（63072000）
- `includeSubDomains`：可选，适用于所有子域名
- `preload`：可选，允许提交到浏览器预加载列表（https://hstspreload.org）

本节在前文完整实现（多级代理、Forwarded 支持、rustls TLS）基础上，添加**工业级 HSTS 中间件**，确保所有响应自动携带正确的 HSTS 头部。

## 最佳实践要点

- 只在 HTTPS 连接下发送 HSTS（我们使用 rustls TLS 终止，已保证）
- 使用 Tower 中间件方式添加头部，高可读、可复用
- 支持配置 max-age、includeSubDomains、preload
- 与 TraceLayer、代理中间件完美层叠
- 不影响性能（仅添加一个静态头部）

## 完整实例代码（含 HSTS 支持）

### Cargo.toml
```toml
[package]
name = "axum-trusted-proxies-tls-hsts"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
axum_server = "0.7"
tokio = { version = "1.48.0", features = ["full"] }
tower = "0.5"
tower-http = { version = "0.6.8", features = ["trace"] }
rustls = "0.23.35"
rustls-pemfile = "2.2.0"
ipnet = "2.10.1"
tracing = "0.1.40"
tracing-subscriber = "0.3.18"
```

> 注意：新增 `tower = "0.5"` 用于自定义 AddExtensionLayer（可选，下面提供纯 middleware 实现更简洁）

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
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing::{error, info, warn};

// 自定义扩展：真实客户端 IP
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

// HSTS 配置结构体（高可配置性）
#[derive(Clone)]
pub struct HstsConfig {
    pub max_age: u64,
    pub include_subdomains: bool,
    pub preload: bool,
}

impl Default for HstsConfig {
    fn default() -> Self {
        Self {
            max_age: 63072000,          // 2 年（强烈推荐）
            include_subdomains: true,   // 生产建议启用
            preload: false,             // 仅在确认符合 preload 要求后启用
        }
    }
}

// HSTS 中间件：为所有响应添加 Strict-Transport-Security 头部
async fn hsts_middleware(mut response: Response, next: Next) -> Response {
    let hsts_config = Extension::<Arc<HstsConfig>>::extract(&response)
        .await
        .ok()
        .map(|ext| ext.0);

    let mut res = next.run(response).await;

    if let Some(config) = hsts_config {
        let mut value = format!("max-age={}", config.max_age);

        if config.include_subdomains {
            value.push_str("; includeSubDomains");
        }
        if config.preload {
            value.push_str("; preload");
        }

        if let Ok(header_value) = HeaderValue::from_static(Box::leak(value.into_boxed_str())) {
            res.headers_mut().insert("strict-transport-security", header_value);
        }
    }

    res
}

// Forwarded 解析函数（同前）
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
    // 1. Forwarded
    let mut all_for_ips: Vec<IpAddr> = headers
        .get_all("forwarded")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(parse_forwarded_for_ips)
        .collect();

    if !all_for_ips.is_empty() {
        for ip in all_for_ips.iter().rev() {
            if !trusted_proxies.is_trusted(*ip) {
                info!("Client IP from Forwarded: {}", ip);
                return Some(*ip);
            }
        }
    }

    // 2. X-Forwarded-For
    if let Some(xff) = headers.get("x-forwarded-for") {
        if let Ok(xff_str) = xff.to_str() {
            let ips: Vec<IpAddr> = xff_str
                .split(',')
                .map(str::trim)
                .filter_map(|s| IpAddr::from_str(s).ok())
                .collect();

            for ip in ips.iter().rev() {
                if !trusted_proxies.is_trusted(*ip) {
                    info!("Client IP from X-Forwarded-For: {}", ip);
                    return Some(*ip);
                }
            }
        }
    }

    // 3. X-Real-IP
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
    mut req: Request,
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

// Handler
async fn root(Extension(client_ip): Extension<ClientIp>) -> impl IntoResponse {
    format!(
        "Secure connection established!\n\
         Your real IP: {}\n\
         HSTS enabled (check response headers)",
        client_ip.0
    )
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    // 可信代理配置
    let trusted_proxies = Arc::new(TrustedProxies::new(
        vec![
            "127.0.0.1/32".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "192.168.0.0/16".to_string(),
        ],
        Some(10),
    ));

    // HSTS 配置（生产推荐）
    let hsts_config = Arc::new(HstsConfig {
        max_age: 63072000,         // 2 年
        include_subdomains: true,
        preload: false,            // 仅在 https://hstspreload.org 提交后启用
    });

    // TLS 配置
    let tls_config = RustlsConfig::from_pem_file(
        "certs/fullchain.pem",
        "certs/privkey.pem",
    )
    .await?;

    // Router
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(|| async { "OK" }))
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
    info!("Starting HTTPS server with HSTS on https://{}", addr);

    axum_server::bind_rustls(addr, tls_config)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await?;

    Ok(())
}
```

### 验证 HSTS 是否生效（curl）
```bash
curl -I https://your-domain.com
```

预期输出包含：
```
strict-transport-security: max-age=63072000; includeSubDomains
```

浏览器中访问后，检查 DevTools → Network → Headers。

## 生产建议

| 项目                | 推荐值                                      |
|---------------------|---------------------------------------------|
| max-age             | 63072000（2 年）                             |
| includeSubDomains   | true（如果所有子域都支持 HTTPS）            |
| preload             | 仅在满足 https://hstspreload.org 要求后启用 |
| 证书                | Let's Encrypt 或付费 CA                     |
| 前端代理            | 可选 Nginx/Traefik 做反向代理（记得 proxy_ssl_*） |

## 参考资料
- MDN Strict-Transport-Security：https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
- HSTS Preload List：https://hstspreload.org
- OWASP HSTS Cheat Sheet：https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html
- axum_server TLS 示例：https://docs.rs/axum-server
- Rustls 文档：https://docs.rs/rustls/0.23.35/rustls/

至此，你已拥有一个**完整生产级** Axum 服务：
- 真实客户端 IP 提取（支持 Forwarded + 多级代理）
- rustls TLS 加密
- HSTS 安全头部强制
- 高可读、可维护、可配置的工业级代码结构
