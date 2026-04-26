---
title: "🦀 Rust LogCleaner 源码深度解析：三阶段流水线（Scanner → Selection → Action）+ gzip 压缩 + 活跃文件排除机制全剖析"
description: "逐行拆解 RustFS LogCleaner 核心源码，从 Scanner 扫描、Selection 筛选到 Action 执行，深扒 gzip 压缩与活跃文件保护机制。结合真实 Issue 修复案例，揭秘生产级日志清理如何做到零误删、零爆盘。"
date: 2026-03-11T15:30:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-jasmine-pang-232852617-16773927.jpg-slimming.webp"
categories: ["Rust", "日志管理", "轮转", "tracing", "observability", "生产实践", "文件系统", "jiff", "tokio","RustFS","RustFS 日志","日志压缩","日志清理","分布式日志聚合"]
authors: ["RustFS Team"]
tags: ["Rust", "日志轮转", "RollingAppender", "tracing_subscriber", "生产级日志", "大小旋转", "时间旋转", "LogCleaner", "Unix权限", "JSON日志", "observability", "jiff", "tokio", "RustFS", "RustFS 日志", "日志压缩", "日志清理", "分布式日志聚合", "日志归档", "日志命名", "日志重试", "日志轮转触发", "日志文件权限", "日志保留策略", "日志清理策略", "日志压缩策略", "分布式日志聚合方案", "日志压缩触发机制", "gzip 压缩", "日志压缩级别", "压缩文件保留策略", "分布式日志聚合实践"]
keywords: "rust,日志轮转,rollingappender,tracing_subscriber,生产级日志,大小旋转,时间旋转,logcleaner,unix权限,json日志,observability,jiff,tokio,rolling file,日志归档,rustfs,rustfs日志,日志压缩,日志清理,分布式日志聚合,日志命名,日志重试,日志轮转触发,日志文件权限,日志保留策略,日志清理策略,日志压缩策略,分布式日志聚合方案,日志压缩触发机制,gzip 压缩,日志压缩级别,压缩文件保留策略,分布式日志聚合实践"
draft: false
---


**🦀 Rust LogCleaner 源码深度解析：三阶段流水线（Scanner → Selection → Action）+ gzip 压缩 + 活跃文件排除机制全剖析**

RustFS（高性能 S3 兼容对象存储）中的日志生命周期管理核心就是 `LogCleaner`。它不是简单的 `rm -rf`，而是一个**生产级、配置驱动、可测试**的后台清理引擎，与我们之前剖析的 `RollingAppender`（时间 + 大小双轮转）完美联动。

本文基于最新主干代码（2026-03-15，`crates/obs/src/cleaner/`），逐文件、逐函数、逐行拆解 `mod.rs`、`types.rs`、`scanner.rs`、`compress.rs`、`core.rs` 的完整实现。结合 Issue #2130（活跃文件忽略导致日志暴涨）最新修复思路，由浅入深带你看懂“为什么永不爆盘、永不误删”。

---

### 浅层：模块结构与公共入口（mod.rs）

```rust
// crates/obs/src/cleaner/mod.rs
mod compress;
mod core;
mod scanner;
pub mod types;

pub use core::LogCleaner;
```

- **唯一对外暴露**：`LogCleaner`（来自 core.rs）
- **README 示例**（直接可拷贝）展示了完整 builder + cleanup 调用
- **集成测试**：5 个单元测试覆盖 keep_files、max_total_size、干跑、忽略无关文件等场景

### 中层：共享类型（types.rs）—— FileMatchMode + FileInfo

```rust
// crates/obs/src/cleaner/types.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileMatchMode {
    Prefix,   // "rustfs.log." 开头匹配归档
    Suffix,   // ".rustfs.log" 结尾匹配（默认）
}

#[derive(Debug, Clone)]
pub(super) struct FileInfo {
    pub path: PathBuf,
    pub size: u64,
    pub modified: SystemTime,
}
```

- `FileMatchMode` 与 `RollingAppender` 完全一致（Suffix/Prefix），保证扫描与轮转命名策略对齐。
- `FileInfo` 只存必要元数据（路径 + 大小 + 修改时间），避免反复 `metadata()` 调用，性能极高。

### 深层一：扫描器（scanner.rs）—— Discovery 阶段

核心函数 `scan_log_directory` 返回 `LogScanResult`：

```rust
pub(super) struct LogScanResult {
    pub logs: Vec<FileInfo>,        // 待清理普通日志
    pub compressed: Vec<FileInfo>,  // .gz 文件（单独保留策略）
    // ... 其他统计字段
}
```

**关键过滤逻辑**（对应 Issue #2130）：

1. `read_dir` 非递归扫描（极轻量）
2. **跳过活跃文件**：`if file_name == active_filename { continue; }`
3. **年龄门控**：`min_file_age_seconds`（默认 3600s = 1h），保护刚轮转的文件
4. **排除模式**：glob 匹配 `exclude_patterns`
5. **空文件清理**：若 `delete_empty_files=true`，直接 `fs::remove_file`（在扫描阶段就删，不计入保留）
6. **.gz 单独收集**：用于后续按 `compressed_file_retention_days` 删除

**注意**：活跃文件因年龄 < min_age 被跳过 → 旧版 size 限制失效（Issue #2130）。当前版本已在 `RollingAppender` 里内置实时 size 轮转，双保险已解决。

### 深层二：压缩引擎（compress.rs）—— Action 阶段压缩

```rust
pub(super) fn compress_file(path: &Path, level: u32, dry_run: bool) -> Result<(), std::io::Error> {
    let gz_path = path.with_extension("gz");  // 使用 DEFAULT_OBS_LOG_GZIP_COMPRESSION_EXTENSION

    if gz_path.exists() { return Ok(()); }
    if dry_run { /* 只 log */ return Ok(()); }

    let input = File::open(path)?;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::new(level.clamp(1,9)));
    std::io::copy(&mut reader, &mut encoder)?;
    // 写入 .gz + flush
}
```

- 使用 `flate2`（零依赖）
- **幂等**：已存在 .gz 直接跳过
- **dry_run 友好**：生产验证神器
- 原文件不在这里删除（交给 core 统一处理）

### 深层三：核心编排（core.rs）—— Selection + Action 全流程

```rust
pub struct LogCleaner {
    log_dir: PathBuf,
    file_pattern: String,
    active_filename: String,
    match_mode: FileMatchMode,
    keep_files: usize,                    // 默认 DEFAULT_LOG_KEEP_FILES
    max_total_size_bytes: u64,
    max_single_file_size_bytes: u64,
    compress_old_files: bool,
    gzip_compression_level: u32,
    compressed_file_retention_days: u64,
    exclude_patterns: Vec<String>,
    delete_empty_files: bool,
    min_file_age_seconds: u64,
    dry_run: bool,
    // ... builder 私有字段
}
```

**Builder 模式**（链式调用，与 local.rs 配置 1:1 映射）：

```rust
impl LogCleaner {
    pub fn builder(log_dir: PathBuf, file_pattern: String, active_filename: String) -> LogCleanerBuilder { ... }
    // .match_mode() .keep_files() .max_total_size_bytes() ... .build()
}
```

**cleanup() 主流程**（单次清理原子操作）：

```rust
pub fn cleanup(&self) -> Result<(usize, u64), Error> {  // deleted, freed_bytes
    // 1. Scanner
    let scan = scan_log_directory(...) ?;

    // 2. Selection（core::select_files_to_delete）
    let to_delete = self.select_files_to_delete(&scan.logs, &scan.compressed);

    // 3. Action
    let mut deleted = 0;
    let mut freed = 0;
    for file in to_delete {
        if self.compress_old_files && !file.path.extension().map_or(false, |e| e == "gz") {
            compress_file(&file.path, self.gzip_compression_level, self.dry_run)?;
        }
        if !self.dry_run {
            fs::remove_file(&file.path)?;
        }
        deleted += 1;
        freed += file.size;
    }

    // 额外：删除超期 .gz 文件（按 compressed_file_retention_days 计算）
    Ok((deleted, freed))
}
```

**Selection 策略优先级**（最聪明部分）：
1. 按 `modified` 时间倒序排序
2. 强制保留最近 `keep_files` 个
3. 若总大小超 `max_total_size_bytes` → 从最老开始删
4. 单文件超 `max_single_file_size_bytes` → 立即删除
5. `.gz` 文件单独按天数清理

### 生产级特性全解析

1. **永不误删**：活跃文件 + exclude_patterns + match_mode 三重防护
2. **永不爆盘**：max_total + max_single + 压缩 + 空文件清理
3. **零阻塞**：`tokio::task::spawn_blocking` 调用（local.rs 已集成）
4. **可观测**：`tracing` 全程 debug/info + 返回 (deleted, freed) 可打指标
5. **跨平台**：Windows 文件锁问题已在 RollingAppender 重试，LogCleaner 只读 + 删除
6. **干跑验证**：`dry_run=true` 只报告不操作（Issue 验证必备）

### 与 RollingAppender 联动闭环（完整日志生命周期）

- `RollingAppender`：微秒 + 原子计数器归档 + 实时 size 轮转（已修复 Issue #2130）
- `LogCleaner`：每 5 分钟（默认）扫描 → 压缩 → 删除
- 结果：活跃文件始终 < max_single，历史文件压缩后保留 30~90 天，磁盘使用率稳定 < 20%

### 实战配置模板（直接环境变量）

```bash
RUSTFS_OBS_LOG_DIRECTORY=/var/log/rustfs
RUSTFS_OBS_LOG_FILENAME=rustfs.log
RUSTFS_OBS_LOG_MATCH_MODE=suffix
RUSTFS_OBS_LOG_MAX_TOTAL_SIZE_BYTES=1073741824     # 1GB
RUSTFS_OBS_LOG_MAX_SINGLE_FILE_SIZE_BYTES=10485760 # 10MB
RUSTFS_OBS_LOG_COMPRESS_OLD_FILES=true
RUSTFS_OBS_LOG_COMPRESSED_FILE_RETENTION_DAYS=90
RUSTFS_OBS_LOG_MIN_FILE_AGE_SECONDS=0              # 强烈建议设 0（已支持活跃文件 size 轮转）
RUSTFS_OBS_LOG_DRY_RUN=false
```

### 参考资料（官方最新）

- 完整源码目录：https://github.com/rustfs/rustfs/tree/main/crates/obs/src/cleaner
- README（架构金矿）：https://github.com/rustfs/rustfs/blob/main/crates/obs/src/cleaner/README.md
- Issue #2130（活跃文件修复历史）：https://github.com/rustfs/rustfs/issues/2130
- flate2 压缩：https://docs.rs/flate2

掌握 `LogCleaner` 源码，你就拥有了 Rust 生态中最硬核的日志全生命周期引擎。无论单机还是分布式集群（多节点侧车 + Loki），都能做到“日志永存、磁盘永控、查询永快”。

**写在最后**：日志清理不是“删文件”，而是**系统稳定性的最后一公里**。用好这套三阶段流水线 + gzip + 双保险，你的 RustFS（或任意 Rust 服务）将真正生产就绪。欢迎 Star RustFS 并 PR 你的压缩优化！🦀
