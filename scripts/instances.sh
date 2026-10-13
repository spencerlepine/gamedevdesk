#!/usr/bin/env bash
# Start/stop the machines without touching the stack. Stopped = no compute charge, disks still billed.
# Usage: scripts/instances.sh status | start cpu|gpu|all | stop cpu|gpu|all
set -euo pipefail

STACK="${STACK:-GameDevDesk}"
REGION="${AWS_REGION:-${CDK_DEFAULT_REGION:-us-east-1}}"

output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

ids_for() {
  case "$1" in
    cpu) output WorkstationInstanceId ;;
    gpu) output GpuInstanceId ;;
    all) echo "$(output WorkstationInstanceId) $(output GpuInstanceId)" ;;
    *) echo "unknown machine '$1' (use cpu, gpu or all)" >&2; exit 1 ;;
  esac
}

cmd="${1:-status}"
case "$cmd" in
  status)
    # shellcheck disable=SC2046
    aws ec2 describe-instances --region "$REGION" --instance-ids $(ids_for all) \
      --query "Reservations[].Instances[].[Tags[?Key=='Name']|[0].Value,InstanceType,State.Name,PublicIpAddress]" \
      --output table
    ;;
  start)
    # shellcheck disable=SC2046
    aws ec2 start-instances --region "$REGION" --instance-ids $(ids_for "${2:-all}") --output table
    ;;
  stop)
    # shellcheck disable=SC2046
    aws ec2 stop-instances --region "$REGION" --instance-ids $(ids_for "${2:-all}") --output table
    ;;
  *)
    echo "usage: $0 status | start cpu|gpu|all | stop cpu|gpu|all" >&2
    exit 1
    ;;
esac
