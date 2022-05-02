/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
module.exports = async function main(config) {
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
    WHERE id IN (${config.podcastIds.join(', ')})
  `;
  const [queryJob] = await config.bigQueryClient.createQueryJob({ query });

  return queryJob;
};
