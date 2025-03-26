import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';

import { VpcWithNatinstanceV2Stack } from '../lib/vpc-with-natinstance-v2-stack';
const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
const pjName: string = 'snapshot';
const envName: string = 'test';
const app = new App();

test('snapshot validation test',() =>{
    const stack = new VpcWithNatinstanceV2Stack(app, 'VPCStack', {
        stackName: [pjName, envName, 'VPCStack'].join('-'),
        description: 'VPC with custom NAT instance',
        pjName: pjName,
        envName: envName,
        vpcCIDR: '10.0.0.0/16',
        isAutoDeleteObject: true,
        natgateways: 1,
        natInstanceStartCronSchedule: "cron(0 23 ? * SUN-THU *)",
        natInstanceStopCronSchedule: "cron(30 9 ? * MON-FRI *)",
        //isAttacheElasticIp: true,
        env: defaultEnv,
        terminationProtection: true, // Enabling deletion protection
      });
    // add tag
    cdk.Tags.of(app).add('Project', pjName);
    cdk.Tags.of(app).add('Environment', envName);
    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();

})