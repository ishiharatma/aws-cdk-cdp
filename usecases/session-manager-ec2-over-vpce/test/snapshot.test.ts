import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';

import { SessionManagerEc2OverVpceStack } from '../lib/session-manager-ec2-over-vpce-stack';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
const pjName: string = 'snapshot';
const envName: string = 'test';
const app = new App();

test('snapshot validation test',() =>{
    const stack = new SessionManagerEc2OverVpceStack(app, 'SessionManagerEc2OverVpceStack', {
      pjName: pjName,
      envName: envName,
      vpcCIDR: '10.0.0.0/16',
      isAutoDeleteObject: true,
      description: 'Session Manager EC2 Over VPCE',
      env: defaultEnv,
      terminationProtection: true, // Enabling deletion protection
    });
    // add tag
    cdk.Tags.of(app).add('Project', pjName);
    cdk.Tags.of(app).add('Environment', envName);
    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();

})