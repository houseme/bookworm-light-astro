---
title: "Askama 模板秒编译：Jinja 语法，零成本渲染，Rust 类型安全兜底"
description: "编译时生成 Rust 代码，模板继承 + 宏 + 过滤器全支持，运行无反射，性能直追手写字符串拼接，unsafe 零出现，Web 页面渲染一键起飞。"
date: 2025-12-15T12:42:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-eberhardgross-4067967.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","Askama","模板引擎","Jinja语法","类型安全","编译时渲染","性能优化","Web开发","服务器端渲染"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","Askama","模板引擎","Jinja语法","类型安全","编译时渲染","性能优化","Web开发","服务器端渲染","Jinja","web框架集成","HTML渲染","文本模板","宏支持","过滤器扩展","白空间控制","HTML转义","模板继承","性能基准","类型系统","Rust模板引擎","Cargo","html"]
keywords: "rust,实战指南,Rust 生态,Askama,模板引擎,Jinja语法,类型安全,编译时渲染,性能优化,Web开发,服务器端渲染"
draft: false
---

# Askama 介绍

Askama 是一个基于 Jinja 的模板渲染引擎，它在编译时从用户定义的结构体中生成类型安全的 Rust 代码，用于持有模板的上下文。它通过 Rust 的类型系统确保类型安全，模板被编译进 crate 中，以实现最佳性能。Askama 支持熟悉的 Jinja-like 语法，包括模板继承、循环、条件判断、宏、变量（不可变）、内置和自定义过滤器、白空间控制、可选的 HTML 转义，以及语法自定义。

主要特性包括：
- 类型安全：通过 Rust 类型系统避免运行时错误。
- 性能优化：模板在编译时转换为 Rust 代码。
- UTF-8 验证：确保模板和输出是有效的 UTF-8。
- 调试支持：便于模板开发。
- 与 Rust 生态兼容：可集成多种 web 框架。

Askama 适用于生成 HTML、文本或其他基于文本的格式，尤其适合 web 应用中的服务器端渲染。

# 安装和配置

## 安装

在你的 Rust 项目中，将 Askama 添加到 `Cargo.toml` 的 `[dependencies]` 部分：

```toml
[dependencies]
askama = "0.12"  # 或最新版本，例如 0.14
```

运行 `cargo build` 来安装依赖。

如果需要与 web 框架集成，使用 `askama_web` crate：

```toml
[dependencies]
askama_web = { version = "0.14", features = ["axum-0.8"] }  # 根据框架选择特征
```

## 配置

配置通过 crate 根目录下的 `askama.toml` 文件进行。该文件控制模板目录、白空间处理、自定义语法和转义器。

默认配置示例：

```toml
[general]
dirs = ["templates"]  # 模板目录，相对 crate 根目录
whitespace = "preserve"  # 默认保留白空间
```

### 白空间控制配置

- `preserve`：默认，保留所有白空间，除非使用 `-` 标记抑制。
- `suppress`：默认抑制白空间，使用 `+` 保留。
- `minimize`：最小化白空间（保留一个字符，如换行），使用 `~` 控制。

可在模板结构体上覆盖：

```rust
#[derive(Template)]
#[template(whitespace = "suppress")]
struct MyTemplate;
```

### 自定义语法

在 `[[syntax]]` 部分定义：

```toml
[[syntax]]
name = "custom"
block_start = "%{"
block_end = "}%"
comment_start = "#{"
comment_end = "#}"
expr_start = "{{"
expr_end = "}}"
```

使用 `default_syntax = "custom"` 设置全局默认。

### 转义器

在 `[[escaper]]` 部分定义：

```toml
[[escaper]]
path = "askama::filters::Text"  # 无转义
extensions = ["txt", "md"]
```

默认转义基于文件扩展名（如 `.html` 使用 HTML 转义）。

最佳配置实践：使用 `askama.toml` 集中管理，避免每个模板单独设置。针对生产环境，选择 `whitespace = "minimize"` 以优化输出大小。

# 基本使用

Askama 的核心是定义一个持有上下文的结构体，派生 `Template` trait，并在编译时生成渲染代码。

## 简单示例

1. 在 crate 根目录创建 `templates` 目录，并添加 `hello.html`：

```html
Hello, {{ name }}!
```

2. 在 Rust 代码中定义上下文结构体：

```rust
use askama::Template;

#[derive(Template)]
#[template(path = "hello.html")]
struct HelloTemplate<'a> {
    name: &'a str,
}

fn main() {
    let hello = HelloTemplate { name: "world" };
    let output = hello.render().unwrap();
    println!("{}", output);  // 输出：Hello, world!
}
```

理论：Askama 在编译时解析模板，生成 `render` 方法的实现。该方法使用结构体的字段填充模板变量，确保类型匹配。如果类型不匹配，编译失败，实现类型安全。

渲染过程：调用 `render()` 返回 `Result<String, Error>`，处理任何运行时错误（如文件读取失败）。

# 模板语法

Askama 的语法类似于 Jinja，支持表达式、注释、白空间控制和块语句。

## 表达式

使用 `{{ expr }}` 输出值，支持 Rust 操作符（如 `+`, `-`, `*`）、方法调用和类型转换。

示例：

```html
{{ 3 * 4 / 2 }}  <!-- 输出：6 -->
{{ (4 + 5) % 3 }}  <!-- 输出：0 -->
{{ name|upper }}  <!-- 如果 name = "askama"，输出：ASKAMA -->
```

字符串连接：`{{ a ~ " " ~ b }}`。

位运算符重命名：`bitand`、`bitor`、`xor`。

HTML 特殊字符默认转义，除非使用 `|safe`。

## 注释

使用 `{# comment #}`，支持嵌套。

示例：

```html
{# 这是一个注释 #}
{#
  多行注释
  {# 嵌套注释 #}
#}
```

## 白空间控制

默认保留白空间，使用 `-`、`+`、`~` 控制：

- `-`：抑制白空间。
- `+`：保留白空间。
- `~`：最小化白空间。

示例：

```html
{%- if foo -%}  <!-- 抑制周围白空间 -->
  {{ bar }}
{% endif %}
```

## 块语句

### if / else

```html
{% if users.len() == 0 %}
  No users
{% else if users.len() == 1 %}
  1 user
{% else %}
  {{ users.len() }} users
{% endif %}
```

支持 `if let`：

```html
{% if let Some(user) = user %}
  {{ user.name }}
{% else %}
  No user
{% endif %}
```

检查变量定义：`{% if x is defined %}`。

### match

用于枚举或 Option：

```html
{% match item %}
  {% when Some with ("foo") %} Found literal foo
  {% when Some with (val) %} Found {{ val }}
  {% when None %} None
  {% else %} Other
{% endmatch %}
```

支持多模式：`{% when 1 | 4 %}`。

### for

```html
{% for user in users %}
  <li>{{ user.name }}</li>
{% endfor %}
```

循环变量：`loop.index` (从 1 开始)、`loop.index0` (从 0)、`loop.first`、`loop.last`。

### let 赋值

```html
{% let name = user.name %}
{{ name.len() }}
```

支持阴影和复杂表达式。

# 上下文定义

上下文是持有模板变量的结构体或枚举。字段必须匹配模板变量，类型必须兼容（不可变）。

## 定义结构体

```rust
#[derive(Template)]
#[template(path = "footer.html", escape = "html")]
struct Footer {
    year: u32,
    title: String,
}
```

属性选项：
- `path`：模板文件路径（相对 dirs）。
- `source`：内联模板字符串。
- `ext`：扩展名（影响转义）。
- `escape`：转义模式 ("html"、"none")。
- `print`：打印模式 ("all"、"code"、"none") 用于调试。
- `whitespace`：白空间设置。

对于枚举：

```rust
#[derive(Template)]
#[template(path = "variant.html")]
enum Variant {
    A { field: String },
    B,
}
```

渲染：实例化结构体，调用 `render()` 或 `to_string()`。

高级：使用 `render_with_values()` 注入运行时值。

# 过滤器

过滤器使用 `|` 应用，支持链式。

## 内置过滤器

- `capitalize`：首字母大写。
- `lower` / `upper`：转小/大写。
- `escape` / `e`：HTML 转义。
- `safe`：标记安全（无转义）。
- `join`：连接迭代器。
- `trim`：去除白空间。
- `format`：格式化字符串。
- 更多见表格（例如 `pluralize`、`truncate`、`urlencode`）。

示例：

```html
{{ "hello" | upper | trim }}  <!-- HELLO -->
{{ array | join(", ") }}  <!-- foo, bar -->
```

## 自定义过滤器

在 `filters` 模块定义：

```rust
mod filters {
    use askama::Result;

    pub fn custom<T: std::fmt::Display>(value: &T) -> Result<String> {
        Ok(value.to_string().replace("a", "A"))
    }
}
```

使用：`{{ text | custom }}`。

# 模板继承和宏

## 继承

基模板 (`base.html`)：

```html
<html>
  <title>{% block title %}Default{% endblock %}</title>
  <body>{% block content %}{% endblock %}</body>
</html>
```

子模板：

```html
{% extends "base.html" %}
{% block title %}My Page{% endblock %}
{% block content %}
  <p>Hello</p>
  {% call super() %}  <!-- 调用父块内容 -->
{% endblock %}
```

## include

```html
{% include "header.html" %}
```

路径必须是字符串字面量。

## 宏

定义：

```html
{% macro heading(text) %}
  <h1>{{ text }}</h1>
{% endmacro %}
```

调用：

```html
{% call heading("Title") %}
```

导入：

```html
{% import "macros.html" as macros %}
{% call macros::heading("Title") %}
```

# 与 Web 框架集成

使用 `askama_web` 提供响应 trait 实现。

## Axum 示例

依赖：

```toml
askama = "0.14"
askama_web = { version = "0.14", features = ["axum-0.8"] }
axum = "0.8"
```

代码：

```rust
use askama::Template;
use askama_web::WebTemplate;
use axum::{Router, routing::get};

#[derive(Template, WebTemplate)]
#[template(path = "hello.html")]
struct Hello { name: String }

async fn hello_handler() -> Hello {
    Hello { name: "world".to_string() }
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(hello_handler));
    axum::Server::bind(&"0.0.0.0:3000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

类似地，对于 Rocket、Actix 等，启用相应特征并派生 `WebTemplate`。

理论：`WebTemplate` 实现框架的响应 trait，将模板渲染为 HTTP 响应，设置 Content-Type 为 text/html。

# 最佳实践

- **类型安全优先**：使用 match 和 if let 利用 Rust 类型检查。
- **性能优化**：避免运行时解析，使用编译时生成。
- **安全**：默认启用 HTML 转义，仅对可信内容使用 |safe。
- **白空间管理**：全局设置 minimize，使用 ~ 细粒度控制。
- **模块化**：使用继承、include 和宏重用代码。
- **调试**：设置 print = "all" 查看生成代码。
- **集成**：使用 askama_web 简化 web 响应。
- **自定义**：为特定格式定义转义器，避免手动 escape。
- **测试**：编写单元测试渲染输出。
- 高效使用：保持上下文结构体简单，避免复杂逻辑移到 Rust 代码中。

# 实战示例

## 项目设置

创建一个简单 web 应用，使用 Axum 和 Askama 渲染用户列表。

1. `Cargo.toml`：

```toml
[package]
name = "askama-demo"
version = "0.1.0"
edition = "2021"

[dependencies]
askama = "0.12"
askama_web = { version = "0.12", features = ["axum-0.6"] }  # 调整版本
axum = "0.6"
tokio = { version = "1", features = ["full"] }
serde = "1"
```

2. 创建 `templates/base.html`：

```html
<!DOCTYPE html>
<html>
<head>
    <title>{% block title %}Askama Demo{% endblock %}</title>
</head>
<body>
    {% block content %}{% endblock %}
</body>
</html>
```

3. 创建 `templates/users.html`：

```html
{% extends "base.html" %}
{% block title %}Users List{% endblock %}
{% block content %}
    <h1>Users</h1>
    <ul>
    {% for user in users %}
        <li>{{ user.name|capitalize }} (Age: {{ user.age }})</li>
    {% endfor %}
    </ul>
    {% if users.len() == 0 %}
        <p>No users found.</p>
    {% else %}
        <p>Total: {{ users.len() }} users.</p>
    {% endif %}
{% endblock %}
```

4. `src/main.rs`：

```rust
use askama::Template;
use askama_web::WebTemplate;
use axum::{Router, routing::get, Server};
use std::net::SocketAddr;

#[derive(Template, WebTemplate)]
#[template(path = "users.html")]
struct UsersTemplate {
    users: Vec<User>,
}

struct User {
    name: String,
    age: u32,
}

async fn users_handler() -> UsersTemplate {
    let users = vec![
        User { name: "alice".to_string(), age: 30 },
        User { name: "bob".to_string(), age: 25 },
    ];
    UsersTemplate { users }
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/users", get(users_handler));
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

运行 `cargo run`，访问 http://localhost:3000/users 查看渲染页面。

说明：这个示例展示了继承、循环、条件、过滤器。扩展时，可添加宏或自定义过滤器。

# 参考资料

- 官方 GitHub: https://github.com/askama-rs/askama
- 文档：https://askama.readthedocs.io/
- API 文档：https://docs.rs/askama
- 在线 playground: https://askama-rs.github.io/askama_playground/
- Web 集成：https://github.com/askama-rs/askama_web
- 模板语法详情：https://askama.readthedocs.io/en/latest/template_syntax.html
