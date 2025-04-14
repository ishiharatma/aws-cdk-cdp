#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VPCStack } from '../lib/stacks/vpc-stack';
import { OnPremVPCStack } from '../lib/stacks/vpc-onpremises-stack';
import { SiteToSiteSampleStack } from '../lib/stacks/site-to-site-sample-stack';


const app = new cdk.App();

// environment identifier
const envName: string = app.node.tryGetContext('env');
const pjName: string = app.node.tryGetContext('project');
const myIP: string = app.node.tryGetContext('myip') ?? '0.0.0.0/0'; // my Public IPaddress

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

const remoteCIDR = '10.0.0.0/16'; // VPC-AWS
const localCIDR = '192.168.0.0/16'; // VPC-OnPremises

const vpc = new VPCStack(app, 'myVPC', {
  pjName: pjName,
  envName: envName,
  vpcCIDR: remoteCIDR,
  isAutoDeleteObject: isAutoDeleteObject,
  env: uswest2Env,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
  crossRegionReferences: true,
});

const onpremisesVpc = new OnPremVPCStack(app, 'onpremisesVpc', {
  pjName: pjName,
  envName: envName,
  vpcCIDR: localCIDR,
  myIP: myIP,
  useRemoteSSH: false,
  isAutoDeleteObject: isAutoDeleteObject,
  env: useast1Env,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
  crossRegionReferences: true,
})

new SiteToSiteSampleStack(app, 'SiteToSiteSampleStack', {
  pjName: pjName,
  envName: envName,
  transitGatewayId: '',
  vpnGatewayId: cdk.Token.asString(vpc._vpc.vpnGatewayId) ,
  customerGatewayId: cdk.Token.asString(onpremisesVpc._cgw.ref),
  virtualPrivateGatewayId: cdk.Token.asString(vpc._vpc.vpnGatewayId),
  env: uswest2Env,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', pjName);
cdk.Tags.of(app).add('Environment', envName);
