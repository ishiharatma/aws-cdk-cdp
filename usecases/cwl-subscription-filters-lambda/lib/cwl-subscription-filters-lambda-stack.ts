import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SubscriptionFilterLambdaConstruct } from './constructs/subscription-filter-lambda';

export class CwlSubscriptionFiltersLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda サブスクリプションフィルター
    new SubscriptionFilterLambdaConstruct(this, 'SubscriptionFilterLambdaConstruct', {});
  }
}
