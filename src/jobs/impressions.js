const MakeCopies = require('../make_copies');

module.exports = async function main(
  event,
  bigQueryClient,
  inclusiveRangeStart,
  exclusiveRangeEnd,
  objectPrefix,
) {
  if (!event?.Jobs?.includes('Impressions')) {
    return;
  }

  const query = `
    SELECT
      timestamp,
      request_uuid,
      feeder_podcast AS podcast_id,
      feeder_episode AS episode_id,
      -- is_duplicate,
      -- cause,
      ad_id,
      campaign_id,
      creative_id,
      flight_id,
      -- is_confirmed,
      digest,
      segment,
      placements_key,
      zone_name,
      target_path,
      -- vast_advertiser,
      -- vast_ad_id,
      -- vast_creative_id,
      -- vast_price_value,
      -- vast_price_currency,
      -- vast_price_model,
      agent_name_id,
      agent_type_id,
      agent_os_id,
      listener_id,
      city_geoname_id,
      country_geoname_id
    FROM ${process.env.BIGQUERY_DATASET}.dt_impressions
    WHERE timestamp >= ?
      AND timestamp < ?
      AND is_duplicate = false
      AND feeder_podcast IN (${event.PodcastIDs.join(', ')})
  `;
  const params = [inclusiveRangeStart, exclusiveRangeEnd];
  const [queryJob] = await bigQueryClient.createQueryJob({ query, params });

  console.log(
    JSON.stringify({ ImpressionsQueryJobMetadata: queryJob.metadata }),
  );

  const queryMetadata = await new Promise((resolve, reject) => {
    queryJob.on('complete', resolve);
    queryJob.on('error', reject);
  });

  const bucketName = process.env.GCP_EXPORT_BUCKET;
  const objectName = `${objectPrefix}impressions.ndjson.gz`;

  const [extractJob] = await bigQueryClient.createJob({
    configuration: {
      extract: {
        sourceTable: queryMetadata.configuration.query.destinationTable,
        // Ensure that the filename after the prefix does not collide with any
        // other files created by this function, or they may overwrite each
        // other
        destinationUri: `gs://${bucketName}/${objectName}`,
        destinationFormat: 'NEWLINE_DELIMITED_JSON',
        printHeader: true,
        compression: 'GZIP',
      },
    },
  });

  await new Promise((resolve, reject) => {
    extractJob.on('complete', resolve);
    extractJob.on('error', reject);
  });

  console.log(
    JSON.stringify({ ImpressionsExtractJobMetadata: extractJob.metadata }),
  );

  await MakeCopies(
    event,
    bigQueryClient.authClient.jsonContent,
    bucketName,
    objectName,
  );
};
