#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CloudfrontS3OacApigwLambdaStack } from '../lib/cloudfront-s3-oac-apigw-lambda-stack';
import { WAFv2Stack } from '../lib/waf-stack';

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

// WAF on us-east1
const wafStack  = new WAFv2Stack(app, '', {
  pjName: projectName,
  envName: envName,
  description: 'CloudFront WAF.',
  isAutoDeleteObject: isAutoDeleteObject,
  env: useast1Env,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});


new CloudfrontS3OacApigwLambdaStack(app, `CloudfrontS3OacApigwLambdaStack-${projectName}-${envName}`, {
  pjName: projectName,
  envName: envName,
  description: 'Deliver S3 static website using OAC with CloudFront',
  isAutoDeleteObject: isAutoDeleteObject,
  env: defaultEnv,
  waf: wafStack.waf,
  crossRegionReferences: true,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});
// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Environment', envName);
