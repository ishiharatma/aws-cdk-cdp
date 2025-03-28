#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SessionManagerEc2OverVpceStack } from '../lib/session-manager-ec2-over-vpce-stack';


const app = new cdk.App();

// environment identifier
const envName: string = app.node.tryGetContext('env');
const pjName: string = app.node.tryGetContext('project');

// env
const defaultEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };
  
const useast1Env = {
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

new SessionManagerEc2OverVpceStack(app, 'SessionManagerEc2OverVpceStack', {
  pjName: pjName,
  envName: envName,
  vpcCIDR: '10.0.0.0/16',
  isAutoDeleteObject: isAutoDeleteObject,
  description: 'Session Manager EC2 Over VPCE',
  env: defaultEnv,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', pjName);
cdk.Tags.of(app).add('Environment', envName);
