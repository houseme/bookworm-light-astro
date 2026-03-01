---
title: "Rust 1.92.0 正式发布：提升可靠性和效率的新特性"
description: "Rust 团队欣喜宣布 Rust 编程语言的新版本 1.92.0 正式发布。Rust 是一种赋能每个人构建可靠且高效软件的编程语言。该版本于 2025 年 12 月 11 日发布，从 master 分支于 2025 年 10 月 24 日分支而来。"
date: 2025-12-12T00:42:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-jean-guillaume-starnini-2157985596-35081277.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","Rust 1.92.0","编程语言","软件开发","系统编程","性能优化","新特性"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","Rust 1.92.0","编程语言","软件开发","系统编程","性能优化","新特性","rustup","版本发布","never 类型","lint","unused_must_use","展开表","macro_export","稳定化 API","Cargo 变更","Rustdoc 变更"]
keywords: "rust,实战指南,Rust 生态,Rust 1.92.0,编程语言,软件开发,系统编程,性能优化,新特性"
draft: false
---

# Rust 1.92.0 正式发布：提升可靠性和效率的新特性

Rust 团队欣喜宣布 Rust 编程语言的新版本 1.92.0 正式发布。Rust 是一种赋能每个人构建可靠且高效软件的编程语言。该版本于 2025 年 12 月 11 日发布，从 master 分支于 2025 年 10 月 24 日分支而来。

如果您已通过 rustup 安装了之前的 Rust 版本，您可以通过以下命令获取 1.92.0：

```console
$ rustup update stable
```

如果尚未安装 rustup，您可以从 Rust 官网的相应页面 [获取 rustup](https://www.rust-lang.org/install.html)，并查看 [1.92.0 的详细发布说明](https://doc.rust-lang.org/stable/releases.html#version-1920-2025-12-11)。

如果您希望帮助测试未来的发布版本，可以考虑本地更新到 beta 通道（`rustup default beta`）或 nightly 通道（`rustup default nightly`）。如果遇到任何问题，请 [报告 bug](https://github.com/rust-lang/rust/issues/new/choose)！

## 1.92.0 稳定版的主要内容

### 默认拒绝的 Never 类型 Lint

语言和编译器团队继续推进 [Never 类型](https://doc.rust-lang.org/stable/std/primitive.never.html) 的稳定化工作。在本版本中，未来兼容性 lint [`never_type_fallback_flowing_into_unsafe`](https://doc.rust-lang.org/beta/rustc/lints/listing/deny-by-default.html#dependency-on-unit-never-type-fallback) 和 [`dependency_on_unit_never_type_fallback`](https://doc.rust-lang.org/beta/rustc/lints/listing/deny-by-default.html#dependency-on-unit-never-type-fallback) 被设置为默认拒绝，这意味着检测到时将导致编译错误。

值得注意的是，虽然这可能导致编译错误，但它仍是一个 *lint*；这些 lint 都可以通过 `#[allow]` 来忽略。这些 lint 仅在直接构建受影响的 crate 时触发，而不是作为依赖构建时（不过在这种情况下 Cargo 会报告警告）。

这些 lint 检测到可能被 Never 类型稳定化破坏的代码。如果您的 crate 图中报告了这些 lint，强烈建议修复它们。我们估计约有 500 个 crate 受影响。尽管如此，我们认为这是可接受的，因为 lint 不是破坏性变更，并将有助于未来稳定化 Never 类型。更多深入理由，请参阅 [语言团队的评估](https://github.com/rust-lang/rust/pull/146167#issuecomment-3363795006)。

此外，本版本记录了 `MaybeUninit` 的表示和有效性；允许在安全代码中对联合字段使用 `&raw [mut | const]`；优先选择关联类型的项边界而非 `where` 边界用于自动 trait 和 `Sized`；防止在 `X` 未初始化时物化 `[X; 0]`；支持结合 `#[track_caller]` 和 `#[no_mangle]`（要求每个声明都指定 `#[track_caller]`）；允许为同一关联项指定多个边界（除 trait 对象外）；略微加强了连贯性中的高阶区域处理；移除了对 `Result<(), Uninhabited>`（如 `Result<(), !>`）和 `ControlFlow<Uninhabited, ()>` 的 `unused_must_use` lint 警告，以避免对不可能发生的错误发出警告。

### `unused_must_use` Lint 的优化

Rust 的 `unused_must_use` lint 在忽略函数返回值时发出警告，如果函数或其返回类型标注了 `#[must_use]`。例如，这会提醒您在使用 `Result` 返回类型时使用 `?` 或类似 `.expect("...")`。

然而，有些函数返回 `Result`，但其错误类型并非“可居住”的，即无法构造该类型的任何值（例如 [`!`](https://doc.rust-lang.org/std/primitive.never.html) 或 [`Infallible`](https://doc.rust-lang.org/std/convert/enum.Infallible.html) 类型）。

现在，`unused_must_use` lint 不再对 `Result<(), UninhabitedType>` 或 `ControlFlow<UninhabitedType, ()>` 发出警告。例如，它不会对 `Result<(), Infallible>` 发出警告。这避免了检查永远不会发生的错误。

示例代码：

```rust
use core::convert::Infallible;
fn can_never_fail() -> Result<(), Infallible> {
    // ...
    Ok(())
}

fn main() {
    can_never_fail(); // 无警告
}
```

这在 trait 带有关联错误类型的常见模式中特别有用，其中错误类型有时可能是不可失败的。

### Linux 上启用 `-Cpanic=abort` 时生成展开表

在 Rust 1.22 中，`-Cpanic=abort` 下的回溯曾经有效，但在 1.23 中被破坏，因为我们停止了在 `-Cpanic=abort` 下生成展开表。在 1.45 中，引入了 `-Cforce-unwind-tables=yes` 作为稳定化的变通方法。

在本版本中，即使指定了 `-Cpanic=abort`，展开表也将默认生成，从而使回溯正常工作。如果不希望生成展开表，用户应使用 `-Cforce-unwind-tables=no` 显式禁用。

此外，本版本将 `mips64el-unknown-linux-muslabi64` 改为动态链接；移除了嵌入命令行参数到 PDB 的代码，因为它对调试工具不必要且导致增量构建问题。

### 验证 `#[macro_export]` 输入

在过去几个版本中，对编译器内置属性的处理进行了许多更改。这大大改进了 Rust 对内置属性的错误消息和警告，使这些诊断在超过 100 个内置属性中更加一致。

具体在本版本中，Rust 通过 [将检查升级为依赖中报告的“默认拒绝 lint”](https://github.com/rust-lang/rust/pull/143857)，对 `macro_export` 允许的参数进行了更严格的检查。同时，将 `invalid_macro_export_arguments` lint 升级为默认拒绝，并在依赖中报告，作为编译器属性重构的一部分。

### 稳定化的 API

- [`NonZero<u{N}>::div_ceil`](https://doc.rust-lang.org/stable/std/num/struct.NonZero.html#method.div_ceil)
- [`Location::file_as_c_str`](https://doc.rust-lang.org/stable/std/panic/struct.Location.html#method.file_as_c_str)
- [`RwLockWriteGuard::downgrade`](https://doc.rust-lang.org/stable/std/sync/struct.RwLockWriteGuard.html#method.downgrade)
- [`Box::new_zeroed`](https://doc.rust-lang.org/stable/std/boxed/struct.Box.html#method.new_zeroed)
- [`Box::new_zeroed_slice`](https://doc.rust-lang.org/stable/std/boxed/struct.Box.html#method.new_zeroed_slice)
- [`Rc::new_zeroed`](https://doc.rust-lang.org/stable/std/rc/struct.Rc.html#method.new_zeroed)
- [`Rc::new_zeroed_slice`](https://doc.rust-lang.org/stable/std/rc/struct.Rc.html#method.new_zeroed_slice)
- [`Arc::new_zeroed`](https://doc.rust-lang.org/stable/std/sync/struct.Arc.html#method.new_zeroed)
- [`Arc::new_zeroed_slice`](https://doc.rust-lang.org/stable/std/sync/struct.Arc.html#method.new_zeroed_slice)
- [`btree_map::Entry::insert_entry`](https://doc.rust-lang.org/stable/std/collections/btree_map/enum.Entry.html#method.insert_entry)
- [`btree_map::VacantEntry::insert_entry`](https://doc.rust-lang.org/stable/std/collections/btree_map/struct.VacantEntry.html#method.insert_entry)
- [`impl Extend<proc_macro::Group> for proc_macro::TokenStream`](https://doc.rust-lang.org/stable/proc_macro/struct.TokenStream.html#impl-Extend%3CGroup%3E-for-TokenStream)
- [`impl Extend<proc_macro::Literal> for proc_macro::TokenStream`](https://doc.rust-lang.org/stable/proc_macro/struct.TokenStream.html#impl-Extend%3CLiteral%3E-for-TokenStream)
- [`impl Extend<proc_macro::Punct> for proc_macro::TokenStream`](https://doc.rust-lang.org/stable/proc_macro/struct.TokenStream.html#impl-Extend%3CPunct%3E-for-TokenStream)
- [`impl Extend<proc_macro::Ident> for proc_macro::TokenStream`](https://doc.rust-lang.org/stable/proc_macro/struct.TokenStream.html#impl-Extend%3CIdent%3E-for-TokenStream)

这些先前稳定的 API 现在在 const 上下文中稳定：

- [`<[_]>::rotate_left`](https://doc.rust-lang.org/stable/std/primitive.slice.html#method.rotate_left)
- [`<[_]>::rotate_right`](https://doc.rust-lang.org/stable/std/primitive.slice.html#method.rotate_right)

此外，库变化包括：为 `TrustedLen` 迭代器特化 `Iterator::eq` 和 `eq_by`；简化元组的 `Extend` 实现；为 `EncodeWide` 的 `Debug` 实现添加细节；修改 `iter::Repeat::last` 和 `count` 以 panic 而非无限循环。

### Cargo、Rustdoc 和其他变化

Cargo 在其手册中添加了新章节：[“优化构建性能”](https://doc.rust-lang.org/stable/cargo/guide/build-performance.html)。

Rustdoc 变化：当 trait 项出现时，在搜索结果中隐藏对应的 impl 项（例如，搜索 `Iterator::last` 不再显示 `std::vec::IntoIter::last`）；放宽标识符搜索规则，现在允许以数字开头或其他先前无效形式搜索，只要作为标识符的一部分有效。

兼容性说明：修复了 Linux 上 `-C panic=abort` 下的回溯，通过默认生成展开表（使用 `-C force-unwind-tables=no` 省略）；更新了最低外部 LLVM 版本至 20；防止对 `Pin<LocalType>` 的下游 `impl DerefMut`；从 `pin!` 和格式化宏的参数中移除临时生命周期扩展规则。

查看 Rust [完整变更](https://github.com/rust-lang/rust/releases/tag/1.92.0)、[Cargo 变更](https://doc.rust-lang.org/nightly/cargo/CHANGELOG.html#cargo-192-2025-12-11) 和 [Clippy 变更](https://github.com/rust-lang/rust-clippy/blob/master/CHANGELOG.md#rust-192)。

## 贡献者致谢

Rust 1.92.0 的诞生离不开众多贡献者的共同努力。我们无法在没有大家的情况下完成这一切。[感谢所有人！](https://thanks.rust-lang.org/rust/1.92.0/)

## 参考地址
- 官方发布公告：https://doc.rust-lang.org/stable/releases.html#version-1920-2025-12-11
- 变更日志总结：https://releases.rs/docs/1.92.0/
