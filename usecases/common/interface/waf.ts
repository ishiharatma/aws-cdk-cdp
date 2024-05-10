import * as cdk from "aws-cdk-lib";

export interface listOfWAFRules {
    name: string;
    priority: number;
    overrideAction: string;
    excludedRules: string[];
};