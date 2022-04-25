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
    SELECT timestamp_trunc(timestamp, DAY) AS date,
      feeder_episode AS episode_id,
      COUNT(*) AS download_count
    FROM production.dt_downloads
    WHERE timestamp >= ?
      AND timestamp < ?
      AND is_duplicate = false
      AND feeder_podcast IN (${event.PodcastIDs.join(', ')})
    GROUP BY date, feeder_episode
    ORDER BY date ASC, episode_id ASC
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
