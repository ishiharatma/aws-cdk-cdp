import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_codecommit as codecommit,
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_action,
  aws_codestarnotifications as codestar_notification,
  aws_sns as sns,
  aws_s3 as s3,
  aws_lambda as lambda,
  aws_logs  as logs,
} from 'aws-cdk-lib';
import { BucketConstruct } from "./construct-bucket";
import * as interfaceDef from '../interface/index';
import * as path from 'path';

export class WebPipelineConstruct extends Construct {
  // 別のスタックで参照する
  //public readonly 
  
  constructor(scope: Construct, id: string, props: interfaceDef.WebPipelineConstructProps) {
    super(scope, id);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    const lambdaLogLevel = props.lambdaLogLevel ?? 'INFO';
    const isApproveStage = props.isApproveStage ?? false;
    const branchName:string  = props.branchName ?? 'main';

    const LogsRetentionDays:number  = props.logsRetentionDays ?? logs.RetentionDays.ONE_YEAR;
    const sourceRole =  iam.Role.fromRoleArn(this,
      'SourceRole',
      `arn:aws:iam::${props.repositoryAccountId}:role/@role-pipeline-source-action-${props.pjName}-${props.envName}-${accountId}`
      );
    const deployBucket = s3.Bucket.fromBucketName(this,'deployBucket',props.websiteBucketName);

    //  ログ出力用ロググループ
    const buildLogGroup = new logs.LogGroup(this,'buildLogGroup',{
      logGroupName: ['buildProject', props.pjName, props.envName, props.repositoryName, branchName].join('-'),
      retention: LogsRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // デプロイロール
    const deployRole = new iam.Role(this,'DeployRole', {
      assumedBy: new iam.AccountRootPrincipal(),//new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSCodeDeployRole'),
      ]
    })
    // Artifact
    const artifactBucket = new BucketConstruct(this,'artifactBucket',{
      pjName: props.pjName,
      envName: props.envName,
      bucketSuffix: ['artifact',  props.pjName, props.envName, props.repositoryName, branchName].join('-'),
      isAutoDeleteObject: props.isAutoDeleteObject,
    })
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowArtifactS3Object",
        effect:  iam.Effect.ALLOW,
        actions: [
          "s3:GetObject*",
          "s3:GetBucket*",
          "s3:List*",
          "kms:GenerateDataKey",
          "kms:Decrypt",
        ],
        resources: [
          artifactBucket.bucket.bucketArn,
          artifactBucket.bucket.arnForObjects('*'),
        ],
      })
    );
    // Deploy Bucket
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowStaticSiteS3Object",
        effect:  iam.Effect.ALLOW,
        actions: [
          "s3:ListBucket",
          "s3:DeleteObject",
          "s3:PutObject",
          "s3:GetObject*",
          "s3:GetBucket*",
          "s3:List*",
        ],
        resources: [
          deployBucket.bucketArn,
          deployBucket.arnForObjects('*'),
        ],
      })
    );

    // パイプラインサービスロール
    const codePipelineServiceRole = new iam.Role(this, 'codePipelineServiceRole',{
      roleName:  ['@role','codepipeline', props.pjName, props.envName, props.repositoryName, branchName].join('-'),
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
//      managedPolicies: [
//        codePipelineServicePolicy
//      ]
    });
    // see : https://docs.aws.amazon.com/ja_jp/codepipeline/latest/userguide/security-iam.html#how-to-custom-role
//    codePipelineServiceRole.addToPolicy(
//      new iam.PolicyStatement({
//        //sid: '',
//        effect: iam.Effect.ALLOW,
//        actions:[
//          "appconfig:StartDeployment",
//          "appconfig:StopDeployment",
//          "appconfig:GetDeployment",
//        ],
//        resources: ['*'],
//      }),
//    );
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
//        conditions: {
//          "StringEqualsIfExists": {
//            "iam:PassedToService": [
//            "cloudformation.amazonaws.com",
//            "elasticbeanstalk.amazonaws.com",
//            "ec2.amazonaws.com",
//            "ecs-tasks.amazonaws.com", 
//            ]
//          }
//        }
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
    const buildRole =  new iam.Role(this, 'buildRole', {
      roleName:  ['@role','codebuild', props.pjName, props.envName, props.repositoryName, branchName].join('-'),
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    })
    // base
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowCodebuild",
        effect:  iam.Effect.ALLOW,
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
        effect:  iam.Effect.ALLOW,
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
    // CloudWatch
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudWatchLogs",
        effect:  iam.Effect.ALLOW,
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
        effect:  iam.Effect.ALLOW,
        actions: [
          "s3:GetBucketAcl",
          "s3:GetBucketLocation",
        ],
        resources: [
          artifactBucket.bucket.bucketArn,
        ],
      })
    );
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AllowArtifactS3Object",
        effect:  iam.Effect.ALLOW,
        actions: [
          "s3:GetObject*",
          "s3:GetBucket*",
          "s3:List*",
          "kms:GenerateDataKey",
          "kms:Decrypt",
        ],
        resources: [
          artifactBucket.bucket.bucketArn,
          artifactBucket.bucket.arnForObjects('*'),
        ],
      })
    );

    // ビルドプロジェクト
    const buildProject = new codebuild.PipelineProject(this, 'buildProject',{
      projectName:  ['buildProject', props.repositoryName, branchName, props.pjName, props.envName].join('-'),
      role: buildRole,
      //encryptionKey: encryptionKey,
      environment: {
        buildImage: props.buildImage ?? codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          PROJECT_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.pjName,
          },
          ENV_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.envName,
          },
        },
      },
      logging: {
        cloudWatch:  {
          logGroup: buildLogGroup
        }
      },
    })

    // リポジトリ
    //const repo = codecommit.Repository.fromRepositoryName(this, "repo", props.repositoryName) as codecommit.Repository
    const repo = codecommit.Repository.fromRepositoryArn(this, "repo", props.repositoryArn) as codecommit.Repository
    
    // アーティファクト
    const sourceArtifact =  new codepipeline.Artifact("SourceArtifact");
    const buildArtifact = new codepipeline.Artifact("BuildArtifact");

    // パイプラインの生成
    const pipelineName = [props.pjName, props.envName, props.repositoryName, branchName].join('-')
    const pipeline = new codepipeline.Pipeline(this, 'pipeline',{
      pipelineName: pipelineName,
      crossAccountKeys: true, // Create KMS keys for cross-account deployments.
      role: codePipelineServiceRole,
      artifactBucket: artifactBucket.bucket,
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
        sourceAction
      ]
    });
    // ビルドアクション
    const buildAction = new codepipeline_action.CodeBuildAction({
      actionName: 'buildAction',
      runOrder: 2,
      project: buildProject,
      input: sourceArtifact,
      outputs:  [buildArtifact],
    });
    pipeline.addStage({
      stageName: 'Build',
      actions:[
        buildAction
      ]
    });

    if (isApproveStage && props.approvalTopicArn) {
      // 承認ステージを追加する
      pipeline.addStage({
        stageName: 'Approval',
        actions:[
          new codepipeline_action.ManualApprovalAction({
            actionName: 'ManualApprovalAction',
            runOrder: 3,
            externalEntityLink: sourceAction.variables.commitMessage,
            additionalInformation: 'Please review the latest change and approve or reject.',
            notificationTopic: sns.Topic.fromTopicArn(this,'ApprovalTopic',props.approvalTopicArn),
          }),
        ]
      });
    };
    // デプロイステージ
    const deployStage = new codepipeline_action.S3DeployAction({
      actionName: 'DeployAction',
      runOrder: 4,
      bucket: deployBucket,
      input: buildArtifact,
      //role: deployRole,
    });
    pipeline.addStage({
      stageName: 'Deploy',
      actions:[
        deployStage
      ]
    });
    // S3 Sync ステージ
    const codeDeployS3SyncRole = new iam.Role(this, 'CodeDeployS3SyncRole',{
      roleName: ['@role', 'lambda', props.pjName, props.envName,'s3sync', props.websiteBucketName].join('-'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: { 
        codeDeployS3Sync: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions:[
              "codepipeline:PutJobSuccessResult",
              "codepipeline:PutJobFailureResult",
              "s3:ListAllMyBuckets",
              "s3:GetBucketLocation",
              "s3:*",
              "kms:Decrypt",
              "sns:Publish",
            ],
            resources: ["*"],
          }),
         ]
      })}
    });
    const codeDeployS3SyncLambdaFunction = new lambda.Function(
      this,
      'codeDeployS3Sync',
      {
        functionName: `${props.pjName}-${props.envName}-codedeploy-s3sync-${props.websiteBucketName}`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, props.s3SyncFunctionPath)
        ),
        handler: 'index.lambda_handler',
        runtime: props.s3SyncFunctionFunctionLambdaRuntime ?? lambda.Runtime.PYTHON_3_12,
        timeout: cdk.Duration.seconds(30),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          LOG_LEVEL: lambdaLogLevel,
        },
        role: codeDeployS3SyncRole,
        tracing: lambda.Tracing.ACTIVE,
      }
    );
    const s3SyncStage =  new codepipeline_action.LambdaInvokeAction({
      actionName: 'S3SyncAction',
      runOrder: 8,
      lambda: lambda.Function.fromFunctionName(this,'S3SyncFunction',codeDeployS3SyncLambdaFunction.functionName),
      userParameters: {
        "DEST_BUCKET_NAME":  props.websiteBucketName,
      },
      inputs: [buildArtifact],
    });
    pipeline.addStage({
      stageName: 'Sync',
      actions:[
        s3SyncStage
      ],
    });
    // CloudFront Invalidation ステージ
    const cloudFrontCreateInvalidationRole = new iam.Role(this, 'CloudFrontCreateInvalidationRole',{
      roleName: ['@role', 'lambda',  props.pjName, props.envName, 'cloudfront', 'invalidation', props.distributionId].join('-'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: { 
        cloudFrontCreateInvalidation: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions:[
              "codepipeline:PutJobSuccessResult",
              "codepipeline:PutJobFailureResult",
              "cloudfront:Get*",
              "cloudfront:List*",
              "cloudfront:CreateInvalidation",
              "sns:Publish",
            ],
            resources: ["*"],
          }),
         ]
      })}
    });
    const cloudFrontCreateInvalidationLambdaFunction = new lambda.Function(
      this,
      'cloudFrontCreateInvalidation',
      {
        functionName: `${props.pjName}-${props.envName}-cloudfront-create-invalidation-${props.distributionId}`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, props.invalidationFunctionPath)
        ),
        handler: 'index.lambda_handler',
        runtime: props.invalidationFunctionLambdaRuntime ?? lambda.Runtime.PYTHON_3_12,
        timeout: cdk.Duration.seconds(30),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          LOG_LEVEL: lambdaLogLevel,
        },
        role: cloudFrontCreateInvalidationRole,
        tracing: lambda.Tracing.ACTIVE,
      }
    );
    const cloudFrontInvalidationStage =  new codepipeline_action.LambdaInvokeAction({
      actionName: 'CloudFrontInvalidationAction',
      runOrder: 9,
      lambda: lambda.Function.fromFunctionName(this,'InvalidationFunction',cloudFrontCreateInvalidationLambdaFunction.functionName),
      userParameters: {
        "PIPELINE_NAME": pipelineName,
        "DISTRIBUTION_ID": props.distributionId,
        "TOPIC_ARN": props.notificationTopicArn,
      }
    });
    pipeline.addStage({
      stageName: 'Invalidation',
      actions:[
        cloudFrontInvalidationStage
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
      targets: [ sns.Topic.fromTopicArn(this, 'PipelineNotificationTopic', props.snsNoticeTopicArn)]
    });

    // タグを付与する
    cdk.Tags.of(this).add('RepositoryAccountId', props.repositoryAccountId);
    cdk.Tags.of(this).add('RepositoryName', props.repositoryName);
    cdk.Tags.of(this).add('BranchName', branchName);

  }

}
