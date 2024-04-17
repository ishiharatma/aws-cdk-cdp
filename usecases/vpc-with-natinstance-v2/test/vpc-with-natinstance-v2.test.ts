import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { VpcWithNatinstanceV2Stack } from '../lib/vpc-with-natinstance-v2-stack';
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
    const stack = new Stack(app, 'testing-stack', {
        env: defaultEnv
    });
    new VpcWithNatinstanceV2Stack(stack, 'vpc', {
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
    // KeyPair    
    template.resourceCountIs('AWS::EC2::KeyPair', 1);
    // Subnet
    template.resourceCountIs('AWS::EC2::Subnet', 6);
    // Internet Gateway
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    template.resourceCountIs('AWS::EC2::VPCGatewayAttachment', 1);
    template.hasResourceProperties('AWS::EC2::VPCGatewayAttachment', {
        VpcId: Match.anyValue(),
        InternetGatewayId: Match.anyValue()
    });
});
