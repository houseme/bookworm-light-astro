---
title: "🦀 crates.io：恶意包通知策略的更新"
description: "crates.io 团队宣布，我们将调整关于检测到或收到报告的恶意包的公告方式。今后，我们将不再为每一个被发现的恶意包单独发布博客文章。"
date: 2026-02-13T08:32:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-freestocks-370017.jpg-slimming.webp"
categories: ["Rust", "实战指南","安全","安全响应"]
authors: ["houseme"]
tags: ["Rust", "实战指南","安全","安全响应","crates.io","恶意包","安全公告"]
keywords: "rust,实战指南,安全,安全响应,crates.io,恶意包,安全公告"
draft: false
---

**文章标题：crates.io：恶意包通知策略的更新**
**发布日期：2026 年 2 月 13 日**
**作者：Adam Harvey，代表 crates.io 团队**

crates.io 团队宣布，我们将调整关于检测到或收到报告的恶意包的公告方式。今后，我们将不再为每一个被发现的恶意包单独发布博客文章。

在迄今为止的绝大多数案例中，这些被通报的包并未发现有任何实际应用的证据。我们认为，为此类事件逐一发布博客文章，更多是在制造信息噪音，而非提供有价值的安全信号。

### 新的通知流程

为了更清晰、有效地传达安全信息，我们调整了通知策略：

*   **标准处理流程**：当某个包因包含恶意软件而被移除时，我们将**始终会为其发布一份 [RustSec][rustsec] 通报**。您可以通过订阅 [RustSec 通报的 RSS 源][rss]来接收所有最新的安全公告。
*   **特殊情况处理**：只有当被移除的恶意包**确实存在实际使用或已被利用**的证据时，我们才会**同时发布博客文章和 RustSec 通报**进行广泛提醒。此外，如果我们认为情况特殊且有必要，也可能会通过其他沟通渠道（如社交媒体）进行通知。

### 近期移除的恶意包

在宣布此政策调整的同时，我们也借此机会，对[自上次博客文章][last-post]以来被移除的恶意包进行一次回顾性总结：

*   **`finch_cli_rust`、`finch-rst` 和 `sha-rst`**：2025 年 12 月 9 日，瑞典国家基因组基础设施的 Matthias Zepper 向 Rust 安全响应工作组报告了这些包。这些包通过冒充合法的 `finch` 和 `finch_cli` 包来试图窃取凭证。
  *   相关通报：[RUSTSEC-2025-0150][advisory-finch-rst]、[RUSTSEC-2025-0151][advisory-sha-rst]、[RUSTSEC-2025-0152][advisory-finch-cli-rust]。
*   **`polymarket-clients-sdk`**：2026 年 2 月 6 日，我们收到 [Socket][socket] 的报告，指出该包试图通过冒充 `polymarket-client-sdk` 包来窃取凭证。
  *   相关通报：[RUSTSEC-2026-0010][advisory-polymarket]。
*   **`polymarket-client-sdks`**：2026 年 2 月 13 日，我们接到报告，该包同样试图通过冒充 `polymarket-client-sdk` 包来窃取凭证。
  *   相关通报：[RUSTSEC-2026-0011][advisory-polymarket-deux]。

在上述所有案例中，相关包均已被删除，发布这些包的用户账户已被立即禁用，并且我们已酌情向上游提供商提交了报告。

### 致谢

我们再次感谢 Matthias、Socket 以及 `polymarket-client-sdks` 的报告者。同时，我们也要感谢来自安全代码工作组的 Dirkjan Ochtman、来自安全响应工作组的 Emily Albini，以及来自 [Rust 基金会][foundation]的 Walter Pearce，感谢他们在响应过程中提供的帮助。

[advisory-finch-cli-rust]: https://rustsec.org/advisories/RUSTSEC-2025-0152.html
[advisory-finch-rst]: https://rustsec.org/advisories/RUSTSEC-2025-0150.html
[advisory-sha-rst]: https://rustsec.org/advisories/RUSTSEC-2025-0151.html
[advisory-polymarket]: https://rustsec.org/advisories/RUSTSEC-2026-0010.html
[advisory-polymarket-deux]: https://rustsec.org/advisories/RUSTSEC-2026-0011.html
[foundation]: https://foundation.rust-lang.org/
[last-post]: https://blog.rust-lang.org/2025/12/05/crates.io-malicious-crates-finch-rust-and-sha-rust/
[ngi-sweden]: https://ngisweden.scilifelab.se/
[rss]: https://rustsec.org/feed.xml
[rustsec]: https://rustsec.org/
[socket]: https://socket.dev/
