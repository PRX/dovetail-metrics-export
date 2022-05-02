/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
module.exports = async function main(config) {
  const query = `
    SELECT
      agentname_id,
      tag
    FROM ${process.env.BIGQUERY_DATASET}.agentnames
  `;
  const [queryJob] = await config.bigQueryClient.createQueryJob({ query });

  return queryJob;
};
