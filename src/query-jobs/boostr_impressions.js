/** @typedef {import('../index.js').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const ds = process.env.BIGQUERY_DATASET;
  const query = `
    SELECT
      FORMAT_TIMESTAMP("%m/%d/%Y", i.timestamp) AS Date,
      COALESCE(x.external_id, f.external_id) AS \`Ad Server Line\`,
      COUNT(*) AS Impressions
    FROM ${ds}.dt_impressions i
    INNER JOIN ${ds}.flights f ON (i.flight_id = f.id)
    LEFT JOIN ${ds}.flight_collection_external_ids x ON (f.id = x.flight_id AND i.feeder_podcast = x.podcast_id)
    WHERE i.timestamp >= ?
      AND i.timestamp < ?
      AND i.is_duplicate = FALSE
      AND i.creative_id IS NOT NULL
      AND f.integration_id IN (${config.integrationIds.join(", ")})
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
