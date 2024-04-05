# ecs-taskdefinition-clean

## Description
ECS のタスクに存在するリビジョンで、ECR のイメージが存在しないものを削除します。
この Lambda は Amazon EventBridge のイベントルールによって起動します。

## Environment or Paramater
- PROJECT_NAME
- ENV_NAME
- TASK_DEF_ARN
    - タスク定義の ARN を指定します。
- CONTAINER_NAME
    - コンテナ名を指定します。
- TOPIC_ARN
    - 通知先の SNS トピック ARN を指定します。環境変数が存在しない場合は SNS トピックへ送信しません。
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## Test Parameter
テスト用のパラメータを記載

## Note
注意点など
