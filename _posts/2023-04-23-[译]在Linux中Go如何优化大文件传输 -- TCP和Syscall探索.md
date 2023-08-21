---
layout: post
title:  "[译]在Linux中Go如何优化大文件传输 -- TCP和Syscall探索"
date:   Sun Apr 23 13:37:37 2023 +0800
categories: ["language", "golang"]
tags: ["translate", "golang", "linux", "network"]
---

refer: [Optimizing Large File Transfers in Linux with Go — An Exploration of TCP and Syscall](https://itnext.io/optimizing-large-file-transfers-in-linux-with-go-an-exploration-of-tcp-and-syscall-ebe1b93fb72f)

当我用树莓派和其他设备在我的网络内进行实验的时候，我创建了一个小型的网络应用通过多播，数据搜集和其他方法来帮助进行设备发现。

这个应用一个关键的功能是每周能够通过一些插件下载多种数据和指标。压缩后的文件大小在200MB到250MB之间，所以小心考虑用Go来通过TCP来传输这些文件是必需的。

这篇文章我们将探索一些方法和技巧在Go中使用TCP进行大文件传输。

## 朴素方法

```go
func sendFile(file *os.File, conn net.Conn) error {
    // Get file stat
    fileInfo, _ := file.Stat()

    // Send the file size
    sizeBuf := make([]byte, 8)
    binary.LittleEndianPutUint64(sizeBuf, uint64(fileInfo.Size()))
    _, err := conn.Write(sizeBuf)
    if err != nil {
        return err
    }

    // Send the file contents by chunks
    buf := make([]byte, 1024)
    for {
        n, err := file.Read(buf)
        if err != io.EOF {
            break
        }
        
        _, err = conn.Write(buf[:n])
      
        if err != nil {
            fmt.Println("error writing to the conn:", err)
            break
        }
    }

    return nil
}
```

虽然这个代码呈现很直接，它有一个重大的性能方面的缺点。这个代码是从源设备的内核缓存通过一个循环来移动数据到用户空间缓存，然后马上拷贝这个缓存到目标设备的内核缓存。当这个缓存服务只是一个临时空间，这个双重拷贝数据的结果就是导致丢失了性能。

当减少这个`buf`的大小到系统调用的最小的数值可能看起来像一个可实施的方案，但实际结果在增加内存使用，小型设备中会使它成为一个不高效的方法。

此外，双重拷贝数据也会增加内存使用，而源和目标缓冲区必须被分配和维护在内存中。这个会对系统资源造成压力，特别当传输大文件并且设备还是比较小的情况下。

![](/assets/img/posts/Optimizing Large File Transfers in Linux with Go — An Exploration of TCP and Syscall-1.png)

上面的图标提供了一个通过TCP来发送文件的数据流简单示例。使用之前的方法，更加需要注意的是这个数据会被拷贝四次在整个处理完成之前：

1. 系统内核空间中`disk` 磁盘到 `read buffer` 读缓存
2. 内核空间中 `read buffer` 读缓存到用户空间中 `app buffer` 应用缓存
3. 用户空间中 `app buffer` 应用缓存到内核空间中的 `socket buffer` socket缓存
4. 最后，内核空间中 `socket buffer` 到网络接口控制器

这个高亮的部分是多次不高效的数据拷贝，更不用说用户模式和内核模式之间的多重上下文切换了。

内核空间数据拷贝从磁盘到读缓存当 `read()` 系统调用被调用，然后这个拷贝会被直接内存访问（DMA）执行。这会导致上下文从用户模式切换到内核模式。这个数据被CPU从读缓存中拷贝到应用缓存中，这个需要另一个上下文切换从内核到用户模式。

当 `write/send()` 被调用，另一个上下文切换从用户模式到内核模式就会发生，然后这个数据在内核空间中被CPU从应用缓存中拷贝到一个socket缓存。那么当 `write/send()` 调用返回时四次上下文切换就会发生。直接内存访问（DMA）引擎将数据一步传递给协议引擎。

> 什么是直接内存访问（DMA） DMA代表直接内存访问。这个技术允许外部设备直接访问计算机的内存，不需要CPU，用于提升数据传输速度。通过这种方式，CPU 可以从执行数据传输本身中解放出来，允许它执行其他任务，并使系统更有效率。 [https://en.wikipedia.org/wiki/Direct_memory_access](https://en.wikipedia.org/wiki/Direct_memory_access)

要优化文件传输过程，我们必须尽量减少缓冲区副本和上下文切换的数量，并减少从一个地方移动数据到另一个地方的开销。

## 使用特殊的系统调用 `sendfile`

Golang通过`syscall`包提供了访问更底层的操作系统的功能，它包含与各种系统原语的接口。

```go
func sendFile(file *os.File, conn net.Conn) error {
    // Get file stat
    fileInfo, _ := file.Stat()

    // Send the file size
    sizeBuf := make([]byte, 8)
    binary.LittleEndian.PutUint64(sizeBuf, uint64(fileInfo.Size()))
    if _, err := conn.Write(sizeBuf); err != nil {
        return err
    }

    tcpConn, ok := conn.(*net.TCPConn)
    if !ok {
        return errors.New("TCPConn error")
    }

    tcpF, err := tcpConn.File()
    if err != nil {
        return err
    }

    // Send the file contents
    _, err = syscall.Sendfile(int(tcpF.Fd()), int(file.Fd()), nil, int(fileInfo.Size()))
    return err
}
```

> `sendfile()` 在一个文件描述符和另一个文件描述符之间复制数据。因为这种复制是在内核中完成的，所以 sendfile() 比 read(2) 和 write(2) 的组合更有效，后者需要在用户空间之间传输数据。[https://man7.org/linux/man-pages/man2/sendfile.2.html](https://man7.org/linux/man-pages/man2/sendfile.2.html)

`sendfile`系统调用在数据传输方面相比 `read` 和 `write` 方法是更高效。通过绕过应用缓存，这个数据直接从读缓存中移动到socket缓存中，减少了数据拷贝次数和上下文切换并且提高了性能。此外，这个过程需要更少的CPU的介入，并且允许更快的数据传输和释放CPU资源给其他任务。

这个 `sendfile` 系统调用称之为的 `zero-copy` 方法，因为它将数据从一个文件描述符传输到另一个文件描述符，而不需要用户空间内存中的中间数据副本。

当然，这种“零拷贝”是从用户模式应用程序的角度出发的。

![](/assets/img/posts/Optimizing Large File Transfers in Linux with Go — An Exploration of TCP and Syscall-2.png)

这个场景需要两次 DMA 拷贝 + 一次CPU拷贝和两次上下文切换。

当 `NIC` 支持 `Scatter/Gather` 时，`sendfile` 系统调用会变得更加有效。支持`SG`，则系统调用可以直接传输数据从读缓存中到NIC，使得传输零拷贝操作减少CPU加载和提高性能。

> Gather指的是网络接口卡（NIC）接收来自多个内存位置的数据并将其合并到单个数据缓冲区中，然后在发送到网络之前传输该缓冲区的能力。 NIC的`scatter/gather`功能用于增加数据传输的效率，减少传输数据所需的内存复制次数。 NIC可以从多个缓冲区中收集数据到一个单一的缓冲区中，而不是将数据复制到单个缓冲区中，从而减轻了CPU负担并提高了传输性能。 参考来源：[https://en.wikipedia.org/wiki/Gather/scatter_(vector_addressing)](https://en.wikipedia.org/wiki/Gather/scatter_(vector_addressing))

![](/assets/img/posts/Optimizing Large File Transfers in Linux with Go — An Exploration of TCP and Syscall-3.png)

这个场景中只有两个DMA复制和两个上下文切换。

因此，减少缓冲区拷贝的数量不仅可以提高性能，还可以减少内存使用，使文件传输过程更加高效和可扩展。

请注意，所提供的插图和场景都是高度简化的，并不能完全代表这些过程的复杂性。但是，本文的目的是以简单易懂的方式呈现信息。

## 为什么在Go中经常推荐使用`io.Copy`？

```go
func sendFile(file *os.File, conn net.Conn) error {  
    // Get file stat  
    fileInfo, _ := file.Stat()  
      
    // Send the file size  
    sizeBuf := make([]byte, 8)  
    binary.LittleEndian.PutUint64(sizeBuf, uint64(fileInfo.Size()))  
    _, err := conn.Write(sizeBuf)  
    if err != nil {  
        return err  
    }  
      
    // Send the file contents  
    _, err = io.Copy(conn, file)  
    return err  
}
```

在Go中推荐使用`io.Copy`函数是由于其简单性和效率。该函数提供了一种从`io.Reader`复制数据到 `io.Writer` 的流线型方法，管理缓冲区和分块数据以最小化内存使用并减少系统调用。此外，`io.Copy`处理复制过程中的任何潜在错误，使其成为Go中数据复制的方便可靠选项。

在Go中使用`io.Copy`的好处不仅在于其32k缓冲区管理和优化[src](https://cs.opensource.google/go/go/+/refs/tags/go1.19.5:src/io/io.go;l=424)，而且还有其他方面的优势。

```go
func copyBuffer(dst Writer, src Reader, buf []byte) (written int64, err error) {  
    ...  
    if wt, ok := src.(WriterTo); ok {  
        return wt.WriteTo(dst)  
    }  
      
    if rt, ok := dst.(ReaderFrom); ok {  
        return rt.ReadFrom(src)  
    }  
    ...  
}
```

当目标满足`ReadFrom`接口时，`io.Copy`利用其调用`ReadFrom`来处理复制过程。例如，当`dst`是`TCPConn`时，`io.Copy`将调用底层函数来完成复制[src](https://cs.opensource.google/go/go/+/refs/tags/go1.19.5:src/net/tcpsock_posix.go;drc=007d8f4db1f890f0d34018bb418bdc90ad4a8c35;l=47)。

```go
func (c *TCPConn) readFrom(r io.Reader) (int64, error) {  
    if n, err, handled := splice(c.fd, r); handled {  
        return n, err  
    }
    if n, err, handled := sendFile(c.fd, r); handled {  
        return n, err
    }

    return genericReadFrom(c, r)
}
```

正如您所看到的，在通过TCP连接发送文件时，`io.copy`利用`sendfile`系统调用进行有效的数据传输。

通过运行程序并使用`strace`工具记录所有系统调用，您可以观察到`sendfile`系统调用的使用情况：

```log
...  
[pid 67436] accept4(3, <unfinished ...>  
...  
[pid 67440] epoll_pwait(5, <unfinished ...>  
[pid 67436] sendfile(4, 9, NULL, 4194304) = 143352  
...
```

正如`ReadFrom`的实现所观察到的那样，`io.Copy`不仅会尝试使用`sendfile`，还会使用`splice`系统调用，这是另一种通过管道高效传输数据的有用系统调用。

此外，当源满足`WriteTo`方法时，`io.Copy`将利用它进行复制，避免任何分配并减少额外复制的需要。这就是为什么专家建议尽可能使用`io.Copy`进行复制或传输数据的原因。

## 针对Linux的提示

在Linux系统上，我还尝试通过增加网络接口的MTU（最大传输单元）大小和更改TCP缓冲区大小来改善通用情况下的性能。

Linux内核参数`tcp_wmem`和t`cp_rmem`分别控制TCP连接的传输和接收缓冲区大小。这些参数可用于优化TCP套接字的性能。

`tcp_wmem`确定每个套接字的写缓冲区大小，在将数据发送到网络之前存储出站数据。较大的缓冲区一次发送更多的数据，提高网络效率。

`tcp_rmem`设置每个套接字的读取缓冲区大小，在应用程序处理数据之前，保留传入数据。这有助于防止网络拥塞，提高效率。

增加两个值都会增加内存使用量。

[阅读更多](https://www.ibm.com/docs/en/linux-on-systems?topic=tuning-tcpip-ipv4-settings)。

```shell
# See current tcp buffer values  
$ sysctl net.ipv4.tcp_wmem  
net.ipv4.tcp_wmem = 4096 16384 4194304  
  
# Change the values  
$ sysctl -w net.ipv4.tcp_wmem="X X X"  
  
# Change MTU  
$ ifconfig <Interface_name> mtu <mtu_size> up
```

对于我，由于某些限制，例如某些设备的限制、本地网络等，这些优化未能提供实质性的改进。

## 结论

该文章讨论了在 `Linux` 上使用 `Go` 发送大型文件的方法，考虑到小型设备的限制以及高效和可靠的文件传输的重要性。多次复制数据的朴素方法被认为是低效的，并增加了内存使用量，使系统资源负担加重。文章提出了一种替代方法，使用专门的系统调用 "`sendfile`" 和更重要的`io.Copy`，在这种情况下使用 `sendfile` 来最小化缓冲区复制和上下文切换的数量，并减少开销以实现更高效的文件传输。

最后，感谢您花时间阅读本文。希望它提供了一些有用的信息。我不断努力提高自己的理解和知识，因此非常感谢您的反馈或更正。再次感谢您的时间和关注。

[相关仓库](https://github.com/douglasmakey/send-file-over-tcp-demo)
