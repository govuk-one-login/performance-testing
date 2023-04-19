### performance-tester-permissions.yaml ###
This is a sample CloudFormation template file based on common infra [roles-for-engineers](https://github.com/alphagov/di-ipv-core-common-infra/blob/main/cloudformation/roles-for-engineers/template.yaml) infrastructure template.

It shows the permissions given to the testers along with:
[arn:aws:iam::aws:policy/AWSCodeBuildDeveloperAccess](https://docs.aws.amazon.com/codebuild/latest/userguide/auth-and-access-control-iam-identity-based-access-control.html#developer-access-policy)

IAM roles to be used by engineers. Each environment has four roles consisting Readonly, Support, PerformanceTester and Admin. Populate the environments
mappings with real account ids and replace dummy values.

A role can only be assumed if the principal has permission to do so and is connected via the office network or VPN.
To grant an engineer access add their gds-users IAM arn to the appropriate entry in the Mappings section.
