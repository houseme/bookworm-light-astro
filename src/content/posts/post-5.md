---
title: "Rust 入门篇：流程控制 - Control Flow"
description: "在任何编程语言中，流程控制是至关重要的。它允许我们根据不同条件执行不同的代码块，或者重复执行特定的代码片段。Rust 提供了强大而灵活的流程控制机制，包括条件语句、循环和模式匹配。本教程将深入剖析 Rust 中的流程控制，提供详细的概念讲解和实战指南。"
date: 2022-04-05T16:56:47+06:00
image: "https://static-rs.bifuba.com/images/posts/05.jpg"
draft: false
authors: ["houseme"]
tags: ["rust", "Control Flow", "Rust 入门", "Rust 编程", "Rust 流程控制", "Rust 条件语句", "Rust 循环", "Rust 模式匹配"]
keywords: "rust,Control Flow,Rust 入门，Rust 编程，Rust 流程控制，Rust 条件语句，Rust 循环，Rust 模式匹配"
categories: ["rust guide","Rust 入门"]
---

在任何编程语言中，流程控制是至关重要的。它允许我们根据不同条件执行不同的代码块，或者重复执行特定的代码片段。Rust 提供了强大而灵活的流程控制机制，包括条件语句、循环和模式匹配。本教程将深入剖析 Rust 中的流程控制，提供详细的概念讲解和实战指南。

### 条件语句

条件语句允许根据条件的真假执行不同的代码块。Rust 中的条件语句由`if`、`else if`和`else`关键字构成。

#### 基本语法：

```rust
if condition {
    // code block if condition is true
} else if another_condition {
    // code block if another_condition is true
} else {
    // code block if all conditions are false
}
```

#### 示例：

```rust
fn main() {
    let num = 5;

    if num > 0 {
        println!("{} is positive", num);
    } else if num < 0 {
        println!("{} is negative", num);
    } else {
        println!("{} is zero", num);
    }
}
```

#### 实战指南：

- 编写一个函数，根据给定的年龄参数输出相应的年龄阶段（如“儿童”、“青少年”、“成年人”）。

### 循环

循环允许我们重复执行特定的代码块，直到满足退出条件。Rust 提供了几种类型的循环：`loop`、`while`和`for`。

#### `loop` 循环

`loop`循环会无限地执行代码块，直到遇到显式的`break`语句。

##### 示例：

```rust
fn main() {
    let mut count = 0;

    loop {
        println!("Count: {}", count);
        count += 1;
        if count == 5 {
            break;
        }
    }
}
```

#### `while` 循环

`while`循环会在条件为真时重复执行代码块。

##### 示例：

```rust
fn main() {
    let mut num = 3;

    while num > 0 {
        println!("Countdown: {}", num);
        num -= 1;
    }

    println!("Liftoff!");
}
```

#### `for` 循环

`for`循环用于迭代集合或指定范围内的元素。

##### 示例：

```rust
fn main() {
    let arr = [10, 20, 30, 40, 50];

    for element in arr.iter() {
        println!("Element: {}", element);
    }
}
```

#### 实战指南：

- 使用循环计算斐波那契数列的前 n 个数字并打印出来。

### 模式匹配

模式匹配是一种强大的特性，允许根据数据的结构匹配和操作数据。在 Rust 中，模式匹配通常与`match`表达式一起使用。

#### 基本语法：

```rust
match expression {
    pattern1 => {
        // code block if expression matches pattern1
    }
    pattern2 => {
        // code block if expression matches pattern2
    }
    _ => {
        // code block if no patterns match
    }
}
```

#### 示例：

```rust
fn main() {
    let number = 7;

    match number {
        1 => println!("One"),
        2 | 3 | 5 | 7 | 11 => println!("Prime"),
        10..=20 => println!("Between 10 and 20"),
        _ => println!("Other"),
    }
}
```

#### 实战指南：

- 编写一个函数，接收一个数字参数，并返回该数字是奇数还是偶数。

### 结语

流程控制是编程中的基础之一，对于编写清晰、高效的代码至关重要。Rust 提供了强大而灵活的流程控制机制，包括条件语句、循环和模式匹配。通过深入学习和实践，你将能够熟练运用这些技术来解决各种问题。

希望本教程能够帮助你理解 Rust 中的流程控制，并为你的学习和开发之路提供支持和指导。
