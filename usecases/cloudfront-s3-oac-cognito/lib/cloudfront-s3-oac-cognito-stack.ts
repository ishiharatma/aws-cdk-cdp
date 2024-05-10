import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LifecycleRule } from '../../common/interface/index';
import { BucketConstruct } from '../../common/lib/construct-bucket';
import { CloudFrontOACConstruct } from '../../common/lib/construct-cloudfront-oac';
import * as path from 'path';
import {
  aws_s3 as s3,
  aws_cognito as cognito,
} from 'aws-cdk-lib';

interface CloudfrontS3OacCognitoStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly isAutoDeleteObject?: boolean;
}

export class CloudfrontS3OacCognitoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudfrontS3OacCognitoStackProps) {
    super(scope, id, props);

    // Bucket for static web site Access Log
    const websiteAccessLogsBucket = new BucketConstruct(this,'WebsiteLogsBucket',{
      pjName: props.pjName,
      envName: props.envName,
      bucketSuffix: 'website-accesslogs-oac',
      isAutoDeleteObject: props.isAutoDeleteObject,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      lifecycleRules: [
        {
          expirationDays: 90,
          abortIncompleteMultipartUploadAfterDays: 7,
          //transitions: [
          //  {
          //    storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          //    transitionAfter: cdk.Duration.days(0),
          //  }
          //]
        }
      ]
    });
    // Bucket for CloudFront Access Log
    const cloudfrontAccessLogsBucket = new BucketConstruct(this,'CloudFrontLogsBucket',{
      pjName: props.pjName,
      envName: props.envName,
      bucketSuffix: 'cloudfront-accesslogs-oac',
      isAutoDeleteObject: props.isAutoDeleteObject,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      lifecycleRules: [
        {
          expirationDays: 90,
          abortIncompleteMultipartUploadAfterDays: 7
        }
      ]
    });

    // Bucket for static web site
    const websiteBucket = new BucketConstruct(this,'WebsiteBucket',{
      pjName: props.pjName,
      envName: props.envName,
      bucketSuffix: 'website-oac',
      isAutoDeleteObject: props.isAutoDeleteObject,
      s3ServerAccessLogBucketConstruct: websiteAccessLogsBucket,
      logFilePrefix: '',
    });

    // Cognito
    const userPool = new cognito.UserPool(this, 'CognitoUserPool', {
      userPoolName: '',
      selfSignUpEnabled: false, // セルフサインアップ
      signInAliases: {email: true}, // サインイン
      signInCaseSensitive: false, // サインインエイリアスの大文字小文字を区別するかどうか
      standardAttributes: {
        // 必須の属性
        givenName: {required: true},
        familyName: {required: true},
      },
      customAttributes: {

      },
      mfa: cognito.Mfa.REQUIRED, // MFA を必須、任意の場合は.OPTIONAL
      mfaSecondFactor: { // 
        sms: true,
        otp: true,
      },
      passwordPolicy: { // パスワードポリシー
        minLength: 12,
        requireLowercase: true, // 小文字
        requireUppercase: true, // 大文字
        requireDigits: true, // 数字
        requireSymbols: true, // 記号
        tempPasswordValidity: cdk.Duration.days(7), // 仮パスワードの有効期限
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, // ユーザーアカウントの復旧設定
      userVerification: { // 認証メッセージの設定
        emailSubject: 'Verify email message',
        emailBody: 'Your verification code is {####}.',
        emailStyle: cognito.VerificationEmailStyle.CODE,
        smsMessage: "Your verification code is {####}."
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // CDK削除時の設定
    });
    // Cognito カスタムドメイン

    // アプリケーションクライアント設定
    userPool.addClient('Application', {
      userPoolClientName: 'application', // クライアント名
      generateSecret: false, // シークレットの作成設定
      enableTokenRevocation: true, // 高度な認証設定のトークンの取り消しを有効化
      preventUserExistenceErrors: true, // 高度な認証設定のユーザー存在エラーの防止を有効化
      oAuth: {
        flows: { // OAuth 付与タイプ設定
          authorizationCodeGrant: true, // 認証コード付与
          implicitCodeGrant: true, // 暗黙的な付与
        },
        callbackUrls: [ // 許可されているコールバックURL設定
          'https://sample.com/app',
          'https://oauth.pstmn.io/v1/callback', // ポストマンアプリ用
        ],
        logoutUrls: [ // 許可されているサインアウトURL設定
          'https://sample.com/app',
        ],
        scopes: [ // カスタムスコープ
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PHONE,
          cognito.OAuthScope.PROFILE,
        ],
      }
    });

    // CloudFront
    const cloudFront = new CloudFrontOACConstruct(this, 'CloudFrontOAC',{
      pjName: props.pjName,
      envName: props.envName,
      staticWebSiteS3: websiteBucket,
      cloudFrontComment: 'CloudFront for OAC',
      cloudFrontAccessLogsBucket: cloudfrontAccessLogsBucket,
      contentsPath: path.join(__dirname, '../src/static-site/web'),
      cloudFrontLogFilePrefix: '',
    })

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: cloudFront.distribution.distributionDomainName,
    });

  }
}
