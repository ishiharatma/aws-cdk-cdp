import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,  
    aws_s3_deployment as s3deploy,
} from 'aws-cdk-lib';
import { BucketConstruct } from "./construct-bucket";
import { ACMConstruct } from "./construct-acm";
import { WAFv2Construct } from "./construct-wafv2";

interface CloudFrontConstructProps {
  readonly pjName: string;
  readonly envName: string;
  readonly domainName?: string;
  readonly staticWebSiteS3: BucketConstruct;
  readonly errorS3?: BucketConstruct;
  readonly enableS3ListBucket?: boolean;
  readonly cloudFrontAccessLogsBucket?: BucketConstruct;
  readonly cloudFrontLogFilePrefix?: string;
  readonly cloudFrontComment?: string;
  readonly contentsPath?: string;
  readonly acm?: ACMConstruct;
  readonly waf?: WAFv2Construct;
}

export class CloudFrontOACConstruct extends Construct {
  public readonly distribution:cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontConstructProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

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
    this.distribution = new cloudfront.Distribution(this,'Distribution',{
      comment: props.cloudFrontComment ?? undefined,
      enabled: true,
      webAclId: props.waf ? props.waf.webACL.attrArn : undefined, 
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // see: https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/PriceClass.html
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, //or PRICE_CLASS_ALL
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      domainNames: props.domainName ? [props.domainName]: undefined,
      certificate: props.domainName
          ? props.acm?.certificate
          : undefined,
      enableIpv6: false,
      defaultRootObject: "index.html",
      defaultBehavior: {
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
          origin: origins.S3BucketOrigin.withOriginAccessControl(props.staticWebSiteS3.bucket),
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy
      },
      errorResponses: [
        {
          ttl: cdk.Duration.minutes(1),
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: "/error.html",
        },
        {
          ttl: cdk.Duration.minutes(1),
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: "/error.html",
        },
      ],
      enableLogging: props.cloudFrontAccessLogsBucket ? true: false,
      logBucket: props.cloudFrontAccessLogsBucket ? props.cloudFrontAccessLogsBucket.bucket : undefined,
      logFilePrefix: props.cloudFrontLogFilePrefix ?? undefined,
    });
//    // OAC
//    const cfnOriginAccessControl = new cdk.aws_cloudfront.CfnOriginAccessControl(
//        this,
//        "OriginAccessControl",
//        {
//          originAccessControlConfig: {
//            name: "Origin Access Control for Website Bucket",
//            originAccessControlOriginType: "s3",
//            signingBehavior: "always",
//            signingProtocol: "sigv4",
//          },
//        }
//    );
//    const cfnDistribution = this.distribution.node
//      .defaultChild as cdk.aws_cloudfront.CfnDistribution;
//
//    // Set OAC
//    cfnDistribution.addPropertyOverride(
//      "DistributionConfig.Origins.0.OriginAccessControlId",
//      cfnOriginAccessControl.attrId
//    );
//    // Set S3 domain name
//    cfnDistribution.addPropertyOverride(
//      "DistributionConfig.Origins.0.DomainName",
//      props.staticWebSiteS3.bucket.bucketRegionalDomainName
//    );
//
//    // Delete OAI
//    cfnDistribution.addPropertyOverride(
//      "DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity",
//      ""
//    );
    // Bucket policy
    props.staticWebSiteS3.bucket.addToResourcePolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: props.enableS3ListBucket
            ? ["s3:GetObject", "s3:ListBucket"]
            : ["s3:GetObject"],
          effect: cdk.aws_iam.Effect.ALLOW,
          principals: [
            new cdk.aws_iam.ServicePrincipal("cloudfront.amazonaws.com"),
          ],
          resources: props.enableS3ListBucket
            ? [
                `${props.staticWebSiteS3.bucket.bucketArn}/*`,
                props.staticWebSiteS3.bucket.bucketArn,
              ]
            : [`${props.staticWebSiteS3.bucket.bucketArn}/*`],
          conditions: {
            StringEquals: {
              "AWS:SourceArn": `arn:aws:cloudfront::${
                cdk.Stack.of(this).account
              }:distribution/${this.distribution.distributionId}`,
            },
          },
        })
    );
    // Deploy
    if (props.contentsPath) {
        new s3deploy.BucketDeployment(this, 'IndexHtmlDeploy', {
            sources: [
              s3deploy.Source.asset(props.contentsPath),
            ],
            destinationBucket: props.staticWebSiteS3.bucket,
            distribution: this.distribution,
            distributionPaths: ["/*"],
        });
    }

  }
}
