import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
} from 'aws-cdk-lib';
import { BucketConstruct } from '../lib/construct-bucket';

interface S3BucketProps {
    readonly pjName: string;
    readonly envName: string;
    readonly targetS3: BucketConstruct;
    readonly s3BucketPolicyStatementJson: string;
}

export class BucketAddPolicyConstruct extends Construct {
  constructor(scope: Construct, id: string, props: S3BucketProps) {
      super(scope, id);
      const accountId = cdk.Stack.of(this).account;
      const region = cdk.Stack.of(this).region;

      // BucketPolicy
      props.targetS3.bucket.addToResourcePolicy(
        iam.PolicyStatement.fromJson(props.s3BucketPolicyStatementJson)
      );

  }
}