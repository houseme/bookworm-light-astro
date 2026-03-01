---
title: "Axum 可信代理 5 分钟：一键取真 IP，防伪造头攻击"
description: "从零配置 Forwarded、X-Forwarded-For，自定义提取层自动校验代理白名单，Nginx→Axum 端到段示例，拒绝伪造，安全开箱。"
date: 2025-12-20T18:22:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-faical-zaramod-254511-774835.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","Axum","可信代理","真实IP","反向代理","安全防护","Web开发","中间件","网络编程","性能优化","最佳实践","安全加固"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","Axum","可信代理","真实IP","反向代理","安全防护","Web开发","中间件","网络编程","性能优化","最佳实践","安全加固","Forwarded头","X-Forwarded-For头","代理白名单","IP提取","请求处理","Axum中间件","Nginx集成","安全实践","Rust网络编程","Axum实战","Web应用安全"]
keywords: "rust,实战指南,Rust 生态,Axum,可信代理,真实IP,反向代理,安全防护,Web开发,中间件,网络编程,性能优化,最佳实践,安全加固,Forwarded头,X-Forwarded-For头,代理白名单,IP提取,请求处理,Axum中间件,Nginx集成,安全实践,Rust网络编程,Axum实战,Web应用安全"
draft: false
---

# Axum 可信代理实战指南：从零构建安全的反向代理感知应用

## 引言：为什么你的 Web 应用需要“可信代理”处理？

在现代 Web 应用部署中，直接面向公网提供服务的情况越来越少。大多数生产环境都会使用**反向代理架构**——你的 Rust 应用运行在内部网络，前面由 Nginx、HAProxy、Cloudflare 或 AWS ALB 等代理服务器接收外部请求并转发到后端。

考虑这个典型场景：你的 Axum 应用运行在 Docker 容器（IP: `172.17.0.2`）中，前面是 Nginx（IP: `10.0.0.10`）作为反向代理。当用户（IP: `203.0.113.195`）访问你的网站时：

1. 用户请求到达 Nginx（记录客户端真实 IP）
2. Nginx 将请求转发给后端 Axum 应用
3. **问题来了**：Axum 看到的连接来自`10.0.0.10`（Nginx），而不是`203.0.113.195`（真实用户）

没有正确的代理处理，你的应用会丢失关键信息：无法记录真实用户 IP、无法实施基于 IP 的访问控制、审计日志变得无用。本教程将带你从零开始，在 Axum 应用中正确、安全地处理这一挑战。

## 第一部分：基础概念与原理

### 1.1 代理头部：信息如何传递

反向代理通过 HTTP 头部传递原始客户端信息。以下是关键头部字段：

| 头部 | 说明 | 示例值 | 安全风险 |
|------|------|--------|----------|
| `X-Forwarded-For` | 客户端和中间代理 IP 链 | `203.0.113.195, 70.41.3.18` | **可被客户端伪造** |
| `X-Forwarded-Host` | 原始请求主机名 | `api.example.com` | 可被伪造 |
| `X-Forwarded-Proto` | 原始请求协议 | `https` | 可被伪造 |
| `X-Real-IP` | 客户端 IP（非标准） | `203.0.113.195` | 可被伪造 |

### 1.2 安全挑战：为什么不能盲目信任这些头部

假设你的应用直接面向公网，攻击者可以发送这样的请求：

```http
GET /admin HTTP/1.1
Host: your-app.com
X-Forwarded-For: 8.8.8.8
X-Real-IP: 8.8.8.8
```

如果你的应用盲目信任这些头部，攻击者就能：
- 伪造 IP 绕过 IP 黑名单
- 伪造内部 IP 访问管理接口
- 扰乱基于 IP 的速率限制
- 使审计日志失效

**核心安全原则**：只接受来自可信代理的转发头部。

## 第二部分：环境搭建与项目初始化

### 2.1 创建项目并添加依赖

```bash
# 创建新项目
cargo new axum-trusted-proxies-tutorial
cd axum-trusted-proxies-tutorial

# 添加必要依赖
```

更新 `Cargo.toml`：

```toml
[package]
name = "axum-trusted-proxies-tutorial"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1.37", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["full"] }
ipnetwork = "0.20"      # 处理 CIDR 范围
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"      # JSON 处理
tracing = "0.1"         # 日志
tracing-subscriber = "0.3"
anyhow = "1.0"          # 错误处理
```

### 2.2 理解 Tower 中间件架构

在开始编码前，理解 Axum 的中间件架构至关重要：

```
客户端请求 → Tower中间件层 → Axum路由层 → 业务处理
       ↑                                     ↓
       └───── 响应经过相同中间件 ←───────────┘
```

我们的可信代理中间件将位于**最外层**，确保后续所有处理都能使用已验证的客户端信息。

## 第三部分：基础实现：可信代理验证

### 3.1 定义配置结构

创建 `src/config.rs`：

```rust
use ipnetwork::IpNetwork;
use std::net::{IpAddr, SocketAddr};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

/// 可信代理配置：支持单个 IP 或 CIDR 网段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrustedProxy {
    /// 单个 IP 地址
    Single(IpAddr),
    /// IP 地址段 (CIDR 表示法)
    Cidr(IpNetwork),
}

impl TrustedProxy {
    /// 从字符串解析可信代理配置
    /// 支持："127.0.0.1", "10.0.0.0/8", "::1"
    pub fn from_str(s: &str) -> anyhow::Result<Self> {
        if s.contains('/') {
            // CIDR 表示法
            let network = IpNetwork::from_str(s)
                .map_err(|e| anyhow::anyhow!("无效 CIDR 格式 '{}': {}", s, e))?;
            Ok(TrustedProxy::Cidr(network))
        } else {
            // 单个 IP
            let ip = IpAddr::from_str(s)
                .map_err(|e| anyhow::anyhow!("无效 IP 地址 '{}': {}", s, e))?;
            Ok(TrustedProxy::Single(ip))
        }
    }
    
    /// 检查 IP 是否匹配此配置
    pub fn contains(&self, ip: &IpAddr) -> bool {
        match self {
            TrustedProxy::Single(proxy_ip) => ip == proxy_ip,
            TrustedProxy::Cidr(network) => network.contains(*ip),
        }
    }
}

/// 可信代理配置集合
#[derive(Debug, Clone)]
pub struct TrustedProxiesConfig {
    proxies: Vec<TrustedProxy>,
}

impl TrustedProxiesConfig {
    /// 创建新配置
    pub fn new(proxies: Vec<TrustedProxy>) -> Self {
        Self { proxies }
    }
    
    /// 从字符串切片创建配置
    pub fn from_strs(proxy_strs: &[&str]) -> anyhow::Result<Self> {
        let mut proxies = Vec::new();
        
        for s in proxy_strs {
            proxies.push(TrustedProxy::from_str(s)?);
        }
        
        Ok(Self::new(proxies))
    }
    
    /// 检查 SocketAddr 是否来自可信代理
    pub fn is_trusted(&self, addr: &SocketAddr) -> bool {
        let ip = addr.ip();
        self.proxies.iter().any(|proxy| proxy.contains(&ip))
    }
    
    /// 获取可信代理列表（用于调试/日志）
    pub fn get_trusted_ranges(&self) -> Vec<String> {
        self.proxies.iter().map(|p| match p {
            TrustedProxy::Single(ip) => ip.to_string(),
            TrustedProxy::Cidr(network) => network.to_string(),
        }).collect()
    }
}

/// 存储在请求扩展中的客户端真实信息
#[derive(Debug, Clone)]
pub struct ClientInfo {
    /// 真实客户端 IP 地址（已验证）
    pub real_ip: IpAddr,
    /// 原始请求主机名（如果来自可信代理）
    pub forwarded_host: Option<String>,
    /// 原始请求协议（如果来自可信代理）
    pub forwarded_proto: Option<String>,
    /// 请求是否来自可信代理
    pub is_from_trusted_proxy: bool,
    /// 直接连接的代理 IP（如果经过代理）
    pub proxy_ip: Option<IpAddr>,
}

impl ClientInfo {
    /// 创建直接连接的客户端信息（无代理）
    pub fn direct(addr: SocketAddr) -> Self {
        Self {
            real_ip: addr.ip(),
            forwarded_host: None,
            forwarded_proto: None,
            is_from_trusted_proxy: false,
            proxy_ip: None,
        }
    }
    
    /// 从可信代理创建客户端信息
    pub fn from_trusted_proxy(
        real_ip: IpAddr,
        forwarded_host: Option<String>,
        forwarded_proto: Option<String>,
        proxy_ip: IpAddr,
    ) -> Self {
        Self {
            real_ip,
            forwarded_host,
            forwarded_proto,
            is_from_trusted_proxy: true,
            proxy_ip: Some(proxy_ip),
        }
    }
}
```

### 3.2 实现核心中间件

创建 `src/middleware.rs`：

```rust
use axum::extract::Request;
use axum::response::Response;
use std::task::{ready, Context, Poll};
use tower::{Layer, Service};
use tracing::{info_span, instrument, Instrument};

use crate::config::{TrustedProxiesConfig, ClientInfo};
use std::net::SocketAddr;

/// 可信代理中间件层
#[derive(Clone)]
pub struct TrustedProxiesLayer {
    config: TrustedProxiesConfig,
}

impl TrustedProxiesLayer {
    pub fn new(config: TrustedProxiesConfig) -> Self {
        Self { config }
    }
}

impl<S> Layer<S> for TrustedProxiesLayer {
    type Service = TrustedProxiesMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        TrustedProxiesMiddleware {
            inner,
            config: self.config.clone(),
        }
    }
}

/// 可信代理中间件服务
#[derive(Clone)]
pub struct TrustedProxiesMiddleware<S> {
    inner: S,
    config: TrustedProxiesConfig,
}

impl<S> Service<Request> for TrustedProxiesMiddleware<S>
where
    S: Service<Request, Response = Response> + Clone + Send + 'static,
    S::Future: Send,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = S::Future;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    #[instrument(
        name = "trusted_proxy_middleware", 
        skip_all,
        fields(peer_addr, trusted)
    )]
    fn call(&mut self, mut req: Request) -> Self::Future {
        // 获取直接连接的客户端地址
        let peer_addr = req.extensions().get::<SocketAddr>().copied();
        
        // 为日志记录添加字段
        let span = info_span!(
            "trusted_proxy_check",
            peer_addr = ?peer_addr.map(|a| a.to_string()),
            trusted = tracing::field::Empty
        );
        
        let _guard = span.enter();
        
        // 处理客户端信息提取
        let client_info = process_client_info(peer_addr, &self.config, &req);
        
        // 记录是否可信
        tracing::Span::current()
            .record("trusted", client_info.is_from_trusted_proxy);
        
        // 将客户端信息存入请求扩展
        req.extensions_mut().insert(client_info);
        
        // 调用内部服务
        self.inner.call(req)
    }
}

/// 处理客户端信息提取逻辑
fn process_client_info(
    peer_addr: Option<SocketAddr>,
    config: &TrustedProxiesConfig,
    req: &Request,
) -> ClientInfo {
    match peer_addr {
        Some(addr) => {
            if config.is_trusted(&addr) {
                // 来自可信代理：解析转发头部
                extract_from_trusted_proxy(&addr, req)
            } else {
                // 来自不可信代理或直接连接：使用连接地址
                tracing::debug!(
                    "请求来自不可信代理或直接连接：{}, 忽略 X-Forwarded-*头部",
                    addr.ip()
                );
                ClientInfo::direct(addr)
            }
        }
        None => {
            // 无法获取对端地址（理论上不应该发生）
            tracing::warn!("无法获取请求的对端地址");
            ClientInfo::direct(SocketAddr::from(([0, 0, 0, 0], 0)))
        }
    }
}

/// 从可信代理的请求中提取客户端信息
fn extract_from_trusted_proxy(proxy_addr: &SocketAddr, req: &Request) -> ClientInfo {
    let headers = req.headers();
    let proxy_ip = proxy_addr.ip();
    
    // 解析 X-Forwarded-For 链
    let real_ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .and_then(|xff| {
            // 处理可能的 IP 链：client, proxy1, proxy2
            parse_x_forwarded_for(xff, proxy_ip)
        })
        .unwrap_or_else(|| {
            // 回退到 X-Real-IP 或使用代理 IP
            headers
                .get("x-real-ip")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(proxy_ip) // 最终回退
        });
    
    // 提取其他转发头部
    let forwarded_host = headers
        .get("x-forwarded-host")
        .and_then(|h| h.to_str().ok())
        .map(String::from);
        
    let forwarded_proto = headers
        .get("x-forwarded-proto")
        .and_then(|h| h.to_str().ok())
        .map(String::from);
    
    tracing::debug!(
        "从可信代理 {} 提取客户端信息：real_ip={}, host={:?}, proto={:?}",
        proxy_ip,
        real_ip,
        forwarded_host,
        forwarded_proto
    );
    
    ClientInfo::from_trusted_proxy(
        real_ip,
        forwarded_host,
        forwarded_proto,
        proxy_ip,
    )
}

/// 安全地解析 X-Forwarded-For 头部
/// 处理格式："client, proxy1, proxy2" 或 "client"
fn parse_x_forwarded_for(xff: &str, current_proxy_ip: std::net::IpAddr) -> Option<std::net::IpAddr> {
    // 分割并清理 IP 地址
    let ips: Vec<&str> = xff.split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    
    if ips.is_empty() {
        return None;
    }
    
    // 取第一个 IP（原始客户端）
    // 注意：在生产环境中，可能需要更复杂的逻辑处理多层代理链
    ips.first()
        .and_then(|ip_str| ip_str.parse().ok())
}
```

### 3.3 创建辅助函数和主应用

更新 `src/main.rs`：

```rust
mod config;
mod middleware;

use axum::{
    extract::{Request, State},
    routing::get,
    Router,
    response::{Json, IntoResponse},
};
use std::sync::Arc;
use config::{TrustedProxiesConfig, TrustedProxy};
use middleware::TrustedProxiesLayer;
use serde_json::{json, Value};
use tracing_subscriber;

// 应用状态
struct AppState {
    proxy_config: TrustedProxiesConfig,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_target(true)
        .with_level(true)
        .init();
    
    tracing::info!("启动可信代理演示应用");
    
    // 1. 配置可信代理
    // 在实际应用中，这些配置应该来自环境变量或配置文件
    let trusted_proxies = TrustedProxiesConfig::from_strs(&[
        "127.0.0.1",        // 本地 IPv4 环回
        "::1",              // 本地 IPv6 环回
        "10.0.0.0/8",       // 私有 A 类网络
        "172.16.0.0/12",    // 私有 B 类网络
        "192.168.0.0/16",   // 私有 C 类网络
        "fd00::/8",         // IPv6 私有地址
    ])?;
    
    tracing::info!(
        "配置的可信代理范围：{:?}",
        trusted_proxies.get_trusted_ranges()
    );
    
    let state = Arc::new(AppState {
        proxy_config: trusted_proxies.clone(),
    });

    // 2. 创建路由
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/client-info", get(client_info_handler))
        .route("/debug", get(debug_handler))
        .with_state(Arc::clone(&state))
        // 3. 添加可信代理中间件（应尽早添加）
        .layer(TrustedProxiesLayer::new(trusted_proxies))
        // 4. 添加其他中间件（它们将能使用正确的客户端 IP）
        .layer(tower_http::trace::TraceLayer::new_for_http());
    
    // 5. 启动服务器
    let addr = "0.0.0.0:3000";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    tracing::info!("服务器运行在 http://{}", listener.local_addr()?);
    tracing::info!("测试命令：");
    tracing::info!("  curl http://localhost:3000/client-info");
    tracing::info!("  curl -H 'X-Forwarded-For: 8.8.8.8' http://localhost:3000/client-info");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

// 根处理器
async fn root_handler() -> Json<Value> {
    Json(json!({
        "message": "可信代理演示 API",
        "endpoints": {
            "/": "此消息",
            "/client-info": "显示客户端信息（已验证）",
            "/debug": "显示原始请求信息（调试用）"
        }
    }))
}

// 客户端信息处理器
async fn client_info_handler(
    State(_state): State<Arc<AppState>>,
    req: Request,
) -> impl IntoResponse {
    // 从请求扩展中获取由中间件插入的 ClientInfo
    let client_info = req.extensions().get::<config::ClientInfo>();
    
    match client_info {
        Some(info) => Json(json!({
            "real_ip": info.real_ip.to_string(),
            "forwarded_host": info.forwarded_host,
            "forwarded_proto": info.forwarded_proto,
            "is_from_trusted_proxy": info.is_from_trusted_proxy,
            "proxy_ip": info.proxy_ip.map(|ip| ip.to_string()),
            "note": info.is_from_trusted_proxy
                ? "此信息已通过可信代理验证"
                : "此信息来自直接连接或不可信代理"
        })),
        None => Json(json!({
            "error": "未找到客户端信息",
            "note": "请求可能未经过可信代理中间件"
        })),
    }.into_response()
}

// 调试处理器：显示原始请求信息
async fn debug_handler(req: Request) -> Json<Value> {
    let headers: Vec<(String, String)> = req.headers()
        .iter()
        .map(|(name, value)| (
            name.to_string(),
            value.to_str().unwrap_or("[不可读]").to_string()
        ))
        .collect();
    
    let peer_addr = req.extensions()
        .get::<std::net::SocketAddr>()
        .map(|addr| addr.to_string())
        .unwrap_or_else(|| "未知".to_string());
    
    Json(json!({
        "peer_addr": peer_addr,
        "method": req.method().to_string(),
        "uri": req.uri().to_string(),
        "headers": headers,
    }))
}
```

## 第四部分：进阶主题：多层代理与安全增强

### 4.1 处理多层代理链

在实际生产环境中，请求可能经过多层代理：
```
客户端 → CDN → 负载均衡器 → Nginx → 你的应用
```

创建 `src/advanced.rs` 处理复杂场景：

```rust
use std::net::IpAddr;
use crate::config::TrustedProxiesConfig;

/// 安全地处理多层代理的 X-Forwarded-For 头部
pub struct ProxyChainProcessor {
    config: TrustedProxiesConfig,
}

impl ProxyChainProcessor {
    pub fn new(config: TrustedProxiesConfig) -> Self {
        Self { config }
    }
    
    /// 解析 X-Forwarded-For 链，找到最右侧的非可信 IP
    /// 原理：从右向左遍历，找到第一个不在可信列表中的 IP
    pub fn extract_client_ip_from_chain(
        &self,
        x_forwarded_for: &str,
        current_proxy_ip: IpAddr,
    ) -> Option<IpAddr> {
        // 分割 IP 链
        let ip_chain: Vec<&str> = x_forwarded_for
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        
        if ip_chain.is_empty() {
            return None;
        }
        
        // 构建完整链：client, proxy1, proxy2, ..., current_proxy
        let mut full_chain: Vec<IpAddr> = ip_chain
            .iter()
            .filter_map(|s| s.parse().ok())
            .collect();
        full_chain.push(current_proxy_ip);
        
        // 从右向左查找（从离我们最近的代理开始）
        // 找到第一个不可信的 IP
        for ip in full_chain.iter().rev() {
            if !self.is_ip_trusted(ip) {
                return Some(*ip);
            }
        }
        
        // 如果所有 IP 都可信，返回原始链的第一个 IP
        full_chain.first().copied()
    }
    
    /// 检查单个 IP 是否可信
    fn is_ip_trusted(&self, ip: &IpAddr) -> bool {
        // 这里简化实现，实际应该使用完整的 SocketAddr
        // 生产环境中需要考虑端口信息
        use std::net::SocketAddr;
        let dummy_port = 0;
        let addr = SocketAddr::new(*ip, dummy_port);
        self.config.is_trusted(&addr)
    }
}
```

### 4.2 与 tower-http 中间件集成

更新主应用以展示完整集成：

```rust
// 在 main 函数中创建完整中间件栈
let app = Router::new()
    .route("/", get(root_handler))
    .route("/client-info", get(client_info_handler))
    .route("/admin", get(admin_handler))
    .with_state(Arc::clone(&state))
    // 1. 最先：可信代理中间件（建立正确的客户端信息）
    .layer(TrustedProxiesLayer::new(trusted_proxies.clone()))
    // 2. 请求 ID 和跟踪（使用真实 IP）
    .layer(tower_http::request_id::RequestIdLayer)
    .layer(tower_http::trace::TraceLayer::new_for_http()
        .make_span_with(|request: &Request| {
            let client_info = request.extensions().get::<ClientInfo>();
            let real_ip = client_info
                .map(|info| info.real_ip.to_string())
                .unwrap_or_else(|| "unknown".to_string());
            
            tracing::info_span!(
                "http_request",
                method = %request.method(),
                uri = %request.uri(),
                real_ip = %real_ip,
                request_id = ?request.headers().get("x-request-id")
            )
        }))
    // 3. 基于真实 IP 的速率限制
    .layer(tower::ServiceBuilder::new()
        .rate_limit(
            10,  // 10 个请求
            std::time::Duration::from_secs(60),  // 每分钟
            |request: &Request| {
                let client_info = request.extensions().get::<ClientInfo>();
                client_info
                    .map(|info| info.real_ip.to_string())
                    .unwrap_or_else(|| "unknown".to_string())
            }
        )
        .into_inner())
    // 4. 压缩、超时等其他中间件
    .layer(tower_http::compression::CompressionLayer::new())
    .layer(tower::timeout::TimeoutLayer::new(std::time::Duration::from_secs(30)));

// 管理端点示例：仅允许特定 IP 访问
async fn admin_handler(req: Request) -> impl IntoResponse {
    let client_info = req.extensions().get::<ClientInfo>();
    
    match client_info {
        Some(info) => {
            // 检查 IP 是否在白名单中
            let admin_ips = ["127.0.0.1", "10.0.0.0/8"];
            let is_allowed = admin_ips.iter().any(|&ip| {
                if ip.contains('/') {
                    // CIDR 检查
                    ip.parse::<ipnetwork::IpNetwork>()
                        .map(|network| network.contains(info.real_ip))
                        .unwrap_or(false)
                } else {
                    // 精确 IP 检查
                    ip.parse::<std::net::IpAddr>()
                        .map(|admin_ip| admin_ip == info.real_ip)
                        .unwrap_or(false)
                }
            });
            
            if is_allowed {
                Json(json!({
                    "message": "欢迎，管理员",
                    "your_ip": info.real_ip.to_string()
                }))
            } else {
                (
                    axum::http::StatusCode::FORBIDDEN,
                    Json(json!({
                        "error": "禁止访问",
                        "note": "管理接口仅限内部 IP 访问"
                    }))
                ).into_response()
            }
        }
        None => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "无法验证客户端身份"}))
        ).into_response(),
    }
}
```

## 第五部分：测试与验证

### 5.1 创建测试套件

创建 `tests/integration_tests.rs`：

```rust
use axum::Router;
use axum_trusted_proxies_tutorial::config::TrustedProxiesConfig;
use axum_trusted_proxies_tutorial::middleware::TrustedProxiesLayer;
use axum::body::Body;
use tower::ServiceExt; // for oneshot

#[tokio::test]
async fn test_direct_connection() {
    // 配置只信任特定代理
    let config = TrustedProxiesConfig::from_strs(&["127.0.0.1"]).unwrap();
    
    let app = Router::new()
        .route("/", axum::routing::get(|| async { "OK" }))
        .layer(TrustedProxiesLayer::new(config));
    
    // 模拟直接连接（无 X-Forwarded-For 头部）
    let request = axum::http::Request::builder()
        .uri("/")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn test_trusted_proxy() {
    let config = TrustedProxiesConfig::from_strs(&["127.0.0.1", "10.0.0.0/8"]).unwrap();
    
    let app = Router::new()
        .route("/", axum::routing::get(|req: axum::extract::Request| async move {
            let info = req.extensions().get::<crate::config::ClientInfo>().unwrap();
            format!("IP: {}", info.real_ip)
        }))
        .layer(TrustedProxiesLayer::new(config));
    
    // 模拟来自可信代理的请求
    let request = axum::http::Request::builder()
        .uri("/")
        .header("X-Forwarded-For", "203.0.113.195, 10.0.0.1")
        .header("X-Real-IP", "203.0.113.195")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    
    assert!(body_str.contains("203.0.113.195"));
}

#[tokio::test]
async fn test_untrusted_proxy() {
    // 配置：不信任 8.8.8.8
    let config = TrustedProxiesConfig::from_strs(&["127.0.0.1"]).unwrap();
    
    let app = Router::new()
        .route("/", axum::routing::get(|req: axum::extract::Request| async move {
            let info = req.extensions().get::<crate::config::ClientInfo>().unwrap();
            format!("IP: {}", info.real_ip)
        }))
        .layer(TrustedProxiesLayer::new(config));
    
    // 模拟来自不可信代理的请求（应忽略 X-Forwarded-For）
    let request = axum::http::Request::builder()
        .uri("/")
        .header("X-Forwarded-For", "8.8.8.8") // 攻击者尝试伪造 IP
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    
    // 应该显示真实 IP（测试环境中的模拟 IP），而不是 8.8.8.8
    assert!(!body_str.contains("8.8.8.8"));
}
```

### 5.2 使用 cURL 进行手动测试

```bash
# 启动应用
cargo run

# 测试1: 直接访问（应显示服务器看到的IP）
curl http://localhost:3000/client-info

# 测试2: 从可信代理访问（应显示伪造的客户端IP）
curl -H "X-Forwarded-For: 8.8.8.8" \
     -H "X-Forwarded-Host: example.com" \
     http://localhost:3000/client-info

# 测试3: 调试端点查看原始头部
curl http://localhost:3000/debug
```

## 第六部分：生产环境部署指南

### 6.1 配置管理最佳实践

创建 `src/config_loader.rs`：

```rust
use crate::config::TrustedProxiesConfig;
use std::env;

/// 从环境变量加载配置
pub fn from_env() -> anyhow::Result<TrustedProxiesConfig> {
    // 读取环境变量，例如：TRUSTED_PROXIES="127.0.0.1,10.0.0.0/8,::1"
    let proxies_str = env::var("TRUSTED_PROXIES")
        .unwrap_or_else(|_| {
            // 默认值：本地环回和常见私有网络
            "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16".to_string()
        });
    
    let proxy_list: Vec<&str> = proxies_str.split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    
    TrustedProxiesConfig::from_strs(&proxy_list)
}

/// 从配置文件加载
pub fn from_config_file(path: &str) -> anyhow::Result<TrustedProxiesConfig> {
    use serde_json;
    use std::fs;
    
    let content = fs::read_to_string(path)?;
    let config: serde_json::Value = serde_json::from_str(&content)?;
    
    let proxies = config["trusted_proxies"]
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("配置文件中缺少 trusted_proxies 数组"))?
        .iter()
        .filter_map(|v| v.as_str())
        .collect::<Vec<&str>>();
    
    TrustedProxiesConfig::from_strs(&proxies)
}
```

### 6.2 安全审计清单

在部署前检查：

1. **✅ 可信代理列表已正确配置**
  - 包含所有反向代理IP/CIDR
  - 不包含公网 IP 范围

2. **✅ 多层代理链已正确处理**
  - 测试了经过 CDN→负载均衡器→应用的全路径

3. **✅ 日志记录真实客户端 IP**
  - 访问日志、审计日志、错误日志

4. **✅ 安全措施基于真实 IP**
  - 速率限制
  - IP黑名单/白名单
  - 地理位置限制

5. **✅ 监控与告警**
  - 监控来自不可信代理的异常请求
  - 设置 X-Forwarded-For 头部格式错误的告警

## 总结与参考资料

### 关键要点

1. **安全第一**：永远不要信任来自不可信源的`X-Forwarded-*`头部
2. **尽早验证**：可信代理中间件应该是处理链的第一个环节
3. **完整传播**：确保已验证的客户端信息传递给所有后续处理层
4. **适当配置**：根据实际部署环境调整可信代理列表

### 进一步学习资源

1. **官方文档**
  - [Axum 中间件指南](https://docs.rs/axum/latest/axum/middleware/index.html)
  - [Tower 中间件架构](https://docs.rs/tower/latest/tower/)
  - [RFC 7239: Forwarded HTTP Extension](https://tools.ietf.org/html/rfc7239)

2. **相关库**
  - `forwarded` crate: 解析 Forwarded 头部（RFC 7239 标准）
  - `ipnetwork` crate: IP 地址和 CIDR 处理
  - `tower-http` crate: 官方 HTTP 中间件集合

3. **生产案例参考**
  - [Fly.io 应用部署指南](https://fly.io/docs/app-guides/axum-with-rust/)
  - [AWS 负载均衡器+Axum 配置](https://aws.amazon.com/blogs/developer/axum-on-aws-lambda/)
  - [Cloudflare Workers 与源站通信](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/)

通过本教程，你已掌握了在 Axum 应用中安全处理反向代理的核心技能。记住，每个部署环境都有其特殊性，务必根据实际情况调整和测试你的可信代理配置。
