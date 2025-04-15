import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_kinesis as kinesis,
  aws_logs_destinations as logsdedestinations,
  aws_lambda as lambda,
  aws_logs as logs,
} from 'aws-cdk-lib';
import * as path from 'path';

interface ConstructProps {
}
export class SubscriptionFilterKDSConstruct extends Construct {

  constructor(scope: Construct, id: string, props: ConstructProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    
    const kdsLambdaPath = path.join(__dirname, '../../../common/src/lambda/kinesis-subscription-filter-lambda/python')

    // サブスクリプションフィルター for Amazon Kinesis Data Streams
    const kinesisLogGroup = new logs.LogGroup(this, 'KinesisLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      logGroupName: '/aws/cwl-subscription-filters/kinesis',
    });

    // サブスクリプションフィルター用のKinesis Data Streams IAMロール
    const kinesisRole = new iam.Role(this, 'CwlSubscriptionFiltersKinesisRole', {
      roleName: 'CwlSubscriptionFiltersKinesisRole',
      assumedBy: new iam.ServicePrincipal('logs.amazonaws.com'),
      inlinePolicies: {
        cwlSubscriptionFilters: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kinesis:PutRecord',
              ],
              resources: [
                `arn:aws:kinesis:${region}:${accountId}:stream/cwl-subscription-filters-kinesis`
              ],
            }),
          ],
        }),
      },
    });

    // kinesis ストリーム用Lambda IAM ロール
    const kinesisLambdaRole = new iam.Role(this, 'CwlSubscriptionFiltersKinesisLambdaRole', {
      roleName: 'CwlSubscriptionFiltersKinesisLambdaRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {} 
    });
    // kinesis ストリーム用Lambda
    const kinesisLambda = new lambda.Function(
      this,
      'CwlSubscriptionFiltersKinesisLambdaFunction',
      {
        functionName: 'CwlSubscriptionFiltersKinesisLambdaFunction',
        code: lambda.Code.fromAsset(
          kdsLambdaPath
        ),
        handler: 'index.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_13,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 128,
        timeout: cdk.Duration.seconds(30),
        environment: {
          KINESIS_STREAM_NAME: 'cwl-subscription-filters-kinesis',
        },
        role: kinesisLambdaRole,
      }
    );

    // サブスクリプションフィルター用のKinesis Data Streams
    // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kinesis.Stream.html
    const kinesisStream = new kinesis.Stream(this, 'CwlSubscriptionFiltersKinesis', {
      streamName: 'cwl-subscription-filters-kinesis',
      retentionPeriod: cdk.Duration.hours(24),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: kinesis.StreamEncryption.MANAGED,
      streamMode: kinesis.StreamMode.ON_DEMAND,
      //shardCount: 1, // if you use streamMode: kinesis.StreamMode.PROVISIONED, set shardCount
    });
    // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kinesis.Stream.html#grantwbrreadgrantee
    kinesisStream.grantRead(kinesisLambdaRole);

    // kinesisストリームをLambdaで処理
    kinesisLambda.addEventSourceMapping('KinesisEventSourceMapping', {
      batchSize: 1,
      eventSourceArn: kinesisStream.streamArn,
      startingPosition: lambda.StartingPosition.LATEST,
    });

    // CloudWatchLogsへのサブスクリプションフィルター ERROR または FATAL
    const subscriptionFilter = new logs.SubscriptionFilter(
      this,
      'CwlSubscriptionFilters',
      {
        logGroup: kinesisLogGroup,
        destination: new logsdedestinations.KinesisDestination(kinesisStream),
        filterPattern: logs.FilterPattern.any(
          logs.FilterPattern.stringValue('$.level', '=', 'ERROR'),
          logs.FilterPattern.stringValue('$.level', '=', 'FATAL')
        ),
        filterName: 'CwlSubscriptionFilters',
      }
    );

  }
}
