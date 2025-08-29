---
title: "Rust 入门篇：开发环境搭建 - Setting up Dev Environment"
description: "Rust 是一种快速、安全、并发的系统编程语言，具有强大的类型系统和内存安全性。在本教程中，我们将介绍如何搭建 Rust 的开发环境，以便开始编写和运行 Rust 程序。"
date: 2022-04-01T05:00:00Z
image: "https://static-rs.bifuba.com/images/posts/01.jpg"
categories: ["rust guide", "dev", "Environment", "setting up","rust 入门篇","rust programming","rust development"]
authors: ["houseme"]
tags: ["dev", "Environment", "setting up", "rust programming", "rust development"]
keywords: "rust,dev,Environment,setting up,rust programming,rust development"
draft: false
---

Rust 是一种快速、安全、并发的系统编程语言，具有强大的类型系统和内存安全性。在本教程中，我们将介绍如何搭建 Rust 的开发环境，以便开始编写和运行 Rust 程序。

### 步骤 1：安装 Rust

首先，我们需要安装 Rust 编程语言的工具链。Rust 的官方工具链包含了 Rust 编译器（rustc）和包管理器（Cargo）。它们可以一起安装，因此只需执行一个命令即可。

在终端中运行以下命令（适用于 Unix 系统，如 Linux 和 macOS）：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

或者，如果您使用的是 Windows 系统，请访问[Rust 官方网站](https://www.rust-lang.org/tools/install)下载安装程序并按照指示进行安装。

### 步骤 2：验证安装

安装完成后，可以通过以下命令验证 Rust 是否正确安装：

```bash
rustc --version
cargo --version
```

这将分别输出 Rust 编译器和 Cargo 包管理器的版本信息，确认安装成功。

### 步骤 3：创建并运行一个简单的 Rust 程序

现在让我们创建一个简单的 Rust 程序并运行它。

1. 打开您最喜欢的文本编辑器，创建一个新文件，命名为`hello.rs`。

2. 在文件中输入以下代码：

```rust
fn main() {
    println!("Hello, world!");
}
```

3. 保存文件。

4. 在终端中，导航到保存`hello.rs`文件的目录。

5. 运行以下命令来编译并执行程序：

```bash
rustc hello.rs
./hello
```

你应该会在终端中看到输出`Hello, world!`。

### 步骤 4：使用 Cargo 创建项目

Cargo 是 Rust 的官方包管理器，它使得创建、构建和管理 Rust 项目变得更加简单。我们将使用 Cargo 来创建一个新的 Rust 项目。

1. 在终端中，导航到您选择的项目目录。

2. 运行以下命令来创建一个新的 Rust 项目：

```bash
cargo new my_project
```

这将创建一个名为`my_project`的新目录，并在其中初始化一个新的 Rust 项目。

3. 进入新创建的项目目录：

```bash
cd my_project
```

4. 在项目目录中，您将找到一个名为`Cargo.toml`的文件，它是项目的元数据文件，类似于其他语言中的`package.json`或`requirements.txt`文件。

5. 在终端中运行以下命令来构建并运行项目：

```bash
cargo run
```

这将编译并运行项目中的默认程序（位于`src/main.rs`中）。

现在，您已经成功搭建了 Rust 的开发环境，并且可以开始编写和运行 Rust 程序了！

---

这就是关于如何设置 Rust 开发环境的简单教程。希望这能帮助您顺利开始使用 Rust 编程。祝您编程愉快！
