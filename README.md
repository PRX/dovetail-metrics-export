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

All files are currently formatted as newline-delimited JSON and compressed with GZIP by default. Other formats can be configured.

Excluding all prefixes, the resulting files in Google Cloud Storage are named:

- downloads.ndjson.gz
- impressions.ndjson.gz
- podcast_metadata.ndjson.gz
- episode_metadata.ndjson.gz
- geo_metadata.ndjson.gz
- user_agent_metadata.ndjson.gz
- advertiser_metadata.ndjson.gz
- campaign_metadata.ndjson.gz
- creative_metadata.ndjson.gz
- flight_metadata.ndjson.gz
- placement_metadata.ndjson.gz

Possible file extensions are: `.ndjson`, `.ndjson.gz`, `.csv`, `.csv.gz`.

#### Default Date Range

If the `Range` property is excluded from the input, the default range will start (inclusive) at midnight yesterday (UTC) and end (exclusive) at midnight today (UTC).

For example, if it is currently `2022-05-05T12:34:56Z`, the range will be `["2022-05-04T00:00:00Z", "2022-05-05T00:00:00Z"]`.

```yaml
{
  # CONDITIONAL
  # - Either PodcastIDs or IntegrationsIDs MUST be included, but not both.
  # - MUST be an array.
  # - Podcast IDs in BigQuery are always numbers.
  PodcastIDs: [1, 2, 3],
  # CONDITIONAL
  # - Either PodcastIDs or IntegrationsIDs MUST be included, but not both.
  # - MUST be an array.
  # - Integrations IDs in BigQuery are always numbers.
  IntegrationsIDs: [1, 2, 3],
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
  # - downloads
  # - impressions
  # - boostr_impressions
  # - podcast_metadata
  # - episode_metadata
  # - geo_metadata
  # - user_agent_metadata
  # - advertiser_metadata
  # - campaign_metadata
  # - creative_metadata
  # - flight_metadata
  # - placement_metadata
  Extractions: [
    downloads,
    impressions
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
  # - Each copy can also include a DestinationFormat, which explicitly defines
  #   the destination file name using placeholder directives.
  #   Because each exctaction (downloads, impressions, etc) may result in
  #   multiple files from BigQuery, each copy task definition may be used
  #   multiple times.
  #
  # - Currently only supports AWS/S3 as destinations. The source is always GCS.
  # - DestinationFormat allows for custom-named copies using directives:
  # - %RANGE_START_ISO - e.g., 2022-05-04T00:00:00.000Z
  # - %RANGE_END_ISO - e.g., 2022-05-05T00:00:00.000Z
  # - %RANGE_START_DATE_ISO - e.g., 2022-05-04
  # - %RANGE_END_DATE_ISO - e.g., 2022-05-05
  # - %TYPE - e.g., downloads, episode_metadata, etc
  # - %REQUEST_ID - A unique identifier for the Lambda invocation
  # - %REQUEST_TIME - A unix timestamp in milliseconds
  # - %FILE_SEQ_ID - This MUST appear somewhere in the custom format, or it will
  #   be added automatically to the end, which you probably don't want, e.g.,
  #   000000000000, 000000000001
  Copies: [
    {
      "Mode": "AWS/S3",
      "BucketName": "MyBucket",
      "DestinationFormat": "Acme/%TYPE/%REQUEST_ID-%FILE_SEQ_ID.ndjson.gz"
    }
  ],
  # OPTIONAL
  # - NEWLINE_DELIMITED_JSON (default)
  # - CSV
  DestinationFormat: "NEWLINE_DELIMITED_JSON",
  # OPTIONAL
  # - GZIP (default)
  # - NONE
  CompressionType: "GZIP"
}
```
