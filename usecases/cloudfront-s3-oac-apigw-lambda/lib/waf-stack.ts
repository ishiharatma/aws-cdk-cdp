import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { WAFv2Construct } from '../../common/lib/construct-wafv2';

interface WAFv2StackProps extends StackProps {
    readonly pjName: string;
    readonly envName: string;
    readonly isAutoDeleteObject?: boolean;
}
  
export class WAFv2Stack extends cdk.Stack {
  public readonly waf: WAFv2Construct;
  constructor(scope: Construct, id: string, props: WAFv2StackProps) {
    super(scope, id, props);

    new WAFv2Construct(this, 'Default',{
      pjName: props.pjName,
      envName: props.envName,
      webACLNameSuffix: 'cloudfront-oac',
      enableS3Log: true,
      S3LogsBucketExpirationDays: 180,
      S3LogsBucketArchiveDays: 90,
    });
  }
}