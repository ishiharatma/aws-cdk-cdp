#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CloudFrontStack } from '../lib/cloudfront-stack';
import { CloudFrontLoggingS3V2Stack } from '../lib/cloudfront-logging-s3-v2-stack';

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
// Whether to force delete an S3 bucket even if objects exist
// Determine by environment identifier
//const isAutoDeleteObject:boolean = envName.match(/^(dev|test|stage)$/) ? true: false;
// Since it is a test, it can be deleted
const isAutoDeleteObject = true;

// Before you can use cdk destroy to delete a deletion-protected stack, you must disable deletion protection for the stack in the management console.
// const isTerminationProtection:boolean = envName.match(/^(dev|test)$/) ? false: true;
// Since it is a test, it can be deleted
const isTerminationProtection=false;

const clodFrontStack = new CloudFrontStack(app, 'CloudFrontStack', {
  stackName: `CloudFrontLoggingS3V2Stack-CloudFront-${pjName}-${envName}`,
  description: 'CloudFront',
  pjName: pjName,
  envName: envName,
  isAutoDeleteObject: isAutoDeleteObject,
  env: defaultEnv,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

const cloudFrontLoggingS3V2Stack = new CloudFrontLoggingS3V2Stack(app, 'CloudFrontLoggingS3V2Stack', {
  stackName: `CloudFrontLoggingS3V2Stack-Logs-${pjName}-${envName}`,
  description: 'logging v2 for CloudFront',
  pjName: pjName,
  envName: envName,
  distributionId: clodFrontStack.distribution.distributionId,
  loggingBucketArn: clodFrontStack.loggingBucket.bucketArn,
  env: useast1Env,
  crossRegionReferences:true,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', pjName);
cdk.Tags.of(app).add('Environment', envName);
