const MakeCopies = require('./make_copies');

const queryForDownloads = require('./query-jobs/downloads');
const queryForEpisodeMetadata = require('./query-jobs/episode_metadata');
const queryForGeoMetadata = require('./query-jobs/geo_metadata');
const queryForImpressions = require('./query-jobs/impressions');
const queryForPodcastMetadata = require('./query-jobs/podcast_metadata');
const queryForUserAgentMetadata = require('./query-jobs/user_agent_metadata');
const queryForAdvertiserMetadata = require('./query-jobs/advertiser_metadata');
const queryForCampaignMetadata = require('./query-jobs/campaign_metadata');
const queryForCreativeMetadata = require('./query-jobs/creative_metadata');
const queryForFlightMetadata = require('./query-jobs/flight_metadata');
const queryForPlacementMetadata = require('./query-jobs/placement_metadata');

// The values should never include an "*", or output files could get real weird
const JOB_TYPES = {
  DOWNLOADS: 'downloads',
  EPISODE_METADATA: 'episode_metadata',
  GEO_METADATA: 'geo_metadata',
  IMPRESSIONS: 'impressions',
  PODCAST_METADATA: 'podcast_metadata',
  USER_AGENT_METADATA: 'user_agent_metadata',
  ADVERTISER_METADATA: 'advertiser_metadata',
  CAMPAIGN_METADATA: 'campaign_metadata',
  CREATIVE_METADATA: 'creative_metadata',
  FLIGHT_METADATA: 'flight_metadata',
  PLACEMENT_METADATA: 'placement_metadata',
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

/**
 *
 * @param {string} extractionType
 * @param {ExportConfig} config
 */
async function queryForExtractionType(extractionType, config) {
  switch (extractionType) {
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
    case JOB_TYPES.ADVERTISER_METADATA:
      return await queryForAdvertiserMetadata(config);
    case JOB_TYPES.CAMPAIGN_METADATA:
      return await queryForCampaignMetadata(config);
    case JOB_TYPES.CREATIVE_METADATA:
      return await queryForCreativeMetadata(config);
    case JOB_TYPES.FLIGHT_METADATA:
      return await queryForFlightMetadata(config);
    case JOB_TYPES.PLACEMENT_METADATA:
      return await queryForPlacementMetadata(config);
    default:
      break;
  }
}

module.exports = {
  types: Object.values(JOB_TYPES),
  /**
   * Runs an extraction job of a specific type for a given configuration
   * @param {string} extractionType
   * @param {ExportConfig} config
   * @returns {Promise<void>}
   */
  run: async function main(extractionType, config) {
    if (!config.extractions.includes(extractionType)) {
      return;
    }

    const queryJob = await queryForExtractionType(extractionType, config);

    console.log(
      JSON.stringify({
        QueryJob: { Type: extractionType, Metadata: queryJob.metadata },
      }),
    );

    const queryMetadata = await new Promise((resolve, reject) => {
      queryJob.on('complete', resolve);
      queryJob.on('error', reject);
    });

    const bucketName = process.env.GCP_EXPORT_BUCKET;

    // All extract jobs use multi-file wildcard output
    const filename = `${extractionType}-*.ndjson.gz`;
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

    // destinationUriFileCounts is an array where each value corresponds to
    // a URL provided in destinationUri in the job. We only ever give one URL,
    // so we only get one value.
    const outputFileCount =
      extractJob.metadata.statistics.extract.destinationUriFileCounts[0];

    console.log(
      JSON.stringify({
        ExtractJob: { Type: extractionType, Metadata: extractJob.metadata },
      }),
    );

    const copyMachines = [];

    // Because the extaction could have generated multiple files, we need to
    // copy however many were created.
    for (let i = 0; i < outputFileCount; i++) {
      // BigQuery makes files with 12-digit numbers, starting at 000000000000
      const fileSequenceId = `${i}`.padStart(12, '0');

      // Replace the wildcard in the filename we gave to BigQuery in the job
      // configuration with a 12-digit number, so it matches one of the files
      // that was created in GCS.
      const numberedObjectName = objectName.replace(
        '-*.ndjson.gz',
        `-${fileSequenceId}.ndjson.gz`,
      );

      // Copy that specific numbered file
      copyMachines.push(
        MakeCopies(
          extractionType,
          config,
          bucketName,
          numberedObjectName,
          fileSequenceId,
        ),
      );
    }

    await Promise.all(copyMachines);
  },
};
