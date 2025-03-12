# README.md

## Lambdaの環境変数

- 必須
    - BUCKET_NAME=<S3バケット名>
    - ZIP_FILE_NAME=<生成するZIPファイルのベース名>
        - ※ .zip の拡張子は不要
    - USER=<Backlogのユーザー名>
    - PASS=<Backlogのパスワード>
    - REPOSITORY=<対象のリポジトリ名>
    - BRANCH=<対象のブランチ名>
- 任意
    - SNS_TOPIC_ARN：指定した場合にSNS通知されます

## Lambdaの設定

- タイムアウト：５分以上
- メモリ：512 MB以上
- 実行ロール：S3へのアップロード権限、SNSへのpush権限

## レイヤーの作成

1. AWSマネジメントコンソールでCloudShell を起動させます

2. レイヤーを作成します

```sh
mkdir -p dulwich-layer/python
cd dulwich-layer

# Python環境のセットアップ（必要な場合）
python -m venv venv
source venv/bin/activate

# dulwichのインストール
pip install dulwich -t python/

# Layerのzip作成
zip -r dulwich-layer.zip python/

# AWS CLIでLayerを作成
# LayerのARNはJSON出力から取得できます
aws lambda publish-layer-version \
    --layer-name "dulwich-layer" \
    --description "Dulwich library for Python Git operations" \
    --license-info "MIT" \
    --zip-file fileb://dulwich-layer.zip \
    --compatible-runtimes "python3.13" \
    --compatible-architectures "arm64"

# Layer ARNの取得（最新バージョン）
LAYER_ARN=$(aws lambda list-layer-versions --layer-name dulwich-layer --query 'LayerVersions[0].LayerVersionArn' --output text)
```

3. 関数へレイヤーを追加します

```sh
# Lambda関数へのLayer追加
# Lambda関数名を指定してください
aws lambda update-function-configuration \
    --function-name YOUR_LAMBDA_FUNCTION_NAME \
    --layers $LAYER_ARN 
```