---
title: "🦀 Cargo 1.94 深度解析：构建提速、锁机制革新与未来规划"
description: "Rust 1.94 版本即将到来，Cargo 团队在过去六周完成了多项关键改进：构建目录布局优化减少重复编译、目标目录锁机制防止并发冲突、结构化日志工具助力性能分析、TOML 1.1 全面支持。本文深入解读这些技术革新背后的设计决策与社区协作成果。"
date: 2026-02-18T05:32:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-vubui-30012276.jpg-slimming.webp"
categories: ["Rust", "工具链", "Cargo", "性能优化", "构建系统"]
authors: ["houseme"]
tags: ["Rust","工具链","Cargo","性能优化","构建系统","锁机制","结构化日志","TOML 1.1","开发者体验","构建目录布局","目标目录锁定","cargo-cargofmt","lockfile-path配置","工作区和配置发现机制"]
keywords: "rust,工具链,Cargo,性能优化,构建系统,锁机制,结构化日志,TOML 1.1,开发者体验"
draft: false
---


## 引言

在 Rust 生态系统中，Cargo 作为构建系统和包管理器，其每一次迭代都牵动着万千开发者的日常工作。Rust 1.94 版本的开发周期中，Cargo 团队聚焦于提升构建效率、增强并发安全性和改善开发者体验。从重构构建目录布局到引入细粒度的目标目录锁机制，从结构化日志工具到 TOML 1.1 规范支持，这一系列更新不仅解决了长期存在的痛点，也为未来功能铺平道路。本文将带你深入了解这些变化的技术细节、设计权衡以及社区的协作方式。

---

# Cargo 开发周期回顾：1.94 版本

本文总结了过去 6 周 Cargo 团队的开发进展，这段时间主要对应 Rust 1.94 版本的合并窗口。

<!-- 时间范围：2025-12-12 至 2026-01-21 -->

- [本期插件推荐](#本期插件推荐)
- [功能实现](#功能实现)
  - [构建目录布局](#构建目录布局)
  - [目标目录锁定](#目标目录锁定)
  - [结构化日志](#结构化日志)
  - [TOML 1.1 支持](#toml-1-1支持)
  - [cargo-cargofmt](#cargo-cargofmt)
  - [lockfile-path 配置](#lockfile-path配置)
- [设计讨论](#设计讨论)
  - [工作区和配置发现机制](#工作区和配置发现机制)
- [其他更新](#其他更新)
- [未进展的重点领域](#未进展的重点领域)

## 本期插件推荐

Cargo 无法满足所有人的所有需求——这既源于其必须维护的兼容性保证，也体现了生态系统的多样性。插件在 Cargo 生态中扮演着重要角色，我们希望通过这个栏目展示社区的优秀作品。

本期推荐插件是 **[cargo-edit](https://crates.io/crates/cargo-edit)**，它提供了编辑`Cargo.toml`文件的命令集。其中`cargo add`和`cargo rm`已合并到 Cargo 主程序中。该插件还提供了`cargo upgrade`（用于更新版本要求，Cargo 主程序跟踪于[#12425](https://github.com/rust-lang/cargo/issues/12425)）和`cargo set-version`（用于修改`package.version`，暂无合并计划）。

感谢 [kpreid](https://github.com/kpreid) 的推荐！

[欢迎为下期文章提交插件建议](https://rust-lang.zulipchat.com/#narrow/stream/246057-t-cargo/topic/Plugin.20of.20the.20Dev.20Cycle/near/420703211)

## 功能实现

### 构建目录布局

*[1.93 版本](https://blog.rust-lang.org/inside-rust/2026/01/07/this-development-cycle-in-cargo-1.93/#build-dir-layout)更新*

[ranger-ross](https://github.com/ranger-ross) 提交了[#16502](https://github.com/rust-lang/cargo/pull/16502)，更新了 Cargo 关于构建目录布局的内部文档。这份文档为审查这一变更提供了新的视角，促使了进一步的优化，如[#16514](https://github.com/rust-lang/cargo/pull/16514)、[#16515](https://github.com/rust-lang/cargo/pull/16515)和[#16519](https://github.com/rust-lang/cargo/pull/16519)。

在一个不相关的变更中，[epage](https://github.com/epage) 曾提议使`CARGO_BIN_EXE_*`变量在运行时（而不仅是编译时）可用（[Zulip 讨论](https://rust-lang.zulipchat.com/#narrow/channel/246057-t-cargo/topic/cargo_bin_exe.20and.20tests/near/564776712)），但在发现实际不需要后放弃了这一想法。在分析[首次 crater 运行结果](https://github.com/rust-lang/rust/pull/149852#issuecomment-3664993475)后，他们决定推进这一改变以减轻对生态系统的影响并可能带来其他好处，提交了[#16421](https://github.com/rust-lang/cargo/pull/16421)。

[epage](https://github.com/epage) 还尝试在新的构建目录布局下运行 Cargo 的全部测试套件（[#16375](https://github.com/rust-lang/cargo/pull/16375)），这导致了[#16348](https://github.com/rust-lang/cargo/pull/16348)的提出。

新一轮[crater 运行](https://github.com/rust-lang/rust/pull/149852#issuecomment-3764244130)已启动，结果分析正在进行中。

### 目标目录锁定

*[1.93 版本](https://blog.rust-lang.org/inside-rust/2026/01/07/this-development-cycle-in-cargo-1.93/#target-dir-locking)更新*

自上次更新以来，除了已有挑战外，另一个问题是在读取指纹以决定是否修改缓存条目时需要持有锁。锁的升级和降级存在死锁风险。

上次更新结束时提出了顶层构建操作拥有所有锁并独占获取的想法。这有助于解决指纹问题——我们在读取指纹前获取锁，确保其有效性。但这意味着两个相同的构建会争用锁。至少 rust-analyzer 的`cargo check`和`cargo test`（包装了`cargo build`）或`cargo clippy`不会相互争用——但某些容易被忽视的重要情况下它们会争用。对于`cargo check`和`cargo clippy`，`cargo clippy`仅为工作区成员获取唯一缓存条目，因此非工作区成员会争用锁。对于`cargo check`和`cargo test`，缓存条目是唯一的（至少目前如此，参见[#3501](https://github.com/rust-lang/cargo/issues/3501)），但过程宏和构建脚本除外。我们决定暂时搁置这些问题，先合并一个最小化设计以便后续迭代。

我们还推迟处理了[动态 rlimit](https://github.com/rust-lang/cargo/pull/16155#discussion_r2632376448)、[用户阻塞消息](https://github.com/rust-lang/cargo/pull/16155#discussion_r2648691107)以及在构建线程被阻塞时复用其他构建单元而非闲置的问题。至此，我们成功合并了[#16155](https://github.com/rust-lang/cargo/pull/16155)。这些推迟事项的进展在[#4282](https://github.com/rust-lang/cargo/issues/4282)中跟踪。

### 结构化日志

*[1.93 版本](https://blog.rust-lang.org/inside-rust/2026/01/07/this-development-cycle-in-cargo-1.93/#structured-logging)更新*

[weihanglo](https://github.com/weihanglo) 持续推进此项工作，包括：
- 代码重构（[#16485](https://github.com/rust-lang/cargo/pull/16485)）
- 文档编写（[#16476](https://github.com/rust-lang/cargo/pull/16476)）
- 为`cargo report timings`添加缺失功能（[#16414](https://github.com/rust-lang/cargo/pull/16414)、[#16441](https://github.com/rust-lang/cargo/pull/16441)）
- 添加`cargo report rebuild`命令（[#16456](https://github.com/rust-lang/cargo/pull/16456)、[#16408](https://github.com/rust-lang/cargo/pull/16408)、[#16448](https://github.com/rust-lang/cargo/pull/16448)），用于查看重建原因
- 添加`cargo report sessions`命令（[#16428](https://github.com/rust-lang/cargo/pull/16428)），查找用于`cargo report timings`和`cargo report rebuild`的 ID
- 为`cargo report *`命令提供手册页（[#16432](https://github.com/rust-lang/cargo/pull/16432)、[#16430](https://github.com/rust-lang/cargo/pull/16430)）
- 移除不稳定的`--timings=FMT`标志，因其与`cargo report timings`功能重复（[#16420](https://github.com/rust-lang/cargo/pull/16420)）

在项目目标跟踪问题上，[weihanglo](https://github.com/weihanglo) [发布了进展总结](https://github.com/rust-lang/rust-project-goals/issues/398#issuecomment-3725163795)，列出了稳定化的剩余步骤以及社区的参与方式。

### TOML 1.1 支持

12 月 18 日，[TOML v1.1 规范](https://github.com/toml-lang/toml/releases/tag/1.1.0)正式发布。此版本的主要变化是允许在内联表格中使用换行符。同一天，[`toml` v0.9.10](https://docs.rs/toml/latest/toml/)发布，[支持解析 TOML 1.1 文件](https://github.com/toml-rs/toml/blob/main/crates/toml/CHANGELOG.md#0910---2025-12-18)。

在[Zulip](https://rust-lang.zulipchat.com/#narrow/channel/246057-t-cargo/topic/TOML.201.2E1/near/564132825)上，我们讨论了 Cargo 的过渡策略。用户可能无意中使用 TOML v1.1 特性，从而提升解析其清单所需的 Cargo 版本。这也是[我们鼓励在 CI 中验证`rust-version`](https://doc.rust-lang.org/cargo/reference/rust-version.html#support-expectations)的原因之一。不过影响有限，因为`cargo package`会重写发布的`Cargo.toml`，仅使用 TOML v0.5 或更早版本的功能。这一变化主要影响使用原始仓库的[git 补丁](https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section)的情况。

需要注意一个细节：`toml`目前不保留时间中[秒或纳秒](https://docs.rs/toml_datetime/0.7.5+spec-1.1.0/toml_datetime/struct.Time.html)是省略还是为`0`，默认假设秒不会被省略，纳秒为`0`时总是省略。如果`toml`开始保留这些信息，且`Cargo.toml`的某个字段使用了时间（可能仅在`[*.metadata]`字段中），且用户使用了新语法格式化时间，那么`cargo package`生成的`Cargo.toml`将需要新版本 Cargo 才能解析。

Cargo 可以检测是否使用了 TOML v1.1 特性，并在`package.rust-version`字段过低时发出警告，但我们认为这并非阻塞性问题——这与当前使用任何其他字段可能提升 MSRV 的情况类似。

Cargo 对 TOML v1.1 的支持已于 12 月 28 日合并（[#16415](https://github.com/rust-lang/cargo/pull/16415)）。

### `cargo-cargofmt`

长期以来，社区一直期望`cargo fmt`也能格式化`Cargo.toml`文件（[rustfmt#4091](https://github.com/rust-lang/rustfmt/issues/4091)）。这项工作的一大障碍是[`Cargo.toml`官方风格指南](https://doc.rust-lang.org/nightly/style-guide/cargo.html)与现有或预期的使用方式不一致。风格指南的提案曾在[Zulip](https://rust-lang.zulipchat.com/#narrow/channel/246057-t-cargo/topic/.60Cargo.2Etoml.60.20style.20guide/near/380796244)上讨论过，但最终停滞。

[epage](https://github.com/epage) 创建了[`cargo-cargofmt`](https://github.com/crate-ci/cargo-cargofmt)作为风格指南思想和实现方法的试验田。这包括[总结过往讨论](https://github.com/crate-ci/cargo-cargofmt/discussions/9)以及[比较现有格式化工具](https://github.com/crate-ci/cargo-cargofmt/discussions/3)。

[iepathos](https://github.com/iepathos) 加入并扩展了格式化规则，包括调整单行和多行数组之间转换的复杂工作（[cargo-cargofmt#37](https://github.com/crate-ci/cargo-cargofmt/pull/37)）。将内联表格格式化为多行的功能被推迟，因为这可能需要新的[Style Edition](https://doc.rust-lang.org/nightly/style-guide/editions.html)来确保包的 MSRV 足够高以支持该特性。

查看[cargo-cargofmt#25](https://github.com/crate-ci/cargo-cargofmt/discussions/25)了解当前支持的功能，以及[项目议题](https://github.com/crate-ci/cargo-cargofmt/issues)了解正在考虑的内容。

### lockfile-path 配置

*[1.82 版本](https://blog.rust-lang.org/inside-rust/2024/10/01/this-development-cycle-in-cargo-1.82/#misc)更新*

此前，`--lockfile-path ../Cargo.lock`的不稳定支持已添加（[#14326](https://github.com/rust-lang/cargo/pull/14326)）。在[#15510](https://github.com/rust-lang/cargo/issues/15510)中，我们收到了通过环境变量支持该功能的请求。讨论后我们认为应将该功能从 CLI 标志转向配置字段，这样既能支持环境变量，也能通过`--config`支持 CLI。我们特别关注的是用户通过`cargo <cmd> --help`查找所需功能的易用性。标志越多，用户越可能找不到所需标志，导致所有标志的价值降低——用户会转而通过其他方式解决他们认为不支持的功能。这在`--out-dir`/`--artifact-dir`的讨论中已经提及（[#6100](https://github.com/rust-lang/cargo/issues/6100)）。考虑到此功能的适用范围，将其"隐藏"在配置中似乎是最佳选择。

[weihanglo](https://github.com/weihanglo) 在[#16510](https://github.com/rust-lang/cargo/pull/16510)中添加了`resolver.lockfile-path`配置。我们将在后续开发周期中移除`--lockfile-path`，给调用者留出过渡时间。

## 设计讨论

### 工作区和配置发现机制

如果不小心将`Cargo.toml`文件复制到主目录，且没有显式声明`[workspace]`，它会导致所有包的构建失败。任何位于父目录中的损坏或仅限 nightly 的`Cargo.toml`或`.cargo/config.toml`文件都会出现这种情况（例如[#6646](https://github.com/rust-lang/cargo/issues/6646)、[#6706](https://github.com/rust-lang/cargo/issues/6706)）。对于`Cargo.toml`，Cargo 会检查当前清单是否属于某个工作区。

我们至少可以改进错误信息，这在[#6706](https://github.com/rust-lang/cargo/issues/6706)中跟踪。同时，劝阻新用户在主目录中意外创建包也会有所帮助（[#16562](https://github.com/rust-lang/cargo/issues/16562)）。

对于 nightly 清单的情况，Cargo 可以检查父级`Cargo.toml`是否有`[workspace]`表，并通过延迟 nightly 特性检查来跳过它。但 nightly 特性可能影响工作区发现。

对于清单，一种解决方法是向包中添加空的`[workspace]`。但如果在子目录中运行`cargo new`，它会自动被添加为成员。我们可以扩展[`package.workspace = "<path>"`](https://doc.rust-lang.org/cargo/reference/manifest.html#the-workspace-field)，增加`package.workspace = <bool>`来选择性启用或禁用工作区的自动发现。对于这种情况，可以设置`package.workspace = false`来避免向上遍历目录树。Cargo 脚本默认禁用工作区自动发现，这可能是启用它的方式。这个想法在[#16563](https://github.com/rust-lang/cargo/issues/16563)中跟踪。

我们希望在更广泛层面改进工作区和配置发现行为，这在[#7871](https://github.com/rust-lang/cargo/issues/7871)中跟踪。

## 其他更新

- [osiewicz](https://github.com/osiewicz) 在[#16264](https://github.com/rust-lang/cargo/pull/16264)中加速了`cargo clean -p`和`cargo clean --workspace`的执行。
- *[1.93 版本](https://blog.rust-lang.org/inside-rust/2026/01/07/this-development-cycle-in-cargo-1.93/#custom-final-artifacts)更新*：[ranger-ross](https://github.com/ranger-ross) 添加了对构建脚本使用`cargo::metadata`而不需要`package.links`清单键的不稳定支持（[#16436](https://github.com/rust-lang/cargo/pull/16436)）。

## 未进展的重点领域

以下是 Cargo 团队关注但本开发周期未有可报告进展的领域。

需要负责人的项目目标：
- [稳定化公有/私有依赖](https://rust-lang.github.io/rust-project-goals/2025h2/pub-priv.html)
- [原型设计一套新的 Cargo"底层"命令](https://rust-lang.github.io/rust-project-goals/2025h2/cargo-plumbing.html)
- [完成 libtest JSON 输出实验](https://rust-lang.github.io/rust-project-goals/2025h2/libtest-json.html)

准备开发：
- [开放命名空间](https://doc.rust-lang.org/nightly/cargo/reference/unstable.html#open-namespaces)
- [自动生成补全](https://github.com/rust-lang/cargo/issues/14520)（参见[clap-rs/clap#3166](https://github.com/clap-rs/clap/issues/3166)）

规划中：
- [默认特性的禁用](https://github.com/rust-lang/cargo/issues/3126)
- [RFC #3416：特性元数据](https://github.com/rust-lang/rfcs/pull/3416)
  - [RFC #3487：可见性](https://github.com/rust-lang/rfcs/pull/3487)
  - [RFC #3486：弃用机制](https://github.com/rust-lang/rfcs/pull/3486)
  - [不稳定特性列表](https://doc.rust-lang.org/cargo/reference/unstable.html#list-of-unstable-features)
- [预 RFC：全局互斥特性](https://internals.rust-lang.org/t/pre-rfc-mutually-excusive-global-features/19618)
- [RFC #3553：Cargo SBOM 片段](https://github.com/rust-lang/rfcs/pull/3553)
- [操作系统原生配置/缓存目录（即 XDG 支持）](https://github.com/rust-lang/cargo/issues/1734)

## 如何参与贡献

如果您有改进 Cargo 的想法，建议先查看[我们的待办列表](https://github.com/rust-lang/cargo/issues/)，然后在[Internals 论坛](https://internals.rust-lang.org/c/tools-and-infrastructure/cargo/15)上探讨。

如果您希望推动某个本文未提及的具体问题，可以采取以下步骤：
- 总结现有讨论（例如：
  [改进 Docker 层缓存支持](https://github.com/rust-lang/cargo/issues/2644#issuecomment-1489371226)、
  [Cargo.lock 策略变更](https://github.com/rust-lang/cargo/issues/8728#issuecomment-1610265047)、
  [MSRV 感知解析器](https://github.com/rust-lang/cargo/issues/9930#issuecomment-1489089277)）
- 记录其他生态系统的先例，以便我们借鉴已有工作并创建用户熟悉的方案
- 记录 Cargo 中相关问题和解决方案，确保我们在正确的抽象层面解决问题
- 基于以上信息，提出考虑周全且符合 Cargo 兼容性要求的解决方案（[示例](https://github.com/rust-lang/cargo/issues/9930#issuecomment-1489269471)）

我们可以在[Zulip](https://rust-lang.zulipchat.com/#narrow/stream/246057-t-cargo)上为[S-accepted 议题](https://doc.crates.io/contrib/issues.html#issue-status-labels)提供指导，也可以在[贡献者办公时间](https://github.com/rust-lang/cargo/wiki/Office-Hours)实时交流。如果您想参与本文提到的大型项目但刚入门，[解决一些简单问题](https://doc.crates.io/contrib/process/index.html#working-on-issues)将帮助您熟悉流程和期望，使后续工作更顺利。如果您想处理[没有导师的议题](https://doc.crates.io/contrib/issues.html#issue-status-labels)，则需要更多自主完成工作的能力。
