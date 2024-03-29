import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { LifecycleRule } from '../interface/index'
import * as path from 'path';

interface S3BucketProps {
    readonly pjName: string;
    readonly envName: string;
    readonly bucketPrefix?: string;
    readonly bucketSuffix?: string;
    readonly isAutoDeleteObject?: boolean;
    readonly lifecycleRules?: LifecycleRule[];
    readonly s3ServerAccessLogBucketConstruct?: BucketConstruct;
    readonly logFilePrefix?: string;
    readonly accessControl?: s3.BucketAccessControl;
}

export class BucketConstruct extends Construct {
  public readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string, props: S3BucketProps) {
      super(scope, id);
      const accountId = cdk.Stack.of(this).account;
      const region = cdk.Stack.of(this).region;
      const bucketNames: string[] = [];
      if (props.bucketPrefix) {
        bucketNames.push(props.bucketPrefix);
      }
      bucketNames.push(props.pjName);
      bucketNames.push(props.envName);
      if (props.bucketSuffix) {
        bucketNames.push(props.bucketSuffix);
      }
      bucketNames.push(accountId);
      this.bucket = new s3.Bucket(this, 'S3Bucket', {
          bucketName: bucketNames.join('.'),
          encryption: s3.BucketEncryption.S3_MANAGED,
          blockPublicAccess: new cdk.aws_s3.BlockPublicAccess({
              blockPublicAcls: true,
              blockPublicPolicy: true,
              ignorePublicAcls: true,
              restrictPublicBuckets: true,
          }),
          accessControl: props.accessControl,
          // see: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html#access-logs-choosing-s3-bucket
          //objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
          enforceSSL: true,
          versioned: false,
          removalPolicy: props.isAutoDeleteObject ? cdk.RemovalPolicy.DESTROY: undefined,
          autoDeleteObjects: props.isAutoDeleteObject ? props.isAutoDeleteObject : undefined,
          serverAccessLogsBucket: props.s3ServerAccessLogBucketConstruct?.bucket,
          serverAccessLogsPrefix: props.logFilePrefix,
      });
      props.lifecycleRules?.forEach((rule) => {
        this.bucket.addLifecycleRule({
            enabled: true,
            id: rule.ruleNameSuffix
                ? `Delete-After-${rule.expirationDays}Days-${rule.ruleNameSuffix}`
                : `Delete-After-${rule.expirationDays}Days`,
            expiration: cdk.Duration.days(rule.expirationDays),
            prefix: rule.prefix,
            expiredObjectDeleteMarker: false,
            abortIncompleteMultipartUploadAfter: rule.abortIncompleteMultipartUploadAfterDays 
                ? cdk.Duration.days(rule.abortIncompleteMultipartUploadAfterDays)
                : undefined,
            transitions: rule.transitions ?? [],
        });
      });
  }
}