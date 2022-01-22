import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Duration, CfnOutput } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class GiteaToS3Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'gitea-code-bucket', {
      versioned: true,
    });
    new CfnOutput(this, 'deploymentBucket', { value: bucket.bucketName });

    let giteaApiUrl: string = this.node.tryGetContext('giteaApiUrl');
    if (!giteaApiUrl) throw new Error('Context variable giteaApiUrl must be defined. cdk deploy --context giteaApiUrl=https://my.gitea/api/v1');
    while (giteaApiUrl.endsWith('/')) giteaApiUrl = giteaApiUrl.substring(0, giteaApiUrl.length - 1);
    if (!giteaApiUrl.endsWith('/api/v1')) throw new Error('Context variable giteaApiUrl should end with /api/v1: --context giteaApiUrl=https://my.gitea/api/v1');
    const giteaApiToken = this.node.tryGetContext('giteaApiToken');
    if (!giteaApiToken) throw new Error('Context variable giteaApiToken must be defined. cdk deploy --context giteaApiToken=abc123');
    const handler = new lambda.NodejsFunction(this, 'gitea-webhook-handler', {
      memorySize: 1024,
      timeout: Duration.seconds(29),
      entry: `${__dirname}/lambda-handler.ts`,
      runtime: Runtime.NODEJS_14_X,
      environment: {
        GITEA_API_URL: giteaApiUrl,
        GITEA_API_TOKEN: giteaApiToken,
        DEPLOY_BUCKET: bucket.bucketName,
      },
      bundling: {
        sourceMap: true,
        target: 'es2018',
      },
    });
    bucket.grantReadWrite(handler);

    const api = new apigateway.RestApi(this, 'gitea-webhook-api', {
      description: 'API gateway for handling gitea webhooks to clone code to S3',
      deployOptions: { stageName: 'prod' },
    });
    api.root.addResource('webhook').addMethod('POST', new apigateway.LambdaIntegration(handler, { proxy: true }));
  }
}
