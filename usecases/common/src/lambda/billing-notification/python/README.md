# billing-notification

## Description
get_cost_and_usage(boto3.client('ce')) を使用して、月初から Lambda 関数を実行した日の前日までの月額合計コストとサービス毎のコストを算出します。

## Environment or Paramater
- TOPICARN
    - 通知先の SNS トピック ARN を指定します。環境変数が存在しない場合は SNS トピックへ送信しません。
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## Test Parameter
特になし

## Note
注意点など
