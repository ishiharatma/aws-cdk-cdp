import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_iam as iam,
  aws_kms as kms,
  aws_codecommit as codecommit,
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_action,
  aws_codestarnotifications as codestar_notification,
  aws_sns as sns,
  aws_s3 as s3,
  aws_logs as logs,
} from 'aws-cdk-lib';

interface CicdSamApigwLambdaStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly repositoryName: string;
  readonly repositoryRegion: string;
  readonly repositoryAccountId: string;
  readonly branchName: string;
  /**
   * @default false
   */
  readonly isApprovetage?: boolean;
  /**
   * Approval Topic Arn
   */
  readonly approvalTopicArn?: string;
}


export class CicdSamApigwLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CicdSamApigwLambdaStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    const repositoryArn:string = `arn:aws:codecommit:${props.repositoryRegion}:${props.repositoryAccountId}:${props.repositoryName}`;
    const isApprovetage = props.isApprovetage ?? false;

    const nameBase:string = [props.pjName, props.envName, props.repositoryName,props.branchName.replace('/','-') ].join('-');

    // CodePipeline アーティファクトバケット
    const artifactKmsAliasName = `alias/${nameBase}`;
    const encryptionKey = new kms.Key(this, 'EncryptionKey', {
      alias: artifactKmsAliasName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enableKeyRotation: true,
    });
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: [props.pjName, props.envName,'artifacts', accountId].join('.'),
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: encryptionKey ? s3.BucketEncryption.KMS : s3.BucketEncryption.KMS_MANAGED,
      encryptionKey: encryptionKey,
    });
    // Bucket Policy
    artifactBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:ListBucket'],
        resources: [
          artifactBucket.bucketArn
        ],
        principals: [
          new iam.AccountRootPrincipal(),
          new iam.AccountPrincipal(props.repositoryAccountId),
        ],
      })
    );
    artifactBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:Get*',
          's3:Put*',
          's3:GetObjectVersion'
        ],
        resources: [
          artifactBucket.bucketArn,
          artifactBucket.arnForObjects('*')
        ],
        principals: [
          new iam.AccountRootPrincipal(),
          new iam.AccountPrincipal(props.repositoryAccountId),
        ],
      })
    );
    artifactBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyInsecureConnections',
        effect: iam.Effect.DENY,
        actions: ['s3:*'],
        resources: [artifactBucket.arnForObjects('*')],
        principals: [new iam.AnyPrincipal()],
        conditions: 
        {
          "Bool":{"aws:SecureTransport": false}
        }
      })
    );
    artifactBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyUnEncryptedObjectUploads',
        effect: iam.Effect.DENY,
        actions: ['s3:PutObject'],
        resources: [artifactBucket.arnForObjects('*')],
        principals: [new iam.AnyPrincipal()],
        conditions: 
        {
          "StringNotEquals":{ "s3:x-amz-server-side-encryption": "aws:kms"}
        }
      })
    );
    // Bucket Lifecycle
    artifactBucket.addLifecycleRule({
      expiration: cdk.Duration.days(60),
      abortIncompleteMultipartUploadAfter: cdk.Duration.days(7), // 不完全なマルチパートアップロードの削除
      transitions: [
        {
          storageClass: s3.StorageClass.ONE_ZONE_INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(30), // 'Days' in Transition action must be greater than or equal to 30 for storageClass 'ONEZONE_IA'
        },
      ],
    });

    // CodePipeline
    const pipelineName:string = [nameBase].join('-');
    const buildLogGroup = new logs.LogGroup(this, 'buildLogGroup',{
      logGroupName: ['buildProject', nameBase].join('-'),
      retention: cdk.aws_logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const sourceRole = iam.Role.fromRoleArn(this,
      'SourceRole',
      `arn:aws:iam::${accountId}:role/@role-pipeline-source-action-${pipelineName}`
      );
    const buildRole = new iam.Role(this, 'buildRole', {
      //roleName: ['@role','codebuild',props.repositoryName, branchName.replace('/','-'), props.pjName, props.envName].join('-'),
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'), managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'), // ECR の操作に必要
      ]
    })
    const changeSetRole = new iam.Role(this, 'ChangeSetRole', {
      assumedBy: new iam.AccountRootPrincipal(),//new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'),
      ]
    })
    changeSetRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          's3:GetBucket*',
          's3:GetObject*',
          's3:List*',
        ],
        resources: [
          artifactBucket.bucketArn,
          artifactBucket.arnForObjects('*')
        ],
      })
    );
    const stackName:string = nameBase;
    const changeSetName: string = 'StagedChangeSet';
    const executeChangeSetRole = new iam.Role(this, 'ExecuteChangeSetRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    })
    executeChangeSetRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          'cloudformation:DescribeChangeSet',
          'cloudformation:DescribeStacks',
          'cloudformation:ExecuteChangeSet',
        ],
        conditions:[
          {
            "StringEqualsIfExists":{ "cloudformation:ChangeSetName": changeSetName}
          }
        ],
        resources: [
          `arn:aws:cloudformation:${region}:${accountId}:stack:${stackName}/*`
        ],
      })
    );
    const pipelineServiceRole = new iam.Role(this, 'codePipelineServiceRole',{
      //roleName: ['@role','codepipeline',props.repositoryName, branchName.replace('/','-'), props.pjName, props.envName].join('-'),
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    });
    pipelineServiceRole.addToPolicy(
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
    pipelineServiceRole.addToPolicy(
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
    pipelineServiceRole.addToPolicy(
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
    pipelineServiceRole.addToPolicy(
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
    pipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        //sid: '',
        effect: iam.Effect.ALLOW,
        actions:[
          "iam:PassRole"
        ],
        resources: ['*'],
      })
    );
    pipelineServiceRole.addToPolicy(
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
    pipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [sourceRole.roleArn],
      })
    );
    // デプロイ用ロールのAssumeRole
    pipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [changeSetRole.roleArn],
      })
    );
    pipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [executeChangeSetRole.roleArn],
      })
    );
    // アーティファクト
    const sourceArtifact = new codepipeline.Artifact("SourceArtifact");
    const buildArtifact = new codepipeline.Artifact("BuildArtifact");

    const repo = codecommit.Repository.fromRepositoryArn(this, "repo", repositoryArn) as codecommit.Repository

    // パイプラインの生成
    const pipeline = new codepipeline.Pipeline(this, 'pipeline',{
      pipelineName: pipelineName,
      crossAccountKeys: true, // 	Create KMS keys for cross-account deployments.
      role: pipelineServiceRole,
      artifactBucket: artifactBucket,
    });
    // ソースアクション
    const sourceAction = new codepipeline_action.CodeCommitSourceAction({
      actionName: 'sourceAction',
      runOrder: 1,
      repository: repo,
      branch: props.branchName,
      output: sourceArtifact,
      role: sourceRole,
    });
    // ビルドアクション
    // ビルドプロジェクト
    const buildProject = new codebuild.PipelineProject(this, 'buildProject',{
      projectName: ['buildProject', nameBase].join('-'),
      role: buildRole,
//      vpc: props.vpc, // see :https://www.docker.com/increase-rate-limit
//                      // CodeBuild の IP からレート制限を受けないように、NAT Gateway の EIP を経由するため VPC に接続
//      subnetSelection: props.vpc.selectSubnets({subnetType: ec2.SubnetType.PRIVATE_WITH_NAT}),
      //encryptionKey: encryptionKey,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL, // this._getCodeBuildComputeType(props.buildComputeType),
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
          S3_BUCKET: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: artifactBucket.bucketName,
          }
        },
      },
      logging: {
        cloudWatch: {
          logGroup: buildLogGroup
        }
      },
    });
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
    // デプロイアクション
    const changeSetAction = new codepipeline_action.CloudFormationCreateReplaceChangeSetAction({
      actionName: 'ceateChangeSet',
      stackName: stackName,
      changeSetName: changeSetName,
      adminPermissions: true,
      templatePath: buildArtifact.atPath("packaged.yaml"),
      runOrder: 20,
      role: changeSetRole,
    })
    pipeline.addStage({
      stageName: 'CreateChangeSet',
      actions:[
        changeSetAction
      ]
    });
    if (isApprovetage) {
      // 承認ステージを追加する
      pipeline.addStage({
        stageName: 'Approval',
        actions:[
          new codepipeline_action.ManualApprovalAction({
            actionName: 'ManualApprovalAction',
            runOrder: 25,
            externalEntityLink: sourceAction.variables.commitMessage,
            additionalInformation: 'Please review the latest change and approve or reject.',
            notificationTopic: sns.Topic.fromTopicArn(this,'ApprovalTopic',props.approvalTopicArn!),
          }),
        ]
      });
    }
    const ExecuteAction = new codepipeline_action.CloudFormationExecuteChangeSetAction({
      actionName: 'executeChangeSet',
      stackName: stackName,
      changeSetName: changeSetName,
      runOrder: 30,
      role: executeChangeSetRole,
    })
    pipeline.addStage({
      stageName: 'ExecuteChangeSet',
      actions:[
        ExecuteAction
      ]
    });

    // タグを付与する
    cdk.Tags.of(this).add('RepositoryName', props.repositoryName);

  }
}
