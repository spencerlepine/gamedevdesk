import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GameDevDeskStackProps extends cdk.StackProps {
  /** Your SSH public key (contents of ~/.ssh/gamedevdesk.pub). Installed for ec2-user on both machines. */
  readonly sshPublicKey?: string;
  /** Your home network, e.g. "203.0.113.7/32". Only this range can reach port 22. */
  readonly sshCidr?: string;
}

/**
 * Two machines in one small VPC:
 *  - workstation: c7i.4xlarge, 200 GB gp3 disk, Elastic IP (stable address)
 *  - gpu:         g6.xlarge (NVIDIA L4), 100 GB gp3 disk, Deep Learning AMI with drivers
 *
 * No NAT gateway, no snapshots, no backups. `cdk destroy` removes everything,
 * including both disks.
 */
export class GameDevDeskStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GameDevDeskStackProps = {}) {
    super(scope, id, props);

    // Public subnets only: no NAT gateway, so the network itself costs nothing.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }],
    });

    if (!props.sshPublicKey || !props.sshCidr) {
      cdk.Annotations.of(this).addWarning(
        'sshPublicKey and/or sshCidr are not filled in cdk.json: SSH is disabled until you set both.',
      );
    }

    const sg = new ec2.SecurityGroup(this, 'MachinesSg', {
      vpc,
      description: 'Game dev machines',
      allowAllOutbound: true,
    });
    if (props.sshCidr && props.sshPublicKey) {
      sg.addIngressRule(ec2.Peer.ipv4(props.sshCidr), ec2.Port.tcp(22), 'SSH from home network');
    }

    // Also allows `aws ssm start-session` as a fallback when your home IP changes.
    const role = new iam.Role(this, 'MachinesRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    // Imports your public key as an EC2 key pair; the private key never leaves your computer.
    // Plain CfnKeyPair so no key type is sent: ed25519 and RSA keys both import as-is.
    let keyPair: ec2.IKeyPair | undefined;
    if (props.sshPublicKey) {
      const cfnKey = new ec2.CfnKeyPair(this, 'KeyPair', {
        keyName: 'gamedevdesk',
        publicKeyMaterial: props.sshPublicKey,
      });
      keyPair = ec2.KeyPair.fromKeyPairName(this, 'ImportedKeyPair', cfnKey.ref);
    }

    const disk = (sizeGb: number) => [
      {
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(sizeGb, {
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          encrypted: true,
          deleteOnTermination: true,
        }),
      },
    ];

    const workstation = new ec2.Instance(this, 'Workstation', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType('c7i.4xlarge'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: sg,
      role,
      keyPair,
      blockDevices: disk(200),
      requireImdsv2: true,
    });
    cdk.Tags.of(workstation).add('Name', 'gamedevdesk-workstation');

    // AWS Deep Learning Base AMI (NVIDIA driver + CUDA) on Amazon Linux 2023,
    // resolved from AWS's public SSM parameter at deploy time.
    const gpuAmi = ec2.MachineImage.fromSsmParameter(
      '/aws/service/deeplearning/ami/x86_64/base-oss-nvidia-driver-gpu-amazon-linux-2023/latest/ami-id',
    );
    const gpu = new ec2.Instance(this, 'Gpu', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType('g6.xlarge'),
      machineImage: gpuAmi,
      securityGroup: sg,
      role,
      keyPair,
      blockDevices: disk(100),
      requireImdsv2: true,
    });
    cdk.Tags.of(gpu).add('Name', 'gamedevdesk-gpu');

    // Stable public address for the workstation only.
    const eip = new ec2.CfnEIP(this, 'WorkstationEip', {
      domain: 'vpc',
      tags: [{ key: 'Name', value: 'gamedevdesk-workstation' }],
    });
    new ec2.CfnEIPAssociation(this, 'WorkstationEipAssoc', {
      allocationId: eip.attrAllocationId,
      instanceId: workstation.instanceId,
    });

    new cdk.CfnOutput(this, 'WorkstationInstanceId', { value: workstation.instanceId });
    new cdk.CfnOutput(this, 'WorkstationPublicIp', { value: eip.attrPublicIp });
    new cdk.CfnOutput(this, 'GpuInstanceId', { value: gpu.instanceId });
  }
}
