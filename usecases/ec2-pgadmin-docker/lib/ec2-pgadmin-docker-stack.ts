import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_ec2 as ec2,
  aws_events as events,
  aws_iam as iam,
} from 'aws-cdk-lib';

interface Ec2PgadminDockerStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly vpcId: string;
  readonly pgAdminLoginId: string;
  readonly pgAdminLoginPassword: string;
  readonly startSchedule?: string;
  readonly stopSchedule?: string;
  readonly isAutoDeleteObject?: boolean;
}

export class Ec2PgadminDockerStack extends cdk.Stack {
  public readonly instance: ec2.IInstance;
  constructor(scope: Construct, id: string, props: Ec2PgadminDockerStackProps) {
    super(scope, id, props);
    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {vpcId:props.vpcId});
    // Create a security group for EC2 instance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true,    
    });
    new cdk.CfnOutput(this, 'EC2SecurityGroupId', {
      value: ec2SecurityGroup.securityGroupId,
    });
    
    const keyPair = new ec2.KeyPair(this, 'KeyPair', {
      keyPairName: `${id}-ec2-KeyPair`,
    });
    new cdk.CfnOutput(this, 'EC2InstanceKeyPairId', {
      value: keyPair.keyPairId,
    });
    // キーペア取得コマンドアウトプット
    new cdk.CfnOutput(this, 'GetSSHKeyCommand', {
      value: `aws ssm get-parameter --name /ec2/keypair/${keyPair.keyPairId} --region ${this.region} --with-decryption --query Parameter.Value --output text`,
    })
    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userData.addCommands(
      'yum update -y',
      'yum -y install docker',  // Docker Engine パッケージインストール
      'systemctl start docker', // Docker サービス起動
      'systemctl enable docker', // Dockerサービスの自動起動を有効化
      // PgAdmin4 のコンテナ起動
      `docker run --restart=always --name pgadmin4 -e "PGADMIN_DEFAULT_EMAIL=${props.pgAdminLoginId}" -e "PGADMIN_DEFAULT_PASSWORD=${props.pgAdminLoginPassword}" -d -p 5050:80 dpage/pgadmin4`,
    );

    // Create an EC2 instance for connection testing
    this.instance = new ec2.Instance(this, 'EC2Instance1', {
      vpc: vpc,
      instanceName: [props.pjName, props.envName, 'pgadmin', 'instance'].join('/') ,
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
      keyPair: keyPair,
    });
    new cdk.CfnOutput(this, "EC2InstanceId", {
        value: this.instance.instanceId,
        description: "PgAdmin Instance",
    });

    // 自動起動と停止スケジュール
    if (props.startSchedule && props.stopSchedule) {
      const role = new iam.Role(this, `EC2startstopRole`, {
        roleName: [props.pjName, props.envName, 'PgAdminStopStart'].join('-'),
        assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonSSMAutomationRole'),
        ]
      });
      // 起動スケジュール
      const startRule = new events.CfnRule(this, 'EC2StartRule', {
        name: [props.pjName, props.envName, 'EC2StartRule'].join('-'),
        description: `${this.instance.instanceId} ${props.startSchedule} Start`,
        scheduleExpression: props.startSchedule,
        targets: [{
          arn: `arn:aws:ssm:${region}::automation-definition/AWS-StartEC2Instance:$DEFAULT`,
          id: 'TargetEC2Instance1',
          input: `{"InstanceId": ["${this.instance.instanceId}"]}`,
          roleArn: role.roleArn
        }]
      });
      
      // 停止スケジュール
      const stopRule = new events.CfnRule(this, 'EC2StopRule', {
        name: [props.pjName, props.envName, 'EC2StopRule'].join('-'),
        description: `${this.instance.instanceId} ${props.stopSchedule} Stop`,
        scheduleExpression: props.stopSchedule,
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
