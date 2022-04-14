const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'prx-metrics',
});

exports.handler = async (event) => {
  const podcast_id = '70';

  const query = `
    SELECT timestamp_trunc(timestamp, DAY) AS Date,
      feeder_episode AS EpisodeID,
      COUNT(*) AS Downloads
    FROM production.dt_downloads
    WHERE timestamp >= ?
      AND timestamp < ?
      AND is_duplicate = false
      AND feeder_podcast = ${podcast_id}
    GROUP BY Date, feeder_episode
    ORDER BY Date ASC, EpisodeID ASC
  `;

  const range_start = new Date();
  range_start.setUTCHours(0, 0, 0, 0);

  const range_end = new Date(range_start);
  range_end.setDate(range_start.getDate() + 1);

  const params = [range_start, range_end];

  const [queryJob] = await bigquery.createQueryJob({ query, params });

  const queryMetadata = await new Promise((resolve, reject) => {
    queryJob.on('complete', resolve);
    queryJob.on('error', reject);
  });

  const tableId = queryMetadata.configuration.query.destinationTable.tableId;

  const [extractJob] = await bigquery.createJob({
    configuration: {
      extract: {
        sourceTable: queryMetadata.configuration.query.destinationTable,
        destinationUri: `gs://prx-farski-sandbox/dw-export/${+new Date()}-${tableId}.csv.gz`,
        destinationFormat: 'CSV',
        printHeader: true,
        compression: 'GZIP',
      }
    }
  });

  await new Promise((resolve, reject) => {
    extractJob.on('complete', resolve);
    extractJob.on('error', reject);
  });
};
