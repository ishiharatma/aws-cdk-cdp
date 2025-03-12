import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {CloudFrontS3OacStack} from '../lib/cloudfront-s3-oac-stack';

const projectName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

test('Case1: Normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new CloudFrontS3OacStack(app, 'CloudFrontS3OacStack', {
        pjName: projectName,
        envName: envName,
        description: 'Deliver S3 static website using OAC with CloudFront',
        isAutoDeleteObject: true,
        env: defaultEnv,
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.resourceCountIs('AWS::S3::Bucket', 3);

});
