const MakeCopies = require('../make_copies');

module.exports = async function main(event, bigQueryClient, objectPrefix) {
  if (!event?.Jobs?.includes('GeoMetadata')) {
    return;
  }

  const query = `
    SELECT
      geoname_id,
      metro_code,
      locale_code,
      continent_code,
      continent_name,
      country_iso_code,
      country_name,
      subdivision_1_iso_code,
      subdivision_1_name,
      subdivision_2_iso_code,
      subdivision_2_name,
      city_name,
      time_zone
    FROM ${process.env.BIGQUERY_DATASET}.geonames
  `;
  const [queryJob] = await bigQueryClient.createQueryJob({ query });

  const queryMetadata = await new Promise((resolve, reject) => {
    queryJob.on('complete', resolve);
    queryJob.on('error', reject);
  });

  const bucketName = process.env.GCP_EXPORT_BUCKET;
  const objectName = `${objectPrefix}geo_metadata.ndjson.gz`;

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
