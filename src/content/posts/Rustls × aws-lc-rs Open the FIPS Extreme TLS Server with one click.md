---
title: "🦀 Rustls × aws-lc-rs：一键开启 FIPS 极速 TLS 服务器"
description: "用 Rustls 的 aws-lc-rs feature，三分钟搭出合规、飞一般的 TLS 服务器，支持可选 mTLS，AWS 与本地通吃。"
date: 2025-12-26T10:11:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-urtimud-89-76108288-35117049.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","rustfs","aws-lc-rs","ring","openssl","rustls"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","rustfs","aws-lc-rs","ring","openssl","rustls","BoringSSL","QUIC","TLS","mTLS","FIPS","feature"]
keywords: "rust,实战指南,Rust 生态,rustfs,aws-lc-rs,ring,openssl,rustls,BoringSSL,QUIC,TLS,mTLS,FIPS,feature"
draft: false
---

# Rustls 基于 aws-lc-rs Feature 的进阶实战指南

## 引言背景
传统 Ring 加密库在 FIPS 场景与极限性能面前渐显吃力。AWS 开源的 aws-lc-rs 带来经过 FIPS 140-3 认证的算法实现，并与 Rustls 0.23.35+ 深度集成，只需切换 feature 即可零成本替换 Ring，让 Rust 服务在合规与吞吐之间两全。


## 1. aws-lc-rs Feature 介绍

aws-lc-rs 是 AWS 提供的加密库 Rust 绑定，提供高性能、安全的加密原语，支持 FIPS 认证。Rustls 通过启用 "aws_lc_rs" feature，使用 aws-lc-rs 作为默认加密提供者，替代 ring。优势包括：
- **性能提升**：在某些场景下更快，尤其 AWS 环境。
- **FIPS 兼容**：适用于需要合规的环境。
- **兼容性**：无缝替换 ring，支持 TLS 1.2/1.3。
- **版本要求**：基于 rustls 0.23.35，需要启用 feature。注意：aws-lc-rs 可能需要额外依赖，如 libc。

为什么使用：
- 生产环境中追求更高性能或 FIPS 认证。
- 与 AWS 服务集成更好。

参考资料：
- aws-lc-rs 文档：https://docs.rs/aws-lc-rs/latest/aws_lc_rs/
- Rustls feature 说明：https://docs.rs/rustls/0.23.35/rustls/#features

## 2. aws-lc-rs Feature 基本配置

### 2.1 理论基础
Rustls 的 `CryptoProvider` 接口允许自定义加密后端。启用 "aws_lc_rs" feature 后，使用 `aws_lc_rs::default_provider()` 创建配置。配置过程类似 ring，但需处理潜在的 FIPS 模式（可选）。

步骤：
1. 在 Cargo.toml 添加 feature。
2. 加载证书、私钥。
3. 使用 aws_lc_rs provider 构建 `ServerConfig`。

### 2.2 配置说明
- Cargo.toml 中启用：
  ```toml
  rustls = { version = "0.23.35", features = ["aws_lc_rs"] }
  ```
- 对于 FIPS：启用 aws-lc-rs 的 "fips" feature（需额外配置）。
- 测试证书生成同前（server.crt、server.key）。

### 2.3 完整实例代码：基本 TLS 服务器（使用 aws-lc-rs）
#### Cargo.toml
```toml
[package]
name = "rustls-aws-lc-example"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8.0"
tokio = { version = "1.48.0", features = ["full"] }
rustls = { version = "0.23.35", features = ["aws_lc_rs"] }
rustls-pemfile = "2.1.0"
tower-http = { version = "0.6.8", features = ["trace"] }
```

#### src/main.rs
```rust
use axum::{routing::get, Router};
use rustls::crypto::aws_lc_rs::default_provider;
use rustls::server::ServerConfig;
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::fs::File;
use std::io::BufReader;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 加载证书和私钥
    let mut cert_file = BufReader::new(File::open("server.crt")?);
    let mut key_file = BufReader::new(File::open("server.key")?);

    let cert_chain = certs(&mut cert_file).collect::<Result<Vec<_>, _>>()?;
    let mut keys = pkcs8_private_keys(&mut key_file).collect::<Result<Vec<_>, _>>()?;

    if keys.is_empty() {
        return Err("No private keys found".into());
    }

    // 使用 aws_lc_rs provider 创建 ServerConfig
    let config = ServerConfig::builder_with_provider(Arc::new(default_provider()))
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(cert_chain, keys.remove(0))?;

    let acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(config));

    // 创建 Axum 路由
    let app = Router::new()
        .route("/", get(|| async { "Hello, TLS with aws-lc-rs!" }))
        .layer(TraceLayer::new_for_http());

    // 绑定地址
    let addr = SocketAddr::from(([127, 0, 0, 1], 8443));
    let listener = TcpListener::bind(addr).await?;

    println!("Listening on https://{}", addr);

    // 服务循环
    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
}
```

## 3. aws-lc-rs Feature 进阶使用：集成可选 mTLS

### 3.1 理论基础
在 mTLS 中，aws-lc-rs 提供更强的加密支持，如增强的证书验证。自定义验证器逻辑不变，但 provider 切换到 aws_lc_rs。FIPS 模式下，确保所有操作符合标准。

关键：
- **FIPS 启用**：在 aws-lc-rs 中设置 `aws_lc_rs::fips::enable()`（需 feature "fips"）。
- **性能监控**：aws-lc-rs 在高负载下更优。

### 3.2 配置说明
- 启用 FIPS（可选）：Cargo.toml 添加 `features = ["aws_lc_rs", "fips"]`（aws-lc-rs 需支持）。
- 客户端证书生成同前（ca.crt、client.crt、client.key）。

### 3.3 完整实例代码：TLS + 可选 mTLS（使用 aws-lc-rs）
#### Cargo.toml（扩展基本，添加 fips 如需）
```toml
[package]
name = "rustls-aws-lc-mtls-example"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8.0"
tokio = { version = "1.48.0", features = ["full"] }
rustls = { version = "0.23.35", features = ["aws_lc_rs"] }  # 添加 "fips" 如需
rustls-pemfile = "2.1.0"
tower-http = { version = "0.6.8", features = ["trace"] }
```

#### src/main.rs
```rust
use axum::{extract::State, routing::get, Router};
use rustls::crypto::aws_lc_rs::default_provider;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::server::{ClientCertVerified, ClientCertVerifier, ServerConfig};
use rustls::RootCertStore;
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::fs::File;
use std::io::BufReader;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::net::TcpListener;
use std::net::SocketAddr;
use tower_http::trace::TraceLayer;

// 自定义可选 mTLS 验证器
struct OptionalClientVerifier {
    roots: RootCertStore,
}

impl ClientCertVerifier for OptionalClientVerifier {
    fn root_hint_subjects(&self) -> &[rustls::pki_types::DnsName] {
        &[]
    }

    fn verify_client_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        now: SystemTime,
    ) -> Result<ClientCertVerified, rustls::Error> {
        if end_entity.as_ref().is_empty() {
            return Ok(ClientCertVerified::assertion());
        }

        let chain = vec![end_entity.clone()];
        let chain_with_intermediates: Vec<_> = chain.iter().chain(intermediates.iter()).cloned().collect();

        self.roots.verify_cert(&chain_with_intermediates, now)?;

        Ok(ClientCertVerified::assertion())
    }

    fn offer_client_auth(&self) -> bool {
        true
    }

    fn client_auth_mandatory(&self) -> bool {
        false
    }
}

// 示例状态
#[derive(Clone)]
struct AppState {
    message: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 加载服务器证书和私钥
    let mut cert_file = BufReader::new(File::open("server.crt")?);
    let mut key_file = BufReader::new(File::open("server.key")?);

    let cert_chain = certs(&mut cert_file).collect::<Result<Vec<_>, _>>()?;
    let mut keys = pkcs8_private_keys(&mut key_file).collect::<Result<Vec<_>, _>>()?;

    if keys.is_empty() {
        return Err("No private keys found".into());
    }

    // 加载根 CA
    let mut root_cert_file = BufReader::new(File::open("ca.crt")?);
    let root_certs = certs(&mut root_cert_file).collect::<Result<Vec<_>, _>>()?;
    let mut root_store = RootCertStore::empty();
    for cert in root_certs {
        root_store.add(cert)?;
    }

    // 自定义验证器
    let client_auth = Arc::new(OptionalClientVerifier { roots: root_store });

    // 使用 aws_lc_rs provider 创建 ServerConfig
    let mut config_builder = ServerConfig::builder_with_provider(Arc::new(default_provider()))
        .with_safe_defaults();

    config_builder = config_builder.with_client_cert_verifier(client_auth);

    let config = config_builder.with_single_cert(cert_chain, keys.remove(0))?;

    let acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(config));

    // Axum 路由
    let state = AppState { message: "Hello, optional mTLS with aws-lc-rs!".to_string() };

    let app = Router::new()
        .route("/", get(handler))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    // 绑定地址
    let addr = SocketAddr::from(([127, 0, 0, 1], 8443));
    let listener = TcpListener::bind(addr).await?;

    println!("Listening on https://{}", addr);

    // 服务循环
    loop {
        let (stream, _) = listener.accept().await?;
        let acceptor = acceptor.clone();
        let app = app.clone();

        tokio::spawn(async move {
            let tls_stream = match acceptor.accept(stream).await {
                Ok(stream) => stream,
                Err(e) => {
                    eprintln!("TLS accept error: {:?}", e);
                    return;
                }
            };

            if let Err(e) = axum::serve(tls_stream, app.into_make_service()).await {
                eprintln!("Server error: {:?}", e);
            }
        });
    }
}

async fn handler(State(state): State<AppState>) -> String {
    state.message
}
```

## 4. aws-lc-rs Feature 高效使用技巧

- **FIPS 模式**：在 main 中调用 `aws_lc_rs::fips::enable()`，确保环境支持。
- **性能测试**：使用 criterion 基准测试 ring vs aws-lc-rs。
- **错误处理**：aws-lc-rs 可能抛出特定错误，添加日志。
- **扩展**：集成 AWS KMS 用于密钥管理。

参考资料：
- Rustls 与 aws-lc-rs 集成示例：https://github.com/rustls/rustls/blob/main/docs/FEATURES.md
- AWS-LC 性能基准：https://aws.amazon.com/blogs/security/introducing-aws-lc-a-new-open-source-cryptographic-library/
- FIPS 指南：https://docs.aws.amazon.com/general/latest/gr/aws-lc.html

## 附属文件
- **server.crt**、**server.key**：服务器证书和私钥（生成命令同前）。
- **ca.crt**：根 CA 证书。
- **client.crt**、**client.key**：客户端证书和私钥（测试用）。
