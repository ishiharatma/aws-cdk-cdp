import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CloudfrontVpcOriginAlbStack } from '../lib/cloudfront-vpc-origin-alb-stack';

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
    const stack = new CloudfrontVpcOriginAlbStack(app, 'CloudfrontVpcOriginAlbStack', {
        pjName: projectName,
        envName: envName,
        description: 'CloudFront with VPC Origin and ALB',
        isAutoDeleteObject: true,
        env: defaultEnv,
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // test with snapshot
    expect(template).toMatchSnapshot();

});
