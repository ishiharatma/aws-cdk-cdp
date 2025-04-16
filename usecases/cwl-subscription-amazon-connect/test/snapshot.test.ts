import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CwlSubscriptionAmazonConnectStack } from '../lib/stack/cwl-subscription-amazon-connect-stack';

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
    const stack = new CwlSubscriptionAmazonConnectStack(app, 'CwlSubscriptionAmazonConnectStack', {
        stackName: 'CwlSubscriptionAmazonConnectStack',
        description: 'CloudWatch Logs Subscription Filters with Amazon Connect',
        env: defaultEnv,
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // test with snapshot
    expect(template).toMatchSnapshot();

});
