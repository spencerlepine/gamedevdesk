# gamedevdesk

One-command deploy and teardown of the two game dev machines on AWS, using CDK.

| Machine | Instance | Disk | Address |
| --- | --- | --- | --- |
| Workstation (agents, Rust builds, tools) | `c7i.4xlarge` (16 vCPU, 32 GB) | 200 GB gp3 | Elastic IP (fixed) |
| GPU box (image models) | `g6.xlarge` (NVIDIA L4, 24 GB) on the AWS Deep Learning Base AMI | 100 GB gp3 | Changes on each start |

Also created: a small VPC with public subnets only (no NAT gateway, so no network charge), one security group, and an IAM role so you can connect through SSM Session Manager. No snapshots or backups.

## Setup (once)

```bash
npm install
aws configure            # your personal account; CDK reads the account from this profile
npm run bootstrap        # creates CDK's S3 bucket in the account, needed once per account/region
```

The account comes from your AWS CLI profile. To pin it instead, pass `-c account=123456789012` or add `"account": "123456789012"` to the `context` block in `cdk.json`. Region defaults to `us-east-1` (change `region` in `cdk.json`).

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run build` | Compile and synthesize the template (works offline, no AWS account needed) |
| `npm run deploy` | Create or update both machines |
| `npm run destroy` | Delete everything, **including both disks** |
| `npm run status` | Show both machines' state and IPs |
| `npm run stop:all` | Stop both machines (no compute charge while stopped) |
| `npm run start:cpu` / `npm run stop:cpu` | Start or stop the workstation |
| `npm run start:gpu` / `npm run stop:gpu` | Start or stop the GPU box |

## Connecting

Default: no SSH port is open. Connect with Session Manager (needs the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)):

```bash
aws ssm start-session --target <WorkstationInstanceId>   # ID is printed after deploy and by `npm run status`
```

To use SSH instead, set these in `cdk.json` `context` and redeploy:

- `keyPairName`: an existing EC2 key pair name
- `sshCidr`: your IP, e.g. `203.0.113.7/32`

## Costs to know

- Stopped machines cost nothing for compute; the disks (~$24/month for 300 GB gp3) and the Elastic IP (~$3.60/month) are billed whether the machines run or not.
- `npm run destroy` removes the disks too. Copy anything you want to keep off the machines first.
- The GPU instance's local NVMe drive (instance store) is wiped on every stop. Keep models and data on the EBS disk.
- If `g6.xlarge` isn't offered in the first availability zone of your region, deploy fails with an "Unsupported" error; change `region`, or edit `vpcSubnets` in `lib/gamedevdesk-stack.ts` to pick another subnet.
