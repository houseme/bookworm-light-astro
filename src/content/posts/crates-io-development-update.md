---
title: "🦀 crates.io：开发更新 | 翻译自 Rust 官方博客"
description: "时光飞逝！自从我们上次 crates.io 开发更新已经过去了六个月，因此是时候再来一篇了。以下是过去六个月中对[crates.io](https://crates.io/)所做的最显著变化和改进的总结。"
date: 2026-01-21T15:22:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-lum3n-44775-1028599.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态", "翻译","crates.io","开发更新","Cargo"]
authors: ["Tobias Bieniek"]
tags: ["Rust", "实战指南","Rust 生态","翻译","crates.io","开发更新","Cargo","安全","前端","Svelte","GitHub Actions","GitLab CI/CD","可信发布"]
keywords: "rust,实战指南,Rust 生态,翻译,crates.io,开发更新,Cargo,安全,前端,Svelte,GitHub Actions,GitLab CI/CD,可信发布"
draft: false
---


时光飞逝！自从我们上次 crates.io 开发更新已经过去了六个月，因此是时候再来一篇了。以下是过去六个月中对[crates.io](https://crates.io/)所做的最显著变化和改进的总结。

## 安全选项卡

crate 页面现在有一个新的“安全”选项卡，显示来自[RustSec](https://rustsec.org/)数据库的安全公告。这允许您在添加依赖项之前快速查看 crate 是否具有已知漏洞。

![安全选项卡截图](https://blog.rust-lang.org/2026/01/21/crates-io-development-update/security-tab.png)

该选项卡显示 crate 的已知漏洞以及受影响的版本范围。

此功能仍在开发中，我们计划在未来添加更多功能。我们要感谢[OpenSSF](https://openssf.org/)（开源安全基金会）为此项工作提供资金，以及[Dirkjan Ochtman](https://github.com/djc)实现它。

## 可信发布增强

在我们 2025 年 7 月的更新中，我们宣布了对 GitHub Actions 的可信发布支持。从那时起，我们对此功能进行了多项增强。

### GitLab CI/CD 支持

可信发布现在除了 GitHub Actions 外，还支持[GitLab CI/CD](https://docs.gitlab.com/ee/ci/)。这允许 GitLab 用户无需管理 API 令牌即可发布 crate，使用相同的基于 OIDC 的认证流程。

请注意，目前这仅适用于 GitLab.com。自托管的 GitLab 实例尚未支持。crates.io 的实现已被重构以支持多个 CI 提供商，因此未来添加对其他平台如 Codeberg/Forgejo 的支持应该相对简单。欢迎贡献！

### 仅可信发布模式

crate 所有者现在可以为他们的 crate 强制实施可信发布。在 crate 设置中启用后，传统的基于 API 令牌的发布将被禁用，只有可信发布可用于发布新版本。这降低了因 API 令牌泄露而导致的未经授权发布的风险。

### 阻塞触发器

`pull_request_target` 和 `workflow_run` GitHub Actions 触发器现在被阻塞无法进行可信发布。这些触发器在 GitHub Actions 生态系统中负责多项安全事件，不值得冒险。

## 源代码行数

crate 页面现在显示源代码行数（SLOC）指标，让您在添加依赖项之前了解 crate 的大小。此指标在发布后通过后台作业使用[tokei](https://github.com/XAMPPRocky/tokei) crate 计算。它也显示在 OpenGraph 图像上：

![显示 SLOC 指标的 OpenGraph 图像](https://blog.rust-lang.org/2026/01/21/crates-io-development-update/og-image-sloc.png)

感谢[XAMPPRocky](https://github.com/XAMPPRocky)维护`tokei` crate！

## 索引中的发布时间

crate 索引条目中添加了一个新的`pubtime`字段，记录每个版本的发布时间。这启用了多项用例：

- Cargo 可以在未来为新版本实现冷却期
- Cargo 可以重现依赖解析，仿佛是过去的日期，尽管被 yank 的版本仍保持 yank 状态
- 服务如[Renovate](https://github.com/renovatebot/renovate)可以无需额外 API 请求即可确定发布日期

感谢[Rene Leonhardt](https://github.com/reneleonhardt)提出建议，以及[Ed Page](https://github.com/epage)在 Cargo 方面推动此事。

## Svelte 前端迁移

在 2025 年底，crates.io 团队评估了多项现代化前端的选项，并决定实验将网站移植到[Svelte](https://svelte.dev/)。目标是在添加新功能之前创建一个现有功能的逐一移植。

此迁移仍被视为实验性工作，正在进行中。使用更主流的框架应该使新贡献者更容易在前台上工作。新 Svelte 前端使用 TypeScript，并从我们的[OpenAPI 描述](https://crates.io/api/openapi.json)生成类型安全的 API 客户端代码，因此类型从 Rust 后端自动流动到 TypeScript 前端。

感谢[eth3lbert](https://github.com/eth3lbert)提供有帮助的审查和 Svelte 最佳实践指导。我们将在未来的更新中分享更多细节。

## 杂项

这些是过去六个月中 crates.io 的一些更明显的变化，但“幕后”也发生了很多事情。

- **Cargo 用户代理过滤**：我们注意到即使对于不受欢迎的 crate，下载图表也显示出恒定的背景下载水平，这是由于机器人、爬虫和镜像造成的。现在下载计数被过滤仅包括来自 Cargo 的请求，提供更准确的统计数据。

- **HTML 电子邮件**：来自 crates.io 的电子邮件现在支持 HTML 格式。

- **加密 GitHub 令牌**：来自 GitHub 的 OAuth 访问令牌现在在数据库中静态加密。虽然我们没有滥用的证据，但我们决定改善我们的安全态势。这些令牌从未包含在每日数据库转储中，旧的未加密列已被移除。

- **源链接**：crate 页面现在在侧边栏显示“浏览源代码”链接，指向相应的 docs.rs 页面。感谢[Carol Nichols](https://github.com/carols10cents)实现此功能。

- **Fastly CDN**：index.crates.io 的稀疏索引现在主要通过 Fastly 提供，以节省我们的 AWS 积分用于其他用例。在过去一个月中，static.crates.io 提供了大约 1.6 PB 的 11 亿请求，而 index.crates.io 提供了大约 740 TB 的 19 亿请求。非常感谢 Fastly 通过他们的[Fast Forward 程序](https://www.fastly.com/fast-forward)提供免费 CDN 服务！

- **OpenGraph 图像改进**：我们修复了 OpenGraph 图像中的表情符号和 CJK 字符渲染问题，这是由于服务器上缺少字体造成的。

- **后台工作者性能**：优化了数据库索引以提高后台作业处理性能。

- **CloudFront 失效改进**：现在失效请求被批量处理，以避免在发布大型工作区时达到 AWS 速率限制。

## 反馈

我们希望您喜欢这份关于 crates.io 开发的更新。如果您有任何反馈或问题，请在[Zulip](https://rust-lang.zulipchat.com/#narrow/stream/318791-t-crates-io)或[GitHub](https://github.com/rust-lang/crates.io/discussions)上告知我们。我们总是乐于听到您的声音，并期待您的反馈！
