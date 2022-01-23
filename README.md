# gitea-to-s3

This repository provides a native aws stack using lambda, apigateway, and s3 which can
receive webhooks from a configured gitea instance, and then subsequently fetch and
upload the code from the related webhook event to S3, for use with consumption in codebuild and codepipeline.

Feel free to fork and contribute, or raise issues if desired.

## Setup

### CDK Environment

You will first need to make sure that you have [nodejs](https://nodejs.org/en/download/) installed with npm.

This also assumes you already have installed and configured the [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
with your desired aws account.

1. Download the code repository: `git clone https://github.com/cheeseandcereal/gitea-to-s3.git && cd gitea-to-s3`
1. Install the dependencies: `npm install`
1. Ensure that you have cdk installed globally: `npm install -g aws-cdk`
1. Ensure that you have the latest CDK bootstrap setup: `cdk bootstrap`

### Gitea Setup

#### Application Token

You will need an application token to provide this aws service so it can access your gitea instance API.

1. While logged into your gitea instance, click on your profile in the top right and select 'Settings'
1. Select the 'Applications' tab, then fill in the 'Token Name' text box with anything you want
1. Click the 'Generate Token' button, then save the token string that is generated

#### API URL

You will need the api url for your gitea instance. This should just your gitea host followed by `api/v1`

I.e: `https://my.gitea.com/api/v1`

Determine this url and save it for the next step

### Deploy the Stack

The aws application stack can now be deployed

Run this command, replacing the valuse for `giteaApiUrl` and `giteaApiToken` as appropriate
with values from the previous Gitea Setup steps.

`cdk --context giteaApiUrl=https://my.gitea.com/api/v1 --context giteaApiToken=abc123 deploy`

After this command runs, it will print out 2 outputs: one for the name of the s3 bucket, and another for the endpoint URL,
make sure to save these.

### Setup Code Repos To Send To The Stack

Now that the application stack is running, you can configure the repos in your gitea instance that you want to setup
for ci/cd. Note you must be an admin with permissions to modify the repo settings (for the desired repos) in order to do this.

1. Go to the repo(s) you want setup.
1. Click on the 'Settings' tab for the repo
1. Go to the 'Webhooks' tab on this page
1. Click the 'Add Webhook' button, and select 'Gitea'
1. Put the endpoint URL from the previous step into the 'Target URL' box, appended with `webhook`. For example: `https://abc123.execute-api.us-east-1.amazon.aws.com/prod/webhook`
1. Set the 'Branch filter' appropriately so that it will only select branches you want to clone when pushed to
1. Click the 'Add Webhook' button to finish

### Test the Setup

If the previous steps were setup, everything should now be setup. You can now test the setup. Try pushing
to an appropriate branch on one of the configured repos. Within the next ~30-60 seconds, the code should be
copied to S3.

You can confirm this by running the following (replacing the bucket name with the output from the deployed stack step):

`aws s3 ls --recursive s3://giteatos3stack-giteacodebucket123abc-abc123/`

You should see a zip file if successful.

## Configure With A Codepipeline and/or Codebuild

After setup is complete, you can now configure a codepipeline to pull from this code whenever it is pushed.

To do this, when configuring the codepipeline source provider, select 'Amazon S3'.
The bucket should be the name of the bucket which was output after the deploy stack step.
The bucket key should be the full name of the repo with the appended branch name as a zip. For example:
`organization/myProject-master.zip`

The rest of the codepipeline setup should be identical to configuring any other codepipeline.

Follow the same steps if you want to set up a Codebuild (which is not attached to a codepipeline)

## Debugging

In order to debug, you can view the logs of the lambda in Cloudwatch.

If you go to the cloudwatch console and select log groups, the correct one should look something like:

`/aws/lambda/GiteaToS3Stack-giteawebhookhandler123abc-abc123`

You can view the logstreams in this log group to diagnose issues. Each time a webhook is received from gitea, this lambda is invoked and will log to this log group.

If you do not find any logs, you can check if the webhooks are being sent successfully, by going to the settings->webhooks page on
a repository, clickind the edit pencil next to the webhook, then scrolling down and checking the provided information about previous webhook requests.

## Useful Information

This project uses [AWS CDK](https://aws.amazon.com/cdk/) to define, configure, and create the native aws application.

Find more info about the cdk cli tool [here](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)
