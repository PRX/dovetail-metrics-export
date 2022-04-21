This project touches both AWS and GCP. The code runs inside AWS Lambda functions, but uses the GCP SDK to perform BigQuery operations in GCP. The result of these operations is objects that live in Google Cloud Storage, which are copied elsewhere using [Porter](https://github.com/PRX/Porter) (which also runs in AWS).

Therefore, permissions are needed for working with resources in both clouds.

### AWS Permissions

Any permissions that the Lambda function needs for working with resources in AWS should be configured in the app's [CloudFormation template](https://github.com/PRX/Infrastructure/blob/master/stacks/apps/dovetail-metrics-export.yml). Some of the permissions it may need include:

- Reading values from Parameter Store
- Sending jobs to Porter

### GCP Permissions

The Lambda function creates BigQuery jobs using the GCP SDK. Permissions are inherited from a **service account** in the GCP project. That service account needs permission to:

- View the necessary data in BigQuery
- Create BigQuery jobs
- Create Storage objects that result from the BigQuery jobs

The bucket that the objects are written to, and thus that the service account needs permission for, is configured as an environment variable of the Lambda function. If using the `Storage Object Creator` role, it should have a condition like `resource.name.startsWith("projects/_/buckets/my-bucket")`, to limit access to only that bucket.
