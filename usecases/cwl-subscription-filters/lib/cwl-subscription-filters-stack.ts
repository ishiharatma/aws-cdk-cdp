import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface myStackProps extends cdk.StackProps {

}

export class CwlSubscriptionFiltersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: myStackProps) {
    super(scope, id, props);


  }
}
