---
title: "Rust 开发利器：深入解析 Cargo 所有官方命令及实战指南"
description: "Cargo 是 Rust 的包管理器和构建系统，它极大地简化了 Rust 项目的管理和开发流程。本文将详细介绍 Cargo 的所有官方命令，包括其原理剖析和实战使用。通过本文，你将全面掌握 Cargo 的各项功能，提升 Rust 项目的开发效率。"
date: 2024-12-09T10:35:00Z
image: "https://static-rs.bifuba.com/images/posts/markus-spiske-OsHE_rhfWSI-unsplash.jpg"
categories: ["Rust", "Cargo", "practical guide", "实战指南"]
authors: ["houseme"]
tags:
  [
    "rust",
    "cargo",
    "practical guide",
    "Cargo.toml",
    "project configuration",
    "dependency management",
    "optimization tips",
    "library",
    "cross-platform",
    "实战指南",
    "项目配置",
    "依赖管理",
    "优化技巧",
    "库",
    "跨平台",
  ]
keywords: "rust,cargo,Cargo.toml,项目配置,依赖管理,优化技巧,库,跨平台,实战指南,包管理器,构建系统"
draft: false
---

### Rust 开发利器：深入解析 Cargo 所有官方命令及实战指南

Cargo 是 Rust 的包管理器和构建系统，它极大地简化了 Rust 项目的管理和开发流程。本文将详细介绍 Cargo 的所有官方命令，包括其原理剖析和实战使用。通过本文，你将全面掌握 Cargo 的各项功能，提升 Rust 项目的开发效率。

### 1. `cargo new`：创建新项目

#### 介绍

`cargo new` 命令用于创建一个新的 Rust 项目。它会生成一个包含基本项目结构和配置文件的目录。

#### 命令格式

```bash
cargo new <project_name>
```

#### 原理剖析

`cargo new` 会创建一个新的目录，并在其中生成 `Cargo.toml` 和 `src/main.rs` 文件。`Cargo.toml` 是项目的配置文件，包含项目的元数据和依赖信息。`src/main.rs` 是默认的 Rust 源文件，通常包含一个简单的 `main` 函数。

#### 实战使用

```bash
cargo new my_project
cd my_project
```

**生成的目录结构：**

```
my_project/
├── Cargo.toml
└── src
    └── main.rs
```

### 2. `cargo init`：在现有目录中初始化项目

#### 介绍

`cargo init` 命令用于在现有目录中初始化一个新的 Rust 项目。它不会创建新的目录，而是在当前目录中生成必要的文件和目录结构。

#### 命令格式

```bash
cargo init
```

#### 原理剖析

`cargo init` 会在当前目录中生成 `Cargo.toml` 和 `src/main.rs` 文件。它适用于在现有目录中快速初始化 Rust 项目。

#### 实战使用

假设你有一个名为 `existing_directory` 的目录，并且想要在其中初始化 Rust 项目。

```bash
cd existing_directory
cargo init
```

**生成的目录结构：**

```
existing_directory/
├── Cargo.toml
└── src
    └── main.rs
```

### 3. `cargo build`：编译项目

#### 介绍

`cargo build` 命令用于编译当前项目。它会根据 `Cargo.toml` 文件中的配置编译项目，并生成可执行文件或库文件。

#### 命令格式

```bash
cargo build
```

#### 原理剖析

`cargo build` 会解析 `Cargo.toml` 文件，下载并编译所有依赖项，然后编译项目代码。生成的文件会放在 `target/debug` 目录中。

#### 实战使用

```bash
cargo build
```

**生成的目录结构：**

```
my_project/
├── Cargo.lock
├── Cargo.toml
├── src
│   └── main.rs
└── target
    └── debug
        └── ...
```

### 4. `cargo run`：运行项目

#### 介绍

`cargo run` 命令用于编译并运行当前项目。它会自动调用 `cargo build` 编译项目，然后运行生成的可执行文件。

#### 命令格式

```bash
cargo run
```

#### 原理剖析

`cargo run` 首先调用 `cargo build` 编译项目，然后运行生成的可执行文件。如果项目已经编译过，它会直接运行可执行文件。

#### 实战使用

```bash
cargo run
```

输出：

```
Hello, world!
```

### 5. `cargo test`：运行测试

#### 介绍

`cargo test` 命令用于运行项目的测试代码。它会编译并运行所有标记为 `#[test]` 的函数。

#### 命令格式

```bash
cargo test
```

#### 原理剖析

`cargo test` 会编译项目，并运行所有测试函数。测试函数通常放在 `src/lib.rs` 或 `src/main.rs` 中，并使用 `#[test]` 属性标记。

#### 实战使用

在 `src/main.rs` 中添加测试代码：

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }
}
```

运行测试：

```bash
cargo test
```

输出：

```
running 1 test
test tests::test_add ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### 6. `cargo check`：检查代码

#### 介绍

`cargo check` 命令用于检查代码是否可以编译，但不会生成可执行文件。它比 `cargo build` 更快，适合在开发过程中快速检查代码。

#### 命令格式

```bash
cargo check
```

#### 原理剖析

`cargo check` 会解析 `Cargo.toml` 文件，下载并编译所有依赖项，然后检查项目代码是否可以编译。它不会生成可执行文件，因此速度更快。

#### 实战使用

```bash
cargo check
```

输出：

```
Checking my_project v0.1.0 (/path/to/my_project)
    Finished dev [unoptimized + debuginfo] target(s) in 0.12s
```

### 7. `cargo update`：更新依赖

#### 介绍

`cargo update` 命令用于更新项目的依赖项。它会根据 `Cargo.toml` 文件中的版本要求，更新 `Cargo.lock` 文件中的依赖项版本。

#### 命令格式

```bash
cargo update
```

#### 原理剖析

`cargo update` 会解析 `Cargo.toml` 文件中的依赖项版本要求，并更新 `Cargo.lock` 文件中的依赖项版本。它不会修改 `Cargo.toml` 文件。

#### 实战使用

```bash
cargo update
```

### 8. `cargo clean`：清理项目

#### 介绍

`cargo clean` 命令用于清理项目的编译输出。它会删除 `target` 目录中的所有文件。

#### 命令格式

```bash
cargo clean
```

#### 原理剖析

`cargo clean` 会删除 `target` 目录中的所有文件，包括编译生成的可执行文件、库文件和中间文件。它不会删除 `Cargo.toml` 和 `Cargo.lock` 文件。

#### 实战使用

```bash
cargo clean
```

### 9. `cargo doc`：生成文档

#### 介绍

`cargo doc` 命令用于生成项目的文档。它会根据代码中的注释生成 HTML 文档。

#### 命令格式

```bash
cargo doc
```

#### 原理剖析

`cargo doc` 会解析项目代码中的注释，并生成 HTML 文档。生成的文档会放在 `target/doc` 目录中。

#### 实战使用

在 `src/main.rs` 中添加文档注释：

````rust
/// Adds two numbers together.
///
/// # Examples
///
/// ```
/// let result = add(2, 3);
/// assert_eq!(result, 5);
/// ```
fn add(a: i32, b: i32) -> i32 {
    a + b
}
````

生成文档：

```bash
cargo doc
```

**生成的目录结构：**

```
my_project/
├── Cargo.lock
├── Cargo.toml
├── src
│   └── main.rs
└── target
    └── doc
        └── ...
```

### 10. `cargo publish`：发布项目

#### 介绍

`cargo publish` 命令用于将项目发布到 crates.io。它会打包项目，并上传到 crates.io 仓库。

#### 命令格式

```bash
cargo publish
```

#### 原理剖析

`cargo publish` 会打包项目，并上传到 crates.io 仓库。在发布之前，需要确保 `Cargo.toml` 文件中的版本号和依赖项配置正确。

#### 实战使用

首先，确保你已经登录到 crates.io。如果没有，使用 `cargo login` 命令登录。

```bash
cargo login
```

然后，发布项目：

```bash
cargo publish
```

### 11. `cargo install`：安装二进制包

#### 介绍

`cargo install` 命令用于从 crates.io 安装二进制包。它会下载并编译指定的包，并将其安装到系统中。

#### 命令格式

```bash
cargo install <package_name>
```

#### 原理剖析

`cargo install` 会从 crates.io 下载指定的包，并编译生成可执行文件。生成的可执行文件会安装到系统中，通常放在 `~/.cargo/bin` 目录中。

#### 实战使用

安装 `ripgrep` 包：

```bash
cargo install ripgrep
```

### 12. `cargo search`：搜索包

#### 介绍

`cargo search` 命令用于在 crates.io 上搜索包。它会列出与搜索词匹配的包及其版本信息。

#### 命令格式

```bash
cargo search <search_term>
```

#### 原理剖析

`cargo search` 会从 crates.io 搜索与指定搜索词匹配的包，并列出包的名称、版本和描述信息。

#### 实战使用

搜索与 `http` 相关的包：

```bash
cargo search http
```

输出：

```
http = "0.2.8"                 # Rust HTTP library
hyper = "0.14.20"              # A fast and correct HTTP implementation for Rust.
reqwest = "0.11.4"             # Higher level HTTP client library.
```

### 13. `cargo fmt`：格式化代码

#### 介绍

`cargo fmt` 命令用于格式化项目的代码。它会根据 Rust 的代码风格指南自动格式化代码。

#### 命令格式

```bash
cargo fmt
```

#### 原理剖析

`cargo fmt` 会根据 Rust 的代码风格指南自动格式化项目中的所有 Rust 文件。它使用 `rustfmt` 工具来完成格式化任务。

#### 实战使用

格式化项目代码：

```bash
cargo fmt
```

### 14. `cargo clippy`：代码检查

#### 介绍

`cargo clippy` 命令用于对项目代码进行静态检查。它会提供一些代码改进建议，帮助你编写更高质量的代码。

#### 命令格式

```bash
cargo clippy
```

#### 原理剖析

`cargo clippy` 会解析项目代码，并提供一些代码改进建议。它使用 `clippy` 工具来完成代码检查任务。

#### 实战使用

检查项目代码：

```bash
cargo clippy
```

### 15. `cargo bench`：运行基准测试

#### 介绍

`cargo bench` 命令用于运行项目的基准测试。它会编译并运行所有标记为 `#[bench]` 的函数。

#### 命令格式

```bash
cargo bench
```

#### 原理剖析

`cargo bench` 会编译项目，并运行所有基准测试函数。基准测试函数通常放在 `benches` 目录中，并使用 `#[bench]` 属性标记。

#### 实战使用

在 `benches` 目录中添加基准测试代码：

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 1,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("fib 20", |b| b.iter(|| fibonacci(black_box(20))));
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
```

运行基准测试：

```bash
cargo bench
```

### 16. `cargo package`：打包项目

#### 介绍

`cargo package` 命令用于打包项目。它会生成一个包含项目文件的 `.crate` 文件，准备发布到 crates.io。

#### 命令格式

```bash
cargo package
```

#### 原理剖析

`cargo package` 会根据 `Cargo.toml` 文件中的配置，生成一个包含项目文件的 `.crate` 文件。生成的文件会放在 `target/package` 目录中。

#### 实战使用

打包项目：

```bash
cargo package
```

**生成的目录结构：**

```
my_project/
├── Cargo.lock
├── Cargo.toml
├── src
│   └── main.rs
└── target
    └── package
        └── my_project-0.1.0.crate
```

### 17. `cargo uninstall`：卸载二进制包

#### 介绍

`cargo uninstall` 命令用于卸载已安装的二进制包。它会从系统中删除指定的包。

#### 命令格式

```bash
cargo uninstall <package_name>
```

#### 原理剖析

`cargo uninstall` 会从系统中删除指定的包。删除的包会从 `~/.cargo/bin` 目录中移除。

#### 实战使用

卸载 `ripgrep` 包：

```bash
cargo uninstall ripgrep
```

### 18. `cargo metadata`：查看项目元数据

#### 介绍

`cargo metadata` 命令用于查看项目的元数据。它会输出项目的依赖关系、目标信息等。

#### 命令格式

```bash
cargo metadata
```

#### 原理剖析

`cargo metadata` 会解析 `Cargo.toml` 文件，并输出项目的元数据信息。输出的信息包括项目的依赖关系、目标信息等。

#### 实战使用

查看项目元数据：

```bash
cargo metadata
```

输出：

```json
{
  "packages": [
    {
      "name": "my_project",
      "version": "0.1.0",
      "id": "my_project 0.1.0 (path+file:///path/to/my_project)",
      "license": null,
      "license_file": null,
      "description": null,
      "source": null,
      "dependencies": [],
      "targets": [
        {
          "kind": ["bin"],
          "crate_types": ["bin"],
          "name": "my_project",
          "src_path": "/path/to/my_project/src/main.rs",
          "edition": "2021",
          "doctest": false
        }
      ],
      "features": {},
      "manifest_path": "/path/to/my_project/Cargo.toml",
      "metadata": null,
      "publish": null,
      "authors": [],
      "categories": [],
      "keywords": [],
      "readme": null,
      "repository": null,
      "edition": "2021",
      "links": null
    }
  ],
  "workspace_members": ["my_project 0.1.0 (path+file:///path/to/my_project)"],
  "resolve": {
    "nodes": [
      {
        "id": "my_project 0.1.0 (path+file:///path/to/my_project)",
        "dependencies": [],
        "deps": [],
        "features": []
      }
    ],
    "root": "my_project 0.1.0 (path+file:///path/to/my_project)"
  },
  "target_directory": "/path/to/my_project/target",
  "version": 1,
  "workspace_root": "/path/to/my_project"
}
```

### 19. `cargo tree`：查看依赖树

#### 介绍

`cargo tree` 命令用于查看项目的依赖树。它会输出项目的依赖关系图。

#### 命令格式

```bash
cargo tree
```

#### 原理剖析

`cargo tree` 会解析 `Cargo.toml` 文件中的依赖项，并输出项目的依赖关系图。输出的信息包括每个依赖项的版本和路径。

#### 实战使用

查看项目依赖树：

```bash
cargo tree
```

输出：

```
my_project v0.1.0 (/path/to/my_project)
```

### 20. `cargo vendor`：生成依赖项的本地副本

#### 介绍

`cargo vendor` 命令用于生成项目依赖项的本地副本。它会下载所有依赖项，并将其放在 `vendor` 目录中。

#### 命令格式

```bash
cargo vendor
```

#### 原理剖析

`cargo vendor` 会解析 `Cargo.toml` 文件中的依赖项，并下载所有依赖项。下载的依赖项会放在 `vendor` 目录中。

#### 实战使用

生成依赖项的本地副本：

```bash
cargo vendor
```

**生成的目录结构：**

```
my_project/
├── Cargo.lock
├── Cargo.toml
├── src
│   └── main.rs
└── vendor
    └── ...
```
