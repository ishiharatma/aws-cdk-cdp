import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_codecommit as codecommit,
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_action,
  aws_codestarnotifications as codestar_notification,
  aws_sns as sns,
  aws_s3 as s3,
  aws_logs as logs,
  aws_ecs as ecs,
  aws_ecr as ecr,
} from 'aws-cdk-lib';

interface CicdEcsFargateStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly vpcId: string;
  readonly artifactBucketArn: string
  /**
   * Target repository Name
   */
  readonly repositoryAccountId: string;
  readonly repositoryName: string;
  readonly repositoryArn: string;
  readonly ecrRepositoryName: string;
  readonly ecsTaskDefArn: string;
  readonly ecsClusterArn: string;
  readonly serviceName:string;
  readonly imageName: string;
  /**
   * Approval Topic Arn
   */
  readonly approvalTopicArn: string;
  /**
   * @default codebuild.LinuxBuildImage.STANDARD_7_0
   */
  readonly buildImage?: codebuild.IBuildImage;
  /**
   * @default codebuild.computeType.SMALL
   */
  readonly buildComputeType?: string; //codebuild.ComputeType;
  /**
   * @default master
   */
  readonly branchName?: string;
  /**
   * @default 365 Days
   */
  readonly logsRetentionDays?: number;
  /**
   * @default 10 minutes
   */
  readonly deploymentTimeoutMinutes?: number;
  /**
   * @default false
   */
  readonly isApprovetage?: boolean;
  /**
   * SNS Topic Arn - Notice
   */
  readonly snsNoticeHandlerTopicArn: string;
}

export class CicdEcsFargateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CicdEcsFargateStackProps) {
    super(scope, id, props);
    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    const pjPrefix:string = props.pjName.concat('-', props.envName);

    // get VPC from VPCid
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
      vpcId: props.vpcId,
    });

    const ecsCluster = ecs.Cluster.fromClusterArn(this, 'ecsCluster', props.ecsClusterArn);

    // get ECR Service from serviceName
    const service = ecs.FargateService.fromFargateServiceAttributes(this, 'service',{
      cluster: ecsCluster,
      serviceName: props.serviceName,
    });

    // get S3 bucket from artifactBucketArn
    const artifactBucket = s3.Bucket.fromBucketArn(this, 'artifactBucket', props.artifactBucketArn);

    const isApprovetage = props.isApprovetage ?? false;
    const branchName:string = props.branchName ?? 'master';

    const LogsRetentionDays:number = props.logsRetentionDays ?? logs.RetentionDays.ONE_YEAR;
    const sourceRole = iam.Role.fromRoleArn(this,
      'SourceRole',
      `arn:aws:iam::${props.repositoryAccountId}:role/@role-pipeline-source-action-${props.pjName}-${props.envName}-${accountId}`
      );
    
    // パイプライン名
    const pipelineName:string = [props.repositoryName, branchName.replace('/','-'), accountId].join('-');

    // ログ出力用ロググループ
    const buildLogGroup = new logs.LogGroup(this, 'buildLogGroup',{
      logGroupName: ['buildProject', props.repositoryName, branchName.replace('/','-')].join('-'),
      retention: LogsRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // デプロイロール
    const deployRole = new iam.Role(this, 'DeployRole', {
      assumedBy: new iam.AccountRootPrincipal(),//new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'),
      ]
    })
    // Artifact
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowArtifactS3Object",
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject*",
          "s3:GetBucket*",
          "s3:List*",
          "kms:GenerateDataKey",
          "kms:Decrypt",
        ],
        resources: [
          artifactBucket.bucketArn,
          artifactBucket.arnForObjects('*'),
        ],
      })
    );
    // パイプラインサービスロール
    const codePipelineServiceRole = new iam.Role(this, 'codePipelineServiceRole',{
      //roleName: ['@role','codepipeline',props.repositoryName, branchName.replace('/','-'), props.pjName, props.envName].join('-'),
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    });
    // see : https://docs.aws.amazon.com/ja_jp/codepipeline/latest/userguide/security-iam.html#how-to-custom-role
    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          "states:DescribeExecution",
          "states:DescribeStateMachine",
          "states:StartExecution",
        ],
        resources: ['*'],
      })
    );
    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          "ecr:DescribeImages",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:TagResource"
        ],
        resources: ['*'],
      })
    );

    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          "codecommit:CancelUploadArchive",
          "codecommit:GetBranch",
          "codecommit:GetCommit",
          "codecommit:GetRepository",
          "codecommit:GetUploadArchiveStatus",
          "codecommit:UploadArchive",
        ],
        resources: ['*'],
      }),
    );
    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          "codebuild:BatchGetBuilds",
          "codebuild:StartBuild",
          "codebuild:BatchGetBuildBatches",
          "codebuild:StartBuildBatch",
        ],
        resources: ['*'],
      }),
    );
    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          "codedeploy:CreateDeployment",
          "codedeploy:GetApplication",
          "codedeploy:GetApplicationRevision",
          "codedeploy:GetDeployment",
          "codedeploy:GetDeploymentConfig",
          "codedeploy:RegisterApplicationRevision",
        ],
        resources: ['*'],
      }),
    );

    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          "codestar-connections:UseConnection"
        ],
        resources: ['*'],
      })
    );

    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          "iam:PassRole"
        ],
        resources: ['*'],
      })
    );
    
    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          'cloudwatch:*',
          's3:*',
          'cloudformation:*',
          "sns:Publish",
          "kms:GenerateDataKey",
          "kms:Decrypt",
        ],
        resources: ['*'],
      })
    );
    // ソースアクションのAssumeRole
    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [sourceRole.roleArn],
      })
    );
    // デプロイ用ロールのAssumeRole
    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [deployRole.roleArn],
      })
    );
    // ビルドロール
    const buildRole = new iam.Role(this, 'buildRole', {
      //roleName: ['@role','codebuild',props.repositoryName, branchName.replace('/','-'), props.pjName, props.envName].join('-'),
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'), managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'), // ECR の操作に必要
      ]
    })
    // base
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowCodebuild",
        effect: iam.Effect.ALLOW,
        actions: [
          "codebuild:CreateReportGroup",
          "codebuild:CreateReport",
          "codebuild:UpdateReport",
          "codebuild:BatchPutTestCases",
          "codebuild:BatchPutCodeCoverages",
        ],
        resources: ["*"],
      })
    );
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowIAM",
        effect: iam.Effect.ALLOW,
        actions: [
          "iam:List*",
          "iam:Get*",
          "iam:AttachRolePolicy",
          "iam:PutRolePolicy",
          "iam:UpdateAssumeRolePolicy",
          "iam:UpdateRole",
          "iam:UpdateRoleDescription",
        ],
        resources: ["*"],
      })
    );
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowECS",
        effect: iam.Effect.ALLOW,
        actions: [
          "ecs:DescribeTaskDefinition",
        ],
        resources: ["*"],
      })
    );
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowSSM",
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:Get*',
          'secretsmanager:Get*',
          'kms:*',
          's3:*',
        ],
        resources: ["*"],
      })
    );
    
    // CloudWatch
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudWatchLogs",
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [
          buildLogGroup.logGroupArn,
          [buildLogGroup.logGroupArn, "*"].join(":")
        ],
      })
    );
    // Artifact
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowArtifactS3Bucket",
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetBucketAcl",
          "s3:GetBucketLocation",
        ],
        resources: [
          artifactBucket.bucketArn,
        ],
      })
    );
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowArtifactS3Object",
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject*",
          "s3:GetBucket*",
          "s3:List*",
          "kms:GenerateDataKey",
          "kms:Decrypt",
        ],
        resources: [
          artifactBucket.bucketArn,
          artifactBucket.arnForObjects('*'),
        ],
      })
    );
    // ビルドプロジェクト
    const buildProject = new codebuild.PipelineProject(this, 'buildProject',{
      projectName: ['buildProject', props.repositoryName, branchName.replace('/','-'), accountId].join('-'),
      role: buildRole,
      vpc: vpc, // see :https://www.docker.com/increase-rate-limit
                      // CodeBuild の IP からレート制限を受けないように、NAT Gateway の EIP を経由するため VPC に接続
      subnetSelection: vpc.selectSubnets({subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}),
      //encryptionKey: encryptionKey,
      environment: {
        buildImage: props.buildImage ?? codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: this._getCodeBuildComputeType(props.buildComputeType),
        privileged: true, // Docker を使うために必要
        environmentVariables: {
          PROJECT_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.pjName,
          },
          ENV_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.envName,
          },
          ECR_REPOSITORY_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.ecrRepositoryName,
          },
          ECS_TASK_DEFINITION_ARN: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.ecsTaskDefArn,
          },
          IMAGE_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.imageName,
          },
          SCAN_RESULT_BUCKET_NAME: {
            // trivy のスキャン結果を格納するためのバケット名を指定
            // TODO: 
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${artifactBucket.bucketName}/${pipelineName.substring(0,20)}`,
          },
        },
      },
      logging: {
        cloudWatch: {
          logGroup: buildLogGroup
        }
      },
    });

    // リポジトリ
    const repo = codecommit.Repository.fromRepositoryArn(this, "repo", props.repositoryArn) as codecommit.Repository

    // アーティファクト
    const sourceArtifact = new codepipeline.Artifact("SourceArtifact");
    const sourceArtifactXray =  new codepipeline.Artifact("SourceArtifactXRay");
    const buildArtifact = new codepipeline.Artifact("BuildArtifact");

    // パイプラインの生成
    const pipeline = new codepipeline.Pipeline(this, 'pipeline',{
      pipelineName: pipelineName,
      crossAccountKeys: true, // 	Create KMS keys for cross-account deployments.
      role: codePipelineServiceRole,
      artifactBucket: artifactBucket,
    });
    
    // ソースアクション
    const sourceAction = new codepipeline_action.CodeCommitSourceAction({
      actionName: 'sourceAction',
      runOrder: 1,
      repository: repo,
      branch: branchName,
      output: sourceArtifact,
      role: sourceRole,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions:[
        sourceAction,
      ]
    });
    // ビルドアクション
    const buildAction = new codepipeline_action.CodeBuildAction({
      actionName: 'buildAction',
      runOrder: 2,
      project: buildProject,
      input: sourceArtifact,
      outputs: [buildArtifact],
    });
    pipeline.addStage({
      stageName: 'Build',
      actions:[
        buildAction
      ]
    });
    if (isApprovetage) {
      // 承認ステージを追加する
      pipeline.addStage({
        stageName: 'Approval',
        actions:[
          new codepipeline_action.ManualApprovalAction({
            actionName: 'ManualApprovalAction',
            runOrder: 10,
            externalEntityLink: sourceAction.variables.commitMessage,
            additionalInformation: 'Please review the latest change and approve or reject.',
            notificationTopic: sns.Topic.fromTopicArn(this,'ApprovalTopic',props.approvalTopicArn),
          }),
        ]
      });
    }
    // デプロイアクション
    const deployAction = new codepipeline_action.EcsDeployAction({
      actionName: 'ecsDeployAction',
      runOrder: 20,
      service: service,//ecs.FargateService.fromFargateServiceArn(this, 'servicve',props.serviceArn),
      imageFile: new codepipeline.ArtifactPath(buildArtifact, `imagedefinitions.json`),
      deploymentTimeout: cdk.Duration.minutes(props.deploymentTimeoutMinutes ?? 10),
    })
    pipeline.addStage({
      stageName: 'Deploy',
      actions:[
        deployAction
      ]
    });

    new codestar_notification.NotificationRule(this, 'NotificationRule', {
      notificationRuleName: pipeline.pipelineName,
      detailType: codestar_notification.DetailType.FULL,
      events: [
        codepipeline.PipelineNotificationEvents.PIPELINE_EXECUTION_SUCCEEDED,
        codepipeline.PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED,
        codepipeline.PipelineNotificationEvents.PIPELINE_EXECUTION_CANCELED,
      ],
      source: pipeline,
      targets: [ sns.Topic.fromTopicArn(this, 'PipelineNotificationTopic',props.snsNoticeHandlerTopicArn)] // 別アカウントに直接送信できないため
    });

    // タグを付与する
    cdk.Tags.of(this).add('RepositoryName', props.repositoryName);

  }

  /**
   * ビルド環境のコンピューティングタイプを取得する
   * see: https://docs.aws.amazon.com/ja_jp/codebuild/latest/userguide/build-env-ref-compute-types.html
   * @param type 
   * @returns 
   */
  private _getCodeBuildComputeType(type?:string): codebuild.ComputeType {
    switch (type) {
      case "SMALL":
        return codebuild.ComputeType.SMALL;
      case "MEDIUM":
        return codebuild.ComputeType.MEDIUM;
      case "LARGE":
        return codebuild.ComputeType.LARGE;
      case "X2_LARGE":
        return codebuild.ComputeType.LARGE;
      default:
        return codebuild.ComputeType.SMALL;
    }
  }

}
