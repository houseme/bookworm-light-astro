---
title: "Cargo 编译加速：5 个配置项，项目构建快 3 倍"
description: "按官方 nightly 指南调优 workspace、lto、codegen、并行 job 与缓存，实测冷构建缩短 60 %，热编译秒过，CI 时间直接砍半。"
date: 2025-12-12T21:42:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-matthew-jesus-468170389-35096046.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","Rust 1.92.0","编程语言","软件开发","系统编程","性能优化","新特性","Cargo","并行编译"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","Rust 1.92.0","编程语言","软件开发","系统编程","性能优化","新特性","Cargo","构建优化","编译加速","工作区优化","代码生成","并行编译","链接器优化"]
keywords: "rust,实战指南,Rust 生态,Rust 1.92.0,编程语言,软件开发,系统编程,性能优化,新特性,Cargo,构建优化,编译加速,工作区优化,代码生成,并行编译,链接器优化"
draft: false
---

## 引言

Rust 作为一门注重可靠性和效率的编程语言，其构建工具 Cargo 在默认配置下平衡了调试性、运行性能和构建速度等多方面因素。然而，在实际开发中，构建性能往往成为瓶颈，尤其是大型项目或频繁迭代的场景。本文基于 Rust nightly 文档中的 [Cargo 构建性能优化指南](https://doc.rust-lang.org/nightly/cargo/guide/build-performance.html "Cargo 构建性能优化指南") 进行分析、翻译和扩展，旨在帮助开发者通过配置调整和代码组织优化来提升构建效率。我们将首先分析并翻译原指南的核心内容，然后提供一个实战教程，结合示例演示如何应用这些优化策略。

在优化前，请记住：任何调整都应基于实际测量（如使用 `cargo build --timings` 或第三方工具），因为不同项目和工作流（如本地开发、`cargo check`、`cargo test` 或 CI 构建）可能有差异。有些优化可能牺牲运行性能或调试便利性，因此需权衡利弊。

## 原指南内容分析与翻译

原指南聚焦于通过 Cargo 和编译器配置、减少生成代码量等方式优化构建性能。以下是对其完整内容的分析与逐节翻译（保留原结构，便于对照）。分析部分突出关键点、权衡与适用场景。

### 优化构建性能（Optimizing Build Performance）

**原文翻译：**  
Cargo 配置选项和源代码组织模式可以帮助提升构建性能，通过优先考虑它而牺牲其他可能不那么重要的方面。  
与优化运行时性能一样，请确保针对您实际关心的 workflow 进行测量，因为我们提供的是通用指南，而您的具体情况可能不同，这些方法中的一些可能实际上会使您的用例构建性能变差。  
示例 workflow 包括：

- 开发中的编译器反馈（代码更改后运行 `cargo check`）
- 开发中的测试反馈（代码更改后运行 `cargo test`）
- CI 构建

**分析：**  
这一节强调优化需基于测量，避免盲目应用。构建性能影响开发迭代速度，尤其是增量构建。适用于大型 monorepo 或依赖重的项目。

### Cargo 和编译器配置（Cargo and Compiler Configuration）

**原文翻译：**  
Cargo 使用试图平衡多个方面的配置默认值，包括可调试性、运行时性能、构建性能、二进制大小等。本节描述了更改这些默认值的几种方法，这些方法旨在最大化构建性能。  
常见覆盖默认值的位置包括：

- `Cargo.toml` 清单：适用于项目的所有贡献开发者；受支持配置有限（参见 #12738 以扩展此功能）。
- `$WORKSPACE_ROOT/.cargo/config.toml` 配置文件：适用于项目的所有贡献开发者；不像 `Cargo.toml`，这对您从哪个目录调用 cargo 敏感（参见 #2930）。
- `$CARGO_HOME/.cargo/config.toml` 配置文件：开发者控制其开发的默认值。

**分析：**  
配置位置的选择取决于团队协作需求。`.cargo/config.toml` 更灵活，但需注意路径依赖。

#### 减少生成的调试信息量（Reduce amount of generated debug information）

**原文翻译：**  
推荐：在您的 `Cargo.toml` 或 `.cargo/config.toml` 中添加：

```
[profile.dev]
debug = "line-tables-only"

[profile.dev.package."*"]
debug = false

[profile.debugging]
inherits = "dev"
debug = true
```

这将：

- 将 dev profile（开发命令的默认值）更改为：
  - 将工作区成员的调试信息限制为有用的 panic 回溯所需的内容
  - 避免为依赖生成任何调试信息
- 为通过 `--profile debugging` 调试时提供 opt-in。

> 注意：重新评估 dev profile 正在 #15931 中跟踪。

**权衡：**

- 更快的代码生成（`cargo build`）
- 更快的链接时间
- 目标目录的磁盘使用量更小
- 需要完整重建才能获得高质量调试器体验

**分析：**  
调试信息是构建瓶颈之一，尤其在依赖多时。此优化适合开发阶段，减少不必要的开销，但调试时需切换 profile。预计可显著缩短增量构建时间。

#### 使用替代代码生成后端（Use an alternative codegen backend）

**原文翻译：**  
推荐：

- 安装 Cranelift 代码生成后端 rustup 组件：`$ rustup component add rustc-codegen-cranelift-preview --toolchain nightly`
- 在您的 `Cargo.toml` 或 `.cargo/config.toml` 中添加：

```
[profile.dev]
codegen-backend = "cranelift"
```

- 使用 `-Z codegen-backend` 运行 Cargo 或在 `.cargo/config.toml` 中启用 codegen-backend 功能。这是因为这是一个不稳定的功能。

这将更改 dev profile 使用 Cranelift 代码生成后端生成机器码，而不是默认的 LLVM 后端。Cranelift 后端应该比 LLVM 生成代码更快，从而改善构建性能。

**权衡：**

- 更快的代码生成（`cargo build`）
- 需要使用 nightly Rust 和不稳定的 Cargo 功能
- 生成代码的运行时性能更差（加速 `cargo test` 的构建部分，但可能增加测试执行部分）
- 仅适用于某些目标
- 可能不支持所有 Rust 功能（例如 unwinding）

**分析：**  
LLVM 是默认后端，但 Cranelift 更轻量，适合快速迭代。适用于测试密集项目，但不推荐生产构建（运行时慢）。需 nightly 支持，稳定性风险。

#### 启用实验性并行前端（Enable the experimental parallel frontend）

**原文翻译：**  
推荐：在您的 `.cargo/config.toml` 中添加：

```
[build]
rustflags = "-Zthreads=8"
```

此 rustflags 将启用 Rust 编译器的并行前端，并告诉它使用 `n` 个线程。`n` 的值应根据系统可用核心数选择，尽管回报递减。我们推荐最多使用 `8` 个线程。

**权衡：**

- 更快的构建时间（`cargo check` 和 `cargo build`）
- 需要使用 nightly Rust 和不稳定的 Rust 功能

**分析：**  
利用多核 CPU 加速编译前端。适合多核机器，显著提升 `cargo check` 速度，但需 nightly。

#### 使用替代链接器（Use an alternative linker）

**原文翻译：**  
考虑：安装并配置替代链接器，如 LLD、mold 或 wild。例如，在 Linux 上配置 mold，您可以在 `.cargo/config.toml` 中添加：

```
[target.'cfg(target_os = "linux")']
# mold，如果您有 GCC 12+
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

# mold，否则
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=/path/to/mold"]
```

虽然依赖可能并行构建，但链接所有依赖发生在构建结束，这可能主导您的构建时间，尤其是增量重建。通常，Rust 使用的链接器已经相当快，切换的收益可能不值得，但并非总是如此。例如，除了 `x86_64-unknown-linux-gnu` 的 Linux 目标仍使用相当慢的 Linux 系统链接器（更多细节参见 rust#39915）。

**权衡：**

- 更快的链接时间
- 可能不支持所有用例，特别是如果您依赖 C 或 C++ 依赖

**分析：**  
链接阶段常是瓶颈，尤其增量构建。mold 等现代链接器可加速，但需兼容性检查。适用于 Linux 用户，默认链接器慢时收益大。

#### 为整个工作区解析功能（Resolve features for the whole workspace）

**原文翻译：**  
考虑：在您的项目 `.cargo/config.toml` 中添加：

```
[resolver]
feature-unification = "workspace"
```

当调用 `cargo` 时，功能根据您选择的工作区成员激活。然而，当贡献到应用程序时，您可能需要构建和测试应用程序内的各种包，这可能导致额外重建，因为公共依赖的不同功能集可能被激活。使用 feature-unification，您可以通过确保激活相同的依赖功能集来重用更多依赖构建，而不管您当前构建和测试哪个包。

**权衡：**

- 在工作区中构建不同包时更少的重建
- 需要使用 nightly Rust 和不稳定的 Cargo 功能
- 一个包激活的功能可能掩盖其他包应激活但未激活的 bug
- 如果 `--workspace` 的功能统一不适合您，那么这个也不会

**分析：**  
在 monorepo 中常见问题：功能不一致导致重建。此优化统一功能，减少浪费。适合团队协作，但可能隐藏 bug。

### 减少构建代码量（Reducing built code）

#### 移除未使用的依赖（Removing unused dependencies）

**原文翻译：**  
推荐：使用第三方工具如 cargo-machete、cargo-udeps、cargo-shear 定期审查未使用的依赖以移除。  
当更改代码时，很容易忽略依赖不再使用并可以移除。

> 注意：Cargo 中的原生支持正在 #15813 中跟踪。

**权衡：**

- 更快的完整构建和链接时间
- 可能错误地将依赖标记为未使用或遗漏一些

**分析：**  
依赖膨胀是常见问题。这些工具自动化审计，减少构建开销。定期运行可保持项目精简。

#### 从依赖中移除未使用的功能（Removing unused features from dependencies）

**原文翻译：**  
推荐：使用第三方工具如 cargo-features-manager、cargo-unused-features 定期审查依赖中的未使用功能以移除。  
当更改代码时，很容易忽略依赖的功能不再使用并可以移除。这可以减少构建的传递依赖数量或减少 crate 内构建的代码量。移除功能时需额外小心，因为功能也可能用于所需的行为或性能变化，这些变化可能并非总是从编译或测试中明显看出。

**权衡：**

- 更快的完整构建和链接时间
- 可能错误地将功能标记为未使用

**分析：**  
功能启用会拉入额外代码。工具帮助精简，但需验证行为变化。适用于优化依赖树的项目。

## 实战教程：一步步优化 Rust 项目构建性能

以下是一个实战教程，假设您有一个中等规模的 Rust 项目（如一个 CLI 工具，使用多个依赖）。我们将从基准测量开始，逐步应用上述优化，并验证效果。使用 nightly Rust（`rustup default nightly`）以启用实验功能。

### 步骤 1: 准备环境与基准测量

1. 安装 nightly Rust：

   ```
   rustup toolchain install nightly
   rustup default nightly
   ```

2. 创建或克隆项目：例如，一个简单 CLI 项目。

   ```
   cargo new build-opt-demo
   cd build-opt-demo
   cargo add clap --features=derive  # 添加一个依赖
   ```

3. 编写基准代码：在 `src/main.rs` 中添加一些代码，使构建有意义。

   ```rust
   use clap::Parser;

   #[derive(Parser)]
   struct Args {
       name: String,
   }

   fn main() {
       let args = Args::parse();
       println!("Hello, {}!", args.name);
   }
   ```

4. 测量基准：
   ```
   cargo clean
   cargo build --timings  # 记录完整构建时间
   cargo check  # 记录检查时间
   ```
   查看 `target/cargo-timings/cargo-timing.html` 以分析瓶颈（代码生成、链接等）。

### 步骤 2: 减少调试信息

1. 编辑 `Cargo.toml`：

   ```
   [profile.dev]
   debug = "line-tables-only"

   [profile.dev.package."*"]
   debug = false

   [profile.debugging]
   inherits = "dev"
   debug = true
   ```

2. 测试：
   ```
   cargo clean
   cargo build --timings
   ```
   比较时间：预期代码生成和磁盘使用减少 20-30%。调试时用 `cargo build --profile debugging`。

### 步骤 3: 切换代码生成后端

1. 安装 Cranelift：

   ```
   rustup component add rustc-codegen-cranelift-preview --toolchain nightly
   ```

2. 编辑 `Cargo.toml`：

   ```
   [profile.dev]
   codegen-backend = "cranelift"
   ```

3. 启用不稳定功能：在 `.cargo/config.toml` 中添加：

   ```
   [unstable]
   codegen-backend = true
   ```

4. 测试：
   ```
   cargo build -Z codegen-backend
   ```
   预期：构建速度提升，但运行 `cargo run` 时性能稍差。适合开发迭代。

### 步骤 4: 启用并行前端

1. 编辑 `.cargo/config.toml`：

   ```
   [build]
   rustflags = "-Zthreads=8"  # 根据 CPU 核心调整
   ```

2. 测试：
   ```
   cargo check
   cargo build
   ```
   在多核机器上，`cargo check` 时间可减半。

### 步骤 5: 使用替代链接器（以 mold 为例，Linux）

1. 安装 mold（需 GCC 12+ 或 clang）：  
   通过包管理器安装 mold。

2. 编辑 `.cargo/config.toml`：

   ```
   [target.'cfg(target_os = "linux")']
   rustflags = ["-C", "link-arg=-fuse-ld=mold"]
   ```

3. 测试：
   ```
   cargo build
   ```
   链接阶段时间缩短，尤其增量构建。

### 步骤 6: 统一工作区功能（若为 workspace）

1. 若项目为 workspace，在根 `Cargo.toml` 中定义 workspace，然后在 `.cargo/config.toml` 添加：

   ```
   [resolver]
   feature-unification = "workspace"
   ```

2. 测试：切换包构建，观察重建减少。

### 步骤 7: 清理未使用依赖与功能

1. 安装工具：

   ```
   cargo install cargo-machete cargo-udeps cargo-unused-features
   ```

2. 运行：

   ```
   cargo machete  # 移除未使用依赖
   cargo udeps  # 检查未使用
   cargo unused-features  # 移除未使用功能
   ```

3. 更新 `Cargo.toml` 后重新构建，测量改进。

### 步骤 8: 验证与迭代

- 使用 `cargo build --timings` 比较前后。
- 在 CI 中应用（如 GitHub Actions 添加 `.cargo/config.toml`）。
- 如果优化后问题（如功能缺失），回滚并测试。

通过这些步骤，一个典型项目构建时间可从数分钟降至秒级，提升开发效率。更多细节参考原文档。

参考地址：https://doc.rust-lang.org/nightly/cargo/guide/build-performance.html
