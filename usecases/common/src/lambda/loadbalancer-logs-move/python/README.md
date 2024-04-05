# loadbalancer-logs-move

## Description
ロードバランサーのログでS3に配置されたログファイルの場所を変更します。
この Lambda は S3 へのファイル追加 のイベントによって起動します。

ロードバランサー が Amazon S3 バケットに保存する各ログファイルの名前には、次のファイル名形式が使用されます。
日付と時刻は協定世界時 (UTC) です。

```
AWSLogs/<アカウントID>/elasticloadbalancing/<リージョン>/<year>/<month>/<day>/<アカウント ID>_elasticloadbalancing_<リージョン>_app.<ロードバランサー名>.XXXX.YYYYMMDDTHHMI_<IP>_unique-ID.log.gz
```

これを以下の階層に移動させます。

```
<optional prefix>/year=YYYY/month=MM/day=DD/hour=HH/<オリジナルのファイル名>
```

## Environment or Paramater
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## Test Parameter
テスト用のパラメータを記載

## Note
注意点など
