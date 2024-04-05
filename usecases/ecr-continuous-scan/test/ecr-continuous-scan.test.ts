import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { EcrContinuousScanStack } from '../lib/ecr-continuous-scan-stack';

const projectName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

const isAutoDeleteObject:boolean = true;
const isTerminationProtection:boolean = false;

test('Case1: Normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new EcrContinuousScanStack(app, 'EcrContinuousScanStack', {
        input:{
            pjName: projectName,
            envName: envName,
            isAutoDeleteObject: isAutoDeleteObject,
            lambdaLogLevel: 'INFO',
            notificationTopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:MyTopic',
        },
        env: defaultEnv,
        terminationProtection: isTerminationProtection, // Enabling deletion protection
        });
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::Events::Rule', 2);
    template.resourceCountIs('AWS::Logs::SubscriptionFilter', 2);

    template.hasResourceProperties('AWS::Events::Rule', {
        "EventPattern": {
            "source": ["aws.ecr"],
            "detail-type": ["ECR Image Scan"],
        }
    });
    template.hasResourceProperties('AWS::Events::Rule', {
        "ScheduleExpression": "cron(0 0 1 * ? *)"
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
        "FunctionName": `${projectName}-${envName}-ecr-scan-notification`
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
        "FunctionName": `${projectName}-${envName}-ecr-continuous-scan`
    });

});
