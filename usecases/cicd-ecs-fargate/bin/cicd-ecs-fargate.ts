#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CicdEcsFargateStack } from '../lib/cicd-ecs-fargate-stack';

const app = new cdk.App();

// environment identifier
const projectName: string = app.node.tryGetContext('project');
const envName: string = app.node.tryGetContext('env');
// env
const defaultEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const useast1Env = {
// US East (Virginia)
account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "us-east-1",
};
const uswest2Env = {
// US West (Oregon)
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "us-east-1",
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

new CicdEcsFargateStack(app, 'CicdEcsFargateStack', {
  pjName: projectName,
  envName: envName,
  vpcId: `vpc-0a1b2c3d4e5f6g7h8`,
  repositoryAccountId: defaultEnv.account!,
  repositoryName: `${projectName}-${envName}-webapi`,
  repositoryArn: `arn:aws:codecommit:ap-northeast-1:${defaultEnv.account}:${projectName}-${envName}-webapi`,
  ecrRepositoryName: 'backend',
  ecsTaskDefArn: `arn:aws:ecs:${defaultEnv.region}:${defaultEnv.account}:task-definition/clusterName/ecsTaskDefName`,
  ecsClusterArn: `arn:aws:ecs:${defaultEnv.region}:${defaultEnv.account}:cluster/clusterName`,
  serviceName: `backend`,
  imageName: 'backend',
  branchName: envName,
  artifactBucketArn: `arn:aws:s3:::${projectName}-${envName}-backend-artifact-${defaultEnv.account}`,
  approvalTopicArn: `arn:aws:sns:${defaultEnv.region}:${defaultEnv.account}:${projectName}-${envName}-backend-approval`,
  isApprovetage: true,
  snsNoticeHandlerTopicArn: `arn:aws:sns:${defaultEnv.region}:${defaultEnv.account}:${projectName}-${envName}-notice`,
  deploymentTimeoutMinutes: 15,
  buildComputeType: 'SMALL',

  description: 'CICD ECS Fargate',
  env: defaultEnv,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Environment', envName);