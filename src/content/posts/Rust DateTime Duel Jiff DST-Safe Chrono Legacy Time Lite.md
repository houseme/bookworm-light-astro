---
title: "🦀 Rust 日期时间三国杀：Jiff 安全秒 DST，Chrono 老而弥坚，Time 轻量疾跑"
description: "用 Jiff 纳秒精度、TZDB 自动、夏令时零翻车，Jiff 新手不踩坑；Chrono 生态满配但易误用；Time 极简极速却无 DST，一张表选对库。"
date: 2026-01-14T11:22:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-shottrotter-625023.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","jiff","日期时间","时区","持续期","性能","time","chrono"]
authors: ["houseme"]
tags: ["Rust", "实战指南","Rust 生态","jiff","日期时间","时区","持续期","性能","pit of success","Temporal","IANA TZDB","Serde","no-std","时间戳","Zoned","Span","Unit","Tz","格式化","解析","数据库集成","Web 框架","异步","加密签名"]
keywords: "rust,实战指南,Rust 生态,jiff,日期时间,时区,持续期,性能,pit of success,Temporal,IANA TZDB,Serde,no-std,时间戳,Zoned,Span,Unit,Tz,格式化,解析,数据库集成,Web 框架,异步,加密签名"
draft: false
---


# Rust 日期时间库实战指南：Jiff vs Chrono vs Time

## Jiff 是什么

Jiff 是一个 Rust 的高级日期时间库，旨在引导开发者“跳入成功的陷阱”（pit of success），通过设计使正确的使用方式成为最简单和最自然的路径。该库专注于提供难以误用的高级日期时间原语，同时确保合理的性能表现。

Jiff 的核心功能包括：

- **时间戳（Timestamp）**：表示 UTC 时刻，支持纳秒级精度。
- **时区感知日期时间（Zoned）**：锚定到 IANA 时区数据库（TZDB），处理本地民事时间和时区偏移/过渡规则。
- **时间跨度（Span）**：用于构建持续时间，支持单位如月、小时等。
- **单位（Unit）**：用于四舍五入的时间粒度，如纳秒、秒、分钟、日、周、月、年。
- **时区（Tz）**：时区标识符，如 "America/New_York"。
- **格式化和解析**：支持 RFC 3339、ISO-8601、RFC 2822 和 strftime 风格的模式，实现无损往返。

Jiff 自动无缝集成 IANA TZDB，支持 DST（夏令时）感知的算术运算和四舍五入、格式化和解析时区感知日期时间、可选的 Serde 支持等。该库深受 Temporal（TC39 JavaScript 日期时间提案）的启发，旨在为 Rust 带来类似的安全性和表达力。

平台支持：

- Unix：从 /usr/share/zoneinfo 或 TZDIR 环境变量读取 TZDB；从 /etc/localtime 获取系统时区。
- Windows：嵌入 TZDB，使用 GetDynamicTimeZoneInformation 获取系统时区，并通过 Unicode CLDR 数据映射 Windows 时区 ID 到 IANA ID。
- 无 std 支持：核心功能可在 no-std 环境下工作（除平台特定 TZDB 访问外）。
- 最低 Rust 版本：1.70.0（次要版本可能提升，但补丁版本保持不变）。

Jiff 的设计哲学强调零外部运行时依赖（Unix 上除 TZDB 外），保守使用 crate，仅在必要时添加（如 Windows 的 windows-sys 或 Serde 的互操作性）。它不计划拆分成多个子 crate，以保持维护开销低。

## Chrono 是什么

Chrono 是 Rust 中最受欢迎的日期时间库，已成为事实标准，提供全面的日期时间处理功能，包括 UTC、本地时间、时区偏移和 Naive（无时区）类型。

核心功能包括：

- **DateTime<Tz>**：时区感知日期时间，支持 Utc、Local 和 FixedOffset。
- **NaiveDateTime**：无时区日期时间，用于简单计算。
- **Duration**：时间跨度，支持秒级精度。
- **格式化和解析**：支持 strftime 风格的模式、RFC 3339 等。
- **时区支持**：通过 FixedOffset 手动处理，或依赖系统时区。

Chrono 设计于 2014-2015 年，灵感来源于 Python 的 datetime 和 Ruby 的 Time。平台支持广泛，包括 no-std（部分功能），最低 Rust 版本 1.31.0。

缺点：API 设计较老，容易误用 Naive 类型或 FixedOffset，导致 DST 错误；维护活跃度较低。

## Time 是什么

Time（time-rs）是一个现代、轻量的 Rust 日期时间库，专注于性能和简洁性，提供 UTC 和偏移日期时间处理。

核心功能包括：

- **OffsetDateTime**：带偏移的日期时间，支持 Utc 和 Local。
- **PrimitiveDateTime**：无偏移的原始日期时间。
- **Duration**：时间跨度，支持纳秒级精度。
- **格式化和解析**：支持多种格式，如 RFC 3339、ISO 8601。
- **时区支持**：主要通过 UtcOffset，手动处理，无原生 TZDB。

Time 设计强调 no-std 支持、零分配和极致性能。平台支持优秀，包括 WASM 和嵌入式。最低 Rust 版本 1.34.0。

缺点：时区支持较弱，不处理 DST 模糊时间；适合简单场景，不如 Jiff 安全。

## 如何使用 Jiff

### 安装

在 Cargo.toml 中添加：

```toml
[dependencies]
jiff = "0.1"  # 或最新版本
```

### 基本示例

```rust
use jiff::{Timestamp, ToSpan, Zoned};

fn main() -> Result<(), jiff::Error> {
    let ts: Timestamp = "2026-01-23T23:34:00Z".parse()?;
    let zoned = ts.in_tz("Asia/Singapore")?.checked_add(1.months())?;
    println!("{}", zoned);  // 输出带时区
    Ok(())
}
```

## 如何使用 Chrono

### 安装

```toml
[dependencies]
chrono = "0.4"
```

### 基本示例

```rust
use chrono::{DateTime, Duration, Utc, FixedOffset};

fn main() {
    let dt: DateTime<Utc> = "2026-01-23T23:34:00Z".parse().unwrap();
    let sg_offset = FixedOffset::east_opt(8 * 3600).unwrap();
    let sg_dt = dt.with_timezone(&sg_offset) + Duration::days(30);
    println!("{}", sg_dt);
}
```

## 如何使用 Time

### 安装

```toml
[dependencies]
time = "0.3"
```

### 基本示例

```rust
use time::{format_description::well_known::Rfc3339, OffsetDateTime, UtcOffset};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dt = OffsetDateTime::parse("2026-01-23T23:34:00Z", &Rfc3339)?;
    let sg_offset = UtcOffset::from_hms(8, 0, 0)?;
    let sg_dt = dt.to_offset(sg_offset) + time::Duration::days(30);
    println!("{}", sg_dt.format(&Rfc3339)?);
    Ok(())
}
```

## 最佳实践实战

- **Jiff**：始终使用 checked\_\* 方法处理溢出；优先 Zoned 处理 DST；启用 tzdb_embedded feature 自包含。
- **Chrono**：避免 Naive 类型；手动检查 DST 边界；用于遗留生态。
- **Time**：用于性能敏感场景；手动管理偏移，不依赖 TZDB。

### 实战项目：时区转换工具（三库对比）

#### Cargo.toml

```toml
[package]
name = "datetime-tool"
version = "0.1.0"
edition = "2021"

[dependencies]
jiff = { version = "0.1", features = ["serde", "tzdb_embedded"] }
chrono = "0.4"
time = "0.3"
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
axum = "0.7"
```

#### src/main.rs

```rust
use axum::{routing::get, Router, Json};
use jiff::{ToSpan, Tz, Unit, Zoned};
use chrono::{DateTime, Duration, FixedOffset, Utc};
use time::{format_description::well_known::Rfc3339, OffsetDateTime, UtcOffset};
use serde::Serialize;

#[derive(Serialize)]
struct TimeResponse {
    jiff: String,
    chrono: String,
    time: String,
}

async fn get_time() -> Json<TimeResponse> {
    // Jiff
    let j_now = Zoned::now();
    let j_future = j_now.checked_add(1.months()).unwrap().round(Unit::Day).unwrap();

    // Chrono
    let c_now: DateTime<Utc> = Utc::now();
    let sg_offset = FixedOffset::east_opt(8 * 3600).unwrap();
    let c_sg = c_now.with_timezone(&sg_offset);
    let c_future = c_sg + Duration::days(30);

    // Time
    let t_now = OffsetDateTime::now_utc();
    let t_sg_offset = UtcOffset::from_hms(8, 0, 0).unwrap();
    let t_sg = t_now.to_offset(t_sg_offset);
    let t_future = t_sg + time::Duration::days(30);

    Json(TimeResponse {
        jiff: j_future.to_string(),
        chrono: c_future.to_rfc3339(),
        time: t_future.format(&Rfc3339).unwrap(),
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/time", get(get_time));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

#### config.toml（配置示例）

```toml
default_tz = "Asia/Singapore"
```

## Rust 日期时间库对比：Jiff vs Chrono vs Time

| 维度     | Jiff             | Chrono         | Time             |
| -------- | ---------------- | -------------- | ---------------- |
| 正确性   | 极高（DST 安全） | 中等（易出错） | 中等（偏移简单） |
| 时区支持 | 原生 TZDB        | FixedOffset    | UtcOffset        |
| 性能     | 合理             | 优秀           | 最快             |
| 生态     | 增长中           | 完美           | 良好             |
| 推荐     | 新项目           | 遗留           | 性能敏感         |

## 详细的参考资料

- **Jiff 官方仓库**：https://github.com/BurntSushi/jiff
- **Chrono 官方**：https://github.com/chronotope/chrono
- **Time 官方**：https://github.com/time-rs/time
- **Temporal 提案**：https://tc39.es/proposal-temporal/
- **IANA TZDB**：https://www.iana.org/time-zones
- **Crates.io**：https://crates.io/crates/jiff, https://crates.io/crates/chrono, https://crates.io/crates/time

## Rust 日期时间库对比：Jiff vs Chrono vs time

作为资深 Rust 工程师，我为你整理一份**清晰、实用、代码并排**的对比，聚焦三个主流库：

- **chrono**：老牌王者，生态最广，但设计较老，容易误用
- **time** (time-rs/time)：现代、轻量、性能优秀，但时区支持较弱
- **jiff**：最新（BurntSushi 出品），正确性最高，DST/模糊时间最安全，推荐新项目

## 快速结论表

| 维度                    | chrono (0.4.x)                   | time (0.3.x)                  | jiff (0.1.x → 接近 1.0)             | 你的推荐（ +08）            |
| ----------------------- | -------------------------------- | ----------------------------- | ----------------------------------- | --------------------------- |
| 正确性（DST、模糊时间） | 中等（很多坑）                   | 中等（FixedOffset 为主）      | **极高**（Temporal 风格，强制安全） | **jiff**                    |
| 时区支持                | 手动 FixedOffset，TZDB 需额外    | 基本 FixedOffset，无原生 TZDB | **原生完整 IANA TZDB** + 系统时区   | **jiff**                    |
| 性能                    | 优秀                             | **最快**（轻量设计）          | 非常接近（热路径优化好）            | time 微胜 / 平手            |
| API 安全性              | 低（Naive / FixedOffset 陷阱多） | 中等                          | **最高**（pit of success）          | **jiff**                    |
| 生态兼容性              | **完美**（sqlx、diesel、serde…） | 良好                          | 良好（快速增长，serde 优秀）        | chrono（遗留） / jiff（新） |
| 学习曲线                | 中等（文档老）                   | 低（简洁）                    | 低（现代、详细对比文档）            | **jiff**                    |
| 二进制大小 / no-std     | 中等                             | **最小**                      | 小（保守设计）                      | time / jiff                 |
| 维护活跃度              | 缓慢（基本维护）                 | 活跃                          | **非常活跃**（目标 1.0）            | **jiff**                    |
| 新项目首选（2026）      | 遗留 / 极致兼容                  | 性能敏感、无时区复杂需求      | **绝大多数新项目**                  | **jiff**                    |

**一句话总结**：  
你在 +8.00，新项目**直接用 jiff**（时区正确性最强，+08 无夏令时也最安全）。  
如果追求极致性能且不怎么用真实时区 → time。  
已有 chrono 生态依赖 → 短期继续 chrono，逐步迁移 jiff。

## 代码并排对比（相同需求，3 种写法）

### 1. 获取当前 +8.00 时间

```rust
// chrono
use chrono::{Local, FixedOffset};
let now = Local::now();                          // 系统时区（希望是 +08）
let sg_offset = FixedOffset::east_opt(8*3600).unwrap();
let sg_now = now.with_timezone(&sg_offset);      // 手动偏移，容易错

// time
use time::{OffsetDateTime, utc_offset::UtcOffset};
let now = OffsetDateTime::now_local().unwrap();  // 系统时区
let sg_now = now.to_offset(UtcOffset::from_hms(8, 0, 0).unwrap());

// jiff（最推荐）
use jiff::Zoned;
let sg_now = Zoned::now();                       // 自动系统时区（ +08）
println!("{}", sg_now);                          // 带 [Asia/Singapore]
```

### 2. 解析带时区字符串 → 加 3 个月

```rust
let input = "2026-03-15T14:30:00+08:00";

// chrono（不安全加法）
use chrono::{DateTime, Duration, Utc};
let dt: DateTime<Utc> = input.parse().unwrap();
let future = dt + Duration::days(90);            // 静默跨越 DST/闰月

// time（更安全，但仍 FixedOffset）
use time::{format_description::well_known::Rfc3339, PrimitiveDateTime};
let parsed = OffsetDateTime::parse(input, &Rfc3339).unwrap();
let future = parsed + time::Duration::days(90);

// jiff（强制 checked + 日历算术）
use jiff::{Timestamp, ToSpan};
let ts: Timestamp = input.parse().unwrap();
let sg = ts.in_tz("Asia/Singapore").unwrap();
let future = sg.checked_add(3.months()).unwrap();  // 日历月，安全
```

### 3. 四舍五入到最近 15 分钟（会议/日志常见）

```rust
// chrono（手动实现）
use chrono::Timelike;
let mut dt = Local::now();
let m = dt.minute() / 15 * 15;
dt = dt.with_minute(m).unwrap().with_second(0).unwrap();

// time（也手动）
use time::ext::NumericalStdDuration;
let now = OffsetDateTime::now_local().unwrap();
let rounded = now - (now.minute() % 15).minutes();

// jiff（一行）
use jiff::Unit;
let rounded = Zoned::now().round(Unit::Minute * 15).unwrap();
```

### 4. 处理美国 DST 模糊时间（秋季后退 1:30 出现两次）

```rust
use jiff::tz::Disambiguation;

// chrono → 通常选一个或 None，很容易错
// time   → FixedOffset 根本不处理 DST 模糊

// jiff（唯一真正安全的）
let ambiguous = "2025-11-02T01:30:00"
    .parse::<jiff::civil::DateTime>()
    .unwrap()
    .to_zoned("America/New_York", Disambiguation::Earlier)
    .unwrap();  // 明确选第一个（-04:00）
```

### 5. Serde JSON（Web API 返回）

```rust
// chrono（需额外 with）
#[derive(serde::Serialize)]
struct Event {
    #[serde(with = "chrono::serde::ts_seconds")]
    time: chrono::DateTime<Utc>,
}

// time（内置支持好）
#[derive(serde::Serialize)]
struct Event {
    time: time::OffsetDateTime,   // 默认 RFC3339
}

// jiff（最现代）
#[derive(serde::Serialize)]
struct Event {
    time: jiff::Zoned,            // 默认带时区名称 ISO8601
}
```

## 三个库的真实优劣势总结（工程视角）

**chrono**  
优点：生态王者，几乎所有数据库、框架、polars/arrow 都原生支持  
缺点：设计 2014–2015 年风格，FixedOffset 滥用，DST 算术不安全，闰秒诡异  
适合：遗留系统、追求零迁移成本

**time**  
优点：极致轻量、性能最高、API 简洁现代、无 std 支持优秀  
缺点：时区支持弱（无原生 TZDB，靠 FixedOffset），DST/模糊时间几乎不处理  
适合：性能敏感、无复杂时区需求（纯 UTC 或固定偏移）、嵌入式/no-std

**jiff**  
优点：正确性最高（Temporal 启发）、DST/模糊时间强制安全、原生 TZDB、坑最少  
缺点：生态还在追赶（虽 serde 很好，但部分数据库 crate 迁移中）  
适合：新项目、金融、日志、跨时区协作、任何需要“不出错”的场景

## 针对你（ +08）的最终建议

- **新项目 / 学习 / 个人项目** → **直接用 jiff**  
  （无夏令时，但未来可能对接全球系统，jiff 的安全性和表达力最强）

- **已有 chrono 项目** → 继续用 chrono，但新模块试用 jiff（可共存，边界转 Timestamp）

- **极致性能 + 简单 UTC** → 可以考虑 time

- **下一步行动**：  
  复制上面 jiff 示例到一个 `main.rs`，跑一遍对比感受差异  
  然后在新 crate 里全面用 jiff 写一个小型 Web API 或日志处理器
