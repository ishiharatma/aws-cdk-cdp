import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { MyVpcStack } from '../lib/vpc-with-natgw-stack';
const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

// environment identifier
const projectName: string = 'unittest';
const envName: string = 'test';
const vpcCIDR: string = '10.0.0.0/16';
test('case1: normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new Stack(app, 'testing-stack', {
        env: defaultEnv
    });
    new MyVpcStack(stack, 'vpc', {
        pjName: projectName,
        envName: envName,
        vpcCIDR:vpcCIDR,
        isAutoDeleteObject: false,
    });
    // WHEN
    const template = Template.fromStack(stack);
    console.log(template);
    // THEN
    // VPC
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: vpcCIDR,
    });
    // Subnet
    template.resourceCountIs('AWS::EC2::Subnet', 6);
    // NatGateway
    template.resourceCountIs('AWS::EC2::NatGateway', 1);
    // Internet Gateway
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    template.resourceCountIs('AWS::EC2::VPCGatewayAttachment', 1);
    template.hasResourceProperties('AWS::EC2::VPCGatewayAttachment', {
        VpcId: Match.anyValue(),
        InternetGatewayId: Match.anyValue()
    });
});
