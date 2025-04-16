import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface LogGroupStackProps extends cdk.StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly params: Record<string, any>;
}

export class LogGroupStack extends cdk.Stack {
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: LogGroupStackProps) {
    super(scope, id, props);

    const { pjName, envName, params } = props;

    // スタックにタグを追加
    cdk.Tags.of(this).add("Project", pjName);
    cdk.Tags.of(this).add("Environment", envName);
    cdk.Tags.of(this).add("StackName", cdk.Stack.of(this).stackName);

    // ロググループを作成
    this.logGroup = new logs.LogGroup(this, "SingleLogGroup", {
      logGroupName: `/aws/${pjName}/${envName}/application-logs`,
      retention: logs.RetentionDays.ONE_WEEK,  // 1週間のログ保持期間
      removalPolicy: cdk.RemovalPolicy.DESTROY  // スタック削除時にロググループも削除
    });

    // 出力の追加
    new cdk.CfnOutput(this, "LogGroupName", {
      value: this.logGroup.logGroupName,
      description: "The name of the CloudWatch Logs log group",
      exportName: `${pjName}-${envName}-log-group-name`
    });

    new cdk.CfnOutput(this, "LogGroupArn", {
      value: this.logGroup.logGroupArn,
      description: "The ARN of the CloudWatch Logs log group",
      exportName: `${pjName}-${envName}-log-group-arn`
    });
  }
}