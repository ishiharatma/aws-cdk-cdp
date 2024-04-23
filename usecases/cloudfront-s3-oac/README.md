# CloudFront + S3 + OAC(origin access control)

Amazon CloudFront distribution resource with an Amazon S3 origin using an OAC (origin access control).

OAC (origin access control) を使用した Amazon S3 オリジンを持つ Amazon CloudFront ディストリビューションです。

## アーキテクチャ

![overview](overview.drawio.svg)

- S3サーバーアクセスログ用S3バケット
- CloudFrontのアクセスログ用S3バケット
- Webサイトのコンテンツ用S3バケット
- CloudFront ディストリビューション
- CloudFront OACの設定
- WebサイトのサンプルコンテンツをS3バケットにアップロード

## 料金

[CloudFront + S3 + OAC/OAI - AWS 料金見積りツール](https://calculator.aws/#/estimate?id=41511c073eec10d71c045acf78da8160d5e5f8ca)