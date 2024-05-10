import * as cdk from "aws-cdk-lib";
import { aws_s3 as s3 } from "aws-cdk-lib";

export interface LifecycleRule {
    prefix?: string;
    expirationDays: number;
    ruleNameSuffix?: string;
    abortIncompleteMultipartUploadAfterDays?: number;
    transitions?: LifecycleRuleTransitions[];
};

export interface LifecycleRuleTransitions {
    storageClass: s3.StorageClass;
    transitionAfter: cdk.Duration;
};

