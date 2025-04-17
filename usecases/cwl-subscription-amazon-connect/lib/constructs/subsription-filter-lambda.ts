import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { Construct } from "constructs";
import { kebabCase, pascalCase } from "change-case-commonjs";
import * as path from "path";

interface LambdaProps {
  readonly subscriptionSNSTopicArn: string;
  readonly alarmSNSTopicArn: string;
  readonly lambdaLogLevel: string;
}

export class SubscriptionFilterLambda extends Construct {
  public readonly logsToSnsFunction: lambda.IFunction;
  public readonly functionErrorAlarm: cloudwatch.Alarm;
  public readonly functionDurationAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const role = new iam.Role(this, "FunctionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
      inlinePolicies: {
        // SNS Publish Policy
        "SnsPublishPolicy": new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "sns:Publish",
              ],
              resources: [
                props.subscriptionSNSTopicArn,
              ],
            }),
          ],
        }),
      },
    });

    const logsToSnsName = "LogsToSns";
    const logsToSnsLogGroupName = `/aws/vendedlogs/lambda/${kebabCase(cdk.Stack.of(this).stackName)}/${kebabCase(logsToSnsName)}`;
    this.logsToSnsFunction = new PythonFunction(this, logsToSnsName, {
      runtime: lambda.Runtime.PYTHON_3_13,
      timeout: cdk.Duration.seconds(60),
      entry: '../common/src/lambda/logs-to-sns/python',
      index: "index.py",
      handler: "lambda_handler",
      role,
      environment: {
        SNS_TOPIC_ARN: props.subscriptionSNSTopicArn,
      },
      bundling: {
        platform: "linux/amd64",
        bundlingFileAccess: cdk.BundlingFileAccess.VOLUME_COPY,
      },
      loggingFormat: lambda.LoggingFormat.JSON,
      applicationLogLevelV2:
        lambda.ApplicationLogLevel[
          props.lambdaLogLevel as keyof typeof lambda.ApplicationLogLevel
        ],
      logGroup: new logs.LogGroup(this, `${pascalCase(logsToSnsName)}LogGroup`, {
        logGroupName : logsToSnsLogGroupName,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.ONE_WEEK,
      }),
    });

    // CloudWatch Alarm for Lambda errors
    const snsTopic = sns.Topic.fromTopicArn(this, 'MonitoringTopic', props.alarmSNSTopicArn);

    // エラー数に基づくアラーム
    this.functionErrorAlarm = new cloudwatch.Alarm(this, 'SubscriptionLambdaErrorAlarm', {
      metric: this.logsToSnsFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Alarm when subscription filter Lambda function throws errors',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.functionErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
    this.functionErrorAlarm.addOkAction(new cloudwatch_actions.SnsAction(snsTopic));

    // Lambda実行時間に基づくアラーム
    this.functionDurationAlarm = new cloudwatch.Alarm(this, 'SubscriptionLambdaDurationAlarm', {
      metric: this.logsToSnsFunction.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'p90',
      }),
      threshold: 50000, // 50秒（タイムアウトは60秒）
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Alarm when subscription filter Lambda function duration is high',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.functionDurationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
    this.functionDurationAlarm.addOkAction(new cloudwatch_actions.SnsAction(snsTopic));
  }
}
