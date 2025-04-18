import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { MyVpcStack } from '../lib/vpc-with-natgw-stack';
const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

// environment identifier
const projectName = 'unittest';
const envName = 'test';
const vpcCIDR = '10.0.0.0/16';
test('case1: normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new MyVpcStack(app, 'vpc', {
        pjName: projectName,
        envName: envName,
        vpcCIDR:vpcCIDR,
        isAutoDeleteObject: false,
        env: defaultEnv
    });
    // WHEN
    const template = Template.fromStack(stack);
    //console.log(template);
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
    // Elastic IP
    template.resourceCountIs('AWS::EC2::EIP', 1);
    // Route Tables
    template.hasResourceProperties('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        NatGatewayId: Match.anyValue(),
    });

    // Internet Gateway
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    template.resourceCountIs('AWS::EC2::VPCGatewayAttachment', 1);
    template.hasResourceProperties('AWS::EC2::VPCGatewayAttachment', {
        VpcId: Match.anyValue(),
        InternetGatewayId: Match.anyValue()
    });
    // Route Tables
    template.hasResourceProperties('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        GatewayId: Match.anyValue(),
    });
});
