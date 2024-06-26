import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BucketConstruct } from '../../common/lib/construct-bucket';
import { CloudFrontOAIConstruct } from '../../common/lib/construct-cloudfront-oai';
import * as path from 'path';
import { aws_s3 as s3 } from 'aws-cdk-lib';

interface CloudFrontS3OaiStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly isAutoDeleteObject?: boolean;
}

export class CloudFrontS3OaiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudFrontS3OaiStackProps) {
    super(scope, id, props);

    // Bucket for static web site Access Log
    const websiteAccessLogsBucket = new BucketConstruct(this,'WebsiteLogsBucket',{
      pjName: props.pjName,
      envName: props.envName,
      bucketSuffix: 'website-logs-oai',
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      isAutoDeleteObject: props.isAutoDeleteObject,
      lifecycleRules: [
        {
          expirationDays: 90,
          abortIncompleteMultipartUploadAfterDays: 7,
        }
      ]
    });
    // Bucket for CloudFront Access Log
    const cloudfrontAccessLogsBucket = new BucketConstruct(this,'CloudFrontLogsBucket',{
      pjName: props.pjName,
      envName: props.envName,
      bucketSuffix: 'cloudfront-logs-oai',
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      isAutoDeleteObject: props.isAutoDeleteObject,
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
      bucketSuffix: 'website-oai',
      isAutoDeleteObject: props.isAutoDeleteObject,
      s3ServerAccessLogBucketConstruct: websiteAccessLogsBucket,
      logFilePrefix: '',
    });
    // CloudFront
    const cloudFront = new CloudFrontOAIConstruct(this, 'CloudFrontOAI',{
      pjName: props.pjName,
      envName: props.envName,
      staticWebSiteS3: websiteBucket,
      cloudFrontComment: 'CloudFront for OAI',
      cloudFrontAccessLogsBucket: cloudfrontAccessLogsBucket,
      contentsPath: path.join(__dirname, '../src/static-site/web'),
      cloudFrontLogFilePrefix: '',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: cloudFront.distribution.distributionDomainName,
    });

  }
}
