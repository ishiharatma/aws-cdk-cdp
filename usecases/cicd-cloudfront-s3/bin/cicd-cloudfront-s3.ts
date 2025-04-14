#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CicdCloudfrontS3Stack } from '../lib/cicd-cloudfront-s3-stack';
import * as path from 'path';

const app = new cdk.App();

// environment identifier
const pjName: string = app.node.tryGetContext('project');
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
  region: "us-west-2",
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

new CicdCloudfrontS3Stack(app, `CicdCloudfrontS3Stack-${pjName}-${envName}`, {
  input: {
    pjName: pjName,
    envName: envName,
    repositoryAccountId: '',
    repositoryArn: '',
    repositoryName: '',
    branchName: '',
    isApproveStage: true,
    isAutoDeleteObject: isAutoDeleteObject,
    websiteBucketName: '',
    invalidationFunctionPath: path.join(__dirname, '../../common/src/lambda/cloudfront-create-invalidation/python'),
    distributionId: '',
    s3SyncFunctionPath: path.join(__dirname, '../../common/src/lambda/codedeploy-s3-sync/python'),
    snsNoticeTopicArn: '',
    lambdaLogLevel: 'INFO',
    notificationTopicArn: '',
  },
  env: defaultEnv,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', pjName);
cdk.Tags.of(app).add('Environment', envName);