import {
    aws_lambda as lambda,
    aws_codebuild as codebuild
} from "aws-cdk-lib";

export interface EcrContinuousScanStackProps {
    readonly pjName: string;
    readonly envName: string;
    readonly isAutoDeleteObject: boolean;

     /**
      * SNS Topic Arn - Notice
      */
    //readonly snsNoticeTopicArn: string;
    /**
     * @default lambda.Runtime.PYTHON_3_12
     */
    readonly lambdaRuntime?: lambda.Runtime;
    /**
     * @default INFO
     */
    readonly lambdaLogLevel?: string;
    /**
     * Lambda Notification Topic Arn
     */
    readonly notificationTopicArn: string;
  }