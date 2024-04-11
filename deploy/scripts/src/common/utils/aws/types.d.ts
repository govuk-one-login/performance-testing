/**
 * AWS CLI Credential Output Format https://docs.aws.amazon.com/cli/latest/reference/sts/assume-role.html#examples
 */
export interface AssumeRoleOutput {
  AssumedRoleUser: {
    Arn: string;
    AssumedRoleId: string;
  };
  Credentials: {
    AccessKeyId: string;
    Expiration: string;
    SecretAccessKey: string;
    SessionToken: string;
  };
}
