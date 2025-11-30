---
title: "Dioxus 0.7 发布：Rust GUI 开发迎来颠覆性突破！"
description: "大家好！今天我们要为大家介绍一个令人兴奋的消息—— Dioxus 0.7 正式发布了！作为一款使用 Rust 构建跨平台应用的框架，Dioxus 让开发者能够用单一代码库轻松交付全栈 Web、桌面和移动应用。经过两年时间的精心打磨，这个版本带来了诸多突破性功能，将 Rust GUI 开发体验提升到了全新高度！"
date: 2025-10-31T09:32:10Z
image: "https://static-rs.bifuba.com/images/posts/dioxus.png-slimming.webp"
categories: ["Rust","性能优化","前端开发","跨平台开发","全栈开发","移动端开发","桌面应用开发","UI 框架","Dioxus","WGPU","Axum","热重载","原生渲染"]
authors: ["houseme"]
tags: ["Rust","性能优化","前端开发","跨平台开发","全栈开发","移动端开发","桌面应用开发","UI 框架","Dioxus","WGPU","Axum","热重载","原生渲染","Rust UI 开发","跨平台应用","全栈 Rust","Rust 移动开发","Rust 桌面开发","Rust 前端框架","高性能 UI","GPU 渲染","热重载引擎","原生 UI 组件库","状态管理","Tailwind CSS 集成","AI 编程助手"]
keywords: "Rust, 性能优化, 前端开发, 跨平台开发, 全栈开发, 移动端开发, 桌面应用开发, UI 框架, Dioxus, WGPU, Axum, 热重载, 原生渲染, Rust UI 开发, 跨平台应用, 全栈 Rust, Rust 移动开发, Rust 桌面开发, Rust 前端框架, 高性能 UI, GPU 渲染, 热重载引擎, 原生 UI 组件库, 状态管理, Tailwind CSS 集成, AI 编程助手"
draft: false
---


> 热修补、原生渲染、AI 编码，一次满足你的所有想象

大家好！今天我们要为大家介绍一个令人兴奋的消息——**Dioxus 0.7 正式发布了！**

作为一款使用 Rust 构建跨平台应用的框架，Dioxus 让开发者能够用单一代码库轻松交付全栈 Web、桌面和移动应用。

经过两年时间的精心打磨，这个版本带来了诸多突破性功能，将 Rust GUI 开发体验提升到了全新高度！

## 🚀 核心亮点抢先看

### 1. Subsecond：Rust 代码热修补技术

这绝对是本版本最亮眼的功能！现在你可以**在运行时直接编辑 Rust 代码**，并立即看到变化，而且不会丢失应用状态。

想象一下，修改组件逻辑、调整事件处理、甚至重构后端服务器函数，都**无需重启应用**！这项技术基于全新的 Subsecond 引擎，支持 Web、桌面和移动全平台。

```rust
pub fn launch() {
    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        subsecond::call(|| tick()); // 编辑这里，立即生效！
    }
}
```

### 2. Dioxus Native + Blitz 渲染引擎

告别传统 WebView！Dioxus Native 是我们全新的 GPU 加速渲染器，基于 WGPU 技术构建。它融合了多个顶尖项目：

- **Taffy**：高性能 flexbox 布局引擎
- **Stylo**：Firefox 和 Servo 的 CSS 解析引擎
- **Vello**：Google 的 GPU 计算渲染器

效果如何？看看这些在原生渲染器上运行的网站：

![Blitz 渲染效果对比](https://static-rs.bifuba.com/images/posts/blitz-vs-safari.png-slimming.webp)

几乎与 Chrome、Safari 等现代浏览器没有区别！

### 3. 首方组件库 Dioxus Primitives

受 Radix-UI 启发，我们提供了 28 个开箱即用的基础组件。每个组件都具备：

- 键盘快捷键支持
- ARIA 无障碍访问
- 跨平台一致性设计
- 无样式设计，轻松定制

[![视频封面](https://static-rs.bifuba.com/images/posts/ScreenShot_2025-11-03_103705_892.png-slimming.webp)](https://static-rs.bifuba.com/images/posts/screen-recording-2.mov)

### 4. Stores：嵌套响应式状态管理

在 Signals 基础上，我们引入了 Stores 来处理复杂嵌套状态：

```rust
#[derive(Store)]
struct Dir {
    children: BTreeMap<String, Dir>,
}

// 精准响应特定字段变化
let mut children: Store<Vec<Dir>, _> = directory.children();
```

## 🛠 开发者体验全面提升

### 零配置 Tailwind 支持

项目根目录有`tailwind.css`？`dx`工具会自动检测并启动 Tailwind 监视器，无需手动配置！

### AI 编程助手升级

内置`llms.txt`上下文文件，让 Copilot、Cursor 等 AI 工具更懂 Dioxus，减少"幻觉"代码。

### 一体化调试体验

按`d`键即可附加调试器，支持 Web、桌面、移动全平台，连 Android 设备调试都变得简单！

### 更智能的 CLI 工具

```bash
# 一行安装
curl -fsSL https://dioxus.dev/install.sh | bash

# 自动更新
dx self-update
```

现在`dx`不仅支持 Dioxus 项目，还能用于**任何 Rust 项目**，享受热重载、打包、调试等强大功能。

## 🎯 移动端开发强化

- **真机热重载**：通过 adb reverse 在 Android 设备上实时调试
- **iPad 正式支持**：完美适配 iPadOS 环境
- **项目配置自定义**：深度定制 AndroidManifest.xml 和 Info.plist

## 💡 还有更多惊喜...

- **全栈 WebSockets**：一行代码实现双向实时通信
- **WASM 代码分割**：大幅降低初始加载体积
- **改进的错误处理**：强类型错误跨客户端共享
- **服务质量升级**：自动打开模拟器、彩色日志、Toast 通知等

## 📚 学习资源更新

我们重新组织了官方文档，更深入讲解响应式原理、渲染模型等核心概念。新的文档站点设计更美观，内容更丰富：

![新文档站点](https://static-rs.bifuba.com/images/posts/screenshot-3.avif)

## 🏢 团队成长

Dioxus 团队已迁入旧金山新办公室，正在加速发展！如果你对 Rust 应用开发充满热情，欢迎加入我们。

## 🎉 立即尝试

```bash
curl -fsSL https://dioxus.dev/install.sh | bash
dx new my-app
cd my-app
dx serve
```

体验下一代 Rust GUI 开发的魅力！

---

**相关链接：**
- [完整发布说明](https://github.com/DioxusLabs/dioxus/releases/tag/v0.7.0)
- [官方文档](https://dioxuslabs.com)
- [GitHub 仓库](https://github.com/DioxusLabs/dioxus)

**#Rust #GUI #跨平台开发 #开源项目 #编程工具**
