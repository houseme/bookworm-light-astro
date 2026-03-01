---
title: "Rust 将全面升级 Linux musl 目标到 musl 1.2.5 "
description: "好消息！从即将于 **2026 年 1 月 22 日**发布的 **Rust 1.93** 开始，所有 `*-linux-musl` 目标（即静态链接 musl libc 的目标）将统一升级到底层 musl 版本 **1.2.5**。"
date: 2025-12-05T08:42:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-gilles-33391083.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","恶意 crate","供应链安全","typosquatting","数据外泄","Web3 安全","crates.io 安全"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","恶意 crate","供应链安全","typosquatting","数据外泄","Web3 安全","crates.io 安全","finch-rust","sha-rust"]
keywords: "rust,实战指南,Rust 生态,恶意 crate,供应链安全,typosquatting,数据外泄,Web3 安全,crates.io 安全,finch-rust,sha-rust"
draft: false
---

### Rust 将全面升级 Linux musl 目标到 musl 1.2.5

—— 从 Rust 1.93 起，静态链接二进制文件网络更稳、兼容性更强

**2025 年 12 月 5 日 · Rust 编译器团队**

好消息！从即将于 **2026 年 1 月 22 日**发布的 **Rust 1.93** 开始，所有 `*-linux-musl` 目标（即静态链接 musl libc 的目标）将统一升级到底层 musl 版本 **1.2.5**。

## 这次升级主要影响哪些目标？

最直接受影响的是之前一直停留在 musl 1.2.3 的三个「Tier 2 with host tools」目标：

- `x86_64-unknown-linux-musl`
- `aarch64-unknown-linux-musl`
- `powerpc64le-unknown-linux-musl`

其他大多数 musl 目标其实已经在 Rust 1.74 和 1.86 时悄悄升级到了 1.2.4/1.2.5（当时因为配置疏忽没写文档），这次只是正式把版本号钉死，文档也补齐了。

## 为什么现在升级？

1. **网络可靠性大幅提升**  
   musl 1.2.4/1.2.5 重写了 DNS 解析器，对大记录、递归解析器、IPv6 等场景的处理更加健壮。以前用静态 musl 编译的网络程序经常莫名其妙卡死或解析失败，这次基本都能彻底解决。

2. **修复大量已知问题**  
   包括动态链接器、线程局部存储、数学函数精度等几十项改进（详见 musl 官方发布日志）。

## 唯一的破坏性变更（已经等了两年）

musl 1.2.4 删除了几个早已废弃的兼容符号（如 `open64`、`lseek64` 等），这曾经会影响到 `libc` crate 的老版本。

好消息是：

- `libc` crate 在 **2023 年 6 月**（libc 0.2.146）就已修复；
- 2025 年 6 月的 crater 全局回归测试显示，只有约 **1.5%** 的 crate 仍受影响，且绝大多数是两年多没跑过 `cargo update` 的「沉睡项目」（很多是几年前的游戏开发小项目卡在旧版 `getrandom`）；
- 修复方法极简单：执行一次 `cargo update` 即可。

典型报错长这样：

```
undefined reference to `open64`
```

看到这行错误，99% 的情况只需要更新依赖就解决。

## 对普通开发者的影响总结

- **新项目**：完全无感，直接享受更强的静态二进制网络能力；
- **老项目**（尤其是 2023 年之前最后一次更新的静态 musl 项目）：升级到 Rust 1.93 后，可能需要执行一次 `cargo update -p libc` 或直接 `cargo update`；
- 游戏开发者注意：如果你还在用很老的 `getrandom 0.2.8` 或更早版本，强烈建议更新到最新版。

## 结语

拖了两年多，我们终于可以放心地把 musl 升级到 1.2.5 了！这不仅带来显著的稳定性提升，也标志着 Rust 静态 musl 构建生态已经足够成熟，可以承受一次小版本的 libc 升级。

从 1.93 开始，用 `x86_64-unknown-linux-musl` 编译出来的单文件二进制，将在网络可靠性上迎来质的飞跃。

感谢所有参与测试、修复和 crater 运行的贡献者们！

—— Rust 编译器团队  
2025 年 12 月 5 日

（原文链接：https://blog.rust-lang.org/2025/12/05/Updating-musl-1.2.5/）

