---
title: "秋风携新锈，Rust 1.91.0 悄然绽放"
description: "秋风轻拂，代码之林再添新叶。Rust 团队欣然宣布，Rust 1.91.0 正式发布——这门赋能世人铸就可靠高效软件的编程语言，又迈出了坚实一步。"
date: 2025-10-28T09:12:10Z
image: "https://static-rs.bifuba.com/images/posts/pexels-frank-wesneck-2154020533-34513551.jpg-slimming.webp"
categories: ["Rust","实战指南","版本发布"]
authors: ["houseme"]
tags: ["Rust","实战指南","版本发布","Rust 1.91.0","新特性","平台支持","API 稳定化","编程语言更新"] 
keywords: "Rust, 实战指南, 版本发布, Rust 1.91.0, 新特性, 平台支持, API 稳定化, 编程语言更新"
draft: false
---

### 秋风携新锈，1.91.0 悄然绽放

秋风轻拂，代码之林再添新叶。Rust 团队欣然宣布，Rust 1.91.0 正式发布——这门赋能世人铸就可靠高效软件的编程语言，又迈出了坚实一步。

若您已通过 `rustup` 安装旧版，只需轻敲：

```console
$ rustup update stable
```

即可拥抱新版。若尚未安装，可前往 [Rust 官网](https://www.rust-lang.org/install.html) 获取 `rustup`，并查阅 [1.91.0 详细发布笔记](https://doc.rust-lang.org/stable/releases.html#version-1910-2025-10-30)。

欲助 Rust 团队测试未来版本，不妨切换至 beta 通道（`rustup default beta`）或 nightly 通道（`rustup default nightly`），并 [报告](https://github.com/rust-lang/rust/issues/new/choose) 任何发现的 bug。

## 1.91.0 稳定版亮点

### **aarch64-pc-windows-msvc 荣升 Tier 1 平台**

Rust 编译器支持 [众多目标平台][platform-support]，但支持力度因阶层而异：

- **Tier 3**：编译器技术支持，但不检查构建或测试，无预编译二进制文件。
- **Tier 2**：保证构建并提供预编译二进制，但不运行测试套件，二进制可能存在缺陷。
- **Tier 1**：最高保障，每合并变更均运行全套测试，并提供预编译二进制。

Rust 1.91.0 将 `aarch64-pc-windows-msvc` 目标提升至 Tier 1，为 64 位 ARM Windows 用户带来最高级别保证。

### **新增对局部变量悬垂原始指针的默认警告 lint**

Rust 的借用检查器可防止悬垂引用返回，但对原始指针无能为力。本版引入默认警告 lint，针对从函数返回指向局部变量的原始指针。例如：

```rust
fn f() -> *const u8 {
    let x = 0;
    &x
}
```

将触发警告：

```
warning: a dangling pointer will be produced because the local variable `x` will be dropped
 --> src/lib.rs:3:5
  |
1 | fn f() -> *const u8 {
  |           --------- return type of the function is `*const u8`
2 |     let x = 0;
  |         - `x` is part the function and will be dropped at the end of the function
3 |     &x
  |     ^^
  |
  = note: pointers do not have a lifetime; after returning, the `u8` will be deallocated
    at the end of the function because nothing is referencing it as far as the type system is
    concerned
  = note: `#[warn(dangling_pointers_from_locals)]` on by default
```

此代码本身并非 unsafe，仅在函数返回后解引用原始指针才属 unsafe。未来版本将进一步增强对原始指针及 unsafe 代码的安全交互支持。

### **稳定化 API**

- [`Path::file_prefix`](https://doc.rust-lang.org/stable/std/path/struct.Path.html#method.file_prefix)
- [`AtomicPtr::fetch_ptr_add`](https://doc.rust-lang.org/stable/std/sync/atomic/struct.AtomicPtr.html#method.fetch_ptr_add)
- [`AtomicPtr::fetch_ptr_sub`](https://doc.rust-lang.org/stable/std/sync/atomic/struct.AtomicPtr.html#method.fetch_ptr_sub)
- [`AtomicPtr::fetch_byte_add`](https://doc.rust-lang.org/stable/std/sync/atomic/struct.AtomicPtr.html#method.fetch_byte_add)
- [`AtomicPtr::fetch_byte_sub`](https://doc.rust-lang.org/stable/std/sync/atomic/struct.AtomicPtr.html#method.fetch_byte_sub)
- [`AtomicPtr::fetch_or`](https://doc.rust-lang.org/stable/std/sync/atomic/struct.AtomicPtr.html#method.fetch_or)
- [`AtomicPtr::fetch_and`](https://doc.rust-lang.org/stable/std/sync/atomic/struct.AtomicPtr.html#method.fetch_and)
- [`AtomicPtr::fetch_xor`](https://doc.rust-lang.org/stable/std/sync/atomic/struct.AtomicPtr.html#method.fetch_xor)
- [`{integer}::strict_add`](https://doc.rust-lang.org/stable/std/primitive.u32.html#method.strict_add) 等严格整数运算系列（涵盖 add、sub、mul、div、div_euclid、rem、rem_euclid、neg、shl、shr、pow）
- [`i{N}::strict_add_unsigned`](https://doc.rust-lang.org/stable/std/primitive.i32.html#method.strict_add_unsigned) 等有符号/无符号混合严格运算
- [`PanicHookInfo::payload_as_str`](https://doc.rust-lang.org/stable/std/panic/struct.PanicHookInfo.html#method.payload_as_str)
- [`core::iter::chain`](https://doc.rust-lang.org/stable/core/iter/fn.chain.html)
- [`u{N}::checked_signed_diff`](https://doc.rust-lang.org/stable/std/primitive.u16.html#method.checked_signed_diff)
- [`core::array::repeat`](https://doc.rust-lang.org/stable/core/array/fn.repeat.html)
- [`PathBuf::add_extension`](https://doc.rust-lang.org/stable/std/path/struct.PathBuf.html#method.add_extension) 与 [`PathBuf::with_added_extension`](https://doc.rust-lang.org/stable/std/path/struct.PathBuf.html#method.with_added_extension)
- [`Duration::from_mins`](https://doc.rust-lang.org/stable/std/time/struct.Duration.html#method.from_mins) 与 [`Duration::from_hours`](https://doc.rust-lang.org/stable/std/time/struct.Duration.html#method.from_hours)
- `Path` / `PathBuf` 与 `str` / `String` 的 `PartialEq` 实现系列
- [`Ipv4Addr::from_octets`](https://doc.rust-lang.org/stable/std/net/struct.Ipv4Addr.html#method.from_octets)、[`Ipv6Addr::from_octets`](https://doc.rust-lang.org/stable/std/net/struct.Ipv6Addr.html#method.from_octets)、[`Ipv6Addr::from_segments`](https://doc.rust-lang.org/stable/std/net/struct.Ipv6Addr.html#method.from_segments)
- `Pin<Box<T>>`、`Pin<Rc<T>>`、`Pin<Arc<T>>` 的 `Default` 实现
- [`Cell::as_array_of_cells`](https://doc.rust-lang.org/stable/std/cell/struct.Cell.html#method.as_array_of_cells)
- 无符号整数的进位/借位运算：[`u{N}::carrying_add`](https://doc.rust-lang.org/stable/std/primitive.u64.html#method.carrying_add)、[`u{N}::borrowing_sub`](https://doc.rust-lang.org/stable/std/primitive.u64.html#method.borrowing_sub)、[`u{N}::carrying_mul`](https://doc.rust-lang.org/stable/std/primitive.u64.html#method.carrying_mul)、[`u{N}::carrying_mul_add`](https://doc.rust-lang.org/stable/std/primitive.u64.html#method.carrying_mul_add)
- [`BTreeMap::extract_if`](https://doc.rust-lang.org/stable/std/collections/struct.BTreeMap.html#method.extract_if) 与 [`BTreeSet::extract_if`](https://doc.rust-lang.org/stable/std/collections/struct.BTreeSet.html#method.extract_if)
- [`impl Debug for windows::ffi::EncodeWide<'_>`](https://doc.rust-lang.org/stable/std/os/windows/ffi/struct.EncodeWide.html#impl-Debug-for-EncodeWide%3C'_%3E)
- [`str::ceil_char_boundary`](https://doc.rust-lang.org/stable/std/primitive.str.html#method.ceil_char_boundary) 与 [`str::floor_char_boundary`](https://doc.rust-lang.org/stable/std/primitive.str.html#method.floor_char_boundary)
- `Saturating<u{N}>` 的 `Sum` 与 `Product` 实现（含 `&Self` 变体）

### **const 上下文中稳定化的原有 API**

- [`<[T; N]>::each_ref`](https://doc.rust-lang.org/stable/std/primitive.array.html#method.each_ref)
- [`<[T; N]>::each_mut`](https://doc.rust-lang.org/stable/std/primitive.array.html#method.each_mut)
- [`OsString::new`](https://doc.rust-lang.org/stable/std/ffi/struct.OsString.html#method.new)
- [`PathBuf::new`](https://doc.rust-lang.org/stable/std/path/struct.PathBuf.html#method.new)
- [`TypeId::of`](https://doc.rust-lang.org/stable/std/any/struct.TypeId.html#method.of)
- [`ptr::with_exposed_provenance`](https://doc.rust-lang.org/stable/std/ptr/fn.with_exposed_provenance.html) 与 [`ptr::with_exposed_provenance_mut`](https://doc.rust-lang.org/stable/std/ptr/fn.with_exposed_provenance_mut.html)

## 平台支持更新

- [将 `aarch64-pc-windows-msvc` 提升至 Tier 1](https://github.com/rust-lang/rust/pull/145682)
- [将 `aarch64-pc-windows-gnullvm` 与 `x86_64-pc-windows-gnullvm` 提升至 Tier 2 并支持 host tools](https://github.com/rust-lang/rust/pull/143031)  
  （注：llvm-tools 与 MSI 安装器暂缺，后续版本补齐）

详见 Rust [平台支持页面][platform-support]。

## 其他变更

详览 [Rust](https://github.com/rust-lang/rust/releases/tag/1.91.0)、[Cargo](https://doc.rust-lang.org/nightly/cargo/CHANGELOG.html#cargo-191-2025-10-30) 与 [Clippy](https://github.com/rust-lang/rust-clippy/blob/master/CHANGELOG.md#rust-191) 的完整变更。

## 致谢 1.91.0 贡献者

无数双手共同铸就 Rust 1.91.0，离不开每一位贡献者。[感谢你们！](https://thanks.rust-lang.org/rust/1.91.0/)

[platform-support]: https://doc.rust-lang.org/rustc/platform-support.html
