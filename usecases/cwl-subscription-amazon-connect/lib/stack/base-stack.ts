/* eslint-disable cdk/no-public-class-fields */
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { Lambda } from "../constructs/lambda";
import { Sns } from "../constructs/sns";
import { SubscriptionFilterLambda } from "../constructs/subscription-filter-lambda";

interface BaseStackProps extends cdk.StackProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly params: Record<string, any>;
}

export class BaseStack extends cdk.Stack {
  public readonly opsLambda: Lambda;
  public readonly opsSns: Sns;
  public readonly subscriptionFilterLambda: SubscriptionFilterLambda; 

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    const { params } = props;
    cdk.Tags.of(this).add("StackName", cdk.Stack.of(this).stackName);

    const lambdaFunctionRole = new iam.Role(this, "ConnectFunctionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
      inlinePolicies: {},
    });

    // 監視系リソース
    this.opsLambda = new Lambda(this, "OpsLambda", {
      role: lambdaFunctionRole,
      slackWebhookUrl: params.ops.webhookUrl,
      lambdaLogLevel: params.lambda.lambdaLogLevel ?? "INFO",
    });
    
    // SNS監視通知リソース
    this.opsSns = new Sns(this, "OpsSns", {
        lambdaArns: {
          critical: [
            this.opsLambda.snsToSlackFunction.functionArn,
          ],
        },
        topics: {
          critical: `test-critical-${cdk.Stack.of(this).stackName}`,
          error: `test-error-${cdk.Stack.of(this).stackName}`,
        },
        envName: 'dev',
    });
    for (const topic in this.opsSns.topics) {
        this.opsSns.topics[topic].grantPublish(lambdaFunctionRole);
    }

    this.subscriptionFilterLambda = new SubscriptionFilterLambda(this, "SubscriptionFilterLambda", {
      subscriptionSNSTopicArn: this.opsSns.topics["critical"].topicArn,
      alarmSNSTopicArn: this.opsSns.topics["error"].topicArn,
      lambdaLogLevel: params.lambda.lambdaLogLevel ?? "INFO",
    });


  }
}
