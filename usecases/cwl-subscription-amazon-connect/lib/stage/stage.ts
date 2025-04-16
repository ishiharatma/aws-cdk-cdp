import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { LogPolicyAspect } from "../aspect/log-policy";
import { BaseStack } from "../stack/base-stack";
import { LogGroupStack } from "../stack/log-group-stack";
import { CwlSubscriptionAmazonConnectStack } from "../stack/cwl-subscription-amazon-connect-stack";

interface myStageProps extends cdk.StageProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly params: any;
}

export class myStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: myStageProps) {
    super(scope, id, props);

    const params = props.params;
    const baseStackName = "baseStackName";
    const pjName = params.project || "project";
    const envName = id;

    const baseStack = new BaseStack(this, 'BaseStack', {
        stackName: baseStackName,
        params,
        env: {
          account: params.env.account,
          region: params.env.region,
        },
    });

    const logPolicyAspect = new LogPolicyAspect(
      baseStack.subscriptionFilterLambda,
    );

    // 新しいロググループスタックを追加
    const logGroupStack = new LogGroupStack(this, 'LogGroupStack', {
      stackName: `${baseStackName}LogGroup`,
      pjName,
      envName,
      params,
      env: {
        account: params.env.account,
        region: params.env.region,
      },
    });
    cdk.Aspects.of(logGroupStack).add(logPolicyAspect);

    const amazonConnectOutboundCallerStack = new CwlSubscriptionAmazonConnectStack(
      this,`AmazonConnectOutboundCaller`, {
        stackName: `${baseStackName}AmazonConnectOutboundCaller`,
        params,
        opsSns: baseStack.opsSns,
        env: {
          account: params.env.account,
          region: params.env.region,
        },
      });
  }
}
