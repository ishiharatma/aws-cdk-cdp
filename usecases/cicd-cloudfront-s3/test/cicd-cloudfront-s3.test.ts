import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CicdCloudfrontS3Stack } from '../lib/cicd-cloudfront-s3-stack';


const projectName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

test('Case1:Normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new CicdCloudfrontS3Stack(app, 'CloudFrontS3OacStack', {
        input: {
            pjName: projectName,
            envName: envName,
            isAutoDeleteObject: true,
        }
        description: 'Deliver S3 static website using OAC with CloudFront',
        env: defaultEnv,
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
});
