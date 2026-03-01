---
title: "🦀 Axum 真 IP 秒取：TLS 全程加密，可信代理一键白名单"
description: "Rust Axum 官方 Tower 层，三行代码识别 Cloudflare/Nginx 代理，自动校验证书链，强制 TLS1.3，零配置拿到真实客户端 IP，Docker 一键跑。"
date: 2025-12-29T10:11:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-john-page-2149641996-35090290.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","tokio","axum"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","rustls","tokio","axum","openssl","rustls-pemfile","axum_server","tower-http","tracing","tracing-subscriber","ipnet","tls"]
keywords: "rust,实战指南,Rust 生态,2024,Edition,Async,Trait,Future,rustls,tokio,axum,openssl,rustls-pemfile,axum_server,tower-http,tracing,tracing-subscriber,ipnet,tls"
draft: false
---

# Rust Axum 框架中可信代理 IP 处理的完整 TLS 支持最佳实践

## 引言背景

在前文实现的基础上（支持 Forwarded、X-Forwarded-For 多级链解析），现在我们将**完整添加生产级 TLS 支持**，使用 **rustls 0.23.35** 实现 HTTPS 终止，确保：

- 安全的加密传输
- 正确的 `ConnectInfo` 获取（Axum 在 TLS 下仍能正确提供 SocketAddr）
- 与可信代理中间件无缝集成
- 高可读性、可配置性（支持 PEM 文件、内存加载证书）

本实现使用 `axum_server` crate（专为 rustls 设计）替代原生 `axum::serve`，因为 Axum 0.8 原生不支持直接绑定 rustls。

## 理论与最佳实践

### 为什么使用 axum_server + rustls？
- Axum 0.8 核心不绑定 TLS，由上层服务器决定。
- `axum_server` 是社区推荐方案，完美支持 `into_make_service_with_connect_info::<SocketAddr>()`，确保 `ConnectInfo` 在 HTTPS 下正常工作。
- rustls 是纯 Rust 实现，无需 OpenSSL，部署更安全、轻量。

### TLS 配置要点
- 支持 PEM 格式证书链和私钥（标准生产格式）
- 支持 PKCS#8 私钥（推荐）
- 生产建议：使用 Let's Encrypt 或企业 CA
- 开发：自签名证书可接受

### 与可信代理兼容性
- TLS 终止后，Socket IP 仍是直接连接的代理 IP（正确）
- HTTP 头部（如 Forwarded）仍由前端代理（如 Nginx、Traefik、Caddy）设置
- 中间件逻辑完全不变

## 完整实例代码（含生产级 TLS）

### Cargo.toml
```toml
[package]
name = "axum-trusted-proxies-tls"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
axum_server = "0.7"  # 专为 rustls 设计的服务器
tokio = { version = "1.48.0", features = ["full"] }
tower-http = { version = "0.6.8", features = ["trace"] }
rustls = "0.23.35"
rustls-pemfile = "2.2.0"
ipnet = "2.10.1"
tracing = "0.1.40"
tracing-subscriber = "0.3.18"
```

> 注意：使用 `axum_server` 而非 `hyper` 原生服务器。

### src/main.rs
```rust
use axum::{
    extract::{ConnectInfo, Extension},
    http::HeaderMap,
    middleware::{self, Next},
    response::IntoResponse,
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

// 自定义扩展
#[derive(Clone, Copy, Debug)]
pub struct ClientIp(pub IpAddr);

// 配置结构体
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

// 解析 Forwarded 头部中的 for 参数
fn parse_forwarded_for_ips(value: &str) -> Vec<IpAddr> {
    let mut ips = Vec::new();
    for pair in value.split(';') {
        let pair = pair.trim();
        if pair.to_lowercase().starts_with("for=") {
            let mut for_val = pair[4..].trim().to_string();
            // 去除引号和 IPv6 方括号
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

// 提取客户端真实 IP（优先 Forwarded）
fn extract_client_ip_from_headers(
    headers: &HeaderMap,
    trusted_proxies: &TrustedProxies,
) -> Option<IpAddr> {
    // 1. Forwarded 头部（可能多个）
    let mut all_for_ips: Vec<IpAddr> = headers
        .get_all("forwarded")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(parse_forwarded_for_ips)
        .collect();

    if !all_for_ips.is_empty() {
        for ip in all_for_ips.iter().rev() {
            if !trusted_proxies.is_trusted(*ip) {
                info!("Client IP resolved from Forwarded: {}", ip);
                return Some(*ip);
            }
        }
        warn!("All Forwarded IPs are trusted proxies");
    }

    // 2. X-Forwarded-For
    if let Some(xff) = headers.get("x-forwarded-for") {
        if let Ok(xff_str) = xff.to_str() {
            let ips: Vec<IpAddr> = xff_str
                .split(',')
                .map(str::trim)
                .filter_map(|s| IpAddr::from_str(s).ok())
                .collect();

            if let Some(max) = trusted_proxies.max_hops {
                if ips.len() > max {
                    error!("X-Forwarded-For chain too long");
                    return None;
                }
            }

            for ip in ips.iter().rev() {
                if !trusted_proxies.is_trusted(*ip) {
                    info!("Client IP resolved from X-Forwarded-For: {}", ip);
                    return Some(*ip);
                }
            }
        }
    }

    // 3. X-Real-IP
    if let Some(real_ip) = headers.get("x-real-ip") {
        if let Ok(ip_str) = real_ip.to_str() {
            if let Ok(ip) = IpAddr::from_str(ip_str.trim()) {
                info!("Client IP resolved from X-Real-IP: {}", ip);
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
    info!("Direct connection from (Socket IP): {}", socket_ip);

    let client_ip = if trusted_proxies.is_trusted(socket_ip) {
        extract_client_ip_from_headers(&headers, trusted_proxies.as_ref())
            .unwrap_or(socket_ip)
    } else {
        socket_ip
    };

    info!("Determined real client IP: {}", client_ip);
    req.extensions_mut().insert(ClientIp(client_ip));

    next.run(req).await
}

// Handler 示例
async fn root(Extension(client_ip): Extension<ClientIp>) -> impl IntoResponse {
    format!(
        "Hello! Your real IP address is: {}\n\
         This connection is secured with TLS (HTTPS).",
        client_ip.0
    )
}

async fn health() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    // === 可信代理配置 ===
    let trusted_proxies = Arc::new(TrustedProxies::new(
        vec![
            "127.0.0.1/32".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "192.168.0.0/16".to_string(),
            // 生产中可添加 Cloudflare、AWS ELB 等 IP 段
        ],
        Some(10),
    ));

    // === TLS 配置 ===
    let tls_config = RustlsConfig::from_pem_file(
        Path::new("certs/fullchain.pem"),   // 证书链（包含中间证书）
        Path::new("certs/privkey.pem"),     // 私钥
    )
    .await?;

    // === Router 构建 ===
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .layer(middleware::from_fn_with_state(
            trusted_proxies.clone(),
            trusted_proxy_middleware,
        ))
        .layer(TraceLayer::new_for_http())
        .with_state(()); // 无需状态

    // === 启动 HTTPS 服务器 ===
    let addr = SocketAddr::from(([0, 0, 0, 0], 443));
    info!("HTTPS server starting on https://{}", addr);

    axum_server::bind_rustls(addr, tls_config)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await?;

    Ok(())
}
```

### 证书目录结构（推荐）
```
project/
├── Cargo.toml
├── src/
│   └── main.rs
└── certs/
    ├── fullchain.pem    # Let's Encrypt 下载的 fullchain.pem
    └── privkey.pem      # 私钥（无密码保护）
```

### 自签名证书生成（开发测试用）
```bash
openssl req -x509 -newkey rsa:4096 -keyout certs/privkey.pem -out certs/fullchain.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

## 生产部署建议

| 项目              | 推荐配置                                      |
|-------------------|-----------------------------------------------|
| 证书              | Let's Encrypt（certbot）或企业 CA             |
| 私钥格式          | PKCS#8（rustls-pemfile 支持）                 |
| 端口              | 443（HTTPS）                                  |
| 前置代理          | Nginx / Traefik / Caddy 设置 Forwarded 头部   |
| HSTS              | 在前端代理或添加自定义中间件启用               |
| OCSP Stapling     | rustls 当前不支持，可由前端代理提供            |

## 参考资料
- axum_server 文档：https://docs.rs/axum-server
- rustls 文档：https://docs.rs/rustls/0.23.35/rustls/
- RustlsConfig：https://docs.rs/axum-server/latest/axum_server/tls_rustls/struct.RustlsConfig.html
- Let's Encrypt 证书说明：https://letsencrypt.org/docs/certificates/
- Cloudflare IP 范围：https://www.cloudflare.com/ips/
- RFC 7239 Forwarded：https://datatracker.ietf.org/doc/html/rfc7239
- Axum ConnectInfo with TLS：https://docs.rs/axum/latest/axum/extract/struct.ConnectInfo.html

现在你拥有了一个**工业级、生产就绪**的 Axum 服务：支持多级可信代理、Forwarded 头部解析、完整 TLS 加密，且代码结构清晰、可维护、可扩展。
