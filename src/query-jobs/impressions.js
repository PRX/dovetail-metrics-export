/** @typedef {import('../index.js').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const query = `
    SELECT
      timestamp,
      request_uuid,
      feeder_podcast AS podcast_id,
      feeder_episode AS episode_id,
      -- is_duplicate,
      -- cause,
      ad_id,
      campaign_id,
      creative_id,
      flight_id,
      -- is_confirmed,
      digest,
      segment,
      placements_key,
      zone_name,
      target_path,
      -- vast_advertiser,
      -- vast_ad_id,
      -- vast_creative_id,
      -- vast_price_value,
      -- vast_price_currency,
      -- vast_price_model,
      agent_name_id,
      agent_type_id,
      agent_os_id,
      listener_id,
      city_geoname_id,
      country_geoname_id
    FROM ${process.env.BIGQUERY_DATASET}.dt_impressions
    WHERE timestamp >= ?
      AND timestamp < ?
      AND is_duplicate = false
      AND feeder_podcast IN (${config.podcastIds.join(", ")})
    `;
  const params = [config.inclusiveRangeStart, config.exclusiveRangeEnd];
  const [queryJob] = await config.bigQueryClient.createQueryJob({
    query,
    params,
  });

  return queryJob;
}
