---
title: "Rust 入门篇：数据类型 - Data Types"
description: "Rust 是一种系统级编程语言，具有静态类型系统，能够提供内存安全性和并发安全性，同时保持高性能。了解 Rust 的数据类型是学习该语言的重要一步。本教程将深入探讨 Rust 的数据类型，以及如何在实际项目中应用它们。"
date: 2022-04-04T16:56:47+06:00
image: "https://static-rs.bifuba.com/images/posts/04.jpg"
draft: false
authors: ["houseme"]
tags: ["rust", "Data Types", "Rust 入门", "Rust 编程", "Rust 数据类型"]
keywords: "rust,Data Types,Rust 入门，Rust 编程，Rust 数据类型"
categories: ["rust guide", "Rust 入门"]
---

Rust 是一种系统级编程语言，具有静态类型系统，能够提供内存安全性和并发安全性，同时保持高性能。了解 Rust 的数据类型是学习该语言的重要一步。本教程将深入探讨 Rust 的数据类型，以及如何在实际项目中应用它们。

## 数据类型的分类

Rust 的数据类型主要分为两大类：标量类型（Scalar Types）和复合类型（Compound Types）。

### 1. 标量类型（Scalar Types）

标量类型代表单个值。Rust 的标量类型包括：

- 整数类型（Integer Types）：表示整数值，如`i32`、`u64`等。
- 浮点数类型（Floating-Point Types）：表示带有小数部分的数字，如`f32`、`f64`。
- 布尔类型（Boolean Type）：表示逻辑值，只能是`true`或`false`。
- 字符类型（Character Type）：表示单个 Unicode 字符，如`char`。

### 2. 复合类型（Compound Types）

复合类型允许你将多个值组合成一个类型。Rust 的复合类型包括：

- 元组类型（Tuple Type）：表示固定大小的有序列表，每个元素可以有不同的类型。
- 数组类型（Array Type）：表示固定大小的相同类型的值的集合。

## 标量类型详解

### 1. 整数类型（Integer Types）

Rust 提供了有符号和无符号的整数类型，分别表示正负值和非负值。以下是常见的整数类型及其取值范围：

- `i8`: -128 到 127
- `i16`: -32,768 到 32,767
- `i32`: -2,147,483,648 到 2,147,483,647
- `i64`: -9,223,372,036,854,775,808 到 9,223,372,036,854,775,807
- `u8`: 0 到 255
- `u16`: 0 到 65,535
- `u32`: 0 到 4,294,967,295
- `u64`: 0 到 18,446,744,073,709,551,615

```rust
fn main() {
    let a: i32 = 42;
    let b: u8 = 255;
    println!("Integer: {}", a);
    println!("Unsigned Integer: {}", b);
}
```

### 2. 浮点数类型（Floating-Point Types）

Rust 提供了两种浮点数类型：`f32`和`f64`，分别对应单精度和双精度浮点数。

```rust
fn main() {
    let c: f32 = 3.14;
    let d: f64 = 6.28;
    println!("Float: {}", c);
    println!("Double: {}", d);
}
```

### 3. 布尔类型（Boolean Type）

布尔类型只有两个可能的值：`true`和`false`。

```rust
fn main() {
    let e: bool = true;
    let f: bool = false;
    println!("Boolean: {}", e);
    println!("Boolean: {}", f);
}
```

### 4. 字符类型（Character Type）

字符类型表示 Unicode 字符，用单引号`'`包裹。

```rust
fn main() {
    let g: char = 'A';
    println!("Character: {}", g);
}
```

## 复合类型详解

### 1. 元组类型（Tuple Type）

元组是固定大小的有序列表，每个元素可以有不同的类型。

```rust
fn main() {
    let tuple: (i32, f64, char) = (42, 3.14, 'A');
    println!("Tuple: {:?}", tuple);
}
```

### 2. 数组类型（Array Type）

数组是固定大小的相同类型的值的集合。

```rust
fn main() {
    let array: [i32; 3] = [1, 2, 3];
    println!("Array: {:?}", array);
}
```

## 自定义数据类型

### 1. 结构体类型（Struct Type）

结构体允许将不同类型的值组合成一个单独的类型。

#### 实战指南：

```rust
struct Person {
    name: String,
    age: i32,
}

fn main() {
    let person1 = Person {
        name: String::from("Alice"),
        age: 30,
    };

    println!("Name: {}", person1.name);
    println!("Age: {}", person1.age);
}
```

### 2. 枚举类型（Enum Type）

枚举类型允许创建一个类型，它的值来自于一个有限的集合。

#### 实战指南：

```rust
enum TrafficLight {
    Red,
    Green,
    Yellow,
}

fn main() {
    let current_light = TrafficLight::Red;

    match current_light {
        TrafficLight::Red => println!("Stop!"),
        TrafficLight::Green => println!("Go!"),
        TrafficLight::Yellow => println!("Caution!"),
    }
}
```

## 实战指南

### 示例 1：计算圆的面积

```rust
fn main() {
    const PI: f64 = 3.14159;
    let radius: f64 = 2.0;
    let area = PI * radius * radius;
    println!("The area of the circle is: {}", area);
}
```

### 示例 2：交换两个变量的值

```rust
fn main() {
    let mut a: i32 = 5;
    let mut b: i32 = 10;
    println!("Before swap: a = {}, b = {}", a, b);
    let temp = a;
    a = b;
    b = temp;
    println!("After swap: a = {}, b = {}", a, b);
}
```

### 示例 3：使用元组和数组存储数据

```rust
fn main() {
    let person: (&str, i32, &str) = ("John", 30, "Developer");
    println!("Name: {}, Age: {}, Occupation: {}", person.0, person.1, person.2);

    let numbers: [i32; 5] = [1, 2, 3, 4, 5];
    println!("First number: {}", numbers[0]);
}
```

通过本教程和示例，你应该对 Rust 的数据类型有了更深入的了解，并且能够在实际项目中灵活运用它们。继续学习并探索 Rust 的丰富功能，以提高你的编程技能！
