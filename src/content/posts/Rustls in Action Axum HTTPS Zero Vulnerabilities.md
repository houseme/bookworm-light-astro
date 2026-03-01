---
title: "🦀 Rustls 实战：Axum HTTPS 配置，零漏洞上云"
description: "Rustls + Axum 打造安全 HTTPS：零外部依赖、内存安全、TLS 1.3 加速，5 分钟集成，附后端选择与性能优化，让 Web 服务无惧网络攻击。"
date: 2026-01-09T08:22:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-rachel-claire-5490892.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","Axum", "TLS", "HTTPS", "安全", "网络编程", "Rustls", "tokio-rustls", "axum-server", "crypto_provider"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","Axum","TLS", "HTTPS", "安全", "网络编程", "Rustls", "tokio-rustls", "axum-server", "crypto_provider", "ring", "aws-lc-rs", "mTLS", "双向认证", "证书管理", "加密套件", "性能优化", "零拷贝 I/O", "异步编程", "安全最佳实践", "Web 服务", "Axum HTTPS", "Rust 网络编程"]
keywords: "rust,实战指南,Rust 生态,Axum,TLS,HTTPS,安全,网络编程,Rustls,tokio-rustls,axum-server,crypto_provider,ring,aws-lc-rs,mTLS,双向认证,证书管理,加密套件,性能优化,零拷贝 I/O,异步编程,安全最佳实践,Web 服务,Axum HTTPS,Rust 网络编程"
draft: false
---


## Rustls 简介

Rustls 是一个用纯 Rust 语言实现的现代 TLS 库，专注于安全性、性能和简洁性。它不依赖于外部 C 库如 OpenSSL，从而避免了潜在的漏洞、依赖管理和跨平台问题。Rustls 支持 TLS 1.2 和 TLS 1.3 协议，提供客户端和服务器端功能，包括双向认证（mTLS）。它使用 Rust 的内存安全特性来防止缓冲区溢出等常见安全问题。

Rustls 的核心设计原则包括：
- **安全性**：通过 Rust 的借用检查器和所有权系统，确保代码无内存泄漏和数据竞争。
- **性能**：优化了加密操作，使用 SIMD 指令加速。
- **简洁性**：API 设计简明，易于集成到异步运行时如 Tokio。

在 Web 开发中，Rustls 常与 Axum 框架结合，用于构建安全的 HTTPS 服务。它可以通过 `axum-server`  crate 或直接使用 `tokio-rustls` 来集成。

## Rustls 的基本使用

要开始使用 Rustls，首先需要在 Cargo.toml 中添加依赖。Rustls 默认使用 `ring` 作为加密后端，但可以切换到 `aws-lc-rs`。

### 步骤 1: 添加依赖
在你的项目 Cargo.toml 中添加：
```toml
[dependencies]
rustls = "0.23.12"  # 最新版本根据实际情况更新
tokio = { version = "1", features = ["full"] }
tokio-rustls = "0.26.0"
axum = "0.7.5"
axum-server = { version = "0.6.0", features = ["tls-rustls"] }  # 用于 Axum 的 HTTPS 支持
```

### 步骤 2: 基本客户端示例
Rustls 可以作为 TLS 客户端使用。以下是一个简单的 HTTPS GET 请求示例：

```rust
use std::io::{self, BufRead};
use std::net::ToSocketAddrs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_rustls::rustls::{ClientConfig, OwnedTrustAnchor, RootCertStore, ServerName};
use tokio_rustls::TlsConnector;

#[tokio::main]
async fn main() -> io::Result<()> {
    // 配置根证书存储
    let mut root_cert_store = RootCertStore::empty();
    root_cert_store.add_server_trust_anchors(
        webpki_roots::TLS_SERVER_ROOTS.0.iter().map(|ta| {
            OwnedTrustAnchor::from_subject_spki_name_constraints(
                ta.subject,
                ta.spki,
                ta.name_constraints,
            )
        })
    );

    let config = ClientConfig::builder()
        .with_safe_defaults()
        .with_root_certificates(root_cert_store)
        .with_no_client_auth();

    let connector = TlsConnector::from(std::sync::Arc::new(config));

    let domain = "www.rust-lang.org";
    let addr = (domain, 443).to_socket_addrs()?.next().unwrap();
    let mut stream = tokio::net::TcpStream::connect(&addr).await?;
    let server_name = ServerName::try_from(domain).unwrap();
    let mut tls_stream = connector.connect(server_name, stream).await?;

    // 发送 HTTP GET 请求
    tls_stream.write_all(b"GET / HTTP/1.0\r\nHost: www.rust-lang.org\r\n\r\n").await?;

    // 读取响应
    let mut buf = Vec::new();
    tls_stream.read_to_end(&mut buf).await?;
    println!("{}", String::from_utf8_lossy(&buf));

    Ok(())
}
```

这个示例展示了如何配置根证书、建立 TLS 连接并发送请求。理论上，`ClientConfig` 使用默认的加密套件（如 AES-128-GCM），确保兼容性和安全性。

## Rustls 的配置详解

Rustls 的配置通过 `ClientConfig` 和 `ServerConfig` 构建器进行。配置包括证书链、私钥、加密套件和协议版本。

### 客户端配置
- **根证书**：使用 `RootCertStore` 添加信任锚点。通常使用 `webpki-roots` 提供 Mozilla 的根证书。
- **客户端认证**：如果需要 mTLS，使用 `with_client_auth_cert` 添加客户端证书和私钥。
- **加密套件**：默认使用安全套件，可通过 `with_cipher_suites` 自定义。

### 服务器配置
- **证书和私钥**：使用 PEM 格式加载。
- **mTLS**：通过 `with_client_cert_verifier` 配置客户端证书验证。

示例服务器配置：
```rust
use rustls::crypto::ring::default_provider;  // 或 aws_lc_rs
use rustls::{Certificate, PrivateKey, ServerConfig};
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::fs::File;
use std::io::BufReader;
use std::sync::Arc;

fn load_certs(path: &str) -> Vec<Certificate> {
    certs(&mut BufReader::new(File::open(path).unwrap()))
        .unwrap()
        .into_iter()
        .map(Certificate)
        .collect()
}

fn load_keys(path: &str) -> Vec<PrivateKey> {
    pkcs8_private_keys(&mut BufReader::new(File::open(path).unwrap()))
        .unwrap()
        .into_iter()
        .map(PrivateKey)
        .collect()
}

let certs = load_certs("server.crt");
let mut keys = load_keys("server.key");

let config = ServerConfig::builder_with_provider(Arc::new(default_provider()))
    .with_safe_defaults()
    .with_no_client_auth()
    .with_single_cert(certs, keys.remove(0))
    .unwrap();
```

理论深入：Rustls 使用 `crypto_provider` 接口抽象加密操作。默认提供者是 `ring`，但可以切换。配置时，确保私钥是 PKCS#8 格式，证书是 DER 编码的 PEM。

## 选择后端依赖：aws-lc-rs vs ring

Rustls 支持两种加密后端：`ring` 和 `aws-lc-rs`。选择取决于性能、安全性和兼容性需求。

### ring
- **优点**：轻量级，使用 BoringSSL 的加密原语。性能高，内存占用低。适合嵌入式或资源受限环境。
- **缺点**：不支持某些高级特性，如 FIPS 认证。依赖于汇编代码，可能在某些平台有兼容性问题。
- **使用**：默认后端，无需额外配置。启用特征：`rustls/ring`。

### aws-lc-rs
- **优点**：基于 AWS 的 LibreCrypto，支持 FIPS 140-2 认证。提供更多加密算法（如 Kyber post-quantum），性能在某些场景优于 ring。适合企业级应用，需要合规性。
- **缺点**：库体积较大，编译时间长。可能引入更多依赖。
- **使用**：在 Cargo.toml 添加 `rustls = { version = "0.23", features = ["aws_lc_rs"] }`。然后在代码中使用 `rustls::crypto::aws_lc_rs::default_provider()`。

选择指南：
- 如果优先性能和轻量：用 `ring`。
- 如果需要 FIPS 或 post-quantum：用 `aws-lc-rs`。
- 理论：两者都实现 `CryptoProvider` trait，确保 Rustls 的 API 不变。切换后端只需更改 provider，无需重写应用逻辑。

## 在 Axum 中集成 Rustls

Axum 是基于 Tokio 的 Web 框架。使用 `axum-server` 简化 HTTPS 配置。

### 完整 Axum HTTPS 示例
项目结构：
```
my_axum_app/
├── Cargo.toml
├── src/
│   └── main.rs
├── server.crt  # 自签名证书
└── server.key  # 私钥
```

Cargo.toml:
```toml
[dependencies]
axum = "0.7.5"
axum-server = { version = "0.6.0", features = ["tls-rustls"] }
tokio = { version = "1", features = ["full"] }
rustls = { version = "0.23.12", features = ["ring"] }  # 或 aws_lc_rs
rustls-pemfile = "2.1.3"
```

main.rs:
```rust
use axum::{routing::get, Router};
use axum_server::tls_rustls::RustlsConfig;
use rustls::{Certificate, PrivateKey, ServerConfig};
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::fs::File;
use std::io::BufReader;
use std::net::SocketAddr;
use std::sync::Arc;

async fn hello() -> &'static str {
    "Hello, HTTPS!"
}

#[tokio::main]
async fn main() {
    // 加载证书和私钥
    let certs: Vec<Certificate> = certs(&mut BufReader::new(File::open("server.crt").unwrap()))
        .unwrap()
        .into_iter()
        .map(Certificate)
        .collect();

    let mut keys: Vec<PrivateKey> = pkcs8_private_keys(&mut BufReader::new(File::open("server.key").unwrap()))
        .unwrap()
        .into_iter()
        .map(PrivateKey)
        .collect();

    // 配置 Rustls
    let config = ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(certs, keys.remove(0))
        .unwrap();

    let rustls_config = RustlsConfig::from_config(Arc::new(config));

    // Axum 路由
    let app = Router::new().route("/", get(hello));

    // 启动服务器
    let addr = SocketAddr::from(([127, 0, 0, 1], 8443));
    axum_server::bind_rustls(addr, rustls_config)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

### 生成自签名证书（附属文件）
使用 OpenSSL 生成测试证书（生产环境用 Let's Encrypt）：
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -subj "/CN=localhost"
```

### mTLS 配置扩展
在服务器配置中添加客户端验证：
```rust
use rustls::server::AllowAnyAuthenticatedClient;

// 加载根 CA
let mut client_root_store = rustls::RootCertStore::empty();
client_root_store.add_parsable_certificates(&load_certs("ca.crt"));

// 配置 mTLS
let verifier = AllowAnyAuthenticatedClient::new(client_root_store);
let config = ServerConfig::builder()
    .with_safe_defaults()
    .with_client_cert_verifier(verifier)
    .with_single_cert(certs, keys.remove(0))
    .unwrap();
```

理论深入：mTLS 通过客户端证书验证身份，确保只有授权客户端访问。Rustls 使用 `ClientCertVerifier` trait 自定义验证逻辑，如检查证书主题。

## 高级主题：性能优化与安全最佳实践

- **性能**：Rustls 支持零拷贝 I/O，在 Tokio 中使用 `TlsStream` 异步操作。启用 `rustls/logging` 特征调试性能瓶颈。
- **安全**：始终使用 TLS 1.3（默认启用）。自定义加密套件避免弱算法：`with_cipher_suites(&[&rustls::cipher_suite::TLS13_AES_256_GCM_SHA384])`。
- **错误处理**：Rustls 错误类型如 `Error::InvalidMessage` 提供详细诊断。
- **集成扩展**：与 `hyper` 或 `reqwest` 集成客户端；服务器端支持热重载证书。

## 参考资料

- 官方文档：https://docs.rs/rustls/latest/rustls/
- GitHub 仓库：https://github.com/rustls/rustls
- axum-server 文档：https://docs.rs/axum-server/latest/axum_server/
- ring 文档：https://docs.rs/ring/latest/ring/
- aws-lc-rs 文档：https://docs.rs/aws-lc-rs/latest/aws_lc_rs/
- TLS 协议规范：RFC 8446 (TLS 1.3)
- 示例项目：https://github.com/rustls/rustls-ffi (C FFI 示例，但适用于理解核心)
- 书籍：《Rust for Rustaceans》Chapter on Security (Idiomatic Rust 安全实践)
