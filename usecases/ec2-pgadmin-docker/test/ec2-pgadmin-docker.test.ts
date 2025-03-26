import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { Ec2PgadminDockerStack } from '../lib/ec2-pgadmin-docker-stack';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};
// environment identifier
const projectName = 'unittest';
const envName = 'test';

test('Case1: Password specification', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new Ec2PgadminDockerStack(app, 'Ec2PgadminDockerStack', {
        pjName: projectName,
        envName: envName,
        vpcId: 'vpc-01234567890abcdef', 
        pgAdminLoginId: 'pgadmin4@example.com',
        pgAdminLoginPassword: 'p@ssword',
        isAutoDeleteObject: true,
        env: defaultEnv,
      });
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // EC2    
    template.resourceCountIs('AWS::EC2::Instance', 1);
    template.hasResourceProperties('AWS::EC2::Instance', {
        UserData: Match.anyValue(),
    });
    template.resourceCountIs('AWS::EC2::KeyPair', 1);
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.resourceCountIs('AWS::SecretsManager::Secret', 0);
    template.resourceCountIs('AWS::Events::Rule', 0);

});

test('Case2: Schedule specification', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack = new Ec2PgadminDockerStack(app, 'Ec2PgadminDockerStack', {
        pjName: projectName,
        envName: envName,
        vpcId: 'vpc-01234567890abcdef', 
        pgAdminLoginId: 'pgadmin4@example.com',
        pgAdminLoginPassword: 'p@ssword',
        startSchedule: "cron(0 0 ? * MON-FRI *)" ,
        stopSchedule: "cron(0 9 ? * MON-FRI *)",
        isAutoDeleteObject: true,
        env: defaultEnv,
      });
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    // EC2    
    template.resourceCountIs('AWS::EC2::Instance', 1);
    template.hasResourceProperties('AWS::EC2::Instance', {
        UserData: Match.anyValue(),
    });
    template.resourceCountIs('AWS::EC2::KeyPair', 1);
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.resourceCountIs('AWS::SecretsManager::Secret', 0);
    template.resourceCountIs('AWS::Events::Rule', 2);
    // Check EventBridge Rules for Start and Stop Schedules
    template.hasResourceProperties('AWS::Events::Rule', {
        Name: `${projectName}-${envName}-EC2StartRule`,
        ScheduleExpression: "cron(0 0 ? * MON-FRI *)",
    });
    template.hasResourceProperties('AWS::Events::Rule', {
        Name: `${projectName}-${envName}-EC2StopRule`,
        ScheduleExpression: "cron(0 9 ? * MON-FRI *)",
    });
});

