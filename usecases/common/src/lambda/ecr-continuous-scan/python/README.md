# ecr-continuous-scan

## Description
ECR のイメージスキャンを手動実行します。ここでは、スキャンを実行するのみで、結果の通知は ecs-scan-notification で実施されます。
この Lambda は Amazon EventBridge のイベントルールによって起動します。


## Environment or Paramater
- BUCKET_NAME
    - スキャン対象の設定ファイルが格納されている S3 バケット名を指定します。
- OBJECT_KEY_NAME
    - スキャン対象の設定ファイルが格納されている S3 オブジェクトのキーを指定します。
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。

## スキャン対象設定ファイル

スキャン対象設定ファイルは以下のようにJsonで指定します。
設定ファイル名は、<環境識別子>.jsonとしておくことで、環境ごとに定義できIaCで自動的に切り替えることができます。

- region
  - ECRのリポジトリが存在するリージョンを記載します。
- registor
  - ECRのリポジトリが存在するAWSアカウントIDを記載します。
- repository
  - ECRのリポジトリ名を記載します。
- tags
  - スキャン対象とするイメージにタグを指定します。

```json
[
	{
		"region": "ap-northeast-1",
		"registry": "123456789012"
		"repository": "foo/bar",
		"tags": [
			"latest"
		]
	},
	{
		"region": "ap-northeast-1",
		"registry": "123456789012",
		"repository": "fuga/hoge",
		"tags": [
			"latest"
		]
	}
]
```

## Test Parameter
テスト用のパラメータを記載

## Note
注意点など
