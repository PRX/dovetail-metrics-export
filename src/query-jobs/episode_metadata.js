/** @typedef {import('../index.js').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const query = `
    SELECT
      id,
      podcast_id,
      guid,
      title,
      subtitle,
      image_url,
      created_at,
      updated_at,
      published_at,
      released_at,
      deleted_at,
      segment_count,
      audio_version,
      TO_JSON_STRING(categories) as keywords_json
    FROM ${process.env.BIGQUERY_DATASET}.episodes
    WHERE podcast_id IN (${config.podcastIds.join(", ")})
  `;
  const [queryJob] = await config.bigQueryClient.createQueryJob({ query });

  return queryJob;
}
