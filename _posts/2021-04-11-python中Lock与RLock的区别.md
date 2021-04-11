---
layout: post
title:  "python中Lock与RLock的区别"
date:   2021-04-11 23:48:00 +0800
categories: [python, 多线程]
---

## Lock vs RLock 简单对比

主要区别是`Lock`只能被获取一次，不能被释放前再次被获取。（在它被释放后，可以被任意线程重新获取）
`RLock`则是另一种表现，可以被同一线程多次获取。它需要被释放同样次数才能被释放。
另一个区别是获取`Lock`可以被任意线程释放，当一个被获取的`RLock`只能被获取它的线程释放。
以下的例子是展示为什么`RLock`有时候是有用的。假定你有：

```python
def f():
    g()
    h()

def g():
    h()
    do_something1()

def h():
    do_something2()
```

让我们假设所有`f`，`g`和`h`都是`public`，他们都是需要同步操作
使用一个`Lock`，你可以做一些事儿，如下：
```python
lock = Lock()
def f():
    with lock:
        _g()
        _h()

def g():
    with lock:
        _g()

def _g():
    _h()
    do_something1()

def h():
    with lock:
        _h()

def _h():
    do_something2()
```
基本上，`f`不能调用`g`在获取锁的时候，它需要调用`_g`。所以你需要每个函数都有一个异步版本和一个同步版本

使用`RLock`可以很优雅的解决这个问题：
```python
lock = RLock()
def f():
    with lock:
        g()
        h()

def g():
    with lock:
        h()
        do_something1()
def h():
    with lock:
        do_something2()
```

## Lock

## RLock

## 相关资料

- [what-is-the-difference-between-lock-and-rlock](https://stackoverflow.com/questions/22885775/what-is-the-difference-between-lock-and-rlock)
- [python-difference-between-lock-and-rlock-objects/](https://www.geeksforgeeks.org/python-difference-between-lock-and-rlock-objects/)
