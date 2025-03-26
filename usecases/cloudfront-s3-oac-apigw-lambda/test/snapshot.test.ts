import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {CloudfrontS3OacApigwLambdaStack} from '../lib/cloudfront-s3-oac-apigw-lambda-stack';
import { WAFv2Stack } from '../lib/waf-stack';

const pjName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
const useast1Env = {
    account: '123456789012',
    region: 'us-east-1',
};

test('SnapShot', () => {
    // GIVEN
    const app = new App({
        context : {}
    });

    // WAF on us-east1
    const wafStack  = new WAFv2Stack(app, '', {
    pjName: pjName,
    envName: envName,
    description: 'CloudFront WAF.',
    isAutoDeleteObject: true,
    env: useast1Env,
    terminationProtection: true, // Enabling deletion protection
    });

    const stack = new CloudfrontS3OacApigwLambdaStack(app, 'CloudfrontS3OacApigwLambdaStack', {
        pjName: pjName,
        envName: envName,
        description: 'Deliver S3 static website using OAC with CloudFront',
        isAutoDeleteObject: true,
        env: defaultEnv,
        waf: wafStack.waf,
        crossRegionReferences: true,
        terminationProtection: true, // Enabling deletion protection
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // test with snapshot
    expect(template).toMatchSnapshot();

});

