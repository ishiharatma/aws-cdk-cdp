import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { VPCStack } from '../lib/stacks/vpc-stack';
import { OnPremVPCStack } from '../lib/stacks/vpc-onpremises-stack';
import { SiteToSiteSampleStack } from '../lib/stacks/site-to-site-sample-stack';

// env
const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
  };
  
const useast1Env = {
  // US East (Virginia)
    account: '123456789012',
    region: "us-east-1",
  };
const uswest2Env = {
  // US West (Oregon)
    account: '123456789012',
    region: "us-west-2",
  };

// environment identifier
const projectName = 'unittest';
const envName = 'test';
const remoteCIDR = '10.0.0.0/16'; // VPC-AWS
const localCIDR = '192.168.0.0/16'; // VPC-OnPremises
const myIP = '192.168.0.1/32'; // my Public IPaddress
test('case1: VPC-AWS normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new Stack(app, 'testing-stack', {
        env: defaultEnv
    });
    new VPCStack(stack, 'vpc', {
        pjName: projectName,
        envName: envName,
        vpcCIDR: remoteCIDR,
        env: uswest2Env,
        isAutoDeleteObject: false,
    });
    // WHEN
    const template = Template.fromStack(stack);
    console.log(template);
    // THEN
    // VPC
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: remoteCIDR,
    });
    // Subnet
    template.resourceCountIs('AWS::EC2::Subnet', 1);
    // Internet Gateway
    template.resourceCountIs('AWS::EC2::InternetGateway', 0);
});

test('case2: VPC-OnPremises normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new Stack(app, 'testing-stack', {
        env: defaultEnv
    });
    new OnPremVPCStack(stack, 'vpc', {
        pjName: projectName,
        envName: envName,
        vpcCIDR: localCIDR,
        myIP: myIP,
        useRemoteSSH: false,
        isAutoDeleteObject: false,
        env: useast1Env,
    });
    // WHEN
    const template = Template.fromStack(stack);
    console.log(template);
    // THEN
    // VPC
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: localCIDR,
    });
    // Subnet
    template.resourceCountIs('AWS::EC2::Subnet', 1);
    // Internet Gateway
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
});
