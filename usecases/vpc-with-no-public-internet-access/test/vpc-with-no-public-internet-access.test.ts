import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { VpcWithNoPublicInternetAccessStack } from '../lib/vpc-with-no-public-internet-access-stack';

const pjName = 'snapshot';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

test('VpcWithNoPublicInternetAccessStack creates resources correctly', () => {
    // GIVEN
    const app = new App();
    const stack = new VpcWithNoPublicInternetAccessStack(app, 'TestStack', {
      pjName: pjName,
      envName: envName,
      vpcCIDR: '10.0.0.0/16',
      isAutoDeleteObject: true,
      description: 'VPC with no public internet access',
      env: defaultEnv,
      terminationProtection: true, // Enabling deletion protection
    });
  
    // WHEN
    const template = Template.fromStack(stack);
  
    // THEN
    // Check if the VPC is created with the correct CIDR
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
    });
    template.resourceCountIs('AWS::EC2::InternetGateway', 0);
    template.resourceCountIs('AWS::EC2::VPCGatewayAttachment', 0);
  
    // Check if the S3 bucket for flow logs is created with the correct properties
    template.hasResourceProperties('AWS::S3::Bucket', {
      AccessControl: 'Private',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      OwnershipControls: {
        Rules: [
          {
            ObjectOwnership: 'BucketOwnerEnforced',
          },
        ],
      },
    });
  
    // Check if the VPC Flow Log is created
    template.hasResourceProperties('AWS::EC2::FlowLog', {
      ResourceId: {
        Ref: Match.anyValue(),
      },
      TrafficType: 'ALL',
      LogDestinationType: 's3',
    });
  
    // Check if the Gateway Endpoint for S3 is created
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      VpcId: {
        Ref: Match.anyValue(),
      },
      VpcEndpointType: 'Gateway',
    });
  });