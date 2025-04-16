import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CwlSubscriptionFiltersKinesisStack } from '../lib/cwl-subscription-filters-kinesis-stack';

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
    const stack = new CwlSubscriptionFiltersKinesisStack(app, 'CwlSubscriptionFiltersKinesisStack', {
        stackName: 'CwlSubscriptionFiltersKinesisStack',
        description: 'CloudWatch Logs Subscription Filters with Kinesis',
        env: defaultEnv,
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // test with snapshot
    expect(template).toMatchSnapshot();

});
