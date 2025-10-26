---
title: "docs.rs 焕新启航：拥抱 ARM64，引领 Rust 生态新篇章"
description: "docs.rs 迎来重大更新，紧随 Rust 生态脉动，拥抱苹果 ARM64 硅片与 Linux ARM64 架构，替换传统 x86_64 和 32 位 x86 默认目标。这一变革彰显 Rust 社区对现代硬件趋势的敏锐响应，为开发者带来更高效、兼容的文档构建体验。crate 作者可通过 Cargo.toml 灵活定制目标，掌控项目未来！"
date: 2025-10-17T23:12:10Z
image: "https://static-rs.bifuba.com/images/posts/pexels-francesco-ungaro-2289652.jpg"
categories: ["Rust","性能优化","工具推荐","实战指南","docs.rs","文档构建","ARM64","生态更新"]
authors: ["houseme"]
tags: ["Rust","性能优化","工具推荐","实战指南","docs.rs","文档构建","ARM64","生态更新"]  
keywords: "Rust, 性能优化, 工具推荐, 实战指南, docs.rs, 文档构建, ARM64, 生态更新"
draft: false
---

## 引言：docs.rs 的新篇章

docs.rs 迎来重大更新，紧随 Rust 生态脉动，拥抱苹果 ARM64 硅片与 Linux ARM64 架构，替换传统 x86_64 和 32 位 x86 默认目标。这一变革彰显 Rust 社区对现代硬件趋势的敏锐响应，为开发者带来更高效、兼容的文档构建体验。crate 作者可通过 Cargo.toml 灵活定制目标，掌控项目未来！

# docs.rs：更改默认构建目标

2025 年 10 月 16 日 · 代表 docs.rs 团队的 Denis Cornehl

## docs.rs 默认构建目标的更改

本文宣布了对 docs.rs 用于构建文档的默认目标列表的两项更改。

crate 作者可以通过在 `Cargo.toml` 中使用 [docs.rs 元数据](https://docs.rs/about/metadata) 指定自定义的目标列表。如果未提供此元数据，docs.rs 将回退到默认目标列表。我们正在更新此列表，以更好地反映 Rust 生态系统的当前状态。

### 苹果硅（ARM64）取代 x86_64

为了反映苹果从 x86_64 到自家 ARM64 硅的过渡，Rust 项目已更新其平台支持层级。`aarch64-apple-darwin` 目标现已成为 Tier 1，而 `x86_64-apple-darwin` 已降为 Tier 2。有关详情，请参阅 [RFC 3671](https://github.com/rust-lang/rfcs/pull/3671) 和 [RFC 3841](https://github.com/rust-lang/rfcs/pull/3841)。

为此，docs.rs 将使用 `aarch64-apple-darwin` 作为苹果平台的默认目标，取代 `x86_64-apple-darwin`。

### Linux ARM64 取代 32 位 x86

对 32 位 `i686` 架构的支持正在减少，主要 Linux 发行版已开始逐步淘汰该架构。

因此，我们将默认目标列表中的 `i686-unknown-linux-gnu` 替换为 `aarch64-unknown-linux-gnu`。

### 新的默认目标列表

更新后的默认目标列表如下：

- `x86_64-unknown-linux-gnu`
- `aarch64-apple-darwin`（取代 `x86_64-apple-darwin`）
- `x86_64-pc-windows-msvc`
- `aarch64-unknown-linux-gnu`（取代 `i686-unknown-linux-gnu`）
- `i686-pc-windows-msvc`

### 选择退出

如果您的 crate 需要使用之前的默认目标列表，您可以在 `Cargo.toml` 中明确指定：

```toml
[package.metadata.docs.rs]
targets = [
    "x86_64-unknown-linux-gnu",
    "x86_64-apple-darwin",
    "x86_64-pc-windows-msvc",
    "i686-unknown-linux-gnu",
    "i686-pc-windows-msvc"
]
```

请注意，docs.rs 继续支持 Rust 工具链中可用的任何目标；仅更改了 _默认_ 目标列表。

原文链接：[https://blog.rust-lang.org/2025/10/16/docsrs-changed-default-targets/](https://blog.rust-lang.org/2025/10/16/docsrs-changed-default-targets/)
