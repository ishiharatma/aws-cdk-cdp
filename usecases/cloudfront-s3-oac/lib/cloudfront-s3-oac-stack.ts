import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LifecycleRule } from '../../common/interface/index';
import { BucketConstruct } from '../../common/lib/construct-bucket';
import { CloudFrontOACConstruct } from '../../common/lib/construct-cloudfront-oac';
import * as path from 'path';
import {aws_s3 as s3} from 'aws-cdk-lib';

interface CloudfrontS3OacStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly isAutoDeleteObject?: boolean;
}

export class CloudFrontS3OacStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudfrontS3OacStackProps) {
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
