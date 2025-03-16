#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IYamlProps, loadConfig} from '../lib/utils/load-config';
import {COLORS} from '../../common/constants';

const app = new cdk.App();

// 文字色
const color_red: string = '\u001b[31m';
const color_green: string = '\u001b[32m';
const color_yellow: string = '\u001b[33m';
const color_white: string = '\u001b[37m';
const color_reset: string = '\u001b[0m';

// 環境識別子の指定

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
  region: "us-east-1",
};

// 環境別設定ファイルの読み込み
const envVals: IYamlProps = loadConfig(`./parameters/${pjName}-${envName}.yaml`);

const isProduction:boolean = envName.match(/^(prod|jump)$/) ? true: false;
if (isProduction) {
  console.log(`${COLORS.color_red}!!!!!!!!!! CAUTION !!!!!!!!!!${COLORS.color_reset}`);
  console.log(`${COLORS.color_red}   本番環境へのリリースです。${COLORS.color_reset}`);
  console.log(`${COLORS.color_red}!!!!!!!!!! CAUTION !!!!!!!!!!${COLORS.color_reset}`);
};

console.log('JSON全て出力')
console.log(envVals);

console.log('JSONの特定の要素を取り出します')
console.log(`pjName: ${envVals.PJName}`);
console.log(`Description: ${envVals.Description}`);
console.log(`IsNatInstance: ${envVals.MyVPC.IsNatInstance}`);
console.log(`NatInstanceType: ${envVals.MyVPC.NatInstanceType ?? 't4g.micro'}`);

process.exit(0);