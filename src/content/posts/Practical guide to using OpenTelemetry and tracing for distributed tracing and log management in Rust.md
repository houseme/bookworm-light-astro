---
title: "Rust 中使用 OpenTelemetry 与 tracing 实现分布式追踪与日志管理的实战指南"
description: "Rust 作为一门高性能、内存安全的语言，广泛应用于系统编程和微服务开发，其 `tracing` 生态提供了强大的事件和 Span 管理能力。结合 OpenTelemetry 的标准化协议（如 OTLP），Rust 开发者可以构建高效的监控系统，将追踪和日志无缝集成到 Jaeger、Prometheus 等后端。"
date: 2025-04-26T08:15:00Z
image: "https://static-rs.bifuba.com/images/posts/arno-senoner-_7bsgYdTTVE-unsplash.jpg"
categories:
  [
    "rust",
    "OpenTelemetry",
    "链路追踪",
    "分布式追踪",
    "日志管理",
    "日志收集",
    "实战指南",
  ]
authors: ["houseme"]
tags:
  [
    "rust",
    "OpenTelemetry",
    "tracing",
    "instrument",
    "OTLP",
    "Protocol",
    "metrics",
    "logs",
    "Jaeger",
    "Prometheus",
    "分布式追踪",
    "链路追踪",
    "日志管理",
    "日志收集",
    "实战指南",
  ]
keywords: "rust,OpenTelemetry,tracing,traces,Logging,logs,metrics,Jaeger,Prometheus,OTLP,Protocol,分布式追踪,链路追踪,日志管理,日志收集,实战指南"
draft: false
---

## 引言背景

在现代分布式系统中，服务间的复杂交互使得监控和调试变得尤为重要。分布式追踪（Tracing）记录请求的完整调用链，日志（Logging）提供详细的事件上下文，两者结合能够快速定位性能瓶颈和错误根因。Rust 作为一门高性能、内存安全的语言，广泛应用于系统编程和微服务开发，其 `tracing` 生态提供了强大的事件和 Span 管理能力。结合 OpenTelemetry 的标准化协议（如 OTLP），Rust 开发者可以构建高效的监控系统，将追踪和日志无缝集成到 Jaeger、Prometheus 等后端。

本文从基础概念入手，深入剖析 Rust 中 `tracing` 和 OpenTelemetry 的集成，结合 `tracing-error` 和 `opentelemetry-appender-tracing`，提供由浅入深的实战指南。内容涵盖环境搭建、追踪与日志配置、错误堆栈捕获、动态过滤，以及生产环境优化。完整示例代码基于最新依赖（`opentelemetry 0.29.0`, `tracing-opentelemetry 0.30.0`），通过 Jaeger 展示追踪和日志效果。无论你是初学者还是资深开发者，本文都将为你提供清晰的理论知识和可直接运行的代码，助力构建健壮的分布式监控系统。

---

## 一、基本信息

### 1.1 核心概念

- **`tracing`**：
  - Rust 的日志和追踪框架，支持高性能的事件和 Span 记录。
  - Span 表示一个操作的上下文（如函数调用），事件表示瞬时日志（如 `info!`）。
  - 通过 `#[instrument]` 宏自动生成 Span，简化代码。
- **OpenTelemetry**：
  - 跨语言的监控标准，提供追踪（traces）、日志（logs）和指标（metrics）三柱模型。
  - OTLP（OpenTelemetry Protocol）支持 gRPC/HTTP 传输，兼容 Jaeger、Prometheus 等。
- **`tracing-opentelemetry`**：
  - 将 `tracing` 的 Span 和事件转换为 OpenTelemetry 追踪，导出到后端。
- **`opentelemetry-appender-tracing`**：
  - 将 `tracing` 事件转换为 OpenTelemetry 日志，与追踪关联。
- **`tracing-error`**：
  - 捕获 `SpanTrace`，为错误提供 Span 上下文，增强调试能力。

### 1.2 依赖说明

- **`opentelemetry = "0.29.0"`**：核心 OpenTelemetry SDK。
- **`opentelemetry-otlp = "0.29.0"`**：支持 OTLP gRPC 导出。
- **`tracing-opentelemetry = "0.30.0"`**：`tracing` 到 OpenTelemetry 追踪桥接。
- **`opentelemetry-appender-tracing = "0.2.0"`**：`tracing` 到 OpenTelemetry 日志桥接。
- **`tracing-error = "0.2.0"`**：错误堆栈捕获。
- **`tracing-subscriber = "0.3.0"`**：日志格式化和过滤。

### 1.3 Jaeger 与 OTLP

Jaeger 是一个开源分布式追踪系统，通过 OTLP gRPC 端点（默认 `http://localhost:4317`）接收追踪和日志数据。界面（`http://localhost:16686`）展示 Span、事件和关联日志。

---

## 二、包含的配置参数

### 2.1 `tracing-subscriber::fmt::Layer`

格式化日志输出：

| 方法               | 作用                  | 参数类型 | 默认值               |
| ------------------ | --------------------- | -------- | -------------------- |
| `with_target`      | 显示模块路径          | `bool`   | `true`               |
| `with_level`       | 显示级别（如 `INFO`） | `bool`   | `true`               |
| `with_file`        | 显示文件名            | `bool`   | `false`              |
| `with_line_number` | 显示行号              | `bool`   | `false`              |
| `with_ansi`        | 启用 ANSI 颜色        | `bool`   | `true`（终端支持时） |
| `pretty`           | 美化多行输出          | 无       | 默认禁用             |
| `json`             | JSON 格式输出         | 无       | 默认禁用             |

### 2.2 `tracing-error::ErrorLayer`

- **作用**：捕获 `SpanTrace`，记录 Span 上下文。
- **配置**：通过 `ErrorLayer::default()` 启用。
- **输出**：`SpanTrace` 可通过 `fmt::Display` 或自定义格式化。

### 2.3 `opentelemetry-otlp`

- **采样器**：
  - `Sampler::AlwaysOn`：全采样，适合调试。
  - `Sampler::TraceIdRatioBased(ratio)`：比率采样，适合生产。
- **导出器**：
  - `.tonic()`：gRPC 传输。
  - `.with_endpoint(url)`：OTLP 端点（如 `http://localhost:4317`）。
- **TracerProvider**：
  - `.with_batch_exporter(exporter)`：批量导出（0.29.0 单参数）。
  - `.with_sampler(sampler)`：采样策略。

### 2.4 `opentelemetry-appender-tracing`

- **OpenTelemetryTracingBridge**：
  - 将 `tracing` 事件转换为 OpenTelemetry 日志。
  - 通过 `with_filter(EnvFilter)` 控制日志级别和模块。

---

## 三、具体配置与使用方法

### 3.1 环境搭建

1. **依赖配置**：

```toml
[package]
name = "opentelemetry-tracing-example"
version = "0.1.0"
edition = "2021"

[dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-opentelemetry = "0.30"
tracing-error = "0.2"
opentelemetry = "0.29"
opentelemetry-otlp = { version = "0.29", features = ["grpc-tonic"] }
opentelemetry_sdk = "0.29"
opentelemetry-appender-tracing = "0.2"
smallvec = "1.0"
tokio = { version = "1.0", features = ["full"] }
tonic = "0.12"
thiserror = "1.0"
```

2. **启动 Jaeger**：

```bash
docker run -d -p 4317:4317 -p 16686:16686 jaegertracing/all-in-one
```

### 3.2 初始化 OTLP 追踪

```rust
use opentelemetry::sdk::trace::{Tracer, TracerProvider, RandomIdGenerator};
use opentelemetry::sdk::{Resource, trace as sdk_trace};
use opentelemetry::KeyValue;
use opentelemetry::trace::Sampler;
use opentelemetry_otlp::WithExportConfig;

fn init_tracer(
    endpoint: &str,
    sample_ratio: Option<f64>,
) -> Result<Tracer, opentelemetry::trace::TraceError> {
    let sample_ratio = sample_ratio.unwrap_or(1.0);
    let sampler = if sample_ratio > 0.0 && sample_ratio < 1.0 {
        Sampler::TraceIdRatioBased(sample_ratio)
    } else {
        Sampler::AlwaysOn
    };

    let mut builder = sdk_trace::TracerProvider::builder()
        .with_sampler(sampler)
        .with_id_generator(RandomIdGenerator::default())
        .with_config(sdk_trace::Config::default().with_resource(Resource::new(vec![
            KeyValue::new("service.name", "opentelemetry-tracing-service"),
        ])));

    let otlp_exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint(endpoint);
    builder = builder.with_batch_exporter(otlp_exporter);

    let tracer_provider = builder.build();
    opentelemetry::global::set_tracer_provider(tracer_provider.clone());

    Ok(tracer_provider.tracer("opentelemetry-tracing-service"))
}
```

### 3.3 初始化日志提供者

```rust
use opentelemetry::sdk::logs::LoggerProvider;

fn init_logger_provider(endpoint: &str) -> Result<LoggerProvider, opentelemetry::logs::LogError> {
    let exporter = opentelemetry_otlp::new_log_exporter()
        .tonic()
        .with_endpoint(endpoint)
        .build_log_exporter()?;
    let logger_provider = opentelemetry::sdk::logs::LoggerProvider::builder()
        .with_resource(Resource::new(vec![KeyValue::new(
            "service.name",
            "opentelemetry-tracing-service",
        )]))
        .with_batch_exporter(exporter, opentelemetry::runtime::Tokio)
        .build();
    opentelemetry::global::set_logger_provider(logger_provider.clone());
    Ok(logger_provider)
}
```

### 3.4 配置追踪与日志

```rust
use tracing_subscriber::prelude::*;
use tracing_subscriber::fmt;
use tracing_subscriber::EnvFilter;
use tracing_opentelemetry::OpenTelemetryLayer;
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use tracing_error::ErrorLayer;
use smallvec::SmallVec;

fn build_env_filter(logger_level: &str, default_level: Option<&str>) -> EnvFilter {
    let level = default_level.unwrap_or(logger_level);
    let mut filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(level));

    if !matches!(logger_level, "trace" | "debug") {
        let directives: SmallVec<[&str; 5]> = smallvec::smallvec!["hyper", "tonic", "h2", "reqwest", "tower"];
        for directive in directives {
            filter = filter.add_directive(format!("{}=off", directive).parse().unwrap());
        }
    }

    filter
}

fn init_tracing(
    tracer: opentelemetry::sdk::trace::Tracer,
    logger_provider: &opentelemetry::sdk::logs::LoggerProvider,
    logger_level: &str,
) {
    let filter = build_env_filter(logger_level, None);
    let otel_filter = build_env_filter(logger_level, Some(if logger_level == "debug" { "debug" } else { "error" }));

    let fmt_layer = fmt::layer()
        .with_target(true)
        .with_level(true)
        .with_file(true)
        .with_line_number(true)
        .with_ansi(true)
        .pretty();

    let otel_layer = OpenTelemetryTracingBridge::new(logger_provider).with_filter(otel_filter);
    let telemetry_layer = OpenTelemetryLayer::new(tracer);

    let mut registry = tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer);

    if logger_level == "debug" {
        registry = registry.with(ErrorLayer::default());
    }

    registry
        .with(otel_layer)
        .with(telemetry_layer)
        .init();
}
```

### 3.5 捕获错误堆栈

#### 方式 1：自定义错误类型

```rust
use tracing_error::SpanTrace;
use std::fmt;

#[derive(Debug)]
struct CustomError {
    message: String,
    span_trace: SpanTrace,
}

impl fmt::Display for CustomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}\nSpanTrace:\n{}", self.message, self.span_trace)
    }
}

impl std::error::Error for CustomError {}

#[instrument]
async fn do_custom_error() -> Result<(), CustomError> {
    Err(CustomError {
        message: "Custom error occurred".to_string(),
        span_trace: SpanTrace::capture(),
    })
}
```

#### 方式 2：使用 `TracedError`

```rust
use tracing_error::TracedError;
use thiserror::Error;

#[derive(Error, Debug)]
#[error("Operation failed: {0}")]
struct OperationError(String);

#[instrument]
async fn do_traced_error() -> Result<(), TracedError<OperationError>> {
    Err(OperationError("Invalid input".to_string()).into())
}
```

---

## 四、实战理论知识

### 4.1 关键点

- **SpanTrace vs Backtrace**：
  - `SpanTrace`：逻辑上下文，记录 Span 层次，适合分布式追踪。
  - `Backtrace`：底层调用栈，补充调试。
- **OTLP gRPC**：
  - 高性能二进制传输，适合生产。
  - 默认端点 `http://localhost:4317`。
- **采样策略**：
  - `AlwaysOn`：调试或低流量。
  - `TraceIdRatioBased`：生产中降低开销。
- **日志与追踪关联**：
  - `OpenTelemetryTracingBridge` 确保日志包含 `trace_id`，在 Jaeger 中关联显示。

### 4.2 最佳实践

- **结构化错误**：使用 `thiserror` + `TracedError`。
- **动态过滤**：
  - 调试：`RUST_LOG=debug`，启用 `ErrorLayer` 和宽松过滤。
  - 生产：`RUST_LOG=info`，严格过滤（如 `error`）。
- **模块过滤**：禁用无关模块（如 `hyper=off`），减少日志噪声。
- **资源管理**：调用 `opentelemetry::global::shutdown_tracer_provider()` 和 `logger_provider.shutdown()`。
- **性能优化**：
  - 使用 `SmallVec` 优化模块过滤内存分配。
  - 批量导出（`with_batch_exporter`）降低网络开销。

---

## 五、完整实战示例代码

### 5.1 项目结构

```
opentelemetry-tracing-example/
├── Cargo.toml
├── src/
│   └── main.rs
```

### 5.2 `Cargo.toml`

```toml
[package]
name = "opentelemetry-tracing-example"
version = "0.1.0"
edition = "2021"

[dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-opentelemetry = "0.30"
tracing-error = "0.2"
opentelemetry = "0.29"
opentelemetry-otlp = { version = "0.29", features = ["grpc-tonic"] }
opentelemetry_sdk = "0.29"
opentelemetry-appender-tracing = "0.2"
smallvec = "1.0"
tokio = { version = "1.0", features = ["full"] }
tonic = "0.12"
thiserror = "2.0"
```

### 5.3 `src/main.rs`

```rust
use opentelemetry::sdk::trace::{Tracer, TracerProvider, RandomIdGenerator};
use opentelemetry::sdk::logs::LoggerProvider;
use opentelemetry::sdk::{Resource, trace as sdk_trace};
use opentelemetry::KeyValue;
use opentelemetry::trace::Sampler;
use opentelemetry_otlp::WithExportConfig;
use tracing::{error, instrument};
use tracing_subscriber::prelude::*;
use tracing_subscriber::fmt;
use tracing_subscriber::EnvFilter;
use tracing_opentelemetry::OpenTelemetryLayer;
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use tracing_error::{ErrorLayer, SpanTrace, TracedError};
use smallvec::SmallVec;
use thiserror::Error;
use std::fmt;

#[derive(Error, Debug)]
#[error("Operation failed: {0}")]
struct OperationError(String);

#[derive(Debug)]
struct CustomError {
    message: String,
    span_trace: SpanTrace,
}

impl fmt::Display for CustomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}\nSpanTrace:\n{}", self.message, self.span_trace)
    }
}

impl std::error::Error for CustomError {}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let endpoint = "http://localhost:4317";
    let logger_level = "info";

    // 初始化追踪和日志
    let tracer = init_tracer(endpoint, Some(0.5))?;
    let logger_provider = init_logger_provider(endpoint)?;
    init_tracing(tracer, &logger_provider, logger_level);

    // 测试自定义错误
    if let Err(e) = do_custom_error().await {
        error!(error = %e, "Custom error occurred");
    }

    // 测试 TracedError
    if let Err(e) = do_traced_error().await {
        error!(
            error = %e,
            span_trace = %e.span_trace(),
            error_type = "operation_error",
            "Traced error occurred"
        );
    }

    // 清理资源
    opentelemetry::global::shutdown_tracer_provider();
    logger_provider.shutdown()?;

    Ok(())
}

fn init_tracer(
    endpoint: &str,
    sample_ratio: Option<f64>,
) -> Result<Tracer, opentelemetry::trace::TraceError> {
    let sample_ratio = sample_ratio.unwrap_or(1.0);
    let sampler = if sample_ratio > 0.0 && sample_ratio < 1.0 {
        Sampler::TraceIdRatioBased(sample_ratio)
    } else {
        Sampler::AlwaysOn
    };

    let mut builder = sdk_trace::TracerProvider::builder()
        .with_sampler(sampler)
        .with_id_generator(RandomIdGenerator::default())
        .with_config(sdk_trace::Config::default().with_resource(Resource::new(vec![
            KeyValue::new("service.name", "opentelemetry-tracing-service"),
        ])));

    let otlp_exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint(endpoint);
    builder = builder.with_batch_exporter(otlp_exporter);

    let tracer_provider = builder.build();
    opentelemetry::global::set_tracer_provider(tracer_provider.clone());

    Ok(tracer_provider.tracer("opentelemetry-tracing-service"))
}

fn init_logger_provider(endpoint: &str) -> Result<LoggerProvider, opentelemetry::logs::LogError> {
    let exporter = opentelemetry_otlp::new_log_exporter()
        .tonic()
        .with_endpoint(endpoint)
        .build_log_exporter()?;
    let logger_provider = opentelemetry::sdk::logs::LoggerProvider::builder()
        .with_resource(Resource::new(vec![KeyValue::new(
            "service.name",
            "opentelemetry-tracing-service",
        )]))
        .with_batch_exporter(exporter)
        .build();
    opentelemetry::global::set_logger_provider(logger_provider.clone());
    Ok(logger_provider)
}

fn build_env_filter(logger_level: &str, default_level: Option<&str>) -> EnvFilter {
    let level = default_level.unwrap_or(logger_level);
    let mut filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(level));

    if !matches!(logger_level, "trace" | "debug") {
        let directives: SmallVec<[&str; 5]> = smallvec::smallvec!["hyper", "tonic", "h2", "reqwest", "tower"];
        for directive in directives {
            filter = filter.add_directive(format!("{}=off", directive).parse().unwrap());
        }
    }

    filter
}

fn init_tracing(
    tracer: opentelemetry::sdk::trace::Tracer,
    logger_provider: &opentelemetry::sdk::logs::LoggerProvider,
    logger_level: &str,
) {
    let filter = build_env_filter(logger_level, None);
    let otel_filter = build_env_filter(logger_level, Some(if logger_level == "debug" { "debug" } else { "error" }));

    let fmt_layer = fmt::layer()
        .with_target(true)
        .with_level(true)
        .with_file(true)
        .with_line_number(true)
        .with_ansi(true)
        .pretty();

    let otel_layer = OpenTelemetryTracingBridge::new(logger_provider).with_filter(otel_filter);
    let telemetry_layer = OpenTelemetryLayer::new(tracer);

    let mut registry = tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer);

    if logger_level == "debug" {
        registry = registry.with(ErrorLayer::default());
    }

    registry
        .with(otel_layer)
        .with(telemetry_layer)
        .init();
}

#[instrument]
async fn do_custom_error() -> Result<(), CustomError> {
    error!("Starting do_custom_error");
    Err(CustomError {
        message: "Custom error occurred".to_string(),
        span_trace: SpanTrace::capture(),
    })
}

#[instrument]
async fn do_traced_error() -> Result<(), TracedError<OperationError>> {
    error!("Starting do_traced_error");
    Err(OperationError("Invalid input".to_string()).into())
}
```

### 5.4 运行与输出

1. **运行程序**：

```bash
RUST_LOG=info cargo run
```

2. **终端输出**：

```
2025-04-25T12:34:56.789 ERROR opentelemetry_tracing_example::do_custom_error [main.rs:XX]
  Starting do_custom_error
  at main.rs:XX
  in opentelemetry_tracing_example::do_custom_error

2025-04-25T12:34:56.790 ERROR opentelemetry_tracing_example::main [main.rs:XX]
  Custom error occurred
  error=Custom error occurred
  SpanTrace:
  0: opentelemetry_tracing_example::do_custom_error
     at main.rs:XX
  1: opentelemetry_tracing_example::main
     at main.rs:XX
  at main.rs:XX
  in opentelemetry_tracing_example::main
```

3. **Jaeger 输出**：

- 访问 `http://localhost:16686`，选择 `opentelemetry-tracing-service`。
- 查看 Span（如 `do_traced_error`），包含事件（如 `Starting do_traced_error`）和日志（如 `Operation failed: Invalid input`）。

---

## 六、参考资料

1. **官方文档**：

- [tracing](https://docs.rs/tracing/latest/tracing/ "tracing")
- [tracing-subscriber](https://docs.rs/tracing-subscriber/latest/tracing_subscriber/ "tracing-subscriber")
- [tracing-error](https://docs.rs/tracing-error/0.2.1/tracing_error/ "tracing-error")
- [opentelemetry](https://docs.rs/opentelemetry/0.29.0/opentelemetry/ "opentelemetry")
- [opentelemetry-otlp](https://docs.rs/opentelemetry-otlp/0.29.0/opentelemetry_otlp/ "opentelemetry-otlp")
- [tracing-opentelemetry](https://docs.rs/tracing-opentelemetry/0.30.0/tracing_opentelemetry/ "tracing-opentelemetry")
- [opentelemetry-appender-tracing](https://docs.rs/opentelemetry-appender-tracing/0.2.0/opentelemetry_appender_tracing/ "opentelemetry-appender-tracing")

2. **源码与示例**：

- [tracing GitHub](https://github.com/tokio-rs/tracing "tracing GitHub")
- [opentelemetry-rust GitHub](https://github.com/open-telemetry/opentelemetry-rust "opentelemetry-rust GitHub")
- [opentelemetry-appender-tracing Examples](https://github.com/open-telemetry/opentelemetry-rust/tree/main/opentelemetry-appender-tracing/examples "opentelemetry-appender-tracing Examples")

3. **社区资源**：

- [Rust 论坛](https://users.rust-lang.org/ "Rust 论坛")
- [OpenTelemetry 社区](https://opentelemetry.io/community/ "OpenTelemetry 社区")
- [Tokio Discord](https://discord.gg/tokio "Tokio Discord")
- [Jaeger 文档](https://www.jaegertracing.io/docs/ "Jaeger 文档")

---

## 七、总结

本文从基础概念到实战代码，全面介绍了 Rust 中使用 `tracing` 和 OpenTelemetry 实现分布式追踪与日志管理的流程。`tracing-opentelemetry` 将 Span 和事件导出为追踪，`opentelemetry-appender-tracing` 桥接日志，`tracing-error` 增强错误诊断。动态过滤和模块优化确保调试与生产的平衡，Jaeger 提供直观的监控界面。希望本指南为你构建高效的分布式监控系统提供清晰指引！

---

其中有彩蛋，自己找一找。
