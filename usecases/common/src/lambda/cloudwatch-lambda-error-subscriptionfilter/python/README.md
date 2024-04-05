# cloudwatch-lambda-error-subscriptionfilter

## Description
CloudWatch のサブスクリプションフィルターに設定します。ロググループとログストリーム名と検知したエラーメッセージを指定された SNS トピックに配信します。

## Environment or Paramater
- TOPIC_ARNS
    - 通知先の SNS トピック ARN を指定します。環境変数が存在しない場合は SNS トピックへ送信しません。複数の場合は、カンマ区切りで指定します。
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## Test Parameter
テスト用のパラメータを記載

## Note
注意点など
