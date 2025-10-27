---
title: "Rust 1.90.0 发布：性能优化与生态进化，赋能可靠高效编程"
description: "Rust 团队于 2025 年 9 月 18 日宣布推出 Rust 编程语言的新版本 1.90.0。Rust 是一种赋予开发者构建可靠且高效软件的编程语言。如果您已通过 `rustup` 安装了 Rust 的早期版本，可通过以下命令更新至 1.90.0"
date: 2025-09-19T17:20:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-happyrisingguy-33957865.jpg-slimming.webp"
categories: ["Rust", "Cargo", "发布公告"]
authors: ["houseme"]
tags: ["rust", "cargo","发布公告","性能优化", "生态进化", "x86_64-unknown-linux-gnu", "LLD", "工作空间发布", "x86_64-apple-darwin", "Tier 2"]
keywords: "rust,cargo,发布公告,性能优化,生态进化,x86_64-unknown-linux-gnu,LLD,工作空间发布,x86_64-apple-darwin,Tier 2"
draft: false
---

# Rust 1.90.0 发布公告

Rust 团队于 2025 年 9 月 18 日宣布推出 Rust 编程语言的新版本 1.90.0。Rust 是一种赋予开发者构建可靠且高效软件的编程语言。如果您已通过 `rustup` 安装了 Rust 的早期版本，可通过以下命令更新至 1.90.0：

```console
$ rustup update stable
```

如果尚未安装 `rustup`，可访问 Rust 官方网站的相应页面获取，并查看 [1.90.0 详细发布说明](https://doc.rust-lang.org/stable/releases.html#version-1900-2025-09-18)。若想帮助测试未来版本，可考虑切换至 beta 通道（`rustup default beta`）或 nightly 通道（`rustup default nightly`），并请报告您遇到的任何问题。

## Rust 1.90.0 的主要更新

### `x86_64-unknown-linux-gnu` 默认使用 LLD 链接器

Rust 的 `x86_64-unknown-linux-gnu` 目标平台现默认使用 LLD 链接器进行 Rust 包的链接。相比 Linux 默认的 BFD 链接器，LLD 在链接大型二进制文件、包含大量调试信息的二进制文件以及增量构建时，性能显著提升。

在绝大多数情况下，LLD 与 BFD 向后兼容，用户只会感受到编译时间的减少。若遇到新的链接器问题，可通过 `-C linker-features=-lld` 编译器标志选择禁用 LLD。可将该标志添加至 `RUSTFLAGS` 环境变量，或在项目的 `.cargo/config.toml` 文件中配置如下：

```toml
[target.x86_64-unknown-linux-gnu]
rustflags = ["-Clinker-features=-lld"]
```

如遇到 LLD 链接器问题，请通过 [GitHub](https://github.com/rust-lang/rust/issues/new/choose) 反馈。更多关于 LLD 的切换、性能基准测试及禁用机制的信息，可参考[此博客](https://blog.rust-lang.org/2025/09/01/rust-lld-on-1.90.0-stable/)。

### Cargo 原生支持工作空间发布

Cargo 现支持 `cargo publish --workspace` 命令，可自动按正确顺序（遵循依赖关系）发布工作空间中的所有 crate。这一功能此前需通过外部工具或手动排序实现，现已集成到 Cargo 中。

原生支持使 Cargo 的发布验证能够在包括 dry-run（模拟发布）在内的场景下，对整个待发布 crate 集合进行构建检查，模拟已发布的状态。但需注意，发布仍非原子操作，网络错误或服务器端故障可能导致工作空间部分发布。

### `x86_64-apple-darwin` 降级为 Tier 2（带主机工具）

由于 GitHub 即将停止为公共仓库提供免费的 macOS x86_64 运行器，且 Apple 宣布将逐步停止支持 x86_64 架构，Rust 1.90 将 `x86_64-apple-darwin` 目标从 Tier 1（带主机工具）降级为 Tier 2（带主机工具）。这意味着该目标（包括 `rustc` 和 `cargo` 等工具）仍保证能够构建，但不再保证通过自动化测试套件。

对用户而言，此变化短期内无明显影响。Rust 项目仍将通过 `rustup` 或其他安装方式为该目标分发标准库和编译器的构建版本。但随着时间推移，由于测试覆盖率降低，该目标可能出现兼容性问题或功能失效，且不会有进一步公告。

### 稳定的 API

以下 API 现已在常量（const）上下文中稳定：

- `[T]::reverse`
- `f32::floor`、`f32::ceil`、`f32::trunc`、`f32::fract`、`f32::round`、`f32::round_ties_even`
- `f64::floor`、`f64::ceil`、`f64::trunc`、`f64::fract`、`f64::round`、`f64::round_ties_even`

新增的稳定 API 包括：

- `u{n}::checked_sub_signed`
- `u{n}::overflowing_sub_signed`
- `u{n}::saturating_sub_signed`
- `u{n}::wrapping_sub_signed`
- `impl Copy for IntErrorKind`
- `impl Hash for IntErrorKind`
- 针对 `CStr` 和 `CString` 的多种 `PartialEq` 实现

### 平台支持

- `x86_64-apple-darwin` 现为 Tier 2 目标

更多关于 Rust 平台支持层级的信息，请参阅 [Rust 平台支持页面](https://doc.rust-lang.org/rustc/platform-support.html)。

### 其他变化

查看 [Rust](https://github.com/rust-lang/rust/releases/tag/1.90.0)、[Cargo](https://doc.rust-lang.org/nightly/cargo/CHANGELOG.html#cargo-190-2025-09-18) 和 [Clippy](https://github.com/rust-lang/rust-clippy/blob/master/CHANGELOG.md#rust-190) 的完整变更日志。

## 致谢

Rust 1.90.0 的发布离不开众多贡献者的努力。感谢所有参与者的支持！更多信息请查看 [感谢页面](https://thanks.rust-lang.org/rust/1.90.0/)。
