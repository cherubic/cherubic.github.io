---
layout: post
title:  "[译]Go中的Strings, bytes, runes和Characters"
date:   Fri Apr 7 17:44:48 2023 +0800
categories: ["language", "golang"]
tags: ["translate", "golang"]
---

refer: [Strings, bytes, runes and characters in Go](https://go.dev/blog/strings)

## 介绍

[之前的博客](https://go.dev/blog/slices) 介绍了slices 在Go中如何工作，使用一些例子来解释他们的实践机制。在此基础上，这个博文讨论了Go中的字符串。首先，对于一篇博客而言字符串可能看起来是一个很简单的话题，但是如何正确使用他们不仅仅需要明白他们怎么工作，还要理解他们和字节（byte），字符（character）和符文（rune）的区别，还有Unicode和UTF-8的区别，一个字符串和字符串字面值的区别，和其他一些微妙的区别。

一个处理这个话题的方法是想想一个高频率被提及的问题：“当我索引一个Go字符串的n的位置，为什么我不需要获取直到第n个的字符？”，这个问题引导出我们许多细节关于现代世界怎么处理文本工作。

对于这些问题的一个完美解释是独立于Go的，是Joel Spolsky的著名博客, [https://www.joelonsoftware.com/2003/10/08/the-absolute-minimum-every-software-developer-absolutely-positively-must-know-about-unicode-and-character-sets-no-excuses/](https://www.joelonsoftware.com/2003/10/08/the-absolute-minimum-every-software-developer-absolutely-positively-must-know-about-unicode-and-character-sets-no-excuses/) 他提出的许多观点将在这里得到回答。

## 什么是字符串？

让我们从一些简单的基础开始。

在Go里，字符串实际上是一个只读的字节切片。如果你有任何关于一个bytes切片是什么或者他如何工作的疑问，请先读[这篇博客](https://go.dev/blog/slices)，我们假设你已经读过这篇文章。

首先要注意的是字符串可以包含任何字节。他不一定是`Unicode`文本，`UTF-8`文本，或者其他任何预定的格式。就字符内容而言，他完全等价于字节的切片。

一个字符串值（很快有更多关于此信息）使用 `\xnn` 符号来定义一个字符常量包含一些奇怪的字节值。（当然，字节的范围是来源于十六字节的值，包含从00到FF）

```go
const sample = "\xbd\xb2\x3d\xbc\x20\xe2\x8c\x98"
```

## 打印字符串

因为一些字节在我们的简单字符串里不是有效的 `ASCII` ，甚至不是有效的 `UTF-8`， 直接打印字符串会产生丑陋的输出。这里有个简单的打印声明

```go
fmt.Println(sample)
```

产生这个混乱消息（其确切输出依赖于环境）

```
��=� ⌘
```

找出这个字符串真实值，我们需要将其拆分并且检查每个片段。这里有一些方法来做这个，最明显的方法就是循环它的内容，并且抽出每个单独的字节，如以下 `for` 循环：

```go
for i := 0; i < len(sample); i++ {
	fmt.Printf("%x", sample[i])
}
```

正如前面所暗示的，索引一个字符串访问单独的字节，不是字符。接下来我们将会返回到这个话题的细节中。这里是每个字节的循环返回结果：

```
bd b2 3d bc 20 e2 8c 98
```

注意各个字节如何与定义字符串的十六进制转义符匹配。

对于一个混乱字符串一个更简单的生成符合要求的输出的方法是使用 `%x` （十六进制） 格式在 `fmt.Printf` 。 它只是将字符串的顺序字节转储为十六进制数字，每个字节两个。

```go
fmt.Printf("%x\n", sample)
```

对比以上的输出

```
bdb23dbc20e28c98
```

一个好技巧是使用“空格”标记在格式化中，放入一个空格在`%`和`x`。对比此处格式化字符串和上面的，

```go
fmt.Printf("% x\n", sample)
```

注意到字节结果带了空格，让结果更加通俗易懂。

```
bd b2 3d bc 20 e2 8c 98
```

还有更多方法。 使用 `%q` 动词将会转译字符串中任何不可打印的字节序列，以便于输出更加明确。

```go
fmt.Printf("%q\n", sample)
```

当字符串大部分可以作为文本理解，但有一些需要挖掘的特殊情况时，这种技术非常有用；它会产生：

```go
"\xbd\xb2=\xbc ⌘
```

如果我们仔细看，就会发现在杂乱无章的字符中，有一个 `ASCII` 等号，以及一个普通的空格，而结尾处则出现了著名的瑞典“名胜”的符号，这个符号有一个`Unicode`值：`U+2318`，在空格之后字节编码为`UTF-8`（十六进制值 `20`）:  `e2 8c 98`

在字符串中如果我们不熟悉或者不清楚奇怪的值，我们可以使用 "+" 号在 `%q` 动词前。这个标志不仅会转义字符串中的不可打印序列，还会转义其中的任何非ASCII字节，并且实现实时解释UTF-8这一功能。结果是，它暴露了字符串中表示非ASCII数据的经过正确格式化的UTF-8的Unicode值。

```go
fmt.Printf("%+q\n", sample)
```

通过这种格式，瑞典符号的Unicode值显示为 `\u` 转义字符。

```
"\xbd\xb2=\xbc \u2318"
```

在调试字符串的内容时，了解这些打印技术非常有用，并且在接下来的讨论中将非常方便。值得指出的是，所有这些方法对于字节片的行为与对于字符串的行为完全相同。

下面是我们列出的全部打印选项，作为一个完整的程序，你可以在浏览器中运行(和编辑) :

```go
package main

import "fmt"

func main() {
	const sample = "\xbd\xb2\x3d\xbc\x20\xe2\x8c\x98"

	fmt.Println("Println:")
	fmt.Println(sample)

	fmt.Println("Byte loop:")
	for i := 0; i < len(sample); i++ {
		fmt.Printf("%x ", sample[i])
	}

	fmt.Printf("\n")

	fmt.Println("Printf with %x:")
	fmt.Printf("%x\n", sample)

	fmt.Println("Printf with % x:")
	fmt.Printf("% x\n", sample)

	fmt.Println("Printf with %q:")
	fmt.Printf("%q\n", sample)

	fmt.Println("Printf with %+q:")
	fmt.Printf("%+q\n", sample)
}
```

【练习：修改上述示例，使用字节切片而不是字符串。提示：使用转换创建切片。】

【练习：使用 %q 格式循环遍历字符串中的每个字节。输出结果告诉你什么？】

## UTF-8 和 字符串值

正如我们看到的，索引一个字符串产生它的是字节不是字符：一个字符串就是一串字节。意味着当我们存储一个字符值在一个字符串中，我们按字节逐个存储它的表示。让我们看一个更受控制的例子，以了解这是如何发生的。

这里有一些简单的程序用三种单字符方法打印一个字符常量，一种是作为普通字符串，一种是作为一个 `ASCII`  引用字符串，还有一种是作为独立十六进制字节。为了避免歧义，我们创建了一个“原始字符串”，用反引号扩起来，所以它只能包含文字文本。（正如我们上面所展示的那样，由双引号括起来的常规字符串可以包含转义序列。）

```go
func main() {
	const placeOfInterest = `⌘`

	fmt.Printf("plain string: ")
	fmt.Printf("%s", placeOfInterest)
	fmt.Printf("\n")

	fmt.Printf("quoted string: ")
	fmt.Printf("%+q", placeOfInterest)
	fmt.Printf("\n")

	fmt.Printf("hex bytes: ")
	for i := 0; i < len(placeOfInterest); i++ {
		fmt.Printf("%x ", placeOfInterest[i])
	}
	fmt.Printf("\n")
}
```

结果是：

```
plain string: ⌘
quoted string: "\u2318"
hex bytes: e2 8c 98
```

这提醒我们 `Unicode` 字符值 `U+2318`，“名胜”符号⌘，由字节 `e2 8c 98` 表示，并且这些字节是十六进制值 `2318` 的 `UTF-8` 编码。

这可能显而易见，也可能微妙，这取决于你对 `UTF-8` 的熟悉程度，但值得花一点时间解释一下如何创建字符串的 `UTF-8 `表示。简单的事实是：它是在编写源代码时创建的。

在 Go 中，源代码被定义为 `UTF-8` 文本；不允许使用其他表示方法。这意味着当我们在源代码中编写文本时，比如：

```
`⌘`
```

用于创建程序的文本编辑器将符号`⌘`的 `UTF-8` 编码放入源文本中。当我们打印出十六进制字节时，我们只是转储编辑器放入文件中的数据。

简而言之，Go 的源代码是 `UTF-8`，因此字符串文字的源代码是 `UTF-8` 文本。如果该字符串文字不包含转义序列（原始字符串不能包含转义序列），则构造的字符串将完全保留引号之间的源代码。因此，根据定义和构造，原始字符串始终包含其内容的有效 `UTF-8` 表示。同样地，除非它包含像前面一节中那样的破坏 `UTF-8` 的转义序列，否则常规字符串字面值也始终包含有效的 `UTF-8`。

有些人认为 Go 字符串始终是 `UTF-8`，但事实并非如此：只有字符串字面值是 `UTF-8`。正如我们在前一节中所示，字符串值可以包含任意字节；就像我们在这一节中所展示的一样，只要它们没有字节级转义，字符串字面值就始终包含 `UTF-8` 文本。

总之，字符串可以包含任意字节，但是当从字符串字面值构造时，这些字节（几乎总是）是 `UTF-8`。

## Code points，characters 和 runes

到目前为止我们非常小心地使用"`byte`"和"`character`"。这个有一部分是因为字符串可以是字节，还有一部分是因为关于 "`character`" 有一些难以定义。`Unicode`标准使用术语："`code point`" 来指代这个项目来代表一个单独的值。code point U+2318是代表十六进制2318的值，代表符号⌘。（有关于更多码点，可以查看[Unicode页面](https://util.unicode.org/UnicodeJsps/character.jsp?a=2318)

选取更多平常的例子，`Unicode` 码点 `U+0061` 是拉丁字母 `A` 的小写： `a`

但是小写的带重音字母‘`A`’，`à`，又是什么呢？它既是一个字符，也是一个码点（`U+00E0`），但它也有其他表示方式。例如，我们可以使用“组合”的重音符号码点 `U+0300`，将它附加到小写字母`a`（`U+0061`）上，以创建相同的字符à。通常，一个字符可以由多个不同的码点序列表示，因此也可以由不同的 `UTF-8` 字节序列表示。

因此，在计算机中，“`character`”这个概念是含糊不清的，或者至少是令人困惑的，因此我们要谨慎使用。为了使事情更可靠，有规范化技术可以保证给定字符始终由相同的码点表示，但是这个主题超出了本文的范围。以后的博客文章将解释 Go 库如何处理规范化。

“码点”这个词有些啰嗦，因此 Go 引入了一个更短的术语来表示这个概念：符文（`rune`）。这个术语出现在库和源代码中，与“码点”完全相同，但有一个有趣的补充。

Go 语言将单词“`rune`”定义为 `int32` 类型的别名，因此程序可以清楚地表示整数值表示的码点。此外，你可能认为是字符常量的常量被称为符文常量。表达式的类型和值

```
'⌘'
```

`rune` 是整型值 `0x2318`

总结如下，这里是最重要的部分：

- Go源码总是`UTF-8`
- 一个字符串可以是任意的字节
- 一个字符串字面值，如果没有字节级别的转义，就总是包含有效的 `UTF-8` 序列。
- 这些序列可以表示`Unicode`码点，称之为`runes`
- Go不承诺字符在字符串中是标准化，规范化的

## 范围循环

除了 Go 源码是 `UTF-8` 这一公理细节外，Go 只有一种方式特殊处理 `UTF-8`，即在字符串上使用 `for range` 循环。

我们已经看到了使用普通 `for` 循环的情况。相比之下，`for range` 循环在每次迭代中解码一个 UTF-8 编码的符文。每次循环时，循环的索引是当前符文的起始位置（以字节为单位），而码点则是其值。下面是使用另一个方便的 `Printf` 格式 `%#U` 的示例，该格式显示码点的 Unicode 值及其打印表示：

```go
const nihongo = '日本語'
for index, runeValue := range nihongo {
	fmt.Printf("%#U starts at byte position %d\n", runeValue, index)
}
```

输出现实了每个码点如何占用多个字节：

```
U+65E5 '日' starts at byte position 0
U+672C '本' starts at byte position 3
U+8A9E '語' starts at byte position 6
```

[练习：将一个无效的 UTF-8 字节序列放入字符串中。 （如何？）循环的迭代会发生什么？]

## 类库

Go 的标准库提供了强大的支持，用于解释 `UTF-8` 文本。如果 `for range` 循环不足以满足你的需求，你需要的功能很可能由库中的某个包提供。

最重要的这种包是 `unicode/utf8`，其中包含辅助程序，用于验证、分解和重新组合 UTF-8 字符串。下面是一个等效于上面的 `for range` 示例的程序，但是使用该包中的 `DecodeRuneInString` 函数来完成工作。该函数的返回值是符文及其以 `UTF-8` 编码的字节宽度。


```go
const nihongo = "日本語"
for i, w := 0, 0; i < len(nihongo); i += w {
    runeValue, width := utf8.DecodeRuneInString(nihongo[i:])
    fmt.Printf("%#U starts at byte position %d\n", runeValue, i)
    w = width
}
```

运行它，看看它是否执行相同的操作。`for range` 循环和 `DecodeRuneInString` 都被定义为产生完全相同的迭代序列。

查看 `unicode/utf8` 包的[文档](https://pkg.go.dev/unicode/utf8)，以了解它提供的其他功能。

##  结论

回答一开始提出的问题：字符串是由字节构建的，因此对它们进行索引会得到字节，而不是字符。字符串甚至可能不包含字符。实际上，“字符”的定义是含糊不清的，试图通过定义字符串由字符组成来消除歧义是错误的。

有关 `Unicode`、`UTF-8` 和多语言文本处理的世界还有很多要说的，但它可以等到另一篇文章。目前，我们希望您对 Go 字符串的行为有更好的理解，并且尽管它们可能包含任意字节，但 `UTF-8` 是其设计的核心部分。