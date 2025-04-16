import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CwlSubscriptionFiltersFirehoseStack } from '../lib/cwl-subscription-filters-firehose-stack';

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
    const stack = new CwlSubscriptionFiltersFirehoseStack(app, 'CwlSubscriptionFiltersFirehoseStack', {
        stackName: 'CwlSubscriptionFiltersFirehoseStack',
        description: 'CloudWatch Logs Subscription Filters with Firehose',
        env: defaultEnv,
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // test with snapshot
    expect(template).toMatchSnapshot();

});
