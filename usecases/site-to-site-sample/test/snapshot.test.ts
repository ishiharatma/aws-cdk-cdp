import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';

import { VPCStack } from '../lib/stacks/vpc-stack';
import { OnPremVPCStack } from '../lib/stacks/vpc-onpremises-stack';
import { SiteToSiteSampleStack } from '../lib/stacks/site-to-site-sample-stack';

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

const projectName: string = 'snapshot';
const envName: string = 'test';
const app = new App();

test('snapshot validation test',() =>{
    const isTerminationProtection=false;
    const isAutoDeleteObject=false;

    const remoteCIDR = '10.0.0.0/16'; // VPC-AWS
    const localCIDR = '192.168.0.0/16'; // VPC-OnPremises
    const myIP = '192.168.0.1/32';
    
    const vpc = new VPCStack(app, 'myVPC', {
      pjName: projectName,
      envName: envName,
      vpcCIDR: remoteCIDR,
      isAutoDeleteObject: isAutoDeleteObject,
      env: uswest2Env,
      terminationProtection: isTerminationProtection, // Enabling deletion protection
      crossRegionReferences: true,
    });
    
   const onpremisesVpc = new OnPremVPCStack(app, 'onpremisesVpc', {
      pjName: projectName,
      envName: envName,
      vpcCIDR: localCIDR,
      myIP: myIP,
      useRemoteSSH: false,
      isAutoDeleteObject: isAutoDeleteObject,
      env: useast1Env,
      terminationProtection: isTerminationProtection, // Enabling deletion protection
      crossRegionReferences: true,
    })
    
    const siteToSiteSampleStack = new SiteToSiteSampleStack(app, 'SiteToSiteSampleStack', {
      pjName: projectName,
      envName: envName,
      transitGatewayId: '',
      vpnGatewayId: cdk.Token.asString(vpc._vpc.vpnGatewayId) ,
      customerGatewayId: cdk.Token.asString(onpremisesVpc._cgw.ref),
      virtualPrivateGatewayId: cdk.Token.asString(vpc._vpc.vpnGatewayId),
      env: uswest2Env,
      terminationProtection: isTerminationProtection, // Enabling deletion protection
    });
    
    // add tag
    cdk.Tags.of(app).add('Project', projectName);
    cdk.Tags.of(app).add('Environment', envName);
    // test with snapshot
    expect(Template.fromStack(vpc)).toMatchSnapshot();
    expect(Template.fromStack(onpremisesVpc)).toMatchSnapshot();
    expect(Template.fromStack(siteToSiteSampleStack)).toMatchSnapshot();

})