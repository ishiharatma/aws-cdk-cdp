# iamuser-report-disable-accesskey

## Description
IAM ユーザーをチェックし、長期未ログインの判定を行います。AWSマネジメントコンソールに最後にログイン日時か、AWSのサービスに最後にアクセスした日時のどちらかで判定します。AWSマネジメントコンソールにログインしていないが、CodeCommitへのアクセスがある場合はCodeCommitへのアクセスが最終アクセスと判定されます。また、IAM ユーザーがアクセスキーを発行している場合、アクセスキーの最終利用日時を判定し長期間使用していない場合は、無効化を行います。
この Lambda は Amazon EventBridge のイベントルールによって起動します。

## Environment or Paramater
- DAYS
    - 長期ログインしていないと判断する日数の敷居値を入力します。指定した敷居値を超えた場合に長期未ログインと判定されます。
    - 指定されなかった場合のデフォルトは「60」日です。
- INVALID_GROUP_NAME
    - 長期間ログインしていないユーザの無効化グループ名を指定します。
    - 無効化する敷居値は、DAYS で指定された日数の 1.5 倍です。（DAYS=60の場合は90日）
    - グループ名が指定された場合のみ、長期未ログインユーザを無効化グループに登録します。
- TOPICARN
    - 通知先の SNS トピック ARN を指定します。環境変数が存在しない場合は SNS トピックへ送信しません。
- LOG_LEVEL
    - ログレベルを指定します。デフォルトは 'INFO'です。
- EXCLUDE_USER_TAG_NAME
    - 無効化処理の対象外ユーザーに付与されるタグ名を指定します。タグの存在有無だけで判定されます。

## Test Parameter
特になし

## Note
- 無効化グループに登録されたユーザーを再び使用可能にしたい場合は、AWSマネジメントコンソールにアクセスし、該当 IAM ユーザーをグループから削除してください。

- アクセスキーが無効化され、再び利用可能にしたい場合は、IAM ユーザー自身で有効化してください。