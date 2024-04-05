import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { WebPipelineConstruct } from '../../common/lib/construct-pipeline-s3web'

import * as interfaceDef from '../../common/interface/index';

interface CicdCloudFrontS3StackProps extends StackProps {
  input: interfaceDef.WebPipelineConstructProps;
}

export class CicdCloudfrontS3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CicdCloudFrontS3StackProps) {
    super(scope, id, props);

    new WebPipelineConstruct(this, 'Default', props.input);

  }
}
