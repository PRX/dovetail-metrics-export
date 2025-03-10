/** @typedef {import('../index.js').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const query = `
    SELECT
      id,
      account_id,
      advertiser_id,
      name,
      type,
      created_at,
      updated_at,
      external_id,
      budget_model,
      budget_cents,
      budget_currency
    FROM ${process.env.BIGQUERY_DATASET}.campaigns
    WHERE id IN (
      SELECT DISTINCT campaign_id FROM ${process.env.BIGQUERY_DATASET}.flights
      WHERE podcast_id IN (${config.podcastIds.join(", ")})
    )
  `;
  const [queryJob] = await config.bigQueryClient.createQueryJob({ query });

  return queryJob;
}
