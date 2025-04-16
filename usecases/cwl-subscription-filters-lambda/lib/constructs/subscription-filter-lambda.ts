import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs_destinations as logsdedestinations,
  aws_sns as sns,
  aws_logs as logs,
} from 'aws-cdk-lib';
import * as path from 'path';

interface ConstructProps {
}
export class SubscriptionFilterLambdaConstruct extends Construct {

  constructor(scope: Construct, id: string, props: ConstructProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const logs2SnsLambdaPath = path.join(__dirname, '../../../common/src/lambda/logs-to-sns/python');
    const sns2LambdaPath = path.join(__dirname, '../../../common/src/lambda/sns-logs-test/python');

    // サブスクリプションフィルター for Lambda
    const lambdaLogGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      logGroupName: '/aws/cwl-subscription-filters/lambda',
    });
    // サブスクリプションフィルターの宛先SNS
    const snsTopic = new cdk.aws_sns.Topic(this, 'CwlSubscriptionFiltersTopic', {
      displayName: 'CwlSubscriptionFiltersTopic',
      topicName: 'CwlSubscriptionFiltersTopic',
    });
    // サブスクリプションフィルター用のLambda IAMロール
    const lambdaRole = new iam.Role(this, 'CwlSubscriptionFiltersLambdaRole', {
      roleName: 'CwlSubscriptionFiltersLambdaRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: { 
        cwlSubscriptionFilters: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions:[
              "logs:Get*",
              "sns:Publish",
            ],
            resources: ["*"],
          }),
         ]
      })}
    });
    // サブスクリプションフィルター用のLambda
    const lambdaFunction = new lambda.Function(
      this,
      'CwlSubscriptionFiltersLambdaFunction',
      {
        functionName: 'CwlSubscriptionFiltersLambdaFunction',
        code: lambda.Code.fromAsset(
          logs2SnsLambdaPath
        ),
        handler: 'index.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_13,
        timeout: cdk.Duration.seconds(30),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          SNS_TOPIC_ARN: snsTopic.topicArn,
          LOG_LEVEL: 'INFO',
        },
        role: lambdaRole,
        tracing: lambda.Tracing.ACTIVE,
      }
    );
    // SNSトピックのサブスクリプション用Lambda IAMロール
    const snsRole = new iam.Role(this, 'CwlSubscriptionFiltersSnsRole', {
      roleName: 'CwlSubscriptionFiltersSnsRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {} 
    });
    // SNSトピックのサブスクリプション用Lambda
    const snsLambdaFunction = new lambda.Function(
      this,
      'SnsLambdaFunction',
      {
        functionName: 'SnsLambdaFunction',
        code: lambda.Code.fromAsset(
          sns2LambdaPath
        ),
        handler: 'index.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_13,
        timeout: cdk.Duration.seconds(30),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          LOG_LEVEL: 'INFO',
        },
        role: snsRole,
        tracing: lambda.Tracing.ACTIVE,
      }
    );
    // SNSのサブスクリプションからLambdaの呼び出しを許可
    snsLambdaFunction.addPermission('SnsPermission', {
      principal: new iam.ServicePrincipal('sns.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: snsTopic.topicArn,
    });

    // SNSトピックのサブスクリプション
    new sns.Subscription(this, 'CwlSubscriptionFiltersSnsSubscription', {
      topic: snsTopic,
      endpoint: snsLambdaFunction.functionArn,
      protocol: sns.SubscriptionProtocol.LAMBDA,
      filterPolicy: {
        // SNSトピックのフィルターポリシー
        // 例: severity "ERROR"のメッセージのみを受信する 
          level: cdk.aws_sns.SubscriptionFilter.stringFilter({
            allowlist: ['ERROR', 'FATAL'],
          }), 
          severity: cdk.aws_sns.SubscriptionFilter.stringFilter({
            allowlist: ['HIGH','CRITICAL'],
          }),
        },
      }
    );
    // CloudWatchLogsへのサブスクリプションフィルター ERROR または FATAL
    const subscriptionFilter = new logs.SubscriptionFilter(
      this,
      'CwlSubscriptionFilters',
      {
        logGroup: lambdaLogGroup,
        destination: new logsdedestinations.LambdaDestination(lambdaFunction),
        filterPattern: logs.FilterPattern.any(
          logs.FilterPattern.stringValue('$.level', '=', 'ERROR'),
          logs.FilterPattern.stringValue('$.level', '=', 'FATAL')
        ),
        filterName: 'CwlSubscriptionFilters',
      }
    );

  }
}
