### GCP API Access

While this Lambda function run in AWS, it makes API calls to Google Cloud via the GCP SDK, and thus needs GCP credentials. Rather than using static API keys, the expectation is that the `GCP_CLIENT_CONFIG_PARAMETER_NAME` value in Parameter Store will contain a client config that takes advantage of [workload identity federation](https://cloud.google.com/iam/docs/workload-identity-federation). The config should look something like this:

```json
{
  "service_account_impersonation_url": "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/MY_SERVICE_ACCOUNT@MY_GCP_PROJECT_ID.iam.gserviceaccount.com:generateAccessToken",
  "audience": "//iam.googleapis.com/projects/MY_GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/MY_POOL_ID/providers/MY_PROVIDER_ID",
  "type": "external_account",
  "subject_token_type": "urn:ietf:params:aws:token-type:aws4_request",
  "token_url": "https://sts.googleapis.com/v1/token",
  "credential_source": {
    "environment_id": "aws1",
    "region_url": "http://169.254.169.254/latest/meta-data/placement/availability-zone",
    "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials",
    "regional_cred_verification_url": "https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15"
  }
}
```

The `service_account_impersonation_url` should include the email of a service account in GCP with the following permissions:

- BigQuery Job User (`roles/bigquery.jobUser`) to create BigQuery Jobs
- BigQuery Data Viewer (`roles/bigquery.dataViewer`) to read data from BigQuery for the jobs
- Storage Object Creator (`roles/storage.objectCreator`) to write the results of the jobs to Storage
- Storage Object Viewer (`roles/storage.objectViewer`) to read the results of the jobs from Storage

The `audience` should point to an identity provider that will grant access to the AWS IAM execution role used by the Lambda function.

This client configuration is also passed to [Porter](https://github.com/PRX/Porter), allowing Porter to [read](https://github.com/PRX/Porter#google-cloud-storage-read-permissions) source files from Google Cloud Storage. Therefore, the identity provider must **also** grant access to the AWS IAM role used by Porter for ingesting files.

The identity provider attribute condition should look something like:

```
('arn:aws:sts::123456789012:assumed-role/ExportFunctionRole-TKTKTKTKTK' == attribute.aws_role) || ('arn:aws:sts::123456789012:assumed-role/porter-IngestLambdaIamRole-TKTKTKTKTK' == attribute.aws_role)
```

### Output Files

All files are currently CSV formatted and compressed with GZIP. The CSV data includes column headers.

Excluding all prefixes, the resulting files in Google Cloud Storage are named:

- downloads.csv.gz
- impressions.csv.gz
- podcast_metadata.csv.gz
- episode_metadata.csv.gz
- geo_metadata.csv.gz
- user_agent_metadata.csv.gz

#### Default Date Range

If the `Range` property is excluded from the input, the default range will start (inclusive) at midnight yesterday (UTC) and end (exclusive) at midnight today (UTC).

For example, if it is currently `2022-05-05T12:34:56Z`, the range will be `["2022-05-04T00:00:00Z", "2022-05-05T00:00:00Z"]`.

```yaml
{
  # REQUIRED
  # - MUST be an array.
  # - Podcast IDs in Big Query are always numbers.
  PodcastIDs: [1, 2, 3],
  # OPTIONAL
  # - If included, the range MUST contain exactly two strings.
  # - If excluded, see above for defaults.
  # - Each string MUST be in the format "YYYY-MM-DDT00:00:00Z".
  # - These strings always represent times in UTC (Z).
  # - Currently all times MUST be midnight.
  # - The first value MUST be prior to the second value.
  # - The first value represents the beginning of the queried range **inclusive**.
  # - The second value represents the end of the queried range **exclusive**.
  Range: ["2022-01-01T00:00:00Z", "2022-01-08T00:00:00Z"],
  # OPTIONAL
  # - If included, MUST be an array.
  # - If excluded, the default is that all jobs will run.
  # - If included, it SHOULD include one or more of the following values:
  # - Downloads
  # - Impressions
  # - PodcastMetadata
  # - EpisodeMetadata
  # - GeoMetadata
  # - UserAgentMetadata
  Jobs: [
    Downloads,
    Impressions
  ],
  # OPTIONAL
  # - A prefix that is added to all files created in Google Cloud Storage.
  # - This string must include a trailing slash if you want to separate the
  #   prefix and the rest of the file name with a slash.
  ObjectPrefix: "Acme/Daily/",
  # OPTIONAL
  # - If included MUST be an array of objects.
  # - Each object contains part of a Porter Copy task input: only the Mode and
  #   BucketName.
  # - Each file created by the export function will be copied using the given
  #   configuration by Porter. The object name from Google Cloud Storage will
  #   be preserved, but the DestinationPrefix will be added to the front.
  # - Currently only supports AWS/S3 as destinations. The source is alwasy GCS.
  # - DestinationPrefix should include a trailing slash if desired.
  Copies: [
    {
      "Mode": "AWS/S3",
      "BucketName": "MyBucket",
      "DestinationPrefix": "CustomerPrefix/"
    }
  ]
}
```
