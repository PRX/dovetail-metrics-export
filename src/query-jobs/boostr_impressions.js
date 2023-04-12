/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
module.exports = async function main(config) {
  const query = `
    SELECT
      timestamp_trunc(timestamp, day) AS Date,
      external_id AS \`Ad Server Line\`,
      count(*) AS Impressions
    FROM staging.dt_impressions
    INNER JOIN staging.flights ON (flight_id = id)
    WHERE timestamp >= ?
      AND timestamp < ?
      AND is_duplicate = false
      AND integration_id IN (${config.integrationIds.join(", ")})
    GROUP BY Date, \`Ad Server Line\`
    ORDER BY Date ASC, \`Ad Server Line\` ASC
  `;
  const params = [config.inclusiveRangeStart, config.exclusiveRangeEnd];
  const [queryJob] = await config.bigQueryClient.createQueryJob({
    query,
    params,
  });

  return queryJob;
};
