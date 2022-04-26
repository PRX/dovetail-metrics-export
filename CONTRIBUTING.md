This project touches both AWS and GCP. The code runs inside AWS Lambda functions, but uses the GCP SDK to perform BigQuery operations in GCP. The result of these operations is objects that live in Google Cloud Storage, which are copied elsewhere using [Porter](https://github.com/PRX/Porter) (which also runs in AWS).

Therefore, permissions are needed for working with resources in both clouds.

### AWS Permissions

Any permissions that the Lambda function needs for working with resources in AWS should be configured in the app's [CloudFormation template](https://github.com/PRX/Infrastructure/blob/master/stacks/apps/dovetail-metrics-export.yml). Some of the permissions it may need include:

- Reading values from Parameter Store
- Sending jobs to Porter
