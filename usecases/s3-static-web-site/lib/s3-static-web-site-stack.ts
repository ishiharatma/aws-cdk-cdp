import * as cdk from 'aws-cdk-lib';
import {
  StackProps,
  aws_s3 as s3,
  aws_iam as iam,
} from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';
import { BucketConstruct } from '../../common/lib/construct-bucket';
import { BucketAddPolicyConstruct } from '../../common/lib/construct-bucket-add-bucketpolicy';

interface S3StaticWebSiteStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly isAutoDeleteObject?: boolean;
  readonly allowedIpV4AddressRanges: string[];
}

export class S3StaticWebSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: S3StaticWebSiteStackProps) {
    super(scope, id, props);
    // Bucket for static web site Access Log
    const websiteAccessLogsBucket = new BucketConstruct(this,'WebsiteLogsBucket',{
      pjName: props.pjName,
      envName: props.envName,
      bucketSuffix: 'static-website-logs',
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      isAutoDeleteObject: props.isAutoDeleteObject,
      lifecycleRules: [
        {
          expirationDays: 90,
          abortIncompleteMultipartUploadAfterDays: 7,
        }
      ]
    });
    // Bucket for static web site
    const websiteBucket = new BucketConstruct(this,'WebsiteBucket',{
      pjName: props.pjName,
      envName: props.envName,
      bucketSuffix: 'static-website',
      isAutoDeleteObject: props.isAutoDeleteObject,
      s3ServerAccessLogBucketConstruct: websiteAccessLogsBucket,
      logFilePrefix: '',
      isPublicReadAccess: props.allowedIpV4AddressRanges.length > 0 ? false: true,
      isStaticWebSite: true,
      contentsPath: path.join(__dirname, '../../common/src/static-site/web'),
    });

    if (props.allowedIpV4AddressRanges.length > 0) {
      // Bucket Policy
      const bucketPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject'],
        principals: [new iam.ArnPrincipal('*')],
        resources: [
          websiteBucket.bucket.arnForObjects('*'),
        ],
        conditions: {
          'IpAddress': {
            'aws:SourceIp': props.allowedIpV4AddressRanges
          }
        }
      });
  
      new BucketAddPolicyConstruct(this, 'AddBucketPolicy', {
        pjName: props.pjName,
        envName: props.envName,
        targetS3: websiteBucket,
        s3BucketPolicyStatementJson: bucketPolicy.toJSON(),
      });  
    };

    new cdk.CfnOutput(this, 'BucketWebsiteUrl', {
      value: websiteBucket.bucket.bucketWebsiteUrl,
      description: 'URL for website hosted on S3'
    });

  }
}
