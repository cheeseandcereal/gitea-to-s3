import 'source-map-support/register';
import { S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { promisify } from 'node:util';
import { pipeline, PassThrough } from 'node:stream';
import { promises } from 'node:fs';
import got from 'got';
import * as unzipper from 'unzipper';
import * as archiver from 'archiver';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
const pipelinePromise = promisify(pipeline);
type ProxyHandler = Handler<APIGatewayProxyEvent, APIGatewayProxyResult>;

interface GiteaWebhook {
  ref: string;
  repository: {
    name: string;
    full_name: string;
  };
}

const GITEA_API_URL = process.env.GITEA_API_URL;
const GITEA_API_TOKEN = process.env.GITEA_API_TOKEN;
const DEPLOY_BUCKET = process.env.DEPLOY_BUCKET || '';

const s3 = new S3({});

export const handler: ProxyHandler = async (event) => {
  console.log('Received request');
  console.log(event.body);
  const body: GiteaWebhook = JSON.parse(event.body || '');
  // Only handle commits to a branch
  if (body.ref.startsWith('refs/heads/')) {
    const ref = body.ref.substring(11);
    // Fetch and extract ref from webhook into temporary directory
    const extractLocation = `/tmp/${Math.random().toString(16).substring(2, 10)}`;
    const extract = unzipper.Extract({ path: extractLocation });
    await pipelinePromise(
      got.stream(`${GITEA_API_URL}/repos/${body.repository.full_name}/archive/${ref}.zip`, {
        headers: { accept: 'application/json', Authorization: `token ${GITEA_API_TOKEN}` },
      }),
      extract
    );
    await extract.promise();
    console.log(`Successfully downloaded and extracted to ${extractLocation}/${body.repository.name}`);

    // Re-zip the contents, without a top-level folder for compatibility with codepipeline and upload to S3
    const archive = archiver.create('zip');
    const writeStream = new PassThrough();
    const s3Upload = new Upload({ client: s3, params: { Bucket: DEPLOY_BUCKET, Key: `${body.repository.full_name}-${ref}.zip`, Body: writeStream } }).done();
    const pipe = pipelinePromise(archive, writeStream);
    archive.directory(`${extractLocation}/${body.repository.name}/`, false);
    await archive.finalize();
    await s3Upload;
    await pipe;
    console.log(`Successfully repackaged zip and uploaded to s3://${DEPLOY_BUCKET}/${body.repository.full_name}-${ref}.zip`);

    // Cleanup
    await promises.rm(extractLocation, { recursive: true, force: true });
    console.log('Finished cleanup');
  } else {
    console.log('Not a commit to a refs/head (branch). Nothing to do');
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'success' }),
  };
};
