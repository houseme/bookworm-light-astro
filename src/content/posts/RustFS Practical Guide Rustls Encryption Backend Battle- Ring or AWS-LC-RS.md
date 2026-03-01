---
title: "🦀 RustFS 实战指南：Rustls 加密后端之争 —— Ring 还是 AWS-LC-RS？"
description: "RustFS 实战手册：一行代码切换 rustls 后端，对比 Ring 与 AWS-LC-RS 的吞吐、延迟与体积，附选型建议，助你秒定最佳加密方案。"
date: 2025-12-25T10:11:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-pixabay-417173.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","rustfs","aws-lc-rs","ring","openssl","rustls"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","rustfs","aws-lc-rs","ring","openssl","rustls","BoringSSL","QUIC"]
keywords: "rust,实战指南,Rust 生态,rustfs,aws-lc-rs,ring,openssl,rustls,BoringSSL"
draft: false
---


## 1. 背景：Rustls 的“换心”手术

在很长一段时间里，使用 Rustls 意味着你必须使用 `ring`。`ring` 是一个优秀的库，但它固执、更新缓慢且不支持 FIPS（联邦信息处理标准）。

Rustls 0.23 引入了 `CryptoProvider` 接口，正式打破了这一垄断。现在，RustFS 可以根据部署环境和性能需求，在两个主要选手之间做选择：

* **Ring**: 老牌卫士，Rust 社区的“默认”选择。
* **AWS-LC-RS**: 性能怪兽，基于 Google BoringSSL 代码库，由 AWS 团队维护。

---

## 2. 深度对比：通过现象看本质

### 选手一：Ring (稳健的极简主义者)

* **本质**：大部分逻辑用 Rust 重写，底层核心数学运算使用汇编（源自 BoringSSL）。
* **构建体验**：**S 级**。极少依赖外部环境，`cargo build` 一把梭，通常不需要安装额外的 C 库或工具。
* **兼容性**：极好。在 Windows、macOS、Linux 甚至 WASM 上都能轻松编译。
* **短板**：不支持 FIPS 认证；对新硬件指令集（如最新的 AVX-512 变体）跟进较慢；维护者精力有限。

### 选手二：AWS-LC-RS (全副武装的特种兵)

* **本质**：它是 AWS-LC（C 语言库）的 Rust 包装器。这意味着它底层是庞大的 C 代码库。
* **构建体验**：**B 级**。它必须在编译时构建底层的 C 代码，因此**强制依赖** `cmake`, `gcc/clang`, `golang` (用于生成汇编), `perl`。环境配置稍微不慎，编译就会报错。
* **性能**：**S 级**。
* **AES-GCM 吞吐量**：在现代 x86_64 和 ARM (Graviton) 架构上，通常比 Ring 快。
* **握手性能**：针对高并发连接进行了极致优化。


* **杀手锏**：**FIPS 140-3 认证**。如果你计划将 RustFS 部署在政府、金融或合规要求严格的场景，这是唯一选择。
* **现代标准**：对 QUIC (HTTP/3) 所需的加密原语支持更完善、更及时。

---

## 3. RustFS 的选择策略：如何决策？

鉴于 RustFS 是一个**高性能文件系统**，且依赖列表里包含了 `tikv-jemallocator`（追求内存分配性能）和 `opentelemetry`（注重观测性），我们的决策逻辑如下：

#### 理由 A：选择 `aws-lc-rs` (推荐用于生产环境)

如果你的目标是**极致的 IO 吞吐性能**。
文件系统的数据传输高度依赖 AES-GCM 加密速度。AWS-LC-RS 针对现代服务器 CPU 进行了激进的汇编优化，能榨干硬件性能。对于数据密集型应用，**性能就是一切**。

* **前提**：你的 CI/CD 流水线和 Docker 基础镜像已经准备好了 `cmake` 等编译工具链。

#### 理由 B：选择 `ring` (推荐用于开发环境/简单构建)

如果你希望**快速开发**，或者你的用户需要在各种非标准环境下自行编译 RustFS。

* **场景**：Windows 开发机、没有安装构建工具的轻量级容器、快速的原型验证。

---

## 4. 实战操作：将 RustFS 切换至 `aws-lc-rs`

在 Rustls 0.23+ 中，默认情况下（Default Features）其实已经指向了 `aws-lc-rs`。但是，为了避免依赖树中的其他库（如 `reqwest` 或 `opentelemetry`）意外引入 `ring` 或 `native-tls`，我们需要在 `Cargo.toml` 中显式锁定配置。

### 修改 `Cargo.toml`

打开你上传的根目录 `Cargo.toml`。由于这是一个 Workspace 项目，建议在根目录的 `[workspace.dependencies]` 中统一管理，或者在 `crates/crypto` 模块中集中处理。

假设你想在全局强制使用 `aws-lc-rs`：

#### 步骤 1: 显式声明 rustls 依赖

找到或添加 `rustls` 依赖，并启用 `aws_lc_rs` 特性。

```toml
[dependencies]
# 显式使用 aws-lc-rs 作为 provider，并开启 tls12 支持（如果需要）
rustls = { version = "0.23", default-features = false, features = ["aws_lc_rs", "logging", "std", "tls12"] }

# 关键：检查 reqwest/opentelemetry
# 你用到了 opentelemetry-otlp，它依赖 reqwest。
# 必须确保 reqwest 使用 rustls-tls-manual-roots 或 rustls-tls-native-roots，且底层指向 aws-lc-rs
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "charset", "http2", "macos-system-configuration"] }

```

*注意：`reqwest` 的 `rustls-tls` feature 默认在 0.12+ 版本中通常会跟随 `rustls` 的默认配置。只要你的依赖树里没有库强制开启 `ring` feature，通常会自动对齐。*

#### 步骤 2: 代码层面的强制注册 (可选但推荐)

为了防止运行时因为依赖混乱导致使用了错误的 Provider（比如莫名其妙用回了 ring），建议在 `rustfs` 的入口文件（如 `rustfs/src/main.rs`）的最开始显式注册 Provider。

```rust
// 在 main.rs 顶部
use rustls::crypto::aws_lc_rs;

fn main() {
    // 强制设置全局默认加密提供者为 AWS-LC-RS
    // 如果设置失败（例如已经被其他库抢先设置），这里会 panic，这在开发期是好事，能让你尽早发现依赖冲突
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC-RS crypto provider");

    // ... 启动逻辑
    println!("RustFS starting with AWS-LC-RS crypto backend...");
}

```

### 验证更改

编译完成后，你可以使用 `cargo tree` 来检查是否还有 `ring` 的残留（除非某些库硬编码依赖 ring，否则应该能看到 ring 消失或变得可选）：

```bash
cargo tree -e features | grep ring
# 如果配置正确，理论上 ring 应该不出现在 rustls 的依赖链中，
# 或者虽然存在（作为备选），但运行时被你的 install_default() 覆盖了。

```

---

## 5. 必要的环境准备 (避坑指南)

既然选择了 `aws-lc-rs`，正如之前的分析，你**必须**确保你的构建环境（Dockerfile 或 CI Runner）安装了以下工具，否则 `cargo build` 会直接挂掉：

```bash
# Ubuntu/Debian 构建环境必备
apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libclang-dev \
    golang \
    perl

```

如果你的 `RustFS` 需要在 Docker 中构建，请务必参考我们之前讨论的 **Multi-stage Build** 方案，在 Builder 阶段安装这些工具，在 Runtime 阶段只保留二进制文件。

---

## 6. 总结

对于 **RustFS** 这样定位的项目：

1. **推荐路线**：坚定地选择 **`aws-lc-rs`**。它带来的 AES-GCM 性能提升对于文件系统吞吐量至关重要，且 FIPS 支持为未来的企业级交付扫清了障碍。
2. **代价**：你需要维护一个包含 `cmake/golang/perl` 的构建镜像。
3. **实施**：在 `Cargo.toml` 中显式开启 `aws_lc_rs` feature，并在 `main.rs` 中进行代码级注册以防万一。

### 参考资料

1. **Rustls 官方迁移指南**: [Rustls 0.23 Provider API](https://www.google.com/search?q=https://docs.rs/rustls/latest/rustls/crypto/index.html)
2. **AWS Security Blog**: [Performance of aws-lc-rs vs ring](https://www.google.com/search?q=https://aws.amazon.com/blogs/opensource/aws-lc-rs-performance/)
3. **RustFS 依赖分析**: 基于你提供的 `Cargo.lock` 和 `Cargo.toml` 文件。
