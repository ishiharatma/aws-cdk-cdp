import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Sns } from '../constructs/sns';
import { AmazonConnect } from '../constructs/amazon-connect-outbound-caller';
interface AmazonConnectOutboundCallerStackProps extends cdk.StackProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly params: Record<string, any>;
  readonly opsSns: Sns;
}
export class CwlSubscriptionAmazonConnectStack extends cdk.Stack {
  public readonly amazonConnectOutboundCaller: AmazonConnect;
  constructor(scope: Construct, id: string, props: AmazonConnectOutboundCallerStackProps) {
    super(scope, id, props);

    const { params,opsSns } = props;
    cdk.Tags.of(this).add("StackName", cdk.Stack.of(this).stackName);

    // Amazon Connect架電機能の設定
    this.amazonConnectOutboundCaller = new AmazonConnect(this, "AmazonConnectOutboundCaller", {
      instanceId: params.amazonConnect.instanceId,
      contactFlowId: params.amazonConnect.contactFlowId,
      phoneSourceNumber: params.amazonConnect.outboundPhoneNumber,
      respondersGroupId: params.amazonConnect.respondersGroupId || "default",
      callStatusTableName: "CallStatus",
      inProgressTableName: "InProgress",
      respondersTableName: "Responders",
      callHistoryTableName: "CallHistory",
      outboundCallerLambdaName: "ConnectOutboundCaller",
      snsTopic: opsSns.topics["critical"],
      lambdaLogLevel: params.lambda.lambdaLogLevel ?? "INFO",
    });

  }
}
