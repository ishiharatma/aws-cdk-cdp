# start-stop-ec2-instance

## Description

SSM_CALENDAR_ARNで指定したChange Calendar のステータスを判定して、OPENであれば実行します。

SSM_CALENDAR_ARNが未指定の場合は、カレンダー判定を行わずにそのまま実行します。

## Environment or Paramater
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## Test Parameter
テスト用のパラメータを記載

```json
{
  "Action": "Start",
  "SSMCalendarArn": "arn:aws:ssm:ap-northeast-1:123456789012:document/test",
  "InstanceId": "i-066cfd600ba9e69c5"
}

{
  "Action": "Stop",
  "SSMCalendarArn": "arn:aws:ssm:ap-northeast-1:123456789012:document/test",
  "InstanceId": "i-066cfd600ba9e69c5"
}
```

## Note
注意点など

Lambda 実行ロールに下記が必要です。

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "ssm:GetCalendarState",
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ec2:Describe*",
                "ec2:Start*",
                "ec2:Stop*"
            ],
            "Resource": "*"
        }
    ]
}
```