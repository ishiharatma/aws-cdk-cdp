import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {S3StaticWebSiteStack} from '../lib/s3-static-web-site-stack';

const projectName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

test('case1', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const ALLOWED_IP_V4_ADDRESS_RANGES: string[] =  [
    ];
    const stack = new S3StaticWebSiteStack(app, 'S3StaticWebSiteStack', {
        pjName: projectName,
        envName: envName,
        isAutoDeleteObject: true,
        allowedIpV4AddressRanges: ALLOWED_IP_V4_ADDRESS_RANGES,
        env: defaultEnv,
      });
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    template.hasResourceProperties('AWS::S3::Bucket', {
        "BucketName": `${projectName}-${envName}-static-website-${defaultEnv.account}`,
        "PublicAccessBlockConfiguration": {
            "BlockPublicAcls": false,
            "BlockPublicPolicy": false,
            "IgnorePublicAcls": false,
            "RestrictPublicBuckets": false,
        },
        "WebsiteConfiguration": {
            "ErrorDocument": "error.html",
            "IndexDocument": "index.html",
        }
    });

});
test('case2', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const ALLOWED_IP_V4_ADDRESS_RANGES: string[] =  ['192.0.2.1/32'];
    const stack = new S3StaticWebSiteStack(app, 'S3StaticWebSiteStack', {
        pjName: projectName,
        envName: envName,
        isAutoDeleteObject: true,
        allowedIpV4AddressRanges: ALLOWED_IP_V4_ADDRESS_RANGES,
        env: defaultEnv,
      });
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    template.hasResourceProperties('AWS::S3::Bucket', {
        "BucketName": `${projectName}-${envName}-static-website-${defaultEnv.account}`,
        "PublicAccessBlockConfiguration": {
            "BlockPublicAcls": true,
            "BlockPublicPolicy": true,
            "IgnorePublicAcls": true,
            "RestrictPublicBuckets": true,
        },
        "WebsiteConfiguration": {
            "ErrorDocument": "error.html",
            "IndexDocument": "index.html",
        }
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
        "PolicyDocument": {
            "Statement": Match.arrayWith([Match.objectLike({
                "Action": "s3:GetObject",
                "Effect": "Allow",
                "Condition": Match.objectLike(
                    {
                        "IpAddress": {
                            "aws:SourceIp": Match.anyValue(),
                        }
                    },
                ),
            })])
        },
    });
});

test('case3', () => {
    // GIVEN
    const app = new App({
        context : {}
    });
    const ALLOWED_IP_V4_ADDRESS_RANGES: string[] =  [
        '0.0.0.0/1',
        '128.0.0.0/1'
    ];
    const stack = new S3StaticWebSiteStack(app, 'S3StaticWebSiteStack', {
        pjName: projectName,
        envName: envName,
        isAutoDeleteObject: true,
        allowedIpV4AddressRanges: ALLOWED_IP_V4_ADDRESS_RANGES,
        env: defaultEnv,
        });
    // WHEN
    const template = Template.fromStack(stack);
    // THEN
    template.hasResourceProperties('AWS::S3::Bucket', {
        "BucketName": `${projectName}-${envName}-static-website-${defaultEnv.account}`,
        "PublicAccessBlockConfiguration": {
            "BlockPublicAcls": true,
            "BlockPublicPolicy": true,
            "IgnorePublicAcls": true,
            "RestrictPublicBuckets": true,
        },
        "WebsiteConfiguration": {
            "ErrorDocument": "error.html",
            "IndexDocument": "index.html",
        }
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
        "PolicyDocument": {
            "Statement": Match.arrayWith([Match.objectLike({
                "Action": "s3:GetObject",
                "Effect": "Allow",
                "Condition": Match.objectLike(
                    {
                        "IpAddress": {
                            "aws:SourceIp": Match.anyValue(),
                        }
                    },
                ),
            })])
        },
    });
});
