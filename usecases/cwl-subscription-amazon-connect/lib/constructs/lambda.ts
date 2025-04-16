import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { PythonFunction,  } from "@aws-cdk/aws-lambda-python-alpha";
import { Construct } from "constructs";
import { kebabCase, pascalCase } from "change-case-commonjs";
import * as path from "path";

interface LambdaProps {
  readonly role: iam.IRole;
  readonly slackWebhookUrl: string;
  readonly lambdaLogLevel?: string;
}

export class Lambda extends Construct {
  public readonly snsToSlackFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const { role, slackWebhookUrl } = props;

    const snsToSlackName = "SnsToSlack";
    const snsToSlackLogGroupName = `/aws/vendedlogs/lambda/${kebabCase(cdk.Stack.of(this).stackName)}/${kebabCase(snsToSlackName)}`;
    this.snsToSlackFunction = new PythonFunction(this, snsToSlackName, {
      runtime: lambda.Runtime.PYTHON_3_13,
      timeout: cdk.Duration.seconds(60),
      entry: path.join(__dirname, '../../../common/src/lambda/sns-to-slack/python'),
      index: "index.py",
      handler: "lambda_handler",
      role,
      environment: {
        SLACK_WEBHOOK_URL: slackWebhookUrl,
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
      logGroup: new logs.LogGroup(this, `${pascalCase(snsToSlackName)}LogGroup`, {
        logGroupName : snsToSlackLogGroupName,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.ONE_WEEK,
      }),
    });

  }
}
