/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
module.exports = async function main(config) {
  let and_ids_in;
  if (config.podcastIds) {
    const ids = config.podcastIds;
    and_ids_in = `AND feeder_podcast IN (${ids.join(', ')})`;
  } else if (config.integrationIds) {
    const ids = config.integrationIds;
    and_ids_in = `AND campaigns.integration_id IN (${ids.join(', ')})`;
  }

  let join = '';
  let addl_columns = ''; // MUST start with a comma
  if (config.integrationIds) {
    join = `JOIN ${process.env.BIGQUERY_DATASET}.campaigns ON campaign_id=campaigns.id`;
    addl_columns = ', campaign.external_id';
  }

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
      ${addl_columns}
    FROM ${process.env.BIGQUERY_DATASET}.dt_impressions
    ${join}
    WHERE timestamp >= ?
      AND timestamp < ?
      AND is_duplicate = false
      ${and_ids_in}
    `;
  const params = [config.inclusiveRangeStart, config.exclusiveRangeEnd];
  const [queryJob] = await config.bigQueryClient.createQueryJob({
    query,
    params,
  });

  return queryJob;
};
