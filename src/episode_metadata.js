module.exports = async function main(bigQueryClient, podcastIds, objectPrefix) {
  const query = `
    SELECT id,
      podcast_id,
      title,
      subtitle,
      published_at
    FROM production.episodes
    WHERE podcast_id IN (${podcastIds.join(', ')})
  `;
  const [queryJob] = await bigQueryClient.createQueryJob({ query });

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
        destinationUri: `gs://${process.env.GCP_EXPORT_BUCKET}/${objectPrefix}episode_metadata.csv.gz`,
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
};
