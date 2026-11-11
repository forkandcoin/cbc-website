#!/usr/bin/env bash
# UNUSED. Do not run this script.
# An AWS Organizations SCP explicitly denies iam:CreateOpenIDConnectProvider
# in this account, so GitHub OIDC deploy is not available.
# The site deploys with IAM user cbc-github-deploy access keys stored as
# GitHub Actions repo secrets AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.
# The remainder of this file is kept only as a record of the intended OIDC setup.

set -euo pipefail

ACCOUNT="110936968754"
ROLE_NAME="cbc-github-deploy"
BUCKET="chicagobitcoincollective-site"
DIST_ID="E2XSH4IVTYIP3K"
# Immutable subject from the repo OIDC settings
# (owner id 348971302, repo id 1436122466). Trust main only.
# workflow_dispatch must be run from main; the optional ref input chooses
# which commit is checked out, but the OIDC subject stays refs/heads/main.
SUB="repo:forkandcoin@348971302/chicagobitcoincollective.github.io@1436122466:ref:refs/heads/main"
OIDC_ARN="arn:aws:iam::${ACCOUNT}:oidc-provider/token.actions.githubusercontent.com"

# Historical GitHub thumbprints plus the current Let's Encrypt YR1 intermediate.
THUMBS=(
  6938fd4d98bab03faadb97b34396831e3780aea1
  1c58a3a8518e8759bf275e00c6b3246c4ef4e7a6
  cbcfd09ce3cd22d99d94e58f92e9898fbee51a5e
)

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
  echo "OIDC provider already exists: $OIDC_ARN"
else
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list "${THUMBS[@]}"
  echo "Created OIDC provider: $OIDC_ARN"
fi

TRUST=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "$OIDC_ARN"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "$SUB"
        }
      }
    }
  ]
}
EOF
)

PERMS=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::$BUCKET"
    },
    {
      "Sid": "SyncObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::$BUCKET/*"
    },
    {
      "Sid": "InvalidateCloudFront",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::$ACCOUNT:distribution/$DIST_ID"
    }
  ]
}
EOF
)

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST"
  echo "Updated trust policy on role $ROLE_NAME"
else
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --description "GitHub Actions deploy for forkandcoin/chicagobitcoincollective.github.io on main" \
    --assume-role-policy-document "$TRUST"
  echo "Created role $ROLE_NAME"
fi

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name cbc-github-deploy \
  --policy-document "$PERMS"

echo "Role ready: arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"
echo "The deploy workflow already assumes this role. Re-run Deploy to AWS on main after this script succeeds."
