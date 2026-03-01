---
title: "🦀 Cargo 1.93 中文速递：诊断更酷、构建更快、插件更香"
description: "Rust 工具链 1.93 发布：Unicode 诊断颜值飙升，结构化日志秒查慢编译，cargo-override 插件一键打补丁，构建缓存与配置包含全面提速，让 Rust 开发体验再上一个台阶。"
date: 2026-01-07T11:22:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-42north-1275680.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态", "工具链", "Cargo", "发布速递"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态", "工具链", "Cargo", "发布速递", "cargo-override", "构建优化", "诊断改进", "日志分析", "shell 补全"]
keywords: "rust,实战指南,Rust 生态,工具链,Cargo,发布速递,cargo-override,构建优化,诊断改进,日志分析,shell 补全"
draft: false
---


# Cargo 1.93 中文速递：诊断更酷、构建更快、插件更香

——Rust 官方博客中文速递

> 原文：[Inside Rust Blog – This Development-cycle in Cargo: 1.93](https://blog.rust-lang.org/inside-rust/2026/01/07/this-development-cycle-in-cargo-1.93/)
> 日期：2026-01-09

----

2026 年 1 月 7 日，Rust 团队发布《This Development-cycle in Cargo: 1.93》，用 6 周时间（2025-10-31 至 2025-12-11）把 Cargo 的体验又往前推了一大步。下面用中文带你 5 分钟看完重点。

---

## 1. 颜值升级：Unicode 诊断正式落地
- 采用 `annotate-snippets` 渲染器，提示线从 `^` 升级为 `━`，对齐更准。  
- 开启方式（nightly 即可）：
  ```toml
  [unstable]
  rustc-unicode = true
  ```
- 稳定化跟踪：[rust#148607](https://github.com/rust-lang/rust/issues/148607)

---

## 2. Lint 体系再进化
新增 `implicit_minimum_version_req`  
当 `workspace.dependencies` 里出现 `clap = "4"` 这种“缺补丁号”的写法时，Cargo 会友情提示：
```
[WARNING] dependency version requirement lacks full precision
```
帮你提前踩雷，避免依赖解析意外升级。

---

## 3. 一键把警告变错误
- 不稳定配置 `build.warnings` 进入实战。
- CI 友好：所有警告直接退码，无需再写 `RUSTFLAGS="-D warnings"`。
- 可配合 `--keep-going` 一次性看完全部报错。

---

## 4. Shell 补全自动生成
- 跟踪 3 年的 [issue #14520](https://github.com/rust-lang/cargo/issues/14520) 落地。
- 支持 bash / zsh / fish，一条命令即可 Tab 补全子命令、特征标志、目标三元组。

---

## 5. 构建目录大重构
| 阶段 | 改动 |
|---|---|
| ① 目录改名 | `debug` → `dbg`、`release` → `rel`（可配置） |
| ② 产物分离 | 中间件与最终产物分目录，减少锁争抢 |
| ③ 公开测试 | 已跑通 crater，1.94 进入 beta |

---

## 6. 自定义最终产物
- build.rs 即将支持：
  ```
  cargo::artifact=src/artifact.bin:bin/artifact.bin
  ```
- 自动检测重名、冲突、并发安全，先当 RFC 3035 的 polyfill。

---

## 7. target 目录细粒度锁
痛点：`rust-analyzer cargo check` 与命令行互堵。  
方案：
- 拆成“产物锁 + 编译单元锁”
- 只检查不生成产物时**完全不用抢锁**
- 实测并行提升 30%+  
  PR：[#16155](https://github.com/rust-lang/cargo/pull/16155)

---

## 8. 结构化日志 & `cargo report timings`
- 写入 JSON 日志到 `target/.cargo/timings/`
- 新增子命令：
  ```bash
  cargo report timings
  ```
- 一眼看出“哪一步慢、为何 rebuild”
- 尝鲜配置：
  ```toml
  [build.analysis]
  enabled = true
  ```

---

## 9. `config-include` 稳定
- 2019 年提出，2025 年终转正。
- 项目级 `.cargo/config.toml` 可：
  ```toml
  include = [
    { path = "config.user.toml", optional = true }
  ]
  ```
- 解决“项目配置 vs 用户配置”长期打架的痛点。

---

## 10. `pubtime`：依赖也带“出生证明”
- 在索引摘要里增加“发布时间”字段。
- 已支持“时间穿越”式锁版本：
  ```bash
  cargo generate-lockfile --publish-time 2025-12-01T01:01:01Z
  ```
- 为后续 `minimumReleaseAge` 策略铺路。

---

## 11. 本期明星插件：`cargo-override`
- 作者：[eopb](https://github.com/eopb)
- 专治 `patch` 表膨胀：
  ```bash
  cargo override uuid ../my-uuid
  ```
- 一条命令完成切换、回滚、共享。

---

## 12. 杂项但好用
| 功能 | 说明 |
|---|---|
| `cargo clean --workspace` | 一次清掉所有成员产物 |
| `cargo clean -p` | 提速 2× |
| 浅克隆 | `net.git-fetch-with-cli` 支持，CI 省带宽 |
| 拼写检查 | 全仓库 typo PR 被一网打尽 |
| TUI 原型 | `cargo-tree-tui` 方向键浏览依赖树 |

---

## 13. 等你来领走的“easy pick”
- [开放命名空间](https://doc.rust-lang.org/nightly/cargo/reference/unstable.html#open-namespaces)
- [公共/私有依赖稳定化](https://rust-lang.github.io/rust-project-goals/2025h2/pub-priv.html)
- [功能元数据 RFC 3416](https://github.com/rust-lang/rfcs/pull/3416)
- [SBOM 片段 RFC 3553](https://github.com/rust-lang/rfcs/pull/3553)
- [XDG 路径支持](https://github.com/rust-lang/cargo/issues/1734)

官方贡献指南已更新，带 `S-accepted` 标签的 issue 自带导师，每周三 Contributor Office Hours 在线答疑。

---

## 结语
Cargo 1.93 没有惊天动地的大版本号，却把所有“小痛点”挨个磨平：  
诊断更好看、构建更省时间、配置更灵活、插件更丰富。

现在就能升级：
```bash
rustup update stable
```
然后跑一遍 `cargo report timings`，看看你的项目是不是又快了 10%。  
Happy Hacking!
