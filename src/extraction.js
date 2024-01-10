import MakeCopies from "./make_copies.js";

import queryForDownloads from "./query-jobs/downloads.js";
import queryForEpisodeMetadata from "./query-jobs/episode_metadata.js";
import queryForGeoMetadata from "./query-jobs/geo_metadata.js";
import queryForImpressions from "./query-jobs/impressions.js";
import queryForBoostrImpressions from "./query-jobs/boostr_impressions.js";
import queryForPodcastMetadata from "./query-jobs/podcast_metadata.js";
import queryForUserAgentMetadata from "./query-jobs/user_agent_metadata.js";
import queryForAdvertiserMetadata from "./query-jobs/advertiser_metadata.js";
import queryForCampaignMetadata from "./query-jobs/campaign_metadata.js";
// import queryForCreativeMetadata from "./query-jobs/creative_metadata.js";
import queryForFlightMetadata from "./query-jobs/flight_metadata.js";
import queryForPlacementMetadata from "./query-jobs/placement_metadata.js";

// The values should never include an "*", or output files could get real weird
const JOB_TYPES = {
  DOWNLOADS: "downloads",
  EPISODE_METADATA: "episode_metadata",
  GEO_METADATA: "geo_metadata",
  IMPRESSIONS: "impressions",
  BOOSTR_IMPRESSIONS: "boostr_impressions",
  PODCAST_METADATA: "podcast_metadata",
  USER_AGENT_METADATA: "user_agent_metadata",
  ADVERTISER_METADATA: "advertiser_metadata",
  CAMPAIGN_METADATA: "campaign_metadata",
  // CREATIVE_METADATA: "creative_metadata",
  FLIGHT_METADATA: "flight_metadata",
  PLACEMENT_METADATA: "placement_metadata",
};

/** @typedef {import('./index.js').ExportConfig} ExportConfig */

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
    "/",
    +config.requestTime, // Make it easier to disambiguate multiple similar jobs
    "/",
    config.requestId, // Provides a safe level of uniqueness
    "/", // Should always end in a slash
  ].join("");
}

/**
 *
 * @param {string} extractionType
 * @param {ExportConfig} config
 */
async function queryForExtractionType(extractionType, config) {
  switch (extractionType) {
    case JOB_TYPES.DOWNLOADS:
      return queryForDownloads(config);
    case JOB_TYPES.EPISODE_METADATA:
      return queryForEpisodeMetadata(config);
    case JOB_TYPES.GEO_METADATA:
      return queryForGeoMetadata(config);
    case JOB_TYPES.IMPRESSIONS:
      return queryForImpressions(config);
    case JOB_TYPES.BOOSTR_IMPRESSIONS:
      return queryForBoostrImpressions(config);
    case JOB_TYPES.PODCAST_METADATA:
      return queryForPodcastMetadata(config);
    case JOB_TYPES.USER_AGENT_METADATA:
      return queryForUserAgentMetadata(config);
    case JOB_TYPES.ADVERTISER_METADATA:
      return queryForAdvertiserMetadata(config);
    case JOB_TYPES.CAMPAIGN_METADATA:
      return queryForCampaignMetadata(config);
    // case JOB_TYPES.CREATIVE_METADATA:
    //   return queryForCreativeMetadata(config);
    case JOB_TYPES.FLIGHT_METADATA:
      return queryForFlightMetadata(config);
    case JOB_TYPES.PLACEMENT_METADATA:
      return queryForPlacementMetadata(config);
    default:
      return false;
  }
}

export const types = Object.values(JOB_TYPES);

/**
 * Runs an extraction job of a specific type for a given configuration
 * @param {string} extractionType
 * @param {ExportConfig} config
 * @returns {Promise<void>}
 */
export async function run(extractionType, config) {
  console.log(extractionType);
  if (!config.extractions.includes(extractionType)) {
    return;
  }

  const queryJob = await queryForExtractionType(extractionType, config);

  if (!queryJob) {
    return;
  }

  console.log(
    JSON.stringify({
      QueryJob: { Type: extractionType, Metadata: queryJob.metadata },
    }),
  );

  const queryMetadata = await new Promise((resolve, reject) => {
    queryJob.on("complete", resolve);
    queryJob.on("error", reject);
  });

  const bucketName = process.env.GCP_EXPORT_BUCKET;

  // All extract jobs use multi-file wildcard output
  const formatExt = { NEWLINE_DELIMITED_JSON: ".ndjson", CSV: ".csv" }[
    config.destinationFormat
  ];
  const compressionExt = { NONE: "", GZIP: ".gz" }[config.compression];
  const fileExtension = `${formatExt}${compressionExt}`;
  const filename = `${extractionType}-*${fileExtension}`;
  const objectName = [gcsObjectPrefix(config), filename].join("");

  const [extractJob] = await config.bigQueryClient.createJob({
    configuration: {
      extract: {
        // https://cloud.google.com/bigquery/docs/reference/rest/v2/Job#jobconfigurationextract
        sourceTable: queryMetadata.configuration.query.destinationTable,
        // Ensure that the filename after the prefix does not collide with any
        // other files created by this function, or they may overwrite each
        // other
        destinationUri: `gs://${bucketName}/${objectName}`,
        destinationFormat: config.destinationFormat,
        printHeader: true,
        compression: config.compression,
      },
    },
  });

  await new Promise((resolve, reject) => {
    extractJob.on("complete", resolve);
    extractJob.on("error", reject);
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
  for (let i = 0; i < outputFileCount; i += 1) {
    // BigQuery makes files with 12-digit numbers, starting at 000000000000
    const fileSequenceId = `${i}`.padStart(12, "0");

    // Replace the wildcard in the filename we gave to BigQuery in the job
    // configuration with a 12-digit number, so it matches one of the files
    // that was created in GCS.
    const numberedObjectName = objectName.replace(
      `-*${fileExtension}`,
      `-${fileSequenceId}${fileExtension}`,
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
}
