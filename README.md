# gamedevdesk

One-command deploy and teardown of the two game dev machines on AWS, using CDK.

| Machine | Instance | Disk | Address |
| --- | --- | --- | --- |
| Workstation (agents, Rust builds, tools) | `c7i.4xlarge` (16 vCPU, 32 GB) | 200 GB gp3 | Elastic IP (fixed) |
| GPU box (image models) | `g6.xlarge` (NVIDIA L4, 24 GB) on the AWS Deep Learning Base AMI | 100 GB gp3 | Changes on each start |

Also created: a small VPC with public subnets only (no NAT gateway, so no network charge), one security group that allows SSH only from your home network, your SSH key imported as an EC2 key pair, and an IAM role so Session Manager works as a backup. No snapshots or backups.

## Setup (once)

### 1. Install and bootstrap

```bash
npm install
aws configure            # your personal account; CDK reads the account from this profile
npm run bootstrap        # creates CDK's S3 bucket in the account, needed once per account/region
```

### 2. Generate an SSH key (one time, on your laptop)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/gamedevdesk -C "gamedevdesk"   # press Enter for no passphrase, or set one
cat ~/.ssh/gamedevdesk.pub                                       # copy this whole line
```

This makes two files: `~/.ssh/gamedevdesk` (private, never share or commit it) and `~/.ssh/gamedevdesk.pub` (public, goes in `cdk.json`). On Windows, run the same commands in PowerShell; the files land in `C:\Users\<you>\.ssh\`.

### 3. Find your home IP

```bash
curl -s https://checkip.amazonaws.com
```

Add `/32` to the end (for example `203.0.113.7/32`). That means "only this one address".

### 4. Fill in the two placeholders in `cdk.json`

```json
"context": {
  "region": "us-east-1",
  "sshPublicKey": "REPLACE_WITH_YOUR_SSH_PUBLIC_KEY",
  "sshCidr": "REPLACE_WITH_YOUR_HOME_IP/32"
}
```

| Key | Put here |
| --- | --- |
| `sshPublicKey` | The full line from `cat ~/.ssh/gamedevdesk.pub`, e.g. `ssh-ed25519 AAAAC3Nz... gamedevdesk` |
| `sshCidr` | Your home IP plus `/32`, e.g. `203.0.113.7/32` |

`npm run deploy` refuses to run while either placeholder is still there. `npm run build` still works, with a warning.

The public key is safe to commit. If you'd rather keep your IP out of git, pass it on the command line instead: `npx cdk deploy -c sshCidr=203.0.113.7/32`.

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

## Connecting with VS Code (Remote - SSH)

1. Install the **Remote - SSH** extension in VS Code.
2. Add this to `~/.ssh/config` on your laptop (create the file if it doesn't exist):

   ```
   Host gamedevdesk-cpu
     HostName <WorkstationPublicIp>     # the Elastic IP printed after deploy; never changes
     User ec2-user
     IdentityFile ~/.ssh/gamedevdesk

   Host gamedevdesk-gpu
     HostName <GPU public IP>           # from `npm run status`; changes every time the GPU box starts
     User ec2-user
     IdentityFile ~/.ssh/gamedevdesk
   ```

3. In VS Code, press `F1`, choose **Remote-SSH: Connect to Host...**, and pick `gamedevdesk-cpu` or `gamedevdesk-gpu`.

Test from a terminal first if anything fails: `ssh gamedevdesk-cpu`.

**If your home IP changes** (routers sometimes get a new one after a restart), SSH will just hang. Run step 3 again, update `sshCidr` in `cdk.json`, and `npm run deploy`. It only updates the firewall rule and takes about a minute.

**Backup way in:** Session Manager works from anywhere without SSH (needs the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)):

```bash
aws ssm start-session --target <WorkstationInstanceId>   # ID is printed after deploy and by `npm run status`
```

## Costs to know

- Stopped machines cost nothing for compute; the disks (~$24/month for 300 GB gp3) and the Elastic IP (~$3.60/month) are billed whether the machines run or not.
- `npm run destroy` removes the disks too. Copy anything you want to keep off the machines first.
- The GPU instance's local NVMe drive (instance store) is wiped on every stop. Keep models and data on the EBS disk.
- If `g6.xlarge` isn't offered in the first availability zone of your region, deploy fails with an "Unsupported" error; change `region`, or edit `vpcSubnets` in `lib/gamedevdesk-stack.ts` to pick another subnet.
