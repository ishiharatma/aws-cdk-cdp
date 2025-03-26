import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SessionManagerEc2OverVpceStack } from '../lib/session-manager-ec2-over-vpce-stack';

const defaultEnv = {
  account: '123456789012',
  region: 'us-east-1',
};

const pjName = 'unittest';
const envName = 'test';

test('SessionManagerEc2OverVpceStack creates resources correctly', () => {
  // GIVEN
  const app = new cdk.App();
  const stack = new SessionManagerEc2OverVpceStack(app, 'MyTestStack', {
    pjName: pjName,
    envName: envName,
    vpcCIDR: '10.0.0.0/16',
    isAutoDeleteObject: true,
    description: 'Session Manager EC2 Over VPCE',
    env: defaultEnv,
    terminationProtection: false,
  });
  // add tag
  cdk.Tags.of(app).add('Project', pjName);
  cdk.Tags.of(app).add('Environment', envName);

  // WHEN
  const template = Template.fromStack(stack);

  // THEN
  // Check if a VPC is created
  template.resourceCountIs('AWS::EC2::VPC', 1);
  template.hasResourceProperties('AWS::EC2::VPC', {
    CidrBlock: '10.0.0.0/16',
  });

  // Check if Subnets are created
  template.resourceCountIs('AWS::EC2::Subnet', 6);

  // Check if an EC2 instance is created
  template.resourceCountIs('AWS::EC2::Instance', 2);
  template.hasResourceProperties('AWS::EC2::Instance', {
    InstanceType: Match.anyValue(),
    SubnetId: Match.anyValue(),
  });

  // Check if a Security Group is created
  template.resourceCountIs('AWS::EC2::SecurityGroup', 2);
  template.hasResourceProperties('AWS::EC2::SecurityGroup', {
    GroupDescription: 'security group for vpc endpoint',
  });

  // Check if a VPC Endpoint for Session Manager is created
  template.resourceCountIs('AWS::EC2::VPCEndpoint', 3);
  template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
    ServiceName: Match.stringLikeRegexp('com.amazonaws.*.ssm'),
    VpcEndpointType: 'Interface',
    VpcId: Match.anyValue(),
  });
  template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
    ServiceName: Match.stringLikeRegexp('com.amazonaws.*.ec2messages'),
    VpcEndpointType: 'Interface',
    VpcId: Match.anyValue(),
  });
  template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
    ServiceName: Match.stringLikeRegexp('com.amazonaws.*.ssmmessages'),
    VpcEndpointType: 'Interface',
    VpcId: Match.anyValue(),
  });

  // Check if Tags are applied
  template.hasResourceProperties('AWS::EC2::VPC', {
    Tags: Match.arrayWith([
      Match.objectLike({
        Key: 'Project',
        Value: pjName,
      }),
    ]),
  });
  template.hasResourceProperties('AWS::EC2::VPC', {
    Tags: Match.arrayWith([
      Match.objectLike({
        Key: 'Environment',
        Value: envName,
      }),
    ]),
  });
});