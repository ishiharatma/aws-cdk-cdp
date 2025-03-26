import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CloudFrontStack} from '../lib/cloudfront-stack';
import { CloudFrontLoggingS3V2Stack} from '../lib/cloudfront-logging-s3-v2-stack';

const projectName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

test('Case1: Normal', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const stack1 = new CloudFrontStack(app, 'CloudFrontStack', {
        pjName: projectName,
        envName: envName,
        description: 'CloudFront',
        isAutoDeleteObject: true,
        env: defaultEnv,
      });
    const stack2 = new CloudFrontLoggingS3V2Stack(app, 'CloudFrontLoggingS3V2Stack', {
        pjName: projectName,
        envName: envName,
        distributionId: stack1.distribution.distributionId,
        loggingBucketArn: stack1.loggingBucket.bucketArn,
        env: defaultEnv,
        crossRegionReferences:true,
      });
    // WHEN
    const template1 = Template.fromStack(stack1);
    const template2 = Template.fromStack(stack2);
    // THEN
    template1.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template1.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template1.resourceCountIs('AWS::S3::Bucket', 2);

    

});
