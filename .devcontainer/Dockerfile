FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye

# 追加パッケージをインストール
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    python3 \
    python3-pip \
    jq \
    git \
    curl \
    unzip \
    docker.io \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# nodeユーザーにsudo権限を付与
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/node

# ユーザーをnodeに設定
USER node
WORKDIR /home/node
