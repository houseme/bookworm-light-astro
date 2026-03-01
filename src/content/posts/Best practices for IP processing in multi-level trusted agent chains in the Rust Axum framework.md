---
title: "🦀 Rust Axum 框架中多级可信代理链 IP 处理的最佳实践"
description: "基于 Rust 的 Axum 框架（版本 0.8），结合 Tokio（1.48.0）、Tower-HTTP（0.6.8）和 Rustls（0.23.35），我们扩展自定义中间件以支持多级代理链。该实践强调高效解析（使用逆向迭代避免额外分配）、错误容忍（无效 IP 跳过）和可扩展性（易集成日志或 Forwarded 头部支持）。"
date: 2025-12-26T10:11:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-marek-piwnicki-3907296-29451002.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","tokio","axum"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","2024","Edition","Async","Trait","Future","rustls","tokio","axum"]
keywords: "rust,实战指南,Rust 生态,2024,Edition,Async,Trait,Future,rustls,tokio,axum"
draft: false
---


## 引言背景

在单级代理场景下，简单取 X-Forwarded-For 头部的第一个 IP 即可。但在多级代理链中，X-Forwarded-For 头部会包含多个 IP（如 "client-ip, proxy1-ip, proxy2-ip"），其中最左侧为原始客户端 IP，最右侧为最近的代理 IP。为了安全提取真实客户端 IP，需要从右侧（最近代理）开始逆向遍历，剥离所有可信代理 IP，直到遇到第一个不可信 IP，即为客户端 IP。如果整个链均为可信，则回退到 Socket IP。

基于 Rust 的 Axum 框架（版本 0.8），结合 Tokio（1.48.0）、Tower-HTTP（0.6.8）和 Rustls（0.23.35），我们扩展自定义中间件以支持多级代理链。该实践强调高效解析（使用逆向迭代避免额外分配）、错误容忍（无效 IP 跳过）和可扩展性（易集成日志或 Forwarded 头部支持）。

本文从基础单级回顾入手，逐步深入多级链理论、配置优化和使用，最后提供完整实例代码。

## 理论基础

### 单级 vs. 多级代理
- **单级**：Socket IP 为代理 IP，X-Forwarded-For 为 "client-ip"。若代理可信，直接取 client-ip。
- **多级**：Socket IP 为最后代理（proxyN），X-Forwarded-For 为 "client-ip, proxy1, ..., proxy(N-1)"。需验证链条以防伪造。
- **RFC 7239 与 X-Forwarded-For**：Forwarded 头部更现代（支持参数如 by=proxy-ip），但 X-Forwarded-For 更普遍。多级时，每个代理追加自身 IP（实际是前一 IP）。
- **安全原理**：仅当 Socket IP 可信时，才信任头部。然后逆向遍历（从链末端）：
  1. 检查链末 IP（最近代理前一）是否可信，若是剥离。
  2. 重复直到非可信 IP（客户端）。
  3. 若全可信，回退 Socket IP（罕见，视作内部请求）。
- **风险与优化**：
  - 伪造：非可信来源可注入假 IP，故先验 Socket IP。
  - 私有/Loopback IP：trusted 列表应包括 127.0.0.1/32、10.0.0.0/8 等。
  - 性能：使用 Vec<IpAddr> 解析一次，逆向迭代 O(n)，n 通常 <5。
  - 错误：无效 IP 字符串跳过或日志，避免崩溃。
- **高级考虑**：
  - 支持 Forwarded：解析 "for=client-ip;by=proxy"，更精确。
  - 日志：记录完整链以审计。
  - 配置：支持深度限制（max hops）防滥用。

### 为什么扩展中间件？
Axum 的中间件链允许无缝插入。扩展前文单级实现，支持多级提升准确性。使用 Tokio 异步确保非阻塞，Rustls 提供 TLS 安全传输。

### 优势与最佳实践
- **高效性**：逆向迭代零拷贝，ipnet 处理 CIDR。
- **可读性**：清晰循环结构，注释说明链解析。
- **可扩展性**：易添加 max_hops 或 Forwarded 解析。
- **工业级**：单元测试链解析，panic-free 错误处理。

## 如何使用与配置

### 步骤 1：依赖准备
同前文，添加 ipnet 用于 CIDR。

### 步骤 2：配置可信代理
扩展 TrustedProxies 支持多 CIDR，添加可选 max_hops（默认无限制）。

### 步骤 3：实现中间件
- 检查 Socket IP 是否可信。
- 若可信，解析 X-Forwarded-For 为 Vec<IpAddr>。
- 逆向遍历：找到第一个非可信 IP。
- 插入 ClientIp 扩展。
- 支持回退 X-Real-IP（单级兼容）。

### 步骤 4：集成到 Axum
同前文，在 Router layer 添加。

### 步骤 5：测试与部署
- 测试：模拟多级链（如 curl -H "X-Forwarded-For: 1.1.1.1, 2.2.2.2" --proxy trusted-ip）。
- 部署：Nginx 等代理配置 append X-Forwarded-For。

由浅入深：
- 初级：单级取首 IP。
- 中级：逆向剥离单一 trusted。
- 高级：多级链 + max_hops + Forwarded。

## 完整实例代码

### Cargo.toml
```toml
[package]
name = "axum-trusted-proxies-multi"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
tokio = { version = "1.48.0", features = ["full"] }
tower-http = { version = "0.6.8", features = ["trace"] }
rustls = "0.23.35"
rustls-pemfile = "2.2.0"
ipnet = "2.10.1"
hyper = { version = "1.5.0", features = ["server"] }
tracing = "0.1.40"
tracing-subscriber = "0.3.18"
```

### src/main.rs
```rust
use axum::{
    extract::{ConnectInfo, Extension, Request},
    http::{HeaderMap, StatusCode},
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
use tracing::{error, info};
use rustls::{Certificate, PrivateKey, ServerConfig};
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::fs::File;
use std::io::BufReader;

// 自定义扩展：客户端真实 IP
#[derive(Clone, Copy, Debug)]
pub struct ClientIp(pub IpAddr);

// 配置结构体：添加 max_hops 可扩展
#[derive(Clone, Debug)]
pub struct TrustedProxies {
    proxies: HashSet<IpNet>,
    max_hops: Option<usize>,  // 可选最大链长，防滥用
}

impl TrustedProxies {
    pub fn new(proxies: Vec<String>, max_hops: Option<usize>) -> Self {
        let mut set = HashSet::new();
        for proxy in proxies {
            match IpNet::from_str(&proxy) {
                Ok(net) => { set.insert(net); }
                Err(e) => { error!("Invalid proxy CIDR: {}, error: {}", proxy, e); }
            }
        }
        Self { proxies: set, max_hops }
    }

    pub fn is_trusted(&self, ip: IpAddr) -> bool {
        self.proxies.iter().any(|net| net.contains(&ip))
    }
}

// 中间件：支持多级链解析
async fn trusted_proxy_middleware(
    Extension(trusted_proxies): Extension<Arc<TrustedProxies>>,
    ConnectInfo(socket_addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    mut req: Request,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let socket_ip = socket_addr.ip();
    info!("Socket IP: {}", socket_ip);

    let mut client_ip = socket_ip;

    if trusted_proxies.is_trusted(socket_ip) {
        // 优先 X-Forwarded-For 多级解析
        if let Some(forwarded) = headers.get("x-forwarded-for") {
            let forwarded_str = forwarded.to_str().map_err(|_| (StatusCode::BAD_REQUEST, "Invalid header".to_string()))?;
            let ips: Vec<IpAddr> = forwarded_str.split(',')
                .map(str::trim)
                .filter_map(|s| IpAddr::from_str(s).ok())
                .collect();

            // 检查链长
            if let Some(max) = trusted_proxies.max_hops {
                if ips.len() > max {
                    error!("Proxy chain too long: {}", ips.len());
                    return Err((StatusCode::BAD_REQUEST, "Proxy chain too long".to_string()));
                }
            }

            // 逆向遍历：从链末找到第一个非可信 IP
            let mut found = false;
            for ip in ips.iter().rev() {
                if !trusted_proxies.is_trusted(*ip) {
                    client_ip = *ip;
                    found = true;
                    break;
                }
            }

            if !found {
                // 全可信，回退 socket_ip
                info!("All proxies trusted, fallback to socket IP");
            } else {
                info!("Resolved client IP from chain: {}", client_ip);
            }
        } else if let Some(real_ip) = headers.get("x-real-ip") {
            // 回退单级 X-Real-IP
            let real_ip_str = real_ip.to_str().map_err(|_| (StatusCode::BAD_REQUEST, "Invalid header".to_string()))?;
            if let Ok(ip) = IpAddr::from_str(real_ip_str) {
                client_ip = ip;
            } else {
                error!("Invalid IP in X-Real-IP: {}", real_ip_str);
            }
        }
    }

    req.extensions_mut().insert(ClientIp(client_ip));

    Ok(next.run(req).await)
}

// 示例 Handler
async fn hello(Extension(client_ip): Extension<ClientIp>) -> impl IntoResponse {
    format!("Hello from IP: {}", client_ip.0)
}

// TLS 配置函数
fn load_tls_config() -> Arc<ServerConfig> {
    let cert_file = &mut BufReader::new(File::open("cert.pem").unwrap());
    let key_file = &mut BufReader::new(File::open("key.pem").unwrap());

    let cert_chain = certs(cert_file).unwrap().into_iter().map(Certificate).collect();
    let mut keys = pkcs8_private_keys(key_file).unwrap();

    let config = ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(cert_chain, PrivateKey(keys.remove(0)))
        .unwrap();

    Arc::new(config)
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // 配置：添加 max_hops 示例
    let trusted_proxies = Arc::new(TrustedProxies::new(
        vec![
            "127.0.0.1/32".to_string(),
            "192.168.0.0/16".to_string(),
        ],
        Some(5),  // 最大 5 级链
    ));

    let app = Router::new()
        .route("/", get(hello))
        .layer(middleware::from_fn(move |req, next| {
            trusted_proxy_middleware(Extension(trusted_proxies.clone()), req, next)
        }))
        .layer(TraceLayer::new_for_http());

    let tls_config = load_tls_config();

    let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum_server::from_tcp(listener)
        .tls(tls_config)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}
```

### 附属文件说明
- **cert.pem** 和 **key.pem**：同前文，自生成 TLS 证书。
- 无其他附属文件；代码自包含。

## 参考资料
- Axum 文档：https://docs.rs/axum/0.8.0/axum/ （中间件扩展）。
- Tower-HTTP：https://docs.rs/tower-http/0.6.8/tower_http/ 。
- Tokio：https://docs.rs/tokio/1.48.0/tokio/ 。
- Rustls：https://docs.rs/rustls/0.23.35/rustls/ 。
- RFC 7239：https://datatracker.ietf.org/doc/html/rfc7239 。
- Ipnet：https://docs.rs/ipnet/2.10.1/ipnet/ 。
- MDN X-Forwarded-For：https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For 。
- StackHawk 博客：https://www.stackhawk.com/blog/do-you-trust-your-x-forwarded-for-header/ （信任处理）。
- Varnish 博客：https://info.varnish-software.com/blog/handling-the-x-forwarded-for-header（多级示例）。
- Reddit/Rust：Axum 代理讨论（如 reverse proxy 生产使用）。
