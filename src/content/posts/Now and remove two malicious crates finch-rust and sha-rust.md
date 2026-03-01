---
title: "现并移除两个恶意 crate：finch-rust 与 sha-rust "
description: "2025 年 12 月 5 日，crates.io 团队接到 Socket Threat Research Team 研究员 Kush Pandya 的报告，发现两个恶意 crate 试图通过“typosquatting”（拼写欺骗）手段混淆用户，与社区广受欢迎的 `finch` crate（一个嵌入式传感器库）制造混淆，并最终窃取用户敏感信息。"
date: 2025-12-05T09:42:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-yunustug-35070914.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","恶意 crate","供应链安全","typosquatting","数据外泄","Web3 安全","crates.io 安全"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","恶意 crate","供应链安全","typosquatting","数据外泄","Web3 安全","crates.io 安全","finch-rust","sha-rust"]
keywords: "rust,实战指南,Rust 生态,恶意 crate,供应链安全,typosquatting,数据外泄,Web3 安全,crates.io 安全,finch-rust,sha-rust"
draft: false
---

## crates.io 发现并移除两个恶意 crate：finch-rust 与 sha-rust

**2025 年 12 月 5 日 · crates.io 团队**

### 事件概要

2025 年 12 月 5 日，crates.io 团队接到 Socket Threat Research Team 研究员 Kush Pandya 的报告，发现两个恶意 crate 试图通过“typosquatting”（拼写欺骗）手段混淆用户，与社区广受欢迎的 `finch` crate（一个嵌入式传感器库）制造混淆，并最终窃取用户敏感信息。

这两个恶意 crate 分别是：

- **`finch-rust`**  
  发布于 2025 年 11 月 25 日，共 1 个版本，被下载 28 次，在其依赖中引入了恶意 crate `sha-rust`。

- **`sha-rust`**  
  在 2025 年 11 月 20 日至 11 月 25 日期间发布了 8 个版本，共被下载 153 次。

这两个 crate 的最终目的均为数据外泄（data exfiltration），主要针对 Web3 开发者的私钥、钱包助记词和环境变量等敏感凭证。

### 已采取的行动

- 立即永久禁用发布者账户 `face-lessssss`；
- 于 UTC 时间 2025 年 12 月 5 日 15:52 将两个恶意 crate 从 crates.io 完全删除；
- 保留恶意 crate 的压缩包以供后续深度分析；
- 向 GitHub 报告了对应的恶意仓库，相关账户及仓库已被 GitHub 移除。

### 技术分析

Socket 团队已发布详细分析文章：  
《恶意 crate 冒充 finch 窃取开发者凭证》  
链接：https://socket.dev/blog/malicious-crate-mimicking-finch-exfiltrates-credentials

好消息是：
- crates.io 上没有其他 crate 依赖这两个恶意包；
- 除自动镜像和安全扫描服务外，没有证据显示普通用户实际下载并使用了它们。

### 致谢

特别感谢：
- Socket Threat Research Team 的 **Kush Pandya** 及时发现并报告；
- crates.io 团队成员 **Carol Nichols** 以及 Rust 基金会 **Adam Harvey** 在应急响应中的快速配合。

### 给 Rust 开发者的提醒

1. 安装依赖时仔细核对 crate 名称，尤其是与热门库只有细微拼写差异的包；
2. 建议使用 `cargo deny`、`cargo vet` 或 Socket 等供应链安全工具进行依赖审计；
3. 生产环境请启用 `cargo creep` 或类似工具检测潜在的凭据泄露行为；
4. 及时更新 `cargo` 和 `rustup`，保持依赖树最新。

Rust 生态的安全离不开每一位使用者的警惕。再次感谢 Socket 团队与社区的安全研究者们！

—— crates.io 团队  
2025 年 12 月 5 日
