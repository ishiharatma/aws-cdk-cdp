import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';

import { Ec2PgadminDockerStack } from '../lib/ec2-pgadmin-docker-stack';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
const pjName: string = 'snapshot';
const envName: string = 'test';
const app = new App();

test('snapshot validation test',() =>{
    const stack = new Ec2PgadminDockerStack(app, 'VPCStack', {
        stackName:  `Ec2PgadminDockerStack-${pjName}-${envName}`,
        description: 'Setup EC2 for PgAdmin',
        pjName: pjName,
        envName: envName,
        vpcId: 'vpc-01234567890abcdef',
        pgAdminLoginId: 'pgadmin4@example.com',
        pgAdminLoginPassword : 'pasword',
        startSchedule: "cron(0 0 ? * MON-FRI *)" ,
        stopSchedule: "cron(0 9 ? * MON-FRI *)",
        isAutoDeleteObject: true,
        env: defaultEnv,
        terminationProtection: true, // Enabling deletion protection
      });
    // add tag
    cdk.Tags.of(app).add('Project', pjName);
    cdk.Tags.of(app).add('Environment', envName);
    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();

})