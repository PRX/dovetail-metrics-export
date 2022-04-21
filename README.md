```yaml
{
  # REQUIRED
  # - MUST be an array.
  # - Podcast IDs in Big Query are always numbers.
  PodcastIDs: [1, 2, 3],
  # OPTIONAL
  # - If included, the range MUST contain exactly two strings.
  # - Each string MUST be in the format "YYYY-MM-DDT00:00:00Z".
  # - These strings always represent times in UTC (Z).
  # - Currently all times MUST be midnight.
  # - The first value MUST be prior to the second value.
  # - The first value represents the beginning of the queried range **inclusive**.
  # - The second value represents the end of the queried range **exclusive**.
  Range: ["2022-01-01T00:00:00Z", "2022-01-02T00:00:00Z"],
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
