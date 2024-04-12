/** @typedef {import('../index.js').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const query = `
    SELECT
      id,
      campaign_id,
      podcast_id,
      name,
      status,
      start_at,
      end_at,
      total_goal,
      contract_start_at,
      contract_end_at,
      contract_goal,
      allocation_priority,
      delivery_mode,
      is_companion,
      daily_minimum,
      velocity,
      unique_per_campaign,
      unique_per_advertiser,
      created_at,
      updated_at,
      external_id,
      price_model,
      price_cents,
      price_currency
    FROM ${process.env.BIGQUERY_DATASET}.flights
    WHERE podcast_id IN (${config.podcastIds.join(", ")})
  `;
  const [queryJob] = await config.bigQueryClient.createQueryJob({ query });

  return queryJob;
}
