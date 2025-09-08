---
title: "Rustls 客户端调试日志循环打印问题解析与解决方案"
description: "在现代网络通信中，TLS（传输层安全协议）已经成为确保数据传输安全性的标准。Rust 社区提供的 `rustls` 库是一个纯 Rust 实现的 TLS 协议库，因其安全性和性能而备受青睐。然而，在使用 `rustls` 进行客户端开发时，开发者可能会遇到一个常见的问题：调试日志循环打印，尤其是以下两条日志："
date: 2024-09-13T06:00:00Z
image: "https://static-rs.bifuba.com/images/posts/caleb-woods-NntIbC93kaM-unsplash.jpg"
categories: ["Rustls", "Rust", "TLS"]
authors: ["houseme"]
tags:
  [
    "rust",
    "Rustls",
    "TLS",
    "log",
    "client",
    "debug",
    "logging",
    "troubleshooting",
    "performance",
    "networking",
    "security",
    "debugging",
    "rust programming",
    "rustlang",
    "证书",
  ]
keywords: "Rustls, Rust, TLS, log, client, debug, logging, troubleshooting, performance, networking, security, debugging, rust programming, rustlang"
draft: false
---

## 引言

在现代网络通信中，TLS（传输层安全协议）已经成为确保数据传输安全性的标准。Rust 社区提供的 `rustls` 库是一个纯 Rust 实现的 TLS 协议库，因其安全性和性能而备受青睐。然而，在使用 `rustls` 进行客户端开发时，开发者可能会遇到一个常见的问题：调试日志循环打印，尤其是以下两条日志：

```plaintext
DEBUG rustls::client::hs: Not resuming any session
DEBUG rustls::client::common: Client auth requested but no cert/sigscheme available
```

这些日志不仅会迅速填满日志文件，还可能影响系统的整体性能。本文将深入探讨这些日志的产生原因，并提供一系列高效且实战性强的解决方案，帮助开发者有效地管理和过滤这些调试信息，确保日志系统的稳定性和性能。

## 文章结构

1. **问题描述**：详细描述 `rustls` 客户端调试日志循环打印的问题及其影响。
2. **日志作用**：解释这两条日志的具体含义及其在 TLS 连接过程中的作用。
3. **问题原因**：分析导致日志循环打印的根本原因。
4. **解决方案**：提供多种解决方案，包括调整日志级别、使用日志过滤器和自定义日志处理程序。
5. **代码示例**：展示如何通过代码实现日志过滤和管理。
6. **总结**：总结本文内容，强调解决方案的有效性和实用性。

通过本文，开发者将能够更好地理解和处理 `rustls` 客户端调试日志循环打印的问题，从而提升应用的稳定性和性能。

## 说明文档

### 1. 问题描述

在使用 `rustls` 库（版本 0.21.12）进行客户端 TLS 连接时，可能会遇到以下调试日志循环打印的问题：

```plaintext
DEBUG rustls::client::hs: Not resuming any session
DEBUG rustls::client::common: Client auth requested but no cert/sigscheme available
```

这些日志会不断重复打印，导致日志文件迅速膨胀，影响系统性能。

### 2. 日志作用

- **`DEBUG rustls::client::hs: Not resuming any session`**: 这条日志表示客户端在尝试建立 TLS 连接时，没有找到可以恢复的会话。通常在每次新的 TLS 连接时都会打印这条日志。

- **`DEBUG rustls::client::common: Client auth requested but no cert/sigscheme available`**: 这条日志表示服务器请求客户端认证，但客户端没有提供证书或签名方案。这通常在服务器要求客户端证书时打印。

### 3. 问题原因

这些日志在每次 TLS 握手时都会打印，如果客户端频繁地进行 TLS 连接（例如在短时间内多次连接同一个服务器），这些日志就会不断重复打印，导致日志文件迅速增长。

### 4. 解决方案

#### 4.1 调整日志级别

最简单的解决方案是调整日志级别，避免打印这些调试信息。可以通过设置日志级别为 `INFO` 或更高级别来过滤掉这些调试日志。

```rust
use log::LevelFilter;
use simple_logger::SimpleLogger;

fn main() {
    SimpleLogger::new()
        .with_level(LevelFilter::Info)
        .init()
        .unwrap();

    // 你的代码
}
```

#### 4.2 使用日志过滤器

如果你仍然需要调试信息，但希望过滤掉特定的日志，可以使用日志过滤器来实现。例如，使用 `env_logger` 库：

```rust
use env_logger::{Builder, Env};

fn main() {
    Builder::from_env(Env::default().default_filter_or("info"))
        .filter(Some("rustls::client::hs"), log::LevelFilter::Off)
        .filter(Some("rustls::client::common"), log::LevelFilter::Off)
        .init();

    // 你的代码
}
```

#### 4.3 自定义日志处理

如果你需要更复杂的日志处理逻辑，可以自定义日志处理程序。例如，使用 `log4rs` 库：

```toml
# log4rs.yaml
refresh_rate: 30 seconds
appenders:
  stdout:
    kind: console
    encoder:
      pattern: "{d} - {m}{n}"
  file:
    kind: file
    path: "log/output.log"
    encoder:
      pattern: "{d} - {l} - {m}{n}"

root:
  level: info
  appenders:
    - stdout

loggers:
  rustls::client::hs:
    level: off
  rustls::client::common:
    level: off
```

```rust
use log4rs::append::console::ConsoleAppender;
use log4rs::append::file::FileAppender;
use log4rs::config::{Appender, Config, Root};
use log4rs::encode::pattern::PatternEncoder;
use log::LevelFilter;

fn main() {
    let stdout = ConsoleAppender::builder()
        .encoder(Box::new(PatternEncoder::new("{d} - {m}{n}")))
        .build();

    let file = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new("{d} - {l} - {m}{n}")))
        .build("log/output.log")
        .unwrap();

    let config = Config::builder()
        .appender(Appender::builder().build("stdout", Box::new(stdout)))
        .appender(Appender::builder().build("file", Box::new(file)))
        .build(
            Root::builder()
                .appender("stdout")
                .appender("file")
                .build(LevelFilter::Info),
        )
        .unwrap();

    log4rs::init_config(config).unwrap();

    // 你的代码
}
```

### 5. 总结

通过调整日志级别、使用日志过滤器或自定义日志处理程序，可以有效避免 `rustls` 客户端调试日志循环打印的问题。根据实际需求选择合适的解决方案，确保日志系统的稳定性和性能。

## 代码示例

以下是一个完整的代码示例，展示了如何使用 `env_logger` 库来过滤特定的调试日志：

```rust
use env_logger::{Builder, Env};
use log::{info, LevelFilter};
use rustls::{ClientConfig, RootCertStore, ClientSession};
use std::sync::Arc;
use std::net::TcpStream;
use std::io::{Read, Write};

fn main() {
    // 设置日志过滤器
    Builder::from_env(Env::default().default_filter_or("info"))
        .filter(Some("rustls::client::hs"), LevelFilter::Off)
        .filter(Some("rustls::client::common"), LevelFilter::Off)
        .init();

    // 创建 Rustls 客户端配置
    let mut root_store = RootCertStore::empty();
    // 添加根证书
    // root_store.add_server_trust_anchors(&webpki_roots::TLS_SERVER_ROOTS);

    let config = ClientConfig::builder()
        .with_safe_defaults()
        .with_root_certificates(root_store)
        .with_no_client_auth();

    let config = Arc::new(config);

    // 创建客户端会话
    let dns_name = "example.com".try_into().unwrap();
    let mut sess = ClientSession::new(&config, dns_name);

    // 连接到服务器
    let mut sock = TcpStream::connect("example.com:443").unwrap();
    let mut tls = rustls::Stream::new(&mut sess, &mut sock);

    // 发送请求
    tls.write_all(b"GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n").unwrap();

    // 读取响应
    let mut response = Vec::new();
    tls.read_to_end(&mut response).unwrap();

    info!("Response: {}", String::from_utf8_lossy(&response));
}
```

## 参考资料

- [Rustls 官方文档](https://docs.rs/rustls/latest/rustls/ "Rustls 官方文档")
- [env_logger 官方文档](https://docs.rs/env_logger/latest/env_logger/ "env_logger 官方文档")
- [log4rs 官方文档](https://docs.rs/log4rs/latest/log4rs/ "log4rs 官方文档")

通过以上方法，你可以有效地管理和过滤 `rustls` 客户端的调试日志，避免日志文件膨胀和系统性能下降。
