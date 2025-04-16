import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as connect from "aws-cdk-lib/aws-connect";
import { kebabCase, pascalCase } from "change-case-commonjs";
import * as fs from "fs";
import { Construct } from "constructs";

export interface AmazonConnectProps {
  readonly instanceAlias?: string;
  readonly connectInstanceArn?: string;

  readonly contactFlowName?: string;
  readonly connectFlowArn?: string;

  readonly phoneNumberCountryCode: string;
  readonly phoneNumberType: string;
  readonly phoneNumberDescription?: string;
}

export class AmazonConnect extends Construct {
  public readonly instance: connect.CfnInstance;
  public readonly contactFlow: connect.CfnContactFlow;
  public readonly phoneNumber: connect.CfnPhoneNumber;
  public readonly instanceId: string;
  public readonly contactFlowId: string;

  constructor(scope: Construct, id: string, props: AmazonConnectProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    // check Parameter
    if (!props.instanceAlias && !props.connectInstanceArn) {
      throw new Error("Either instanceAlias or connectInstanceArn must be provided.");
    }
    if (!props.contactFlowName && !props.connectFlowArn) {
      throw new Error("Either contactFlowName or connectFlowArn must be provided.");
    }

    // Amazon Connectインスタンスの作成
    if (props.connectInstanceArn) {
        this.instance = new connect.CfnInstance.fromInstanceArn(this, "Instance", {
            instanceArn: props.connectInstanceArn,
        });
    } else {
        this.instance = new connect.CfnInstance(this, "Instance", {
        attributes: {
          inboundCalls: true,
          outboundCalls: true,
          contactLens: false,
        },
        identityManagementType: "CONNECT_MANAGED",
        instanceAlias: props.instanceAlias,
      });
    }
    // コンタクトフロー
    // ../json/amazon-connect-contact/connect-outbound-caller-flow.jsonを読み込み
    const contactFlowJsonPath = `../json/amazon-connect-contact/${kebabCase(C_LAMBDA_AMAZON_CONNECT_OUTBOUND_CALL)}-flow.json`;
    const contactFlowContent = fs.readFileSync(contactFlowJsonPath, 'utf8');

    // コンタクトフローの内容：障害通知メッセージを日本語で設定
    if (props.connectFlowArn) {
        this.contactFlow = new connect.CfnContactFlow.fromContactFlowArn(this, "ContactFlow", {
            contactFlowArn: props.connectFlowArn,
        });
    } else if (props.contactFlowName) {
        this.contactFlow = new connect.CfnContactFlow(this, "ContactFlow", {
        instanceArn: this.instance.attrArn,
        name: props.contactFlowName,
        description: "Contact flow for error notifications",
        type: "CONTACT_FLOW",
        content: contactFlowContent,
        });
    }

    this.phoneNumber = new connect.CfnPhoneNumber(this, "PhoneNumber", {
      targetArn: this.instance.attrArn,
      countryCode: props.phoneNumberCountryCode,
      type: props.phoneNumberType,
      description: props.phoneNumberDescription || "Phone number for error notifications",
    });

    // Lambda関数で使用するためのリソースIDを取得
    this.instanceId = cdk.Fn.select(2, cdk.Fn.split("/", this.instance.attrArn));
    this.contactFlowId = cdk.Fn.select(2, cdk.Fn.split("/", this.contactFlow.attrContactFlowArn));
    this.phoneNumberE164 = this.phoneNumber.attrAddress;

  }
}
