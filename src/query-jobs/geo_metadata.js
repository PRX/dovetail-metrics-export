/** @typedef {import('../index').ExportConfig} ExportConfig */

/**
 * @param {ExportConfig} config
 */
export default async function job(config) {
  const query = `
    SELECT
      geoname_id,
      metro_code,
      locale_code,
      continent_code,
      continent_name,
      country_iso_code,
      country_name,
      subdivision_1_iso_code,
      subdivision_1_name,
      subdivision_2_iso_code,
      subdivision_2_name,
      city_name,
      time_zone
    FROM ${process.env.BIGQUERY_DATASET}.geonames
  `;
  const [queryJob] = await config.bigQueryClient.createQueryJob({ query });

  return queryJob;
}
