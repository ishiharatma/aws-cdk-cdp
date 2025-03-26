import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { MyVpcStack } from '../lib/myvpc-stack';
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
    // NAT Gateway
    template.resourceCountIs('AWS::EC2::NatGateway', 2);
    template.hasResourceProperties('AWS::EC2::NatGateway', {
        SubnetId: Match.anyValue(),
    });
    // Elastic IP
    template.resourceCountIs('AWS::EC2::EIP', 2);
    // Route Tables
    template.hasResourceProperties('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        NatGatewayId: Match.anyValue(),
    });
    // KeyPair    
    template.resourceCountIs('AWS::EC2::KeyPair', 1);
    // Subnet
    template.resourceCountIs('AWS::EC2::Subnet', 6);
    template.hasResourceProperties('AWS::EC2::Subnet', {
        MapPublicIpOnLaunch: true,
    });
    template.hasResourceProperties('AWS::EC2::Subnet', {
        MapPublicIpOnLaunch: false,
    });
    // Internet Gateway
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    template.resourceCountIs('AWS::EC2::VPCGatewayAttachment', 1);
    template.hasResourceProperties('AWS::EC2::VPCGatewayAttachment', {
        VpcId: Match.anyValue(),
        InternetGatewayId: Match.anyValue()
    });
    template.hasResourceProperties('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        GatewayId: Match.anyValue(),
    });
    // Security Groups
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for NAT instances',
    });
});
