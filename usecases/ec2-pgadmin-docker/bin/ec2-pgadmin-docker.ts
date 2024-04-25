#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Ec2PgadminDockerStack } from '../lib/ec2-pgadmin-docker-stack';
import { IYamlProps, loadConfig} from '../lib/utils/load-config';

const app = new cdk.App();

// environment identifier
const pjName: string = app.node.tryGetContext('project');
const envName: string = app.node.tryGetContext('env');
const parameterFile: string = path.join(__dirname, `../parameters/${pjName}-${envName}.yaml`);
const envVals: IYamlProps = loadConfig(parameterFile);

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

new Ec2PgadminDockerStack(app, `Ec2PgadminDockerStack-${pjName}-${envName}`, {
  stackName:  `Ec2PgadminDockerStack-${pjName}-${envName}`,
  description: 'Setup EC2 for PgAdmin',
  pjName: pjName,
  envName: envName,
  vpcId: envVals.VPCId, // 'vpc-01234567890abcdef'
  pgAdminLoginId: envVals.PgAdminLoginId, // 'pgadmin4@example.com'
  pgAdminLoginPassword : envVals.PgAdminLoginPassword,// 'aaa'
  startSchedule: envVals.PgAdminEC2startSchedule,
  stopSchedule: envVals.PgAdminEC2stopSchedule,
  isAutoDeleteObject: isAutoDeleteObject,
  env: defaultEnv,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

// --------------------------------- Tagging  -------------------------------------y
cdk.Tags.of(app).add('Project', pjName);
cdk.Tags.of(app).add('Environment', envName);