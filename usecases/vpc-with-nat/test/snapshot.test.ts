import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';

import { MyVpcStack } from '../lib/myvpc-stack';
const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
const projectName: string = 'snapshot';
const envName: string = 'test';
const app = new App();

test('snapshot validation test',() =>{
    const stack = new MyVpcStack(app, 'VPCStack', {
        stackName: [projectName, envName, 'VPCStack'].join('-'),
        description: "Create VPC , Subnets , InternetGateway and etc.",
        pjName:projectName,
        envName: envName,
        vpcCIDR: '10.0.0.0/16',
        isAutoDeleteObject: true,
        env: defaultEnv,
        terminationProtection: false, // Enabling deletion protection
      });
    // add tag
    cdk.Tags.of(app).add('Project', projectName);
    cdk.Tags.of(app).add('Environment', envName);
    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();

})