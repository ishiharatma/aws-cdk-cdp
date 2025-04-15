import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_logs_destinations as logsdedestinations,
  aws_kinesisfirehose as firehose,
  aws_s3 as s3,
  aws_logs as logs,
} from 'aws-cdk-lib';
import * as path from 'path';

interface ConstructProps {
}
export class SubscriptionFilterFirehoseConstruct extends Construct {

  constructor(scope: Construct, id: string, props: ConstructProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // サブスクリプションフィルター for Amazon Data Firehose
    const firehoseLogGroup = new logs.LogGroup(this, 'FirehoseLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      logGroupName: '/aws/cwl-subscription-filters/firehose',
    });
    // 宛先S3バケット
    const s3Bucket = new s3.Bucket(this, 'CwlSubscriptionFiltersS3Bucket', {
      bucketName: 'cwl-subscription-filters-s3-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // 宛先S3バケットのアクセスポリシー
    const s3BucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('firehose.amazonaws.com')],
      actions: ['s3:PutObject', 's3:GetObject'],
      resources: [`${s3Bucket.bucketArn}/*`],
    });
    s3Bucket.addToResourcePolicy(s3BucketPolicy);
    // サブスクリプションフィルター用のFirehose IAMロール
    const firehoseRole = new iam.Role(this, 'CwlSubscriptionFiltersFirehoseRole', {
      roleName: 'CwlSubscriptionFiltersFirehoseRole',
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      managedPolicies: [
      ],
      inlinePolicies: {
      },
    });
    s3Bucket.grantReadWrite(firehoseRole);
    
    // サブスクリプションフィルター
    // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kinesisfirehose.DeliveryStream.html
    const firehoseDeliveryStream = new firehose.DeliveryStream(this, 'CwlSubscriptionFiltersFirehose', {
      deliveryStreamName: 'cwl-subscription-filters-firehose',
      destination: new firehose.S3Bucket(s3Bucket, {
        // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kinesisfirehose.S3BucketProps.html
        bufferingInterval: cdk.Duration.seconds(60),
        bufferingSize: cdk.Size.mebibytes(1),
        compression: firehose.Compression.GZIP,
        dataOutputPrefix: `AWSLogs/${accountId}/firehose/${region}/`
      }),
      role: firehoseRole,
    });

    // CloudWatchLogsへのサブスクリプションフィルター ERROR または FATAL
    const subscriptionFilter = new logs.SubscriptionFilter(
      this,
      'CwlSubscriptionFilters',
      {
        logGroup: firehoseLogGroup,
        destination: new logsdedestinations.FirehoseDestination(firehoseDeliveryStream),
        filterPattern: logs.FilterPattern.any(
          logs.FilterPattern.stringValue('$.level', '=', 'ERROR'),
          logs.FilterPattern.stringValue('$.level', '=', 'FATAL')
        ),
        filterName: 'CwlSubscriptionFilters',
      }
    );
  }
}
