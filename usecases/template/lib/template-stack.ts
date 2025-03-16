import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface TemplateStackProps extends cdk.StackProps {
  pjName: string;
  envName: string;
  isAutoDeleteObject: boolean;
}

export class TemplateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TemplateStackProps) {
    super(scope, id, props);

  }
}
