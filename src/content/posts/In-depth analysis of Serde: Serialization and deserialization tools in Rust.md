---
title: "深入解析 Serde：Rust 中的序列化与反序列化利器"
description: "Serde 不仅提供了处理默认值的灵活性，还提供了多种序列化和反序列化选项，使得开发者能够根据具体需求定制数据处理流程。"
date: 2024-11-03T09:15:00Z
image: "https://static-rs.bifuba.com/images/posts/willian-justen-de-vasconcellos-wk3Pjf4MK7w-unsplash.jpg"
categories: ["rust", "serde", "serialization", "deserialization"]
authors: ["houseme"]
tags: ["rust", "serde", "serialization", "deserialization"]
keywords: "rust, serde, serialization, deserialization"
draft: false
---

## 引言

Serde 不仅提供了处理默认值的灵活性，还提供了多种序列化和反序列化选项，使得开发者能够根据具体需求定制数据处理流程。以下是 Serde 中一些重要的序列化和反序列化选项：

### 1. `#[serde(rename = "new_name")]`

- **作用**：在序列化和反序列化时，将字段名称重命名为指定的名称。
- **使用场景**：适用于需要与外部系统或 API 兼容的情况。
- **示例**：

```rust
#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(rename = "time_out")]
    timeout: u64,
}
```

在这个例子中，字段`timeout`在序列化和反序列化时会被重命名为`time_out`。

### 2. `#[serde(skip)]`

- **作用**：在序列化和反序列化时完全跳过该字段。
- **使用场景**：适用于不需要序列化或反序列化的字段。
- **示例**：

```rust
#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(skip)]
    debug_info: String,
}
```

在这个例子中，`debug_info`字段在序列化和反序列化时都会被跳过。

### 3. `#[serde(skip_serializing)]`

- **作用**：在序列化时跳过该字段。
- **使用场景**：适用于只需要反序列化而不需要序列化的字段。
- **示例**：

```rust
#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(skip_serializing)]
    password: String,
}
```

在这个例子中，`password`字段在序列化时会被跳过，但在反序列化时会被处理。

### 4. `#[serde(skip_deserializing)]`

- **作用**：在反序列化时跳过该字段。
- **使用场景**：适用于只需要序列化而不需要反序列化的字段。
- **示例**：

```rust
#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(skip_deserializing)]
    version: String,
}
```

在这个例子中，`version`字段在反序列化时会被跳过，但在序列化时会被处理。

### 5. `#[serde(flatten)]`

- **作用**：将嵌套的结构体或枚举展平到父结构体中。
- **使用场景**：适用于需要将嵌套结构体或枚举的字段直接展平到父结构体中的情况。
- **示例**：

```rust
#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(flatten)]
    settings: Settings,
}

#[derive(Serialize, Deserialize)]
struct Settings {
    timeout: u64,
    retries: u32,
}
```

在这个例子中，`settings`结构体的字段`timeout`和`retries`会被展平到`Config`结构体中。

### 6. `#[serde(with = "module")]`

- **作用**：指定一个模块，用于自定义字段的序列化和反序列化逻辑。
- **使用场景**：适用于需要复杂序列化和反序列化逻辑的情况。
- **示例**：

```rust
mod custom_serde {
    use serde::{Serialize, Deserialize, Serializer, Deserializer};

    pub fn serialize<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&value.to_string())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<u64, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        s.parse::<u64>().map_err(serde::de::Error::custom)
    }
}

#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(with = "custom_serde")]
    timeout: u64,
}
```

在这个例子中，`timeout`字段的序列化和反序列化逻辑被自定义模块`custom_serde`处理。

### 7. `#[serde(tag = "type")]` 和 `#[serde(untagged)]`

- **作用**：用于处理枚举类型的序列化和反序列化。
- **使用场景**：适用于需要区分不同枚举变体的情况。
- **示例**：

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
enum Message {
    Text { content: String },
    Image { url: String },
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum Response {
    Success(String),
    Error(String),
}
```

在这个例子中，`Message`枚举使用`tag`属性来区分不同的变体，而`Response`枚举使用`untagged`属性来直接序列化和反序列化变体。

### 8. Serde 库处理默认值的属性

Serde 是一个用于序列化和反序列化数据的 Rust 库，广泛应用于处理 JSON、YAML、TOML 等数据格式。在处理默认值方面，Serde 提供了多种灵活的属性，使得开发者能够轻松地定义和使用默认值。以下是 Serde 库中处理默认值的主要属性：

#### 1. `#[serde(default)]`

- **作用**：当反序列化时，如果某个字段在输入数据中缺失，Serde 会使用该字段的默认值。
- **使用场景**：适用于所有类型的字段，包括基本类型、结构体、枚举等。
- **示例**：

```rust
#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(default)]
    timeout: u64,
}
```

在这个例子中，如果 JSON 数据中没有`timeout`字段，Serde 会使用`u64`类型的默认值`0`。

#### 2. `#[serde(default = "path")]`

- **作用**：指定一个函数路径，当字段缺失时，Serde 会调用该函数来获取默认值。
- **使用场景**：适用于需要自定义默认值的情况。
- **示例**：

```rust
fn default_timeout() -> u64 {
    30
}

#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(default = "default_timeout")]
    timeout: u64,
}
```

在这个例子中，如果 JSON 数据中没有`timeout`字段，Serde 会调用`default_timeout`函数，返回`30`作为默认值。

#### 3. `#[serde(skip_serializing_if = "path")]`

- **作用**：指定一个函数路径，当该函数返回`true`时，Serde 会跳过该字段的序列化。
- **使用场景**：适用于在序列化时根据条件跳过某些字段。
- **示例**：

```rust
fn is_default<T: Default + PartialEq>(t: &T) -> bool {
    t == &T::default()
}

#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(skip_serializing_if = "is_default")]
    timeout: u64,
}
```

在这个例子中，如果`timeout`字段的值等于`u64`的默认值`0`，Serde 会在序列化时跳过该字段。

#### 4. `#[serde(deserialize_with = "path")]`

- **作用**：指定一个函数路径，用于自定义字段的反序列化逻辑。
- **使用场景**：适用于需要复杂反序列化逻辑的情况。
- **示例**：

```rust
fn deserialize_timeout<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    let value = u64::deserialize(deserializer)?;
    Ok(if value == 0 { 30 } else { value })
}

#[derive(Serialize, Deserialize)]
struct Config {
    #[serde(deserialize_with = "deserialize_timeout")]
    timeout: u64,
}
```

在这个例子中，如果反序列化得到的`timeout`值为`0`，Serde 会将其替换为`30`。

除了默认设置，Serde 还提供了哪些序列化和反序列化选项？

Serde 提供了多种序列化和反序列化选项，以下是一些主要的属性和功能：

1. **容器属性**：

- `#[serde(rename = "name")]`：使用给定的名字进行序列化或反序列化，而不是使用 Rust 结构内的名字。允许为序列化或反序列化指定单独的名称。
- `#[serde(rename_all = "...")]`：重命名所有的字段（如果是结构体）或变体（如果是枚举体）。可能的值有 `"lowercase"`, `"UPPERCASE"`, `"PascalCase"`, `"camelCase"`, `"snake_case"`, `"SCREAMING_SNAKE_CASE"`, `"kebab-case"`, `"SCREAMING-KEBAB-CASE"`。
- `#[serde(deny_unknown_fields)]`：指定遇到未知字段时，在反序列化期间始终出错。

2. **变体属性**：

- `#[serde(alias = "name")]`：反序列化时，对应的别名，允许配置多个。
- `#[serde(skip)]`：跳过序列化或反序列化此变体，尝试序列化时将报错，尝试反序列化时将报错。

3. **字段属性**：

- `#[serde(rename = "name")]`：使用给定名称而不是其 Rust 名称序列化和反序列化此字段。
- `#[serde(alias = "name")]`：从给定名称或其 Rust 名称反序列化此字段。可以重复为同一字段指定多个可能的名称。
- `#[serde(default)]`：如果反序列化时该值不存在，请使用 `Default::default()` 生成默认值。
- `#[serde(default = "path")]`：如果反序列化时该值不存在，则调用函数以获取默认值。给定的函数必须可以调用为 `fn()->T`。
- `#[serde(flatten)]`：展开该字段，也就是将该字段内部抽到当前结构。
- `#[serde(skip)]`：跳过此字段：不会序列化或反序列化它。
- `#[serde(skip_serializing)]`：序列化时跳过此字段，反序列化时不跳过此字段。
- `#[serde(skip_deserializing)]`：反序列化时跳过此字段，但序列化时不跳过。
- `#[serde(skip_serializing_if = "path")]`：调用一个函数来确定是否跳过序列化该字段。
- `#[serde(serialize_with = "path")]`：指定一个函数来自定义序列化行为。

4. **其他属性**：

- `#[serde(with = "module")]`：`serialize_with` 和 `deserialize_with` 的组合。Serde 将使用 `$module::serialize` 作为 `serialize_with` 的值， `$module::deserialize` 作为 `deserialize_with` 的值。
- `#[serde(bound = "T: MyTrait")]`：序列化和反序列化的 where 子句表示。这将替换 Serde 推断的任何特征范围。
- `#[serde(borrow)]` 和 `#[serde(borrow = "'a + 'b + ...")]`：使用零拷贝反序列化从反序列化程序借用该字段的数据。
- `#[serde(other)]`：如果枚举标记不是此枚举中其他变体之一的标记，则反序列化此变体。
- `#[serde(untagged)]`：不会对内容进行任何标记字段包裹。`untagged` 的变体必须在枚举定义中排在最后。

这些属性和功能提供了灵活的方式来控制 Serde 的序列化和反序列化行为。

### 总结

Serde 提供了丰富的序列化和反序列化选项，使得开发者能够根据具体需求灵活地处理数据。无论是重命名字段、跳过字段、展平嵌套结构体，还是自定义序列化和反序列化逻辑，Serde 都能提供强大的支持。通过合理使用这些选项，开发者可以构建出高效、灵活且易于维护的数据处理代码。
