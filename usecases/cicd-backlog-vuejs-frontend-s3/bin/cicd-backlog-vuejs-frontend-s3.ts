#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CicdBacklogVuejsFrontendS3Stack } from '../lib/cicd-backlog-vuejs-frontend-s3-stack';


const app = new cdk.App();

// environment identifier
const pjName: string = "sample";//app.node.tryGetContext('project');
const envName: string = "dev";//app.node.tryGetContext('env');
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

new CicdBacklogVuejsFrontendS3Stack(app, 'CicdBacklogVuejsFrontendS3Stack', {
  pjName: pjName,
  envName: envName,
  repositoryName: 'backlog-vuejs-frontend-s3',
  branchName: 'main',
  // see: https://support-ja.backlog.com/hc/ja/articles/360035645534-Webhook-%E9%80%81%E4%BF%A1%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%81%AE-IP-%E3%82%A2%E3%83%89%E3%83%AC%E3%82%B9%E3%82%92%E6%95%99%E3%81%88%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84
  allowedIps: [
    "163.135.151.64/26",
    "163.135.251.64/27",
    "163.135.155.0/24",
    "54.248.107.22",
    "54.248.105.89",
    "54.238.168.195",
    "52.192.66.90",
    "54.65.251.183",
    "54.250.148.49",
    "35.166.55.243",
    "50.112.242.159",
    "52.199.112.83",
    "35.73.201.244",
    "35.72.166.154",
    "35.73.143.41",
    "35.74.201.20",
    "52.198.115.185",
    "35.165.230.177",
    "18.236.6.123"
  ],
  isAutoDeleteObject: isAutoDeleteObject,
  env: defaultEnv,
  terminationProtection: isTerminationProtection, // Enabling deletion protection
});

// --------------------------------- Tagging  -------------------------------------
cdk.Tags.of(app).add('Project', pjName);
cdk.Tags.of(app).add('Environment', envName);
