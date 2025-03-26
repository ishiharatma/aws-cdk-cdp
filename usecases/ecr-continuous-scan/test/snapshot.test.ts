import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';

import { EcrContinuousScanStack } from '../lib/ecr-continuous-scan-stack';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
const pjName: string = 'snapshot';
const envName: string = 'test';
const app = new App();

test('snapshot validation test',() =>{
    const stack = new EcrContinuousScanStack(app, 'VPCStack', {
        input:{
            pjName: pjName,
            envName: envName,
            isAutoDeleteObject: true,
            lambdaLogLevel: 'INFO',
            notificationTopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:MyTopic',
          },
          description: 'Continuously scan ECR container images.',
          env: defaultEnv,
          terminationProtection: true, // Enabling deletion protection
      });
    // add tag
    cdk.Tags.of(app).add('Project', pjName);
    cdk.Tags.of(app).add('Environment', envName);
    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();

})