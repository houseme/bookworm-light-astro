---
title: "在 Rust 中实战 io_uring：以文件系统 IO 为例"
description: "io_uring 是 Linux 内核（从 5.1 版本开始支持）提供的高性能异步 IO 接口，它允许用户空间批量提交 IO 操作，减少系统调用开销，特别适合高吞吐的文件 IO 或网络 IO。Rust 社区有多个 crate 支持 io_uring："
date: 2025-09-29T13:42:10Z
image: "https://static-rs.bifuba.com/images/posts/pexels-oskar-gross-1074333632-34125813.jpg"
categories: ["Rust", "Cargo", "实战指南","性能调优","异步编程","io_uring","文件系统","网络编程"]
authors: ["houseme"]
tags: ["rust", "cargo","tokio","异步编程","性能调优","实战指南","性能优化","理论知识","场景选择","代码实例","io_uring","io-uring","tokio-uring","uring-fs","文件系统IO","网络编程"]  
keywords: "rust,cargo,实战指南,异步编程,性能优化,性能调优,安全性,理论知识,场景选择,代码实例,io_uring,io-uring,tokio-uring,uring-fs,文件系统IO,网络编程"
draft: false
---


io_uring 是 Linux 内核（从 5.1 版本开始支持）提供的高性能异步 IO 接口，它允许用户空间批量提交 IO 操作，减少系统调用开销，特别适合高吞吐的文件 IO 或网络 IO。Rust 社区有多个 crate 支持 io_uring：

- **io-uring**：低级绑定，直接对应内核 API，适合需要精细控制的场景。
- **tokio-uring**：基于 Tokio 的异步运行时封装，易于集成 async/await，支持文件和网络操作（推荐用于实战）。
- **uring-fs**：专注于文件系统的 io_uring 实现，类似于 std::fs 但异步化。

你的查询提到“rustfs”，这可能指 Rust 的文件系统相关库（如 rustfs 项目或 uring-fs crate）。我假设你想在文件 IO 场景下实战 io_uring。下面我以 **tokio-uring** 为例，提供一个完整的实战教程：实现一个异步文件复制器（类似于 `cp` 命令，但使用 io_uring 驱动）。这展示了文件打开、读取和写入的实战应用。

## 环境要求
- Linux 内核 ≥ 5.5（推荐 5.10+ 以支持更多功能）。
- Rust 1.70+。
- 测试环境：使用 `cargo new io_uring_cp --bin` 创建项目。

## 步骤 1: 添加依赖
在 `Cargo.toml` 中添加：
```toml
[dependencies]
tokio-uring = "0.4"  # io_uring 运行时
tokio = { version = "1", features = ["full"] }  # 兼容 Tokio 生态
clap = { version = "4", features = ["derive"] }  # 命令行解析（可选）
anyhow = "1"  # 错误处理
```

运行 `cargo build` 验证依赖。

## 步骤 2: 理解核心概念
- **Submission Queue (SQ)**：用户提交 IO 操作（如 read/write）。
- **Completion Queue (CQ)**：内核返回完成事件。
- **tokio-uring** 隐藏了这些细节，提供 `#[tokio::main(flavor = "uring")]` 来启动运行时，以及 `uring::open_file`、`read`、`write` 等 API。
- 与标准 Tokio 不同，文件 IO 是真正异步的（不阻塞线程）。

## 步骤 3: 完整代码示例
以下是一个简单的异步文件复制器 `io_uring_cp.rs`。它使用 io_uring 打开源文件、读取内容，并异步写入目标文件。支持命令行参数如 `cargo run -- src.txt dst.txt`。

```rust
use anyhow::{Context, Result};
use clap::Parser;
use std::fs;
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_uring::fs::File;

#[derive(Parser)]
struct Args {
    /// 源文件路径
    src: PathBuf,
    /// 目标文件路径
    dst: PathBuf,
}

#[tokio_uring::main(flavor = "uring")]  // 使用 io_uring 运行时
async fn main() -> Result<()> {
    let args = Args::parse();

    // 检查源文件存在
    if !args.src.exists() {
        anyhow::bail!("源文件 {} 不存在", args.src.display());
    }

    // 使用 io_uring 打开文件（异步）
    let src_file = File::open(&args.src).await
        .context("打开源文件失败")?;
    let mut dst_file = File::create(&args.dst).await
        .context("创建目标文件失败")?;

    // 读取源文件（缓冲区大小 8KB）
    let mut buffer = vec![0u8; 8192];
    loop {
        let n = src_file.read(&mut buffer).await
            .context("读取源文件失败")?;
        if n == 0 {
            break;  // EOF
        }

        // 异步写入目标文件
        dst_file.write_all(&buffer[..n]).await
            .context("写入目标文件失败")?;
    }

    // 确保写入完成
    dst_file.close().await
        .context("关闭目标文件失败")?;

    println!("文件复制完成：{} -> {}", args.src.display(), args.dst.display());
    Ok(())
}
```

## 步骤 4: 运行与测试
1. 创建测试文件：`echo "Hello, io_uring in Rust!" > src.txt`。
2. 运行：`cargo run -- src.txt dst.txt`。
3. 验证：`cat dst.txt` 应输出相同内容。
4. 性能测试：使用大文件（e.g., 1GB）比较与 `std::fs::copy` 的速度。io_uring 在高并发或大文件场景下更快（减少上下文切换）。

## 步骤 5: 扩展实战
- **集成 uring-fs**：如果专注于文件系统，替换为 `uring-fs` crate（添加 `uring-fs = "0.1"`）。示例：
  ```rust:disable-run
  use uring_fs::Filesystem;
  let fs = Filesystem::new(256)?;  // SQ/CQ 深度 256
  let mut src = fs.open_file(&args.src, 0o644).await?;
  // ... 类似读取/写入
  ```
  这更像 Rust 的 std::fs，但全异步。

- **网络 IO 示例**：扩展为 echo TCP 服务器（参考 developerlife.com 的教程）：
  ```rust
  use tokio_uring::net::TcpListener;
  let listener = TcpListener::bind("127.0.0.1:8080").await?;
  loop {
      let (stream, _) = listener.accept().await?;
      // 处理连接：read -> write 回显
  }
  ```

- **性能优化**：
  - 注册缓冲区：使用 `tokio_uring::buf::RegisteredBuf` 减少内核拷贝。
  - 批量提交：io_uring 支持多操作链式提交，适合高负载。

## 注意事项
- **兼容性**：仅 Linux 支持。测试时用 `uname -r` 检查内核版本。
- **错误处理**：io_uring 事件可能乱序，确保使用 `user_data` 跟踪操作。
- **生产使用**：从 Reddit 讨论看，io_uring 在 Rust 中已用于生产（如数据摄取），但 tokio-uring 仍年轻，建议从小规模开始。潜在问题：内存安全（Rust 绑定已处理，但需审计 unsafe 代码）。
- **进一步学习**：
  - 官方 docs：https://docs.rs/tokio-uring
  - 示例 repo：https://github.com/espoal/uring_examples
  - 教程：https://developerlife.com/2024/05/25/tokio-uring-exploration-rust/ （包含视频）

这个示例展示了 io_uring 在文件 IO 上的实战价值。如果你指的是特定“rustfs”项目（如用户空间文件系统），请提供更多细节，我可以调整！
