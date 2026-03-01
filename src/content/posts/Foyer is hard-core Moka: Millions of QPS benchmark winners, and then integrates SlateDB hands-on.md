---
title: "Foyer 硬刚 Moka：百万 QPS 基准赢家，再手把手集成 SlateDB"
description: "实测二者并发、内存、命中率曲线，附 SlateDB 磁盘缓存 5 步集成模板，一键切换冷热层，吞吐翻倍，延迟再降 50%。"
date: 2025-11-19T19:22:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-jean-paul-wettstein-677916508-34960896.jpg-slimming.webp"
categories: ["Rust", "Cargo", "Foyer", "实战指南", "Rust 生态", "Cache","Guide","Hybrid","Disk Storage","Moka","内存缓存","缓存库","rustfs","分布式缓存","SlateDB"]
authors: ["houseme"]
tags: ["rust", "cargo","Foyer", "实战指南", "Rust 生态", "Cache","Guide","Hybrid","Disk Storage","Moka","内存缓存","缓存库","异步编程","并发编程","高性能计算","Rust 教程","Rust 实战","rustfs","分布式缓存","redis","s3兼容对象存储","分布式系统","微服务架构","缓存一致性","缓存分片","SlateDB"]
keywords: "rust,cargo,Foyer,实战指南,Rust 生态,Cache,Guide,Hybrid,Disk Storage,Moka,内存缓存,缓存库,异步编程,并发编程,高性能计算,Rust 教程,Rust 实战,rustfs,分布式缓存,redis,s3兼容对象存储,分布式系统,微服务架构,缓存一致性,缓存分片,SlateDB"
draft: false
---


# Foyer 与 Moka 基准测试对比，以及 SlateDB 缓存集成指南

Foyer 是一个 Rust 混合缓存库，结合内存和磁盘存储，提供零拷贝抽象和高并发支持；Moka 则是一个纯内存并发缓存库，受 Caffeine 启发，专注于高性能键值存储。在 2025 年，随着数据密集型应用的兴起（如 AI 和分布式存储），基准测试成为评估这些库的关键。本指南基于最新基准数据（使用 mokabench 工具），对比二者在内存模式下的性能，并深入探讨 Foyer 在 SlateDB（一个高性能嵌入式 KV 数据库）中的集成实践。SlateDB 使用 Foyer 实现 SSTable（Sorted String Table）的本地缓存，显著提升读性能。

## 1. Foyer 与 Moka 基准测试对比

### 1.1 基准测试概述
基准测试主要使用 mokabench 工具（Moka 的官方基准套件），在 x64 Linux 环境（Intel i9-12900H CPU）下运行，模拟高并发读写负载。测试场景包括：
- **纯内存模式**：Foyer 的 in-memory 缓存 vs Moka 的 sync::Cache。
- **混合模式**：Foyer 的内存 + 磁盘 vs Moka（无磁盘支持）。
- **指标**：吞吐量（ops/s）、延迟（μs）、命中率（%）、内存占用（MB）。
- **负载**：Zipfian 分布（模拟真实访问模式），容量 10k-100k 条目，线程数 1-16。

Foyer 在内存模式下优化了零拷贝机制，利用 Rust 类型系统减少克隆开销；在混合模式下，通过块存储引擎（block-based）实现高效的内存 - 磁盘晋升/降级。

### 1.2 关键基准结果
根据 Foyer 官方文档和社区基准，Foyer 在纯内存场景下优于 Moka，仅次于 Quick Cache（一个轻量级 FIFO 缓存）。以下是典型结果总结（基于 2025 年 10 月更新）：

| 指标/场景          | Foyer (内存模式) | Moka (TinyLFU) | Quick Cache (S3-FIFO) | 备注 |
|--------------------|------------------|----------------|-----------------------|------|
| **吞吐量 (ops/s, 16 线程)** | 1.2M            | 950K          | 1.5M                 | Foyer 零拷贝提升 26% |
| **平均延迟 (μs, 命中)**    | 0.8             | 1.1           | 0.6                  | Foyer 接近 Quick Cache |
| **命中率 (Zipfian, 90%)**  | 92%             | 88%           | 94%                  | Foyer LRU+过滤器优化 |
| **内存占用 (100k 条目)**   | 45 MB           | 52 MB         | 38 MB                | Foyer 更高效哈希表 |
| **混合模式吞吐量 (ops/s)** | 800K            | N/A           | N/A                  | Foyer 磁盘后备，延迟 <10ms |

- **关键发现**：
  - **Foyer 优势**：在高并发下，Foyer 的无锁并发模型和零拷贝抽象使其吞吐量高于 Moka 约 20-30%，尤其在读密集负载中。混合模式下，Foyer 可将 S3 延迟降低 50%（如 HN 讨论案例），适用于 SlateDB 等存储系统。
  - **Moka 优势**：Moka 的 TinyLFU 策略在流行度敏感场景（如 API 缓存）中命中率更高（+4%），且 API 更成熟，支持 TTL/TTI 等过期机制。Moka 适合纯内存场景，开销更低。
  - **Quick Cache 领先**：作为基准，轻量级 Quick Cache 在简单 FIFO 场景下最快，但缺乏 Foyer 的混合支持。
  - **测试设置**：使用 mokabench 的 SPC1/SPC2 跟踪，客户端 1-16 个。Foyer v0.21-dev，Moka v0.12.11。完整结果见 Foyer 文档。

如果你的应用内存有限，优先 Foyer；纯内存高并发选 Moka。社区建议：用 criterion 运行自定义基准，模拟你的负载。

### 1.3 性能优化建议
- **Foyer**：启用 nightly 特性提升 10% 吞吐；分片数设为 CPU 核心数。
- **Moka**：用 LRU 策略替换 TinyLFU 以降低 CPU 开销（-15% 延迟）。
- **迁移**：从 Moka 到 Foyer 时，复用 get/insert API，添加磁盘配置。

## 2. SlateDB 中的 Foyer 缓存集成

SlateDB 是一个 Rust 实现的嵌入式 KV 数据库，支持对象存储后端（如 S3），专注于高吞吐写和低延迟读。Foyer 被集成作为 `FoyerHybridCache`，用于缓存 SSTable 的块（blocks）、索引（indexes）和布隆过滤器（bloom filters），实现内存 + 本地磁盘的混合缓存。这减少了对对象存储的访问，提升读性能 2-3x，尤其在冷数据场景。

### 2.1 集成特点
- **分层缓存**：内存层（热数据，低延迟）+ 磁盘层（冷数据，持久化）。
- **自定义权重**：基于条目大小（e.g., 块大小）计算权重，避免大对象挤占空间。
- **与对象存储共存**：结合 `CachedObjectStore` 预取 SSTable，但需注意写放大（write amplification）。
- **性能益处**：读吞吐受磁盘 I/O 限制时，Foyer 可将对象存储命中率降至 <20%，整体延迟 <10ms。缺点：与对象缓存结合时，可能导致冗余写（内存→磁盘→对象）。

### 2.2 配置与使用
在 SlateDB builder 中注入 Foyer 缓存。添加依赖：`cargo add slatedb foyer`。

示例代码：基本集成（异步模式）：
```rust
use anyhow::Result;
use foyer::{HybridCacheBuilder, FsDeviceBuilder, DirectFsDeviceOptions};
use slatedb::{Db, DbBuilder, db_cache::foyer_hybrid::{FoyerHybridCache, CachedEntry, HybridCacheBuilder as SlateHybridBuilder}};
use std::path::Path;
use tokio::main;

#[main]
async fn main() -> Result<()> {
    // 配置 Foyer 混合缓存
    let cache_dir = Path::new("/tmp/slatedb-cache");
    let hybrid_cache = SlateHybridBuilder::default()
        .memory(1024 * 1024 * 1024)  // 1GB 内存
        .storage()
            .with_device_options(
                DirectFsDeviceOptions::new(cache_dir)
                    .with_capacity(10 * 1024 * 1024 * 1024u64)  // 10GB 磁盘容量
            )
        .with_weigher(|_k: &u64, v: &CachedEntry| v.size() as u64)  // 按大小加权
        .build()
        .await?;

    let foyer_cache = FoyerHybridCache::new(hybrid_cache);

    // SlateDB 构建器注入缓存
    let db = DbBuilder::default()
        .with_memory_cache(foyer_cache)  // 注入 Foyer 缓存
        .open("slatedb-data")  // 数据目录
        .await?;

    // 示例：写/读操作（自动使用缓存）
    db.put(b"key1", b"value1").await?;
    let value = db.get(b"key1").await?;
    println!("值：{:?}", value);  // 从缓存或磁盘获取

    Ok(())
}
```

- **配置选项**：
  - **内存大小**：`.memory(bytes)` - 建议 内存总量的 10-20%。
  - **磁盘设备**：`.with_device_options(DirectFsDeviceOptions::new(path).with_capacity(bytes))` - 使用直接 I/O 提升性能。
  - **权重函数**：`.with_weigher(|key, value| value.size())` - 自定义驱逐优先级。
  - **引擎**：`.storage().with_engine_config(BlockEngineBuilder::new(device).with_block_size(1MB))`。

### 2.3 调优与最佳实践
- **调优提示**：监控磁盘 I/O（SlateDB tuning 文档）；若写放大问题严重，禁用对象存储缓存，仅用 Foyer。目标：读命中率 >80%。
- **集成注意**：关闭时调用 `db.close().await` 刷新缓存。测试：用 SlateDB 的基准工具模拟 SSTable 读写。
- **性能提升**：在 RisingWave 等生产环境中，Foyer 集成 SlateDB 后，成本降低 30%，读延迟降至 ms 级。

## 3. 参考资料
- **Foyer 文档**：https://foyer.rs/docs/overview - 基准详情。
- **SlateDB 文档**：https://docs.rs/slatedb/latest/slatedb/db_cache/foyer_hybrid/index.html - 集成 API。
- **SlateDB 调优**：https://slatedb.io/docs/operations/tuning/ - I/O 优化。
- **Moka 基准**：https://github.com/moka-rs/moka - mokabench 工具。
- **社区**：Rust 论坛讨论 Foyer vs Moka（2025 年更新）。
