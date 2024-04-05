# cloudfront-logs-move

## Description
CloudFront の標準ログでS3に配置されたログファイルの場所を変更します。
この Lambda は S3 へのファイル追加 のイベントによって起動します。

CloudFront が Amazon S3 バケットに保存する各ログファイルの名前には、次のファイル名形式が使用されます。
日付と時刻は協定世界時 (UTC) です。

```
<optional prefix>/<distribution ID>.YYYY-MM-DD-HH.unique-ID.gz
```

これを以下の階層に移動させます。

```
<optional prefix>/year=YYYY/month=MM/day=DD/hour=HH/<distribution ID>.YYYY-MM-DD-HH.unique-ID.gz
```

## Environment or Paramater
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## Test Parameter
テスト用のパラメータを記載

## Note
注意点など
