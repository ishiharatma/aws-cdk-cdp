#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3StaticWebSiteStack } from '../lib/s3-static-web-site-stack';

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

// Allowed IP address ranges for this app itself
// e.g.) ALLOWED_IP_V4_ADDRESS_RANGES: string[] =  ['192.0.2.1/32','192.0.2.2/32']; 
const ALLOWED_IP_V4_ADDRESS_RANGES: string[] =  [];

new S3StaticWebSiteStack(app, 'S3StaticWebSiteStack', {
  pjName: projectName,
  envName: envName,
  isAutoDeleteObject: isAutoDeleteObject,
  allowedIpV4AddressRanges: ALLOWED_IP_V4_ADDRESS_RANGES,
  env: defaultEnv,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});
// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Environment', envName);
