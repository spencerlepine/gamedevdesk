#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GameDevDeskStack } from '../lib/gamedevdesk-stack';

const app = new cdk.App();

// Values still holding the REPLACE_WITH_... placeholders from cdk.json count as unset, so
// `npm run build` works before you fill them in. `npm run deploy` refuses to run until you do.
const filled = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' && !v.startsWith('REPLACE_WITH_') ? v.trim() : undefined;

// Account comes from your AWS CLI profile (CDK_DEFAULT_ACCOUNT) or `-c account=123456789012`.
// Leaving it unset still lets `npm run build` synthesize the template offline.
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'us-east-1';

new GameDevDeskStack(app, 'GameDevDesk', {
  env: { account, region },
  description: 'Game dev machines: c7i.4xlarge workstation (Elastic IP) + g6.xlarge GPU box',
  sshPublicKey: filled(app.node.tryGetContext('sshPublicKey')),
  sshCidr: filled(app.node.tryGetContext('sshCidr')),
});
