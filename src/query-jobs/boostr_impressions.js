/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const query = `
    SELECT
      timestamp_trunc(timestamp, day) AS Date,
      external_id AS \`Ad Server Line\`,
      count(*) AS Impressions
    FROM ${process.env.BIGQUERY_DATASET}.dt_impressions
    INNER JOIN ${process.env.BIGQUERY_DATASET}.flights ON (flight_id = id)
    WHERE timestamp >= ?
      AND timestamp < ?
      AND is_duplicate = false
      AND creative_id IS NOT NULL
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
}
