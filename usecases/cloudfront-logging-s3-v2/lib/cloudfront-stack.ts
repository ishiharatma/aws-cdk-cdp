import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins, 
  aws_s3_deployment as s3deploy,
  aws_logs as logs,
} from 'aws-cdk-lib';
import * as path from 'path';
interface CloudFrontStackProps extends cdk.StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly isAutoDeleteObject?: boolean;
}

export class CloudFrontStack extends cdk.Stack {
  public readonly distribution:cloudfront.IDistribution;
  public readonly loggingBucket:s3.IBucket;
  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);
    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    const contentsPath:string = path.join(__dirname, '../src/static-site');

    // create logging bucket for cloudfront
    this.loggingBucket = new s3.Bucket(this, 'LoggingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    }); 
    // create static website bucket
    const staticWebSiteBucket = new s3.Bucket(this, 'StaticWebSiteBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'ResponseHeadersPolicy',
      {
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.SAME_ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.seconds(63072000),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: 'Cache-Control',
              value: 'no-cache',
              override: true,
            },
            {
              header: 'pragma',
              value: 'no-cache',
              override: true,
            },
            {
              header: 'server',
              value: '',
              override: true,
            },
          ],
        },
      }
    );
    // create cloudfront distribution
    this.distribution = new cloudfront.Distribution(this, 'MyDistribution', {
      comment: 'My distribution',
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // see: https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/PriceClass.html
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, //or PRICE_CLASS_ALL
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      enableIpv6: false,
      defaultRootObject: "index.html",

      defaultBehavior: {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        origin: origins.S3BucketOrigin.withOriginAccessControl(staticWebSiteBucket),
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy
      },
    });

    new s3deploy.BucketDeployment(this, 'IndexHtmlDeploy', {
      sources: [
        s3deploy.Source.asset(contentsPath),
      ],
      destinationBucket: staticWebSiteBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
    });

  }
}
