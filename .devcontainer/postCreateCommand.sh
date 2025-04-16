#!/bin/bash
set -ex

#cd /workspaces/${localWorkspaceFolderBasename}
#test -f package.json && npm install || echo 'No package.json found, skipping npm install'

# nodeユーザーをdockerグループに追加
sudo usermod -aG docker node
# Dockerソケットの権限を調整
sudo chmod 666 /var/run/docker.sock

echo "checking versions..."
echo "node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "aws version: $(aws --version)"
echo "cdk version: $(cdk --version)"
echo "git version: $(git --version)"

echo "checking aws configuration..."
aws configure list
aws configure list-profiles

