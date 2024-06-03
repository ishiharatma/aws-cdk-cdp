import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {CloudfrontS3OacApigwLambdaStack} from '../lib/cloudfront-s3-oac-apigw-lambda-stack';
import { WAFv2Stack } from '../lib/waf-stack';

const projectName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
const useast1Env = {
    // US East (Virginia)
    account: process.env.CDK_DEFAULT_ACCOUNT,
      region: "us-east-1",
    };
test('case1', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const wafStack  = new WAFv2Stack(app, '', {
        pjName: projectName,
        envName: envName,
        description: 'CloudFront WAF.',
        isAutoDeleteObject: true,
        env: useast1Env,
        crossRegionReferences: true,
      });
    const cloudFrontStack = new CloudfrontS3OacApigwLambdaStack(app, 'S3StaticWebSiteStack', {
        pjName: projectName,
        envName: envName,
        description: 'Deliver S3 static website using OAC with CloudFront',
        isAutoDeleteObject: true,
        env: defaultEnv,
        waf: wafStack.waf,
      });
    // WHEN
    const wafStackTemplate = Template.fromStack(wafStack);
    const cloudFrontStackTemplate = Template.fromStack(cloudFrontStack);
    // THEN
    wafStackTemplate.resourceCountIs('AWS::WAFv2::WebACL', 1);
    cloudFrontStackTemplate.resourceCountIs('AWS::CloudFront::Distribution', 1);

});
