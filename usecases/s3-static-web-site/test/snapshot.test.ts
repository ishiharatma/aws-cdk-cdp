import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';

import { S3StaticWebSiteStack } from '../lib/s3-static-web-site-stack';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
const pjName: string = 'snapshot';
const envName: string = 'test';
const app = new App();

test('snapshot validation test',() =>{
    const stack = new S3StaticWebSiteStack(app, 'VPCStack', {
        pjName: pjName,
        envName: envName,
        description: '',
        isAutoDeleteObject: true,
        allowedIpV4AddressRanges: ['0.0.0.0/0'],
        env: defaultEnv,
        terminationProtection: true, // Enabling deletion protection
      });
    // add tag
    cdk.Tags.of(app).add('Project', pjName);
    cdk.Tags.of(app).add('Environment', envName);
    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();

})