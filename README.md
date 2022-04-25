### Output Files

All files are currently CSV formatted and compressed with GZIP. The CSV data includes column headers.

Excluding all prefixes, the resulting files in Google Cloud Storage are named:

- downloads.csv.gz
- impressions.csv.gz
- podcast_metadata.csv.gz
- episode_metadata.csv.gz
- geo_metadata.csv.gz

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
  #   be preserved.
  # - Currently only supports AWS/S3 as destinations. The source is alwasy GCS.
  Copies: [
    {
      "Mode": "AWS/S3",
      "BucketName": "MyBucket",
    }
  ]
}
```
