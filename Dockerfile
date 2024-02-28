FROM node:18.19.1-bullseye-slim

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

RUN sed -i 's/deb.debian.org/mirrors.ustc.edu.cn/g' /etc/apt/sources.list \
    && echo "registry=https://npmreg.proxy.ustclug.org/" > ~/.npmrc \
    && apt-get update -y && apt-get install -y ruby-full build-essential zlib1g-dev git \
    && echo 'export GEM_HOME="$HOME/gems"' >> ~/.bashrc \
    && echo 'export PATH="$HOME/gems/bin:$PATH"' >> ~/.bashrc \
    && /usr/bin/gem install jekyll bundler