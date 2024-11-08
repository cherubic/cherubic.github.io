---
layout: post
title:  "Go get/mod tidy 类库太大问题"
date:   2024-10-31 11:30:00 +0800
categories: ["golang", "faq"]
tags: [golang, faq]
---

## 问题描述

在使用 `go get` 或 `go mod tidy` 时，可能会遇到以下错误：

```shell
# 错误 1
downloaded zip file too large

# 错误 2
create zip: module source tree too large
```

## 问题原因

### 错误 1：`downloaded zip file too large`

错误 1 是因为 `go get` 或者 `go mod tidy` 时，超过了下载 zip 文件的大小限制，默认大小为 `500 << 20`，即 500MB。

- **描述**：该错误是因为下载的 zip 文件大小超过默认限制 500MB (`500 << 20`)。
- **源代码逻辑**：在 `cmd/go/internal/modfetch/codehost/codehost.go` 中，`MaxZipFile` 定义了下载 zip 文件的最大限制：

  ```go
  const MaxZipFile = 500 << 20 // 解压文件最大限制为 500MB
  ```

- **触发流程**：在下载模块 zip 文件时，函数检查文件总大小：这里的 `repo.Zip` 会调用 `LimitedReader` 来控制读取的字节数。如果实际 zip 文件超过 `MaxZipFile`，就会触发错误信息 `downloaded zip file too large`。

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
        ...
        lr := &io.LimitedReader{R: body, N: codehost.MaxZipFile + 1}
        ...
    }

    // src/cmd/go/internal/modfetch/codehost/codehost.go
    const (
        MaxGoMod   = 16 << 20    // maximum size of go.mod file
        MaxLICENSE = 16 << 20    // maximum size of LICENSE file
        MaxZipFile = 50000 << 20 // maximum size of downloaded zip file
    )
    ```

### 错误 2：`create zip: module source tree too large`

- **描述**：此错误指解压后的模块源代码树大小超过默认的 500MB 限制。
- **源代码逻辑**：解压文件大小限制由 `cmd/vendor/golang.org/x/mod/zip/zip.go` 中的 `MaxZipFile` 定义：

  ```go
  const MaxZipFile = 500 << 20 // 解压文件最大限制为 500MB
  ```

- **触发流程**：在解压模块 zip 文件时，`Create` 函数检查文件总大小：`checkFiles` 函数在解压模块时验证文件大小，如果超出 `MaxZipFile` 限制，将返回 `module source tree too large` 错误。

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

通过修改 Go 源码的文件大小限制并重新编译 Go 来解决问题。

1. **备份并修改源码路径**：

    ```shell
    mv $GOROOT $GOROOT.new
    ```

2. **修改限制值**：
    - 打开 `$GOROOT.new/src/cmd/go/internal/modfetch/codehost/codehost.go`，将 `MaxZipFile` 修改为更大的值（例如 50GB）：

      ```go
      const MaxZipFile = 50000 << 20 // 将限制增大至 50GB
      ```

    - 同时在 `$GOROOT.new/src/cmd/vendor/golang.org/x/mod/zip/zip.go` 中进行相同修改。

3. **重新编译 Go**：

    ```shell
    cd $GOROOT.new/src/cmd/go
    go build -o go
    export GOROOT=$GOROOT.new
    ```

4. **运行 `go get` 或 `go mod tidy`**：

    ```shell
    $GOROOT.new/src/cmd/go/go get xxx
    $GOROOT.new/src/cmd/go/go mod tidy
    ```

### 永久解决方案

在原始 GOROOT 源码中修改后重新编译，使更改永久生效。

1. **修改源码文件**：
    - `$GOROOT/src/cmd/go/internal/modfetch/codehost/codehost.go`  
    - `$GOROOT/src/cmd/vendor/golang.org/x/mod/zip/zip.go`  
    - 将 `MaxZipFile` 调整为更大值，例如 50GB。

2. **重新编译 Go**：

    ```shell
    cd $GOROOT/src
    ./make.bash
    ```

3. **使用 `go get` 或 `go mod tidy` 即可正常运行**。

## 参考资料

- [Go lang "go get" with error "zip file too big" -- reedit my question](https://stackoverflow.com/questions/66761606/go-lang-go-get-with-error-zip-file-too-big-reedit-my-question)
- [file is too large” with Go](https://paulxiong.medium.com/how-to-fix-cant-load-package-zip-file-is-too-large-with-go-b1ff87596a7c)
