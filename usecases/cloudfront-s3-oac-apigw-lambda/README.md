# CloudFront + S3 + OAC(origin access control) + API Gateway + Lambda

This is an Amazon CloudFront distribution with Amazon S3 and API Gateway as origins using OAC (origin access control).

OAC (origin access control) を使用した Amazon S3 とAPIGatewayをオリジンに持つ Amazon CloudFront ディストリビューションです。

## **Sorry!Under construction!!**

![overview](overview.drawio.svg)

- WAFログ用S3バケット
- WebACL

- S3サーバーアクセスログ用S3バケット
- CloudFrontのアクセスログ用S3バケット
- Webサイトのコンテンツ用S3バケット
- API Gateway
- Lambda
- CloudFront ディストリビューション
- CloudFront OACの設定
- WebサイトのサンプルコンテンツをS3バケットにアップロード
