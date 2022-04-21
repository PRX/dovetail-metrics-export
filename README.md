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
  ]
}
```
