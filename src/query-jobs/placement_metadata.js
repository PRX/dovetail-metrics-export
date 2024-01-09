/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const query = `
    SELECT
      id,
      podcast_id,
      name,
      original_count,
      zone_index,
      zone_type,
      zone_name,
      zone_label,
      section_name,
      section_label,
      created_at,
      updated_at
    FROM ${process.env.BIGQUERY_DATASET}.placements
    WHERE podcast_id IN (${config.podcastIds.join(", ")})
  `;
  const [queryJob] = await config.bigQueryClient.createQueryJob({ query });

  return queryJob;
}
