import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { Construct } from "constructs";
import { kebabCase, pascalCase } from "change-case-commonjs";
import * as path from "path";

interface LambdaProps {
  readonly snsTopicArn: string;
}

export class SubscriptionFilterLambda extends Construct {
  public readonly logsToSnsFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const { snsTopicArn } = props;

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
                snsTopicArn,
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
      entry: path.join(__dirname, '../../../common/src/lambda/logs-to-sns/python'),
      index: "index.py",
      handler: "index.lambda_handler",
      role,
      environment: {
        SNS_TOPIC_ARN: snsTopicArn,
      },
      bundling: {
        platform: "linux/amd64",
      },
      loggingFormat: lambda.LoggingFormat.JSON,
      logGroup: new logs.LogGroup(this, `${pascalCase(logsToSnsName)}LogGroup`, {
        logGroupName : logsToSnsLogGroupName,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.ONE_WEEK,
      }),
    });
  }
}
