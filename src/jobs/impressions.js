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
    SELECT timestamp_trunc(timestamp, DAY) AS date,
      feeder_episode AS episode_id,
      COUNT(*) AS impression_count
    FROM production.dt_impressions
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

  const [extractJob] = await bigQueryClient.createJob({
    configuration: {
      extract: {
        sourceTable: queryMetadata.configuration.query.destinationTable,
        // Ensure that the filename after the prefix does not collide with any
        // other files created by this function, or they may overwrite each
        // other
        destinationUri: `gs://${process.env.GCP_EXPORT_BUCKET}/${objectPrefix}impressions.csv.gz`,
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

  await MakeCopies(event, bucketName, objectName);
};
