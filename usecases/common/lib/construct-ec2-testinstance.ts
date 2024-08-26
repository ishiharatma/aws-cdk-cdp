import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
    aws_ec2 as ec2,
    aws_events as events,
    aws_iam as iam
} from 'aws-cdk-lib';

interface TestEC2InstanceProps {
  readonly pjName: string;
  readonly envName: string;
  readonly vpc: ec2.Vpc;
  readonly stopCronSchedule?: string;
  readonly startCronSchedule?: string;
}

export class TestEC2InstanceConstruct extends Construct {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: TestEC2InstanceProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // Create a security group for your EC2 instance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,    
    });
    new cdk.CfnOutput(this, 'EC2SecurityGroupId', {
      value: ec2SecurityGroup.securityGroupId,
    });

    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userData.addCommands(
      'yum update -y'
    );
    const keyPair = new ec2.KeyPair(this, 'KeyPair', {
      keyPairName: `${id}-ec2-KeyPair`,
    });
    new cdk.CfnOutput(this, 'EC2InstanceKeyPairId', {
      value: keyPair.keyPairId,
    });
    // Create an EC2 instance for connection testing
    this.instance = new ec2.Instance(this, 'EC2Instance1', {
      vpc: props.vpc,
      instanceName: [id, 'test', 'instance'].join('/') ,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64 //X86_64, 
      }),
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroup: ec2SecurityGroup,
      //availabilityZone: 'ap-northeast-1a',
      ssmSessionPermissions: true, // Used by SSM session manager
      userData: userData,
      // Configure IMDSv2 for the NAT instance
      // Security Hub EC2.8
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-8
      requireImdsv2: true,
    });
    new cdk.CfnOutput(this, "EC2InstanceId", {
        value: this.instance.instanceId,
        description: "Test Instance",
    });

    if (props.startCronSchedule && props.stopCronSchedule) {
      
      const role = new iam.Role(this, `NatInstanceStartStopRole`, {
        roleName: [props.pjName, props.envName, 'NatInstanceStartStop'].join('-'),
        assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonSSMAutomationRole'),
        ]
      });
      // 起動スケジュール
      new events.CfnRule(this, `EC2StartRule`, {
        name: [props.pjName, props.envName, 'EC2StartRule', this.instance.instanceId].join('-'),
        description: `${this.instance.instanceId} ${props.startCronSchedule} Start`,
        scheduleExpression: props.startCronSchedule,
        targets: [{
          arn: `arn:aws:ssm:${region}::automation-definition/AWS-StartEC2Instance:$DEFAULT`,
          id: 'TargetEC2Instance1',
          input: `{"InstanceId": ["${this.instance.instanceId}"]}`,
          roleArn: role.roleArn
        }]
      });
      
      // 停止スケジュール
      new events.CfnRule(this, `EC2StopRule`, {
        name: [props.pjName, props.envName, 'EC2StopRule', this.instance.instanceId].join('-'),
        description: `${this.instance.instanceId} ${props.stopCronSchedule} Stop`,
        scheduleExpression: props.stopCronSchedule,
        targets: [{
          arn: `arn:aws:ssm:${region}::automation-definition/AWS-StopEC2Instance:$DEFAULT`,
          id: 'TargetEC2Instance1',
          input: `{"InstanceId": ["${this.instance.instanceId}"]}`,
          roleArn: role.roleArn
        }]
      });
    }
  }
}
