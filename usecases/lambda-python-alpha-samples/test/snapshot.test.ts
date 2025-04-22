// snapshot test for lambda-python-alpha-samples
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { LambdaPythonAlphaSamplesStack } from '../lib/lambda-python-alpha-samples-stack';

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
    const stack = new LambdaPythonAlphaSamplesStack(app, 'LambdaPythonAlphaSamplesStack', {
        stackName: 'LambdaPythonAlphaSamplesStack',
        description: 'Lambda Python Alpha Samples Stack',
        env: defaultEnv,
      });
      
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // test with snapshot
    expect(template).toMatchSnapshot();

});