---
layout: post
title:  "Go get/mod tidy 类库太大问题"
date:   2024-10-31 11:30:00 +0800
categories: ["golang", "faq"]
tags: [golang, faq]
---

## 问题描述

在使用 go get 或者 go mod tidy 时，出现以下错误：

```shell
# error 1
downloaded zip file too large

# error 2
create zip: module source tree too large
```

## 问题原因

错误 1 是因为 `go get` 或者 `go mod tidy` 时，超过了下载 zip 文件的大小限制，默认大小为 `500 << 20`，即 500MB。

主要代码逻辑如下：

```go
// src/cmd/go/internal/modget/get.go
func init() {
    work.AddbuildFlags(CmdGet, work.OmitModFlag)
    CmdGet.Run = runGet // break init loop
}

func runGet(ctx context.Context, cmd *base.Command, args []string) {
    ...
    r.wrok.Add(func() {
        if _, err := modfetch.DownloadZip(ctx, mActual); err != nil {
            ...
        }
    })
    ...
}

// src/cmd/go/internal/modfetch/fetch.go
func DownloadZip(ctx context.Context, mod module.Version) (zipfile string, err error) {
    ...
    if err := downloadZip(ctx, mod, zipfile); err != nil {
        return cached{"", err}
    }
    ...
}

func downloadZip(ctx context.Context, mod module.Version, zipfile string) (err error) {
    ...
    err := repo.Zip(f, mod.Version)
    ...
}

// src/cmd/go/internal/modfetch/coderepo.go
func (r *codeRepo) Zip(dst io.Writer, version string) error {
    ...
    maxSize := int64(codehost.MaxZipFile)
    lr := &io.LimitedReader{R: dl, N: maxSize + 1}
    ...
}

// src/cmd/go/internal/modfetch/proxy.go
func (p *proxyRepo) Zip(dst io.Writer, version string) error {
    。。。
    lr := &io.LimitedReader{R: body, N: codehost.MaxZipFile + 1}
    。。。
}

// src/cmd/go/internal/modfetch/codehost/codehost.go
const (
    MaxGoMod   = 16 << 20    // maximum size of go.mod file
    MaxLICENSE = 16 << 20    // maximum size of LICENSE file
    MaxZipFile = 50000 << 20 // maximum size of downloaded zip file
)
```

错误 2 是因为 `go get` 或者 `go mod tidy` 时，超过了解压 zip 文件的大小限制，默认大小为 `500 << 20`，即 500MB。

主要代码逻辑如下：

```go
// src/cmd/go/internal/modget/get.go
func init() {
    work.AddbuildFlags(CmdGet, work.OmitModFlag)
    CmdGet.Run = runGet // break init loop
}

func runGet(ctx context.Context, cmd *base.Command, args []string) {
    ...
    r.wrok.Add(func() {
        if _, err := modfetch.DownloadZip(ctx, mActual); err != nil {
            ...
        }
    })
    ...
}

// src/cmd/go/internal/modfetch/fetch.go
func DownloadZip(ctx context.Context, mod module.Version) (zipfile string, err error) {
    ...
    if err := downloadZip(ctx, mod, zipfile); err != nil {
        return cached{"", err}
    }
    ...
}

func downloadZip(ctx context.Context, mod module.Version, zipfile string) (err error) {
    ...
    err := repo.Zip(f, mod.Version)
    ...
}

// src/cmd/go/internal/modfetch/coderepo.go
func (r *codeRepo) Zip(dst io.Writer, version string) error {
    ...
    return modzip.Create(dst, module.Version{Path: r.modPath, Version: version}, files)
}

// src/cmd/vendor/golang.org/x/mod/zip/zip.go
const (
    MaxZipFile = 500 << 20

    MaxGoMod = 16 << 20

    MaxLICENSE = 16 << 20
)

func Create(w io.Writer, m module.Version, files []File) (err error) {
    ...
    cf, validFiles, validSizes := checkFiles(files)
    ...
}

func checkFiles(files []File) (cf CheckedFiles, validFiles []File, validSizes []int64) {
    ...

    maxSize := int64(MaxZipFile)
    ...
    size := info.Size()
    if size >= 0 && size <= maxSize {
        maxSize -= size
    } else if cf.SizeError == nil {
        cf.SizeError = fmt.Errorf("module source tree too large (max size is %d bytes)", MaxZipFile)
    }
    ...
}

```

## 解决方案

### 临时解决方案

通过修改源码进行对限制的调整，并且重新编译 `go`，然后将项目中的 `GOROOT` 指向修改后的源码路径。

```shell
mv $GOROOT $GOROOT.new
# $GOROOT.new/src/cmd/go/internal/modfetch/codehost/codehost.go
# 修改 MaxZipFile 为 50000 << 20 即 50GB

# $GOROOT.new/src/cmd/vendor/golang.org/x/mod/zip/zip.go
# 修改 MaxZipFile 为 50000 << 20 即 50GB

# 重新编译 go
cd $GOROOT.new/src/cmd/go
go build -o go

# 修改项目中的 GOROOT
export GOROOT=$GOROOT.new

# 使用 go get 或者 go mod tidy
$GOROOT.new/src/cmd/go/go get xxx
$GOROOT.new/src/cmd/go/go mod tidy
```

### 永久解决方案

```shell
# $GOROOT/src/cmd/go/internal/modfetch/codehost/codehost.go
# 修改 MaxZipFile 为 50000 << 20 即 50GB

# $GOROOT/src/cmd/vendor/golang.org/x/mod/zip/zip.go
# 修改 MaxZipFile 为 50000 << 20 即 50GB

# 重新编译 go
cd $GOROOT/src

./make.bash

# 使用 go get 或者 go mod tidy
go get xxx
go mod tidy
```

## 参考资料

- [Go lang "go get" with error "zip file too big" -- reedit my question](https://stackoverflow.com/questions/66761606/go-lang-go-get-with-error-zip-file-too-big-reedit-my-question)
- [file is too large” with Go](https://paulxiong.medium.com/how-to-fix-cant-load-package-zip-file-is-too-large-with-go-b1ff87596a7c)
