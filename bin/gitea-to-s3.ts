#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GiteaToS3Stack } from '../lib/gitea-to-s3-stack';

const app = new cdk.App();
new GiteaToS3Stack(app, 'GiteaToS3Stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
