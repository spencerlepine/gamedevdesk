#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GameDevDeskStack } from '../lib/gamedevdesk-stack';

const app = new cdk.App();

// Account comes from your AWS CLI profile (CDK_DEFAULT_ACCOUNT) or `-c account=123456789012`.
// Leaving it unset still lets `npm run build` synthesize the template offline.
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'us-east-1';

new GameDevDeskStack(app, 'GameDevDesk', {
  env: { account, region },
  description: 'Game dev machines: c7i.4xlarge workstation (Elastic IP) + g6.xlarge GPU box',
  sshCidr: app.node.tryGetContext('sshCidr') || undefined,
  keyPairName: app.node.tryGetContext('keyPairName') || undefined,
});
