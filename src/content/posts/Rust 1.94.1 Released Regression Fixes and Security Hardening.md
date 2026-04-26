---
title: "🦀 Rust 1.94.1 正式发布：回归修复与安全加固"
description: "Rust 1.94.1 点版本发布，修复 wasm32 线程生成、Windows API 回归及 Clippy ICE 问题，同步更新 Cargo 依赖以修复两项 CVE 安全漏洞，保障开发体验与系统安全。"
date: 2026-03-26T08:00:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-roseleon-3321584.jpg-slimming.webp"
categories: ["Rust", "工具链", "版本发布", "安全更新", "Cargo", "Clippy"]
authors: ["houseme"]
tags: ["Rust","工具链","版本发布","安全加固","Cargo","Clippy","wasm32","Windows","CVE 修复","回归修复"]
keywords: "rust,工具链,版本发布,安全更新,Cargo,Clippy,wasm32,Windows,CVE 修复,回归修复,线程生成,证书验证"
draft: false
---

# 🦀 Rust 1.94.1 正式发布：回归修复与安全加固

Rust 团队于 2026 年 3 月 26 日正式发布 Rust 1.94.1 点版本。作为 1.94.0 的紧急补丁版本，本次更新聚焦于**回归问题修复**与**安全漏洞加固**，旨在为开发者提供更稳定、更可靠的工具链体验。

## 🔧 核心修复内容

### 1. 平台兼容性修复
- **wasm32-wasip1-threads 支持**：修复 `std::thread::spawn` 在 WebAssembly WASI 线程模型下的回归问题，确保异步并发场景在边缘计算与服务器端 WASM 应用中稳定运行。

### 2. API 稳定性维护
- **Windows 文件系统接口回退**：移除 `std::os::windows::fs::OpenOptionsExt` 中不慎引入的不稳定方法。由于该 Trait 未标记为 `sealed`，直接扩展可能破坏下游兼容性，本次回退体现了 Rust 对 API 演进严谨性的坚守。

### 3. 开发体验优化
- **Clippy 静态检查修复**：解决 `match_same_arms` 规则触发的内部编译器错误（ICE），避免开发者在模式匹配检查中遭遇非预期崩溃，提升代码审查流畅度。

### 4. Cargo 依赖链加固
- **curl-sys 降级至 0.4.83**：修复部分 FreeBSD 用户遇到的 TLS 证书验证失败问题，保障跨平台依赖拉取的可靠性。
- **tar 升级至 0.4.45**：修复 [CVE-2026-33055](https://www.cve.org/CVERecord?id=CVE-2026-33055) 与 [CVE-2026-33056](https://www.cve.org/CVERecord?id=CVE-2026-33056) 两项安全漏洞，防止归档解压过程中的路径遍历风险。注：crates.io 用户不受影响，但建议本地构建场景及时更新。

## 🚀 升级建议

若已通过 rustup 安装 Rust，执行以下命令即可平滑升级：

```bash
rustup update stable
```

新用户可访问 [官方安装页面](https://www.rust-lang.org/install.html) 获取 rustup 工具。

## 💡 版本解读

1.94.1 虽未引入语言层面新特性，但其价值体现在**工程稳定性**与**供应链安全**两个维度：
- 对 WASM、Windows 等关键平台的回归修复，体现了 Rust 对多目标后端一致性的承诺；
- 依赖项的及时安全更新，彰显了 Cargo 生态对 CVE 响应的敏捷性；
- Clippy 的稳定性改进，进一步巩固了 Rust "编译期即正确" 的开发哲学。

建议所有生产环境项目尽快升级，尤其在涉及归档处理、跨平台构建或静态分析的场景中，本次修复将有效降低潜在风险。

> 致谢：感谢全球贡献者共同促成 1.94.1 的发布，详见 [致谢页面](https://thanks.rust-lang.org/rust/1.94.1/)。
