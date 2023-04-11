/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
module.exports = async function main(config) {
  const query = `
    SELECT
      timestamp,
      request_uuid,
      feeder_podcast AS podcast_id,
      feeder_episode AS episode_id,
      digest,
      ad_count,
      -- is_duplicate
      -- cause,
      remote_referrer,
      remote_agent,
      remote_ip,
      agent_name_id,
      agent_type_id,
      agent_os_id,
      city_geoname_id,
      country_geoname_id,
      -- is_confirmed
      url,
      listener_id,
      listener_episode
    FROM ${process.env.BIGQUERY_DATASET}.dt_downloads
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
};
