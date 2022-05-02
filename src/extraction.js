const MakeCopies = require('./make_copies');

const queryForDownloads = require('./query-jobs/downloads');
const queryForEpisodeMetadata = require('./query-jobs/episode_metadata');
const queryForGeoMetadata = require('./query-jobs/geo_metadata');
const queryForImpressions = require('./query-jobs/impressions');
const queryForPodcastMetadata = require('./query-jobs/podcast_metadata');
const queryForUserAgentMetadata = require('./query-jobs/user_agent_metadata');

const JOB_TYPES = {
  DOWNLOADS: 'downloads',
  EPISODE_METADATA: 'episode_metadata',
  GEO_METADATA: 'geo_metadata',
  IMPRESSIONS: 'impressions',
  PODCAST_METADATA: 'podcast_metadata',
  USER_AGENT_METADATA: 'user_agent_metadata',
};

/** @typedef {import('./index').ExportConfig} ExportConfig */

/**
 * This object prefix is used for all files created by all exports, like:
 * some/prefix/some_file_name.zip
 * @param {ExportConfig} config
 */
function gcsObjectPrefix(config) {
  return [
    config.inputPrefix,
    // inputPrefix can include a trailing slash if it needs to, don't add one
    `${config.inclusiveRangeStart.toISOString()}-${config.exclusiveRangeEnd.toISOString()}`,
    '/',
    +config.requestTime, // Make it easier to disambiguate multiple similar jobs
    '/',
    config.requestId, // Provides a safe level of uniqueness
    '/', // Should always end in a slash
  ].join('');
}

async function queryForJobType(jobType, config) {
  switch (jobType) {
    case JOB_TYPES.DOWNLOADS:
      return await queryForDownloads(config);
    case JOB_TYPES.EPISODE_METADATA:
      return await queryForEpisodeMetadata(config);
    case JOB_TYPES.GEO_METADATA:
      return await queryForGeoMetadata(config);
    case JOB_TYPES.IMPRESSIONS:
      return await queryForImpressions(config);
    case JOB_TYPES.PODCAST_METADATA:
      return await queryForPodcastMetadata(config);
    case JOB_TYPES.USER_AGENT_METADATA:
      return await queryForUserAgentMetadata(config);
    default:
      break;
  }
}

module.exports = {
  types: Object.values(JOB_TYPES),
  /**
   *
   * @param {string} jobType
   * @param {ExportConfig} config
   * @returns
   */
  run: async function main(jobType, config) {
    if (!config.extractions.includes(jobType)) {
      return;
    }

    const queryJob = await queryForJobType(jobType, config);

    console.log(
      JSON.stringify({
        QueryJob: { Job: jobType, Metadata: queryJob.metadata },
      }),
    );

    const queryMetadata = await new Promise((resolve, reject) => {
      queryJob.on('complete', resolve);
      queryJob.on('error', reject);
    });

    const bucketName = process.env.GCP_EXPORT_BUCKET;

    const filename = `${jobType}.ndjson.gz`;
    const objectName = [gcsObjectPrefix(config), filename].join('');

    const [extractJob] = await config.bigQueryClient.createJob({
      configuration: {
        extract: {
          sourceTable: queryMetadata.configuration.query.destinationTable,
          // Ensure that the filename after the prefix does not collide with any
          // other files created by this function, or they may overwrite each
          // other
          destinationUri: `gs://${bucketName}/${objectName}`,
          destinationFormat: 'NEWLINE_DELIMITED_JSON',
          printHeader: true,
          compression: 'GZIP',
        },
      },
    });

    await new Promise((resolve, reject) => {
      extractJob.on('complete', resolve);
      extractJob.on('error', reject);
    });

    console.log(
      JSON.stringify({
        ExtractJob: { Job: jobType, Metadata: extractJob.metadata },
      }),
    );

    await MakeCopies(jobType, config, bucketName, objectName);
  },
};
