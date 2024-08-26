#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcWithNatinstanceV2Stack } from '../lib/vpc-with-natinstance-v2-stack';
import { TestInstanceStack } from '../../common/stacks/test-instance-stack';

const app = new cdk.App();

// environment identifier
const envName: string = app.node.tryGetContext('env');
const projectName: string = app.node.tryGetContext('project');

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

const vpc = new VpcWithNatinstanceV2Stack(app, `VPCWithNATStack-${projectName}-${envName}`, {
    pjName: projectName,
    envName: envName,
    vpcCIDR: '10.0.0.0/16',
    isAutoDeleteObject: isAutoDeleteObject,
    natInstanceStartCronSchedule: "cron(0 23 ? * SUN-THU *)",
    natInstanceStopCronSchedule: "cron(30 9 ? * MON-FRI *)",
    //isAttacheElasticIp: true,
    description: 'VPC with custom NAT instance',
    env: defaultEnv,
    terminationProtection: isTerminationProtection, // Enabling deletion protection
});

new TestInstanceStack(app, `TestInstanceStack-${projectName}-${envName}`, {
  pjName: projectName,
  envName: envName,
  vpc: vpc.vpc,
  description: 'Create test instance',
  env: defaultEnv,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Environment', envName);
