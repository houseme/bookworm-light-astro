---
title: "Rust 1.91.1 发布：两例回归缺陷一次性修复"
description: "Rust 团队于 2025 年 9 月 18 日宣布推出 Rust 编程语言的新版本 1.90.0。Rust 是一种赋予开发者构建可靠且高效软件的编程语言。如果您已通过 `rustup` 安装了 Rust 的早期版本，可通过以下命令更新至 1.90.0"
date: 2025-11-11T07:20:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-ahmet-ozcan-2156466497-34615511.jpg-slimming.webp"
categories: ["Rust", "Cargo", "发布公告"]
authors: ["houseme"]
tags: ["rust", "cargo","发布公告","性能优化", "生态进化", "x86_64-unknown-linux-gnu", "LLD", "工作空间发布", "x86_64-apple-darwin", "Tier 2"]
keywords: "rust,cargo,发布公告,性能优化,生态进化,x86_64-unknown-linux-gnu,LLD,工作空间发布,x86_64-apple-darwin,Tier 2"
draft: false
---

Rust 1.91.1 发布：修复 Wasm 链接与 illumos 构建锁两大回归缺陷

Rust 团队于 2025 年 11 月 10 日正式发布 1.91.1 补丁版本。如果你已通过 rustup 安装旧版，只需在终端执行：

```bash
rustup update stable
```

即可一键升级。尚未安装 rustup 的用户，可前往官网获取安装指引。

## 1.91.1 修复了哪些缺陷？

### 1. WebAssembly 链接与运行时错误

大多数 Rust 目标平台仅通过符号名来识别函数，但 WebAssembly（Wasm）还需额外的「模块名」。  
开发者可使用 `#[link(wasm_import_module = "...")]` 为 `extern` 块指定模块名：

```rust
#[link(wasm_import_module = "hello")]
extern "C" {
    pub fn world();
}
```

**回归现象**  
在 1.91.0 中，如果多个 Rust crate 分别从**不同 Wasm 模块**导入**同名符号**，编译阶段可能触发 *"import module mismatch"* 链接失败；更严重的是，运行时可能绑定到错误函数，引发未定义行为（崩溃、静默数据损坏）。

**修复结果**  
1.91.1 已校正符号解析逻辑，彻底消除该风险。详情见 [Issue #148347](https://github.com/rust-lang/rust/issues/148347)。

### 2. illumos 上 Cargo 构建目录锁失效

Cargo 会在 `target/` 目录加文件锁，防止多进程同时构建互相干扰。若文件系统不支持锁，Cargo 会收到 `Unsupported` 错误并自动降级到无锁模式。

**回归现象**  
1.91.0 将加锁实现从自定义代码改为标准库新稳定的 `File::lock` 系列方法。由于实现疏忽，在 illumos 平台这些方法始终返回 `Unsupported`，导致**即使文件系统支持锁**，Cargo 也直接放弃加锁，可能出现构建污染。

**修复结果**  
1.91.1 在标准库层面启用 illumos 的 `File::lock` 支持，Cargo 的目录锁行为恢复正常。

## 致谢

本次快速修复离不开社区贡献者的协作。完整的感谢名单请见 [thanks.rust-lang.org](https://thanks.rust-lang.org/rust/1.91.1/)。

---

### 快速总结（TL;DR）

- 只修两条 1.91.0 回归：  
  ① Wasm 同名符号跨 crate 导入会链错/跑错；  
  ② illumos 上 Cargo 因误判而**完全不锁**构建目录。
- 升级成本 = 一条 `rustup update stable`。
- 无新功能，无破坏性变更，生产环境可放心采纳。
