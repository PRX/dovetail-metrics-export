const MakeCopies = require('../make_copies');

module.exports = async function main(
  event,
  bigQueryClient,
  inclusiveRangeStart,
  exclusiveRangeEnd,
  objectPrefix,
) {
  if (!event?.Jobs?.includes('Downloads')) {
    return;
  }

  const query = `
    SELECT
      timestamp_trunc(timestamp, DAY) AS date,
      request_uuid,
      feeder_podcast AS podcast_id,
      feeder_episode AS episode_id,
      digest,
      ad_count,
      -- is_duplicate
      cause,
      remote_referrer,
      remote_agent,
      remote_ip,
      agent_name_id,
      agent_type_id,
      agent_os_id,
      city_geoname_id,
      country_geoname_id,
      -- is_confirmed
      url,
      listener_id,
      listener_episode
    FROM ${process.env.BIGQUERY_DATASET}.dt_downloads
    WHERE timestamp >= ?
      AND timestamp < ?
      AND is_duplicate = false
      AND feeder_podcast IN (${event.PodcastIDs.join(', ')})
  `;
  const params = [inclusiveRangeStart, exclusiveRangeEnd];
  const [queryJob] = await bigQueryClient.createQueryJob({ query, params });

  const queryMetadata = await new Promise((resolve, reject) => {
    queryJob.on('complete', resolve);
    queryJob.on('error', reject);
  });

  const bucketName = process.env.GCP_EXPORT_BUCKET;
  const objectName = `${objectPrefix}downloads.csv.gz`;

  const [extractJob] = await bigQueryClient.createJob({
    configuration: {
      extract: {
        sourceTable: queryMetadata.configuration.query.destinationTable,
        // Ensure that the filename after the prefix does not collide with any
        // other files created by this function, or they may overwrite each
        // other
        destinationUri: `gs://${bucketName}/${objectName}`,
        destinationFormat: 'CSV',
        printHeader: true,
        compression: 'GZIP',
      },
    },
  });

  await new Promise((resolve, reject) => {
    extractJob.on('complete', resolve);
    extractJob.on('error', reject);
  });

  await MakeCopies(
    event,
    bigQueryClient.authClient.jsonContent,
    bucketName,
    objectName,
  );
};
