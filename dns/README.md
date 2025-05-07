# Deploying DNS and ACM Stacks

These were deployed as part of QA-967

DNS needed deploying first, then a di-domains PR, before I could then run ACM.

To confirm the config, you can re-run the deployment.

1. set your AWS_PROFILE to a profile tied to the AWS SSO sign-in for either the perf-non-prod (build) or perf-prod (staging) accounts.
2. Using the existing configs you can run the following command:

```AWS_PROFILE=xxxx sam deploy -t acm-certificate.yaml --config-file acm-samconfig.toml --config-env staging --guided```

To change between dns/acm:

- change the template to point at the right template
- change the config file to point at the appropriate config file
- set the config-env to either build/staging dependent on the environment.

The --guided will allow you to have an interactive console to validate the changeset before you deploy.
