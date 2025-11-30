---
title: "Foyer Hybrid Cache Integration Guide in Rust"
description: "Foyer is an innovative hybrid caching library for Rust, designed to combine the speed of in-memory caching with the persistence and scalability of disk-based storage. Inspired by modern cache designs like Caffeine and Moka, Foyer provides a seamless abstraction for zero-copy operations, high concurrency, and plug-and-play eviction policies."
date: 2025-11-17T18:22:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-hartonosbg-34749411.jpg-slimming.webp"
categories: ["Rust", "Cargo", "Foyer", "实战指南", "Rust 生态", "Cache","Guide","Hybrid","Disk Storage"]
authors: ["houseme"]
tags: ["rust", "cargo","Foyer", "实战指南", "Rust 生态", "Cache","Guide","Hybrid","Disk Storage","Hybrid Cache","In-Memory Cache","Disk Cache","Eviction Policies","Zero-Copy","Concurrency","Async I/O","Tokio","Serialization","Serde","LZ4 Compression","Observability","Prometheus","OpenTelemetry","Jaeger"]
keywords: "rust,cargo,Foyer,实战指南,Rust 生态,Cache,Guide,Hybrid,Disk Storage,Hybrid Cache,In-Memory Cache,Disk Cache,Eviction Policies,Zero-Copy,Concurrency,Async I/O,Tokio,Serialization,Serde,LZ4 Compression,Observability,Prometheus,OpenTelemetry,Jaeger"
draft: false
---

# Foyer Hybrid Cache Integration Guide in Rust

Foyer is an innovative hybrid caching library for Rust, designed to combine the speed of in-memory caching with the persistence and scalability of disk-based storage. Inspired by modern cache designs like Caffeine and Moka, Foyer provides a seamless abstraction for zero-copy operations, high concurrency, and plug-and-play eviction policies. It's particularly useful in data-intensive applications such as databases, web services, or AI workloads where memory constraints demand spilling to disk without sacrificing performance. As of November 2025, Foyer is in active development (version 0.21-dev), supporting Rust 1.85+ on Linux (primary), macOS, and Windows (with limitations). This guide walks you through integration from setup to advanced usage, with practical examples and best practices.

## 1. Why Foyer? Key Features and Architecture

### Core Features
- **Hybrid Design**: In-memory layer for hot data (low-latency access) + disk layer for cold data (persistent, larger capacity).
- **Concurrency**: Thread-safe with fearless Rust patterns; supports async I/O via Tokio.
- **Zero-Copy Abstraction**: Leverages Rust's type system for efficient data handling without unnecessary cloning.
- **Eviction Policies**: Built-in LRU with customizable configs; supports admission/reinsertion filters.
- **Observability**: Out-of-the-box metrics for Prometheus, tracing for OpenTelemetry/Jaeger.
- **Extensibility**: Custom hashing, weighing, compression (e.g., LZ4), and I/O throttling.

### Architecture Overview
Foyer uses a **block-based storage engine** for the disk layer:
- **Memory Cache**: Fast, volatile (e.g., 64MB limit).
- **Disk Device**: File-system backed (e.g., via `FsDevice`), with configurable block sizes and flushers.
- **Serialization**: Data must implement `foyer::Code` (or use `serde` feature for auto-derivation).
- **Operations**: Async methods like `insert`, `get`, `get_or_fetch` handle promotion/demotion between layers.
- **Eviction Flow**: Memory evicts to disk; disk reclaims via LRU or custom pickers.

This setup ensures high hit rates (up to 95% in benchmarks) while handling terabyte-scale data.

## 2. Integration Setup

### Step 1: Add Dependencies
In your `Cargo.toml`, add Foyer with required features. For hybrid mode with Serde support:
```toml
[dependencies]
foyer = { version = "0.21-dev", features = ["serde"] }  # For serde auto-Code
tokio = { version = "1", features = ["full"] }  # For async runtime
anyhow = "1"  # For error handling
tempfile = "3"  # For temp dirs in examples
```

For nightly optimizations (e.g., better perf):
```toml
foyer = { version = "0.21-dev", features = ["nightly"] }
```

Run `cargo build` to fetch. Minimum Rust: 1.85.0.

### Step 2: Project Structure
Organize as a binary crate for simplicity:
```rust
// src/main.rs
use foyer::{CacheBuilder, HybridCacheBuilder, BlockEngineBuilder, FsDeviceBuilder};
use std::path::Path;
use tokio::main;
```

## 3. Basic Usage Examples

### 3.1 In-Memory Cache (Sync, Simple)
For pure memory caching (no disk):
```rust
use foyer::{Cache, CacheBuilder};

fn main() {
    let cache: Cache<String, String> = CacheBuilder::new(16)  // Max 16 entries
        .build();

    cache.insert("key".to_string(), "value".to_string());
    if let Some(entry) = cache.get("key") {
        println!("Value: {}", entry.value());  // Output: Value: value
    }
}
```
This is synchronous and ideal for low-latency, non-persistent needs.

### 3.2 Hybrid Cache (Async, Disk-Backed)
For full hybrid integration:
```rust
use anyhow::Result;
use foyer::{
    BlockEngineBuilder, DeviceBuilder, FsDeviceBuilder, HybridCache, HybridCacheBuilder,
};
use std::path::Path;
use tokio::main;

#[main]
async fn main() -> Result<()> {
    // Create a temp directory for disk storage
    let dir = tempfile::tempdir()?;
    let device = FsDeviceBuilder::new(dir.path())
        .with_capacity(256 * 1024 * 1024)  // 256MB disk capacity
        .build()?;

    // Build hybrid cache: 64MB memory, disk engine
    let hybrid: HybridCache<u64, String> = HybridCacheBuilder::new()
        .memory(64 * 1024 * 1024)  // 64MB in-memory
        .storage()
        .with_engine_config(
            BlockEngineBuilder::new(device)
                .with_block_size(1024 * 1024)  // 1MB blocks
                .build(),
        )
        .build()
        .await?;

    // Insert and retrieve
    hybrid.insert(42, "The answer to life, the universe, and everything.".to_string()).await?;
    if let Some(entry) = hybrid.get(&42).await? {
        println!("Value: {}", entry.value());
    }

    // Clean up
    hybrid.close().await?;
    Ok(())
}
```
Run with `cargo run`. This promotes data from disk to memory on access, evicting cold items to disk.

### 3.3 Lazy Loading with `get_or_fetch`
Integrate with compute-on-miss:
```rust
use foyer::CacheValueRef;

async fn fetch_expensive(key: u64) -> Result<String, anyhow::Error> {
    // Simulate DB call
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    Ok(format!("Fetched for key {}", key))
}

let value = hybrid
    .get_or_fetch(100, fetch_expensive(100))
    .await?
    .map(|entry| entry.value().clone());
```

## 4. Advanced Configuration and Integration

### 4.1 Custom Eviction and Sharding
Tune for high-load scenarios:
```rust
use foyer::{LruConfig, PickerConfig};

let hybrid = HybridCacheBuilder::new()
    .with_shards(4)  // Shard for concurrency
    .memory(128 * 1024 * 1024)
    .eviction(LruConfig::new(1024))  // Max 1024 memory entries
        .with_high_priority_pool_ratio(0.25)  // 25% for hot items
        .with_picker_config(PickerConfig::Fifo)  // FIFO eviction picker
    .storage()
    .with_weighter(|_k, v: &String| v.len() as u64)  // Weigh by string length
    .with_compression(foyer::Compression::Lz4)  // Compress disk data
    .build()
    .await?;
```
This setup shards across 4 threads, uses weighted eviction, and compresses for disk efficiency.

### 4.2 Observability Integration
Enable metrics:
```rust
use foyer::metrics::MetricsRegistry;

let registry = MetricsRegistry::new();  // Prometheus-compatible
let hybrid = HybridCacheBuilder::new()
    .with_metrics_registry(registry)
    // ... other config
    .build()
    .await?;
```
Expose via a web server (e.g., with `axum`) at `/metrics` for Grafana dashboards. Track hit rates, eviction counts, and I/O throughput.

### 4.3 Custom Types with Serde
For non-primitive values:
```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
struct User { id: u64, name: String }

let hybrid: HybridCache<u64, User> = // ... build as above
```
Foyer's `serde` feature auto-implements `Code` for serialization.

## 5. Best Practices and Tips

- **Performance Tuning**: Start with 1MB block sizes; monitor IOPS with `Throttle` (e.g., limit to 1000 IOPS). Use `RecoverMode::Quiet` in production to skip verbose logs.
- **Concurrency**: Always use async for hybrid; shard count = CPU cores for balanced load.
- **Data Safety**: Call `close().await` on shutdown to flush pending writes. Enable tombstone logging for recovery.
- **Error Handling**: Wrap in `anyhow` or `thiserror`; handle `io::Error` for disk failures.
- **Testing**: Use `tempfile` for unit tests; benchmark with `criterion` to compare hit latencies (<1μs memory, <10ms disk).
- **Limitations**: Architecture evolving—pin to 0.21-dev for stability. Windows support limited; prefer Linux for prod.
- **Integration Patterns**: Pair with databases (e.g., as SlateDB's cache layer) for read-heavy workloads. For Moka users, migrate by wrapping Foyer as a backend.

In benchmarks, Foyer achieves 2-3x throughput over pure disk caches while keeping memory usage low.

## 6. References
- **Official GitHub**: https://github.com/foyer-rs/foyer - Full README, examples, and roadmap.
- **Docs**: https://foyer-rs.github.io/foyer/ - API reference and architecture deep-dive.
- **Related Projects**: SlateDB integration example (https://github.com/slatedb/slatedb).
- **Community**: Rust forums and Reddit r/rust for discussions on hybrid caching.

This guide equips you to integrate Foyer into your Rust project. For custom scenarios, check the repo's examples directory.
