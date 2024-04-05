# cloudfront-modify-response-header

## Description
CloudFront に設定する Lambda です。

- セキュリティヘッダー「Content-Security-Policy」を設定します。
- CodeBuild で自動的に付与されたヘッダー「x-amz-meta-codebuild-」を削除します。
- content-type が text/html または text/css の場合に、charset=UTF-8 を付与します。

## Environment or Paramater
なし

## Test Parameter
テスト用のパラメータを記載

## Note
注意点など
