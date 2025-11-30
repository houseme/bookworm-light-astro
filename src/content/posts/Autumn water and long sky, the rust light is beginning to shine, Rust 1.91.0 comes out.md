---
title: "秋水长天，锈光初绽——Rust 1.91.0 翩然问世"
description: "金风送爽，代码之河又泛新澜。Rust 团队以静水深流之姿，欣然献上 **Rust 1.91.0**——一门让世人皆可铸就坚不可摧、迅若惊鸿之软件的语言，再度凌空而起。"
date: 2025-10-28T09:22:10Z
image: "https://static-rs.bifuba.com/images/posts/pexels-joseph-russo-430180075-34509418.jpg-slimming.webp"
categories: ["Rust","实战指南","版本发布"]
authors: ["houseme"]
tags: ["Rust","实战指南","版本发布","Rust 1.91.0","新特性","平台支持","API 稳定化","编程语言更新"] 
keywords: "Rust, 实战指南, 版本发布, Rust 1.91.0, 新特性, 平台支持, API 稳定化, 编程语言更新"
draft: false
---

### 秋水长天，锈光初绽——Rust 1.91.0 翩然问世

金风送爽，代码之河又泛新澜。Rust 团队以静水深流之姿，欣然献上 **Rust 1.91.0**——一门让世人皆可铸就坚不可摧、迅若惊鸿之软件的语言，再度凌空而起。

若君已携旧版同游，只需轻唤：

```console
$ rustup update stable
```

便可踏入新境。若尚未结缘 `rustup`，请移步 [Rust 官苑](https://www.rust-lang.org/install.html) 迎之入怀，并静览 [1.91.0 详尽诗笺](https://doc.rust-lang.org/stable/releases.html#version-1910-2025-10-30)。

愿与未来共舞者，可化身 beta 之蝶（`rustup default beta`）或 nightly 之萤（`rustup default nightly`），于幽暗中探路，并 [轻叩此处](https://github.com/rust-lang/rust/issues/new/choose) 诉说所见之影。

---

## 1.91.0 稳定版 · 星辰新章

### **aarch64-pc-windows-msvc 登临 Tier 1 之巅**

Rust 编译器广纳百川，然支持之深浅各异，依阶而分：

- **Tier 3**：仅存于图谱，编译可成，然无测试、无二进制，似孤舟漂泊。
- **Tier 2**：构建无虞，二进制可得，然未历全试，暗礁或存。
- **Tier 1**：至高誓约，每一合併皆经千锤百炼，全套试炼，预编译之宝亦随身而至。

今，**`aarch64-pc-windows-msvc`** 破茧成蝶，荣登 Tier 1，为 64 位 ARM Windows 之士，奉上最坚实的守护。

---

### **悬垂原始指针，秋风先知其危**

借用检查如明月护航，然原始指针独行于夜。本版新添**默认警告 lint**，于函数归途之际，洞察局部变量之指针悄然悬空。

如是代码：

```rust
fn f() -> *const u8 {
    let x = 0;
    &x
}
```

将闻秋风低语：

> **warning**: 悬指针将生，`x` 虽在函数中安身，然归后即没……  
> `#[warn(dangling_pointers_from_locals)]` 已默然开启。

此码未涉 unsafe，唯解引用后方入险境。未来版本，将继续为原始指针与 unsafe 之境，铺陈更安全的星光之路。

---

### **API 星河 · 恒星新现**

| 星名 | 归属 | 辉光 |
|------|------|------|
| `Path::file_prefix` | std::path | 窥见路径之首 |
| `AtomicPtr::fetch_ptr_add` 等 | std::sync::atomic | 原子指针之舞 |
| `{integer}::strict_add` 等 | 整数原语 | 严格运算，溢出即止 |
| `Duration::from_mins` / `from_hours` | std::time | 时间轻启 |
| `PathBuf` 与 `str` / `String` 之 `PartialEq` | std | 路径弦音相和 |
| `BTreeMap::extract_if` | std::collections | 枫叶摘落有道 |
| `str::ceil_char_boundary` / `floor_char_boundary` | str | 字符边界，进退有度 |

更多星辰，详见[官方星图](https://doc.rust-lang.org/stable/std/)。

---

### **const 之境 · 旧星再耀**

下列旧 API，今于 **const 恒温之境** 中亦可安然绽放：

- `&[T; N]::each_ref` / `each_mut`
- `OsString::new` · `PathBuf::new`
- `TypeId::of`
- `ptr::with_exposed_provenance`（及其 mut 变体）

---

## 平台新篇

- **`aarch64-pc-windows-msvc` 荣登 Tier 1**：[PR #145682](https://github.com/rust-lang/rust/pull/145682)
- **`aarch64-pc-windows-gnullvm` 与 `x86_64-pc-windows-gnullvm` 升 Tier 2 并携 host tools**：[PR #143031](https://github.com/rust-lang/rust/pull/143031)  
  （llvm-tools 与 MSI 安装器，待来日补阙）

详见 [Rust 平台支持诗卷][platform-support]。

---

## 余韵流转

- [Rust 完整更迭](https://github.com/rust-lang/rust/releases/tag/1.91.0)
- [Cargo 之变](https://doc.rust-lang.org/nightly/cargo/CHANGELOG.html#cargo-191-2025-10-30)
- [Clippy 微言](https://github.com/rust-lang/rust-clippy/blob/master/CHANGELOG.md#rust-191)

---

## 致谢 · 群星共铸

无无数双手并肩，无 1.91.0 之光。  
每一行代码，皆是心血凝成的诗句。

**[向每一位贡献者，致以最深秋意的谢意](https://thanks.rust-lang.org/rust/1.91.0/)**

---

[platform-support]: https://doc.rust-lang.org/rustc/platform-support.html

> **Rust 1.91.0** —— 秋水为神玉为骨，代码为诗意为歌。  
> 愿你所写，皆安；所筑，皆久。
