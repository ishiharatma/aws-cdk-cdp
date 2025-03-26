import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { VpcWithNatinstanceV2Stack } from '../lib/vpc-with-natinstance-v2-stack';
const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

// environment identifier
const pjName = 'unittest';
const envName = 'test';
const vpcCIDR = '10.0.0.0/16';
test('case1: normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new VpcWithNatinstanceV2Stack(app, 'vpc', {
        pjName: pjName,
        envName: envName,
        vpcCIDR: '10.0.0.0/16',
        isAutoDeleteObject: true,
        natgateways: 1,
        natInstanceStartCronSchedule: "cron(0 23 ? * SUN-THU *)",
        natInstanceStopCronSchedule: "cron(30 9 ? * MON-FRI *)",
        //isAttacheElasticIp: true,
        description: 'VPC with custom NAT instance',
        env: defaultEnv,
        terminationProtection: true, // Enabling deletion protection
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
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
    // Route Tables
    template.hasResourceProperties('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        InstanceId: Match.anyValue(),
    });
    // Subnet
    template.resourceCountIs('AWS::EC2::Subnet', 6);
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
    template.resourceCountIs('AWS::Events::Rule', 2);
    // Check EventBridge Rules for Start and Stop Schedules
    template.hasResourceProperties('AWS::Events::Rule', {
        ScheduleExpression: "cron(0 23 ? * SUN-THU *)",
    });
    template.hasResourceProperties('AWS::Events::Rule', {
        ScheduleExpression: "cron(30 9 ? * MON-FRI *)",
    });
});
