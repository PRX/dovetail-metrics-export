const MakeCopies = require('../make_copies');

module.exports = async function main(event, bigQueryClient, objectPrefix) {
  if (!event?.Jobs?.includes('PodcastMetadata')) {
    return;
  }

  const query = `
    SELECT
      id,
      account_id,
      title,
      subtitle,
      image_url,
      created_at,
      updated_at,
      published_at,
      deleted_at
    FROM ${process.env.BIGQUERY_DATASET}.podcasts
    WHERE id IN (${event.PodcastIDs.join(', ')})
  `;
  const [queryJob] = await bigQueryClient.createQueryJob({ query });

  const queryMetadata = await new Promise((resolve, reject) => {
    queryJob.on('complete', resolve);
    queryJob.on('error', reject);
  });

  const bucketName = process.env.GCP_EXPORT_BUCKET;
  const objectName = `${objectPrefix}podcast_metadata.ndjson.gz`;

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

  await MakeCopies(
    event,
    bigQueryClient.authClient.jsonContent,
    bucketName,
    objectName,
  );
};
