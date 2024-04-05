# cloudwatch-logs-retentionIndays-auto-configure

## Description
CloudWatch のロググループが作成されたイベントをトリガーに実行されます。ロググループが作成されたタイミングで、ロググループの保持期限を設定し、無期限でログが蓄積されないようにします。

## Environment or Paramater
- RETENTION_IN_DAYS
    - ロググループの保持期限日数を指定します。指定されなかった場合のデフォルトは、「30」日です。
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## Test Parameter
テスト用のパラメータを記載

## Note
注意点など
