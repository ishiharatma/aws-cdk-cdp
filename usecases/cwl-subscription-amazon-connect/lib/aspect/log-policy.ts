import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as destinations from "aws-cdk-lib/aws-logs-destinations";
import { IConstruct } from "constructs";
import { SubscriptionFilterLambda } from "../constructs/subsription-filter-lambda";

export class LogPolicyAspect implements cdk.IAspect {
  constructor(
    private readonly Lambda: SubscriptionFilterLambda,
  ) {}

  public visit(node: IConstruct): void {
    let targetNode = node;
    if (targetNode instanceof logs.LogGroup) {
      targetNode.addSubscriptionFilter("ErrorFilter", {
        destination: new destinations.LambdaDestination(
          this.Lambda.logsToSnsFunction,
        ),
        filterPattern: logs.FilterPattern.literal("?ERROR ?FATAL"),
      });
      targetNode = node.node.defaultChild as logs.CfnLogGroup;
    }
    if (targetNode instanceof logs.CfnLogGroup) {
      const removalPolicy = cdk.RemovalPolicy.DESTROY
      /*
        this.env === C_ENV_PRD
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY;*/
      const retentionPeriod =logs.RetentionDays.ONE_DAY;
      /*
        this.env === C_ENV_PRD
          ? logs.RetentionDays.ONE_YEAR
          : logs.RetentionDays.ONE_WEEK;*/
      targetNode.applyRemovalPolicy(removalPolicy);
      targetNode.addPropertyOverride("RetentionInDays", retentionPeriod);
    }
  }
}
