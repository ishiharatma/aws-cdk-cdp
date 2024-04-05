import {
    aws_lambda as lambda,
    aws_codebuild as codebuild
} from "aws-cdk-lib";

export interface WebPipelineConstructProps {
    readonly pjName: string;
    readonly envName: string;
    readonly isAutoDeleteObject: boolean;
    /**
     * Target repository Name
     */
    readonly repositoryAccountId: string;
    readonly repositoryName: string;
    readonly repositoryArn: string;
    /**
     * @default main
     */
    readonly branchName?: string;
    /**
     * @default false
     */
    readonly isApproveStage?: boolean;
    /**
     * (Required When isApproveStage is True)Approval Topic Arn
     */
    readonly approvalTopicArn?: string;
    /**
     * Website Bucket Name
     */
    readonly websiteBucketName: string;
    /**
     * CloudFront Invalidation Function Name
     */
    readonly invalidationFunctionPath: string;
    /**
     * @default lambda.Runtime.PYTHON_3_12
     */
    readonly invalidationFunctionPythonVersion?: lambda.Runtime;
    /**
     * CloudFront Distribution Id
     */
    readonly distributionId: string;
    /**
     * S3 Sync Function Name
     */
    readonly s3SyncFunctionPath: string;
    /**
     * @default lambda.Runtime.PYTHON_3_12
     */
    readonly s3SyncFunctionFunctionPythonVersion?: lambda.Runtime;
    
    /**
     * @default codebuild.LinuxBuildImage.STANDARD_7_0
     */
    readonly buildImage?: codebuild.IBuildImage;
    /**
     * @default 365 Days
     */
    readonly logsRetentionDays?: number;
     /**
      * SNS Topic Arn - Notice
      */
    readonly snsNoticeTopicArn: string;
    /**
     * @default INFO
     */
    readonly lambdaLogLevel?: string;
    /**
     * Lambda Notification Topic Arn
     */
    readonly notificationTopicArn: string;
  }