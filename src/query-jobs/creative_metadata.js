/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
module.exports = async function main(config) {
  const query = `
    SELECT
      id,
      account_id,
      advertiser_id,
      url,
      mime_type,
      file_size,
      filename,
      media_type,
      created_at,
      updated_at
    FROM ${process.env.BIGQUERY_DATASET}.creatives
    WHERE id IN (
      SELECT DISTINCT creative_id
      FROM ${process.env.BIGQUERY_DATASET}.flights, UNNEST(creative_ids) AS creative_id
      WHERE podcast_id IN (${config.podcastIds.join(', ')})
    )
  `;
  const [queryJob] = await config.bigQueryClient.createQueryJob({ query });

  return queryJob;
};
