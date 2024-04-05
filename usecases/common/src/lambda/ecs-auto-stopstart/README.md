# ecs-auto-stopstart

## Description
ECS のタスクを停止または起動させます。本番環境以外でのコスト削減を目的としています。
この Lambda は Amazon EventBridge のイベントルールによって起動します。


## Environment or Paramater
- PROJECT_NAME
- ENV_NAME
- CLUSTER_NAME
    - ECS のクラスター名を指定します。
- SERVICE_NAME
    - ECS のサービス名を指定します。
- SERVICE_PREFIX
    - ログやメッセージなどに使用するサービス名の短縮名称を指定します。
- TOPIC_ARN
    - 通知先の SNS トピック ARN を指定します。環境変数が存在しない場合は SNS トピックへ送信しません。
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## Test Parameter
テスト用のパラメータを記載

## Note
注意点など
