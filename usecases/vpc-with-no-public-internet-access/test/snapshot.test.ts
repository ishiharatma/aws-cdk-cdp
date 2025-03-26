import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { VpcWithNoPublicInternetAccessStack } from '../lib/vpc-with-no-public-internet-access-stack';

const pjName = 'snapshot';
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
    const stack = new VpcWithNoPublicInternetAccessStack(app, 'CloudFrontS3OacStack', {
        pjName: pjName,
        envName: envName,
        vpcCIDR: '10.0.0.0/16',
        isAutoDeleteObject: true,
        description: 'VPC with no public internet access',
        env: defaultEnv,
        terminationProtection: true, // Enab
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // test with snapshot
    expect(template).toMatchSnapshot();

});
