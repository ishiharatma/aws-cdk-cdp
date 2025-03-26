import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {CloudFrontS3OaiStack} from '../lib/cloudfront-s3-oai-stack';

const projectName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

test('Snapshot', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new CloudFrontS3OaiStack(app, 'S3StaticWebSiteStack', {
        pjName: projectName,
        envName: envName,
        description: 'Deliver S3 static website using OAI(Legacy) with CloudFront',
        isAutoDeleteObject: true,
        env: defaultEnv,
      });
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // test with snapshot
    expect(template).toMatchSnapshot();
});
