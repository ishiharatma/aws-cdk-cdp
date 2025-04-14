import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_ec2 as ec2,
  aws_events as events,
  aws_iam as iam,
} from 'aws-cdk-lib';

interface Ec2KeycloakDockerStackProps extends cdk.StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly vpcId: string;
  readonly keycloakAdmin: string;
  readonly keycloakAdminPassword: string;
  readonly startSchedule?: string;
  readonly stopSchedule?: string;
  readonly isAutoDeleteObject?: boolean;
  readonly isPublic?: boolean;
  readonly ipAddresses?: string[];
}
export class Ec2KeycloakDockerStack extends cdk.Stack {
  public readonly instance: ec2.IInstance;
  constructor(scope: Construct, id: string, props: Ec2KeycloakDockerStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    if (props.isPublic && !props.ipAddresses) {
      throw new Error('When isPublic is true, ipAddresses must be specified.');
    }

    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {vpcId:props.vpcId});
    // Create a security group for EC2 instance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      securityGroupName: `${id}-ec2-SecurityGroup`,
      vpc: vpc,
      allowAllOutbound: false,
    });
    ec2SecurityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS, 'Allow HTTPS access to anywhere');

    if (props.isPublic) {
      for (const ip of props.ipAddresses ?? []) {
        ec2SecurityGroup.addIngressRule(ec2.Peer.ipv4(ip), ec2.Port.tcp(9000), 'Allow Helthcheck Port from the IP address');
        ec2SecurityGroup.addIngressRule(ec2.Peer.ipv4(ip), ec2.Port.HTTP, 'Allow HTTP access from the IP address');
        ec2SecurityGroup.addIngressRule(ec2.Peer.ipv4(ip), ec2.Port.HTTPS, 'Allow HTTPS access from the IP address');
      }
    } else {
      ec2SecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(9000), 'Allow Helthcheck Port from VPC');
      ec2SecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.HTTP, 'Allow HTTP access from VPC');
      ec2SecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.HTTPS, 'Allow HTTPS access from VPC');
    }

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
    const keycloakVersion = '26.1.4';
    const dockerComposeVersion = 'v2.34.0';
    userData.addCommands(
      'yum update -y',
      // Optional: timezone setting (Asia/Tokyo)
      'ln -sf /usr/share/zoneinfo/Asia/Tokyo /etc/localtime',
      // Install Docker Engine
      'yum -y install docker',  // Docker Engine パッケージインストール
      // install docker-compose
      'mkdir -p /usr/local/lib/docker/cli-plugins',
      `curl -SL https://github.com/docker/compose/releases/download/${dockerComposeVersion}/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose`,
      'chmod +x /usr/local/lib/docker/cli-plugins/docker-compose',
      'systemctl start docker', // Docker サービス起動
      'systemctl enable docker', // Dockerサービスの自動起動を有効化
      // Keycloak のコンテナ起動
      // https://quay.io/repository/keycloak/keycloak?tab=tags
      // or
      // https://hub.docker.com/r/keycloak/keycloak/tags
      'docker run --restart=always --name keycloak ' + 
      // `-e "KEYCLOAK_ADMIN=${props.keycloakAdmin}" ` + // deprecated
      `-e "KC_BOOTSTRAP_ADMIN_USERNAME=${props.keycloakAdmin}" ` +
      //`-e "KEYCLOAK_ADMIN_PASSWORD=${props.keycloakAdminPassword}" ` + // deprecated
      `-e "KC_BOOTSTRAP_ADMIN_PASSWORD=${props.keycloakAdminPassword}" ` +
      `-e "TZ='Asia/Tokyo'" ` +
      `-e "KC_HTTP_ENABLED=true" ` +
      `-e "KC_HOSTNAME_STRICT=false" ` +
      `-e "KC_HOSTNAME_STRICT_HTTPS=false" ` +
      `-e "KC_HEALTH_ENABLED=true" ` +
      `-d -p 80:8080 -p 443:8443 -p 9000:9000 quay.io/keycloak/keycloak:${keycloakVersion} start-dev`,
    );

    // Create an EC2 instance for connection testing
    this.instance = new ec2.Instance(this, 'EC2Instance1', {
      vpc: vpc,
      instanceName: [props.pjName, props.envName, 'keycloak', 'instance'].join('/') ,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64 //X86_64, 
      }),
      vpcSubnets: { 
        subnetType: props.isPublic ? ec2.SubnetType.PUBLIC : ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
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
        description: "Keycloak Instance",
    });

    // 自動起動と停止スケジュール
    if (props.startSchedule && props.stopSchedule) {
      const role = new iam.Role(this, `EC2startstopRole`, {
        roleName: [props.pjName, props.envName, 'KeycloakStopStart'].join('-'),
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
