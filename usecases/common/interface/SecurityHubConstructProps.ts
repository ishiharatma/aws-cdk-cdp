import {
    aws_lambda as lambda,
    aws_codebuild as codebuild
} from "aws-cdk-lib";

export interface SecurityHubConstructProps {
    readonly pjName: string;
    readonly envName: string;
    readonly aggregationRegion?: string;
    readonly regions?: securityHubConfig[];
}
interface securityHubConfig {
  region: string;
  isMain: boolean;
};