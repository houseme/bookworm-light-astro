---
title: "🦀 Rust Axum 框架中支持 Forwarded 头部的可信代理 IP 处理最佳实践"
description: "`Forwarded` 头部是 RFC 7239 定义的标准头部，比 `X-Forwarded-For` 更安全、更规范。它支持结构化参数，能明确区分客户端 IP、代理 IP、协议等信息，避免了 `X-Forwarded-For` 的模糊性和易伪造问题。"
date: 2025-12-27T10:11:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-vantrangho-4747159.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","tokio","axum"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","rustls","tokio","axum"]
keywords: "rust,实战指南,Rust 生态,2024,Edition,Async,Trait,Future,rustls,tokio,axum"
draft: false
---


## 引言背景

`Forwarded` 头部是 RFC 7239 定义的标准头部，比 `X-Forwarded-For` 更安全、更规范。它支持结构化参数，能明确区分客户端 IP、代理 IP、协议等信息，避免了 `X-Forwarded-For` 的模糊性和易伪造问题。

常见格式示例：
```
Forwarded: for=192.0.2.60;proto=http;by=203.0.113.43
Forwarded: for="_hidden";host=example.com
Forwarded: for=198.51.100.17, for=10.0.0.1, for="[2001:db8::1]"
```

在多级代理场景下，多个 `Forwarded` 头部或单个头部包含多个 `for` 参数。本文基于前文多级代理链实现，进一步扩展自定义中间件，**优先支持 `Forwarded` 头部**，并在缺失时回退到 `X-Forwarded-For` 和 `X-Real-IP`，实现最安全的真实客户端 IP 提取。

目标：工业级、高可读、可维护、可扩展，支持完整 RFC 7239 解析。

## 理论基础

### Forwarded vs X-Forwarded-For 优势
- **标准化**：RFC 7239 定义明确。
- **参数化**：`for`（客户端）、`by`（代理）、`proto`（http/https）、`host`。
- **隐私保护**：支持 `for="_hidden"` 或 `for=unknown`。
- **多值支持**：可多个头部或逗号分隔。
- **安全性**：不易被恶意客户端伪造（需配合可信代理检查）。

### 解析策略（推荐顺序）
1. **优先解析 `Forwarded` 头部**：
  - 从右到左（最新代理追加在最前或最后，标准推荐追加在最前）。
  - 实际中多数代理（如 Nginx、Traefik、Cloudflare）将新条目**追加到最前面**。
  - 逆向遍历所有 `for` 参数，找到第一个非可信代理的 IP，即为客户端 IP。
2. **回退 `X-Forwarded-For`**：多级链逆向剥离。
3. **回退 `X-Real-IP`**：单级兼容。
4. **最终回退 Socket IP**。

### 最佳实践
- 优先 `Forwarded`，兼容旧头部。
- 支持 IPv4 和 IPv6（包括 `[2001:db8::1]` 格式）。
- 忽略未知/无效/隐私标识（如 `_hidden`, `unknown`）。
- 支持 `for` 参数中的引号和方括号。
- 高效解析：避免重复分配，使用迭代器。

## 如何使用与配置

### 步骤 1：依赖不变
继续使用 `ipnet` 处理 CIDR。

### 步骤 2：配置 TrustedProxies
同前文，支持 CIDR 和 max_hops。

### 步骤 3：实现 Forwarded 解析函数
- 提取所有 `Forwarded` 头部值。
- 按标准逆向处理（从最近代理开始）。
- 提取所有 `for` 参数的 IP。
- 逆向查找第一个非可信 IP。

### 步骤 4：中间件优先级
```rust
Forwarded → X-Forwarded-For → X-Real-IP → Socket IP
```

## 完整实例代码

### Cargo.toml
```toml
[package]
name = "axum-trusted-proxies-forwarded"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
tokio = { version = "1.48.0", features = ["full"] }
tower-http = { version = "0.6.8", features = ["trace"] }
rustls = "0.23.35"
rustls-pemfile = "2.2.0"
ipnet = "2.10.1"
tracing = "0.1.40"
tracing-subscriber = "0.3.18"
```

### src/main.rs
```rust
use axum::{
    extract::{ConnectInfo, Extension, Request},
    http::{HeaderMap, HeaderValue},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use ipnet::IpNet;
use std::collections::HashSet;
use std::net::{IpAddr, SocketAddr};
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

// 解析单个 Forwarded 头部值中的所有 for 参数 IP
fn parse_forwarded_for_ips(value: &str) -> Vec<IpAddr> {
    let mut ips = Vec::new();
    for pair in value.split(';') {
        let pair = pair.trim();
        if pair.to_lowercase().starts_with("for=") {
            let for_val = pair[4..].trim();
            let cleaned = for_val
                .trim_matches('"')
                .trim_start_matches('[')
                .trim_end_matches(']');

            if cleaned == "_hidden" || cleaned == "unknown" || cleaned.is_empty() {
                continue;
            }

            if let Ok(ip) = IpAddr::from_str(cleaned) {
                ips.push(ip);
            }
        }
    }
    ips
}

// 主解析函数：优先 Forwarded
fn extract_client_ip_from_headers(
    headers: &HeaderMap,
    trusted_proxies: &TrustedProxies,
) -> IpAddr {
    // 1. 优先 Forwarded 头部（可能多个）
    let mut all_for_ips: Vec<IpAddr> = headers
        .get_all("forwarded")
        .iter()
        .filter_map(|hv| hv.to_str().ok())
        .flat_map(parse_forwarded_for_ips)
        .collect();

    if !all_for_ips.is_empty() {
        // 多数代理将新条目追加到最前 → 逆向遍历 = 从最近代理开始
        for ip in all_for_ips.iter().rev() {
            if !trusted_proxies.is_trusted(*ip) {
                info!("Client IP from Forwarded: {}", ip);
                return *ip;
            }
        }
        warn!("All Forwarded 'for' IPs are trusted proxies, falling back");
    }

    // 2. 回退 X-Forwarded-For
    if let Some(xff) = headers.get("x-forwarded-for") {
        if let Ok(xff_str) = xff.to_str() {
            let ips: Vec<IpAddr> = xff_str
                .split(',')
                .map(str::trim)
                .filter_map(|s| IpAddr::from_str(s).ok())
                .collect();

            if let Some(max) = trusted_proxies.max_hops {
                if ips.len() > max {
                    error!("X-Forwarded-For chain too long: {}", ips.len());
                }
            }

            for ip in ips.iter().rev() {
                if !trusted_proxies.is_trusted(*ip) {
                    info!("Client IP from X-Forwarded-For: {}", ip);
                    return *ip;
                }
            }
        }
    }

    // 3. 回退 X-Real-IP
    if let Some(real_ip) = headers.get("x-real-ip") {
        if let Ok(ip_str) = real_ip.to_str() {
            if let Ok(ip) = IpAddr::from_str(ip_str.trim()) {
                info!("Client IP from X-Real-IP: {}", ip);
                return ip;
            }
        }
    }

    // 最终回退（会在中间件外处理）
    IpAddr::from([0, 0, 0, 0]) // 占位，实际由 socket_ip 决定
}

// 中间件
async fn trusted_proxy_middleware(
    Extension(trusted_proxies): Extension<Arc<TrustedProxies>>,
    ConnectInfo(socket_addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    mut req: Request,
    next: Next,
) -> Response {
    let socket_ip = socket_addr.ip();
    info!("Socket IP: {}", socket_ip);

    let client_ip = if trusted_proxies.is_trusted(socket_ip) {
        let extracted = extract_client_ip_from_headers(&headers, trusted_proxies);
        if extracted != IpAddr::from([0, 0, 0, 0]) {
            extracted
        } else {
            socket_ip // 全链可信
        }
    } else {
        socket_ip
    };

    info!("Final Client IP: {}", client_ip);
    req.extensions_mut().insert(ClientIp(client_ip));

    next.run(req).await
}

// Handler
async fn hello(Extension(client_ip): Extension<ClientIp>) -> impl IntoResponse {
    format!("Hello, your real IP is: {}", client_ip.0)
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let trusted_proxies = Arc::new(TrustedProxies::new(
        vec![
            "127.0.0.1/32".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "192.168.0.0/16".to_string(),
            // Cloudflare 等可添加其 IP 范围
        ],
        Some(10),
    ));

    let app = Router::new()
        .route("/", get(hello))
        .route("/ip", get(|| async move { "Check logs for IP resolution" }))
        .layer(middleware::from_fn(move |req, next| {
            trusted_proxy_middleware(
                Extension(trusted_proxies.clone()),
                req,
                next,
            )
        }))
        .layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
    info!("Server running on http://0.0.0.0:3000 (use HTTPS in production)");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
```

### 测试示例（curl）
```bash
# 模拟多级 Forwarded
curl -H "Forwarded: for=1.2.3.4;by=10.0.0.1, for=203.0.113.43" http://localhost:3000/

# 模拟 X-Forwarded-For
curl -H "X-Forwarded-For: 198.51.100.42, 10.0.0.5, 172.16.0.10" -x 127.0.0.1:3000 http://example.com
```

## 参考资料
- **RFC 7239**: Forwarded HTTP Extension – https://datatracker.ietf.org/doc/html/rfc7239
- MDN Forwarded Header – https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Forwarded
- Nginx proxy_set_header 配置 – https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
- Traefik Forwarded Headers – https://doc.traefik.io/traefik/routing/entrypoints/#forwarded-headers
- Cloudflare True-Client-IP – https://developers.cloudflare.com/fundamentals/reference/http-headers/
- Rust HTTP Headers 解析讨论 – https://github.com/hyperium/headers
- Axum Middleware 示例 – https://docs.rs/axum/latest/axum/middleware/index.html

此实现已达到工业级标准：优先标准头部、安全逆向解析、兼容旧头部、错误容忍、高可读性。推荐在生产环境中优先启用 `Forwarded` 支持。
