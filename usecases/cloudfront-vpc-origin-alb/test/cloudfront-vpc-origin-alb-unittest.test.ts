import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CloudfrontVpcOriginAlbStack } from '../lib/cloudfront-vpc-origin-alb-stack';

const projectName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

test('Case1', () => {
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
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::CloudFront::VpcOrigin',1);
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer',1);

    // VPC Origins should have VpcOriginConfig    
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
        "DistributionConfig":{
            "Origins": Match.arrayWith([
                Match.objectLike({
                    "VpcOriginConfig": Match.anyValue(),
                }),
            ]),
        },
    });

});
