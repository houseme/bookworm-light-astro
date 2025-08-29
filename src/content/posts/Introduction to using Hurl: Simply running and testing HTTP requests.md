---
title: "Hurl 使用介绍：简单运行和测试 HTTP 请求"
description: "Hurl 是一个基于命令行的 HTTP 请求工具，旨在简化 HTTP 请求的发送和调试过程。它支持多种 HTTP 方法（如 GET、POST、PUT、DELETE 等），并且可以通过简单的文本文件来定义请求，使得测试和调试变得更加直观和高效。"
date: 2024-09-26T06:00:00Z
image: "https://static-rs.bifuba.com/images/posts/frida-aguilar-estrada-sMV0Rv4UKKY-unsplash.jpg"
categories: ["hurl", "http request", "http tool", "command line tool","实战工具"]
authors: ["houseme"]
tags: ["hurl", "http request", "http tool", "command line tool", "curl alternative", "httpie alternative", "http client", "http debugging", "http testing", "http tooling"]
keywords: "hurl, http request, http tool, command line tool, curl alternative, httpie alternative, http client, http debugging, http testing, http tooling"
draft: false
---

在现代软件开发中，HTTP 请求是不可或缺的一部分。无论是与 API 交互、测试 Web 服务，还是进行性能测试，发送和调试 HTTP 请求都是开发者日常工作中的重要任务。然而，传统的工具如 cURL 虽然功能强大，但命令行参数复杂，对于新手来说可能不太友好。今天，我们将介绍一个简单易用的命令行工具——Hurl，它可以帮助你轻松地发送和调试 HTTP 请求。

## 什么是 Hurl？

Hurl 是一个基于命令行的 HTTP 请求工具，旨在简化 HTTP 请求的发送和调试过程。它支持多种 HTTP 方法（如 GET、POST、PUT、DELETE 等），并且可以通过简单的文本文件来定义请求，使得测试和调试变得更加直观和高效。

Hurl 的设计理念是“简单即美”，它不需要复杂的配置或繁琐的命令行参数，只需几行文本即可完成一个 HTTP 请求的定义。此外，Hurl 还支持多种输出格式，方便你将请求结果导出为 JSON、HTML 或其他格式。

## 安装 Hurl

Hurl 是一个跨平台的工具，支持 Windows、macOS 和 Linux。你可以通过以下几种方式安装 Hurl：

### 1. 使用 Homebrew（macOS/Linux）

如果你使用的是 macOS 或 Linux，可以通过 Homebrew 来安装 Hurl：

```bash
brew install hurl
```

### 2. 使用 Scoop（Windows）

如果你使用的是 Windows，可以通过 Scoop 来安装 Hurl：

```powershell
scoop install hurl
```

### 3. 从 GitHub 下载

你也可以直接从 Hurl 的 GitHub 仓库下载预编译的二进制文件：

```bash
wget https://github.com/Orange-OpenSource/hurl/releases/latest/download/hurl-<version>-<platform>.tar.gz
tar -xzf hurl-<version>-<platform>.tar.gz
```

## 使用 Hurl 发送 HTTP 请求

Hurl 的使用非常简单，你只需要编写一个简单的文本文件，定义你的 HTTP 请求，然后使用 `hurl` 命令来执行它。

### 1. 创建 Hurl 文件

首先，创建一个名为 `request.hurl` 的文件，并在其中定义你的 HTTP 请求。例如，假设你想向 `https://jsonplaceholder.typicode.com/posts` 发送一个 GET 请求：

```hurl
GET https://jsonplaceholder.typicode.com/posts
```

### 2. 执行 Hurl 文件

接下来，使用 `hurl` 命令来执行这个文件：

```bash
hurl request.hurl
```

Hurl 会自动解析文件中的请求，并将其发送到指定的 URL。你将在终端中看到请求的结果。

### 3. 添加请求头和参数

Hurl 支持在请求中添加请求头和查询参数。例如，如果你想在 GET 请求中添加一个 `Authorization` 头和一个查询参数 `userId`，可以这样写：

```hurl
GET https://jsonplaceholder.typicode.com/posts?userId=1
Authorization: Bearer your_token_here
```

### 4. 发送 POST 请求

Hurl 也支持发送 POST 请求。你可以在请求中定义请求体，并指定内容类型。例如，发送一个 JSON 格式的 POST 请求：

```hurl
POST https://jsonplaceholder.typicode.com/posts
Content-Type: application/json

{
  "title": "foo",
  "body": "bar",
  "userId": 1
}
```

### 5. 处理响应

Hurl 不仅可以发送请求，还可以处理响应。你可以在 Hurl 文件中定义期望的响应状态码、响应头或响应体。例如，检查响应状态码是否为 200：

```hurl
GET https://jsonplaceholder.typicode.com/posts

HTTP/1.1 200
```

如果响应状态码不是 200，Hurl 会抛出一个错误。

## 实战案例：测试 RESTful API

假设你正在开发一个 RESTful API，并希望对其进行测试。你可以使用 Hurl 来编写测试用例，并自动化测试过程。

### 1. 创建测试用例

首先，创建一个名为 `test_api.hurl` 的文件，并在其中定义你的测试用例。例如，测试一个 POST 请求是否成功创建资源：

```hurl
POST https://your-api.com/posts
Content-Type: application/json

{
  "title": "Test Post",
  "body": "This is a test post",
  "userId": 1
}

HTTP/1.1 201
Location: https://your-api.com/posts/1
```

### 2. 执行测试用例

使用 `hurl` 命令来执行测试用例：

```bash
hurl test_api.hurl
```

如果 API 返回的状态码是 201，并且响应头中包含 `Location` 字段，Hurl 将认为测试通过。否则，Hurl 会抛出一个错误，并显示详细的错误信息。

### 3. 自动化测试

你可以将 Hurl 集成到你的 CI/CD 管道中，自动化测试过程。例如，在 GitHub Actions 中运行 Hurl 测试：

```yaml
name: Run Hurl Tests

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Install Hurl
        run: |
          sudo apt-get update
          sudo apt-get install -y hurl

      - name: Run Hurl Tests
        run: hurl test_api.hurl
```

## 总结

Hurl 是一个简单易用的命令行工具，适用于发送和调试 HTTP 请求。它不仅简化了 HTTP 请求的定义和执行过程，还提供了强大的测试功能，帮助你轻松地测试 RESTful API。无论你是新手还是经验丰富的开发者，Hurl 都能让你的 HTTP 请求工作变得更加高效和愉快。

现在就试试 Hurl，体验它带来的便利吧！
