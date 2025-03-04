/** @typedef {import('../index.js').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const ds = process.env.BIGQUERY_DATASET;
  const query = `
    WITH top_flights AS (
      SELECT
        f.id AS id,
        COALESCE(p.id, f.id) AS top_id,
        COALESCE(f.external_id, p.external_id) AS external_id,
        COALESCE(f.integration_id, p.integration_id) AS integration_id
      FROM ${ds}.flights f
      LEFT JOIN ${ds}.flights p ON (f.parent_id = p.id)
      WHERE COALESCE(f.integration_id, p.integration_id) IN (${config.integrationIds.join(", ")})
    )
    SELECT
      FORMAT_TIMESTAMP("%m/%d/%Y", i.timestamp) AS Date,
      f.external_id AS \`Ad Server Line\`,
      COUNT(*) AS Impressions
    FROM ${ds}.dt_impressions i
    INNER JOIN top_flights f ON (i.flight_id = f.id)
    WHERE i.timestamp >= ?
      AND i.timestamp < ?
      AND i.is_duplicate = FALSE
      AND i.creative_id IS NOT NULL
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
