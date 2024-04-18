import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_ec2 as ec2,
} from 'aws-cdk-lib';
import { TestEC2InstanceConstruct } from '../lib/construct-ec2-testinstance'


interface TestInstanceStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly vpc: ec2.Vpc;
} 

export class TestInstanceStack extends cdk.Stack {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: TestInstanceStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    this.instance  = new TestEC2InstanceConstruct(this,'',{
      pjName: props.pjName,
      envName: props.envName,
      vpc: props.vpc
    }).instance;
  }
}
