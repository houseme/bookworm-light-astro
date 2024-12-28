---
title: "Rust 入门篇：基础语法 (Basic Syntax)"
description: "Rust 是一种系统级编程语言，它拥有内存安全、并发性和高性能等特点。在本教程中，我们将介绍 Rust 的基础语法，包括变量、数据类型、函数、控制流等内容，并提供代码示例以帮助您更好地理解。"
date: 2022-04-03T06:00:00+00:00
image: "https://static-rs.bifuba.com/images/posts/kenny-eliason-Hav7EXRbDoE-unsplash.jpg"
categories: ["rust guide"]
authors: ["houseme"]
tags: ["rust", "Basic Syntax"]
keywords: "rust,Basic Syntax,Rust 入门，Rust 编程，Rust 语法"
draft: false
---

Rust 是一种系统级编程语言，它拥有内存安全、并发性和高性能等特点。在本教程中，我们将介绍 Rust 的基础语法，包括变量、数据类型、函数、控制流等内容，并提供代码示例以帮助您更好地理解。

## 变量与数据类型

在 Rust 中，变量可以通过 `let` 关键字进行声明，而数据类型通常由编译器进行推断，但也可以显式指定。

```rust
fn main() {
    // 声明一个整数变量
    let num = 10;

    // 声明一个字符串变量
    let message = "Hello, Rust!";

    // 显式指定数据类型
    let float_num: f64 = 3.14;

    println!("Number: {}", num);
    println!("Message: {}", message);
    println!("Floating Point Number: {}", float_num);
}
```

## 函数

函数是 Rust 程序的基本构建块之一，可以使用 `fn` 关键字定义函数。

```rust
// 定义一个简单的函数，用于计算两个数的和
fn add(a: i32, b: i32) -> i32 {
    a + b // 返回值是最后一个表达式的结果，不需要使用 return 关键字
}

fn main() {
    let result = add(5, 3);
    println!("Result: {}", result); // 输出：Result: 8
}
```

## 控制流

Rust 支持常见的控制流结构，如条件表达式和循环。

```rust
fn main() {
    let num = 10;

    // 使用 if-else 表达式进行条件判断
    if num > 0 {
        println!("Positive");
    } else if num < 0 {
        println!("Negative");
    } else {
        println!("Zero");
    }

    // 使用循环打印数字
    for i in 1..=5 {
        println!("{}", i);
    }

    // 使用 match 表达式匹配值
    match num {
        1 => println!("One"),
        2 => println!("Two"),
        _ => println!("Other"),
    }
}
```

## 结论

通过本教程，您了解了 Rust 的基础语法，包括变量与数据类型、函数以及控制流。这些是您学习 Rust 编程语言的第一步。接下来，您可以继续学习 Rust 的更多高级特性和用法，探索其丰富的生态系统。

希望这个教程对您有所帮助，祝您学习愉快，编程顺利！
