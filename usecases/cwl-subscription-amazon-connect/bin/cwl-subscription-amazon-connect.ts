#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { myStage } from '../lib/stage/stage';
import { cp } from 'fs';
import { LogPolicyAspect } from "../lib/aspect/log-policy";
import { BaseStack } from "../lib/stack/base-stack";
import { LogGroupStack } from "../lib/stack/log-group-stack";
import { CwlSubscriptionAmazonConnectStack } from "../lib/stack/cwl-subscription-amazon-connect-stack";

const app = new cdk.App();
// environment identifier
const pjName: string = "sample"; //app.node.tryGetContext('project');
const envName: string = "dev"; //app.node.tryGetContext('env');

// 環境変数から取得。環境変数がない場合はコンテキストから取得
const instanceArn: string = process.env.INSTANCE_ARN || app.node.tryGetContext('instanceArn');
const contactFlowArn: string = process.env.CONTACT_FLOW_ARN || app.node.tryGetContext('contactFlowArn');
const phoneNumber: string = process.env.PHONE_NUMBER || app.node.tryGetContext('phoneNumber');

// 環境変数の存在確認
if (!instanceArn) {
  throw new Error('INSTANCE_ARN環境変数またはinstanceArnコンテキストが設定されていません');
}
console.log(`instanceArn: ${instanceArn}`);
console.log(`instanceId: ${instanceArn.split('/').pop()}`);

if (!contactFlowArn) {
  throw new Error('CONTACT_FLOW_ARN環境変数またはcontactFlowArnコンテキストが設定されていません');
}
console.log(`contactFlowArn: ${contactFlowArn}`);
console.log(`contactFlowId: ${contactFlowArn.split('/').pop()}`);

if (!phoneNumber) {
  throw new Error('PHONE_NUMBER環境変数またはphoneNumberコンテキストが設定されていません');
}
console.log(`phoneNumber: ${phoneNumber}`);

// env
const defaultEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
// Whether to force delete an S3 bucket even if objects exist
// Determine by environment identifier
//const isAutoDeleteObject:boolean = envName.match(/^(dev|test|stage)$/) ? true: false;
// Since it is a test, it can be deleted
const isAutoDeleteObject = true;

// Before you can use cdk destroy to delete a deletion-protected stack, you must disable deletion protection for the stack in the management console.
// const isTerminationProtection:boolean = envName.match(/^(dev|test)$/) ? false: true;
// Since it is a test, it can be deleted
const isTerminationProtection=false;



/*
new myStage(app, envName, {
  params: {
    amazonConnect: {
      instanceId: instanceArn.split('/').pop(), // Extract the instance ID from the ARN
      contactFlowId: contactFlowArn.split('/').pop(), // Extract the contact flow ID from the ARN
      outboundPhoneNumber: phoneNumber,
      respondersGroupId: 'default',
    },
    ops: {
      webhookUrl: 'https://example.com/webhook',
    },
    env: defaultEnv,
  },
});
*/
const params = {
  amazonConnect: {
    instanceId: instanceArn.split('/').pop(), // Extract the instance ID from the ARN
    contactFlowId: contactFlowArn.split('/').pop(), // Extract the contact flow ID from the ARN
    outboundPhoneNumber: phoneNumber,
    respondersGroupId: 'default',
  },
  ops: {
    webhookUrl: 'https://example.com/webhook',
  },
  env: defaultEnv,
  lambda: {
    lambdaLogLevel: 'DEBUG',
  },
};


    const baseStackName = "baseStackName";

    const baseStack = new BaseStack(app, 'BaseStack', {
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
    const logGroupStack = new LogGroupStack(app, 'LogGroupStack', {
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
      app,`AmazonConnectOutboundCaller`, {
        stackName: `${baseStackName}AmazonConnectOutboundCaller`,
        params,
        opsSns: baseStack.opsSns,
        env: {
          account: params.env.account,
          region: params.env.region,
        },
      });

// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', pjName);
cdk.Tags.of(app).add('Environment', envName);