const AWS = require('aws-sdk');
const { BigQuery } = require('@google-cloud/bigquery');
const ExportDownloads = require('./downloads');
const ExportImpressions = require('./impressions');
const ExportEpisodeMetadata = require('./episode_metadata');
const ExportPodcastMetadata = require('./podcast_metadata');
const ExportGeoMetadata = require('./geo_metadata');

const ssm = new AWS.SSM({ apiVersion: '2014-11-06' });

/**
 * Returns the default start of the query range, which is the second-most
 * recent UTC midnight relative to the present time
 */
function defaultRangeStart() {
  const d = defaultRangeEnd();
  return new Date(d.setDate(d.getDate() - 1));
}

/**
 * Returns the default end of the query range, which is the most recent UTC
 * midnight relative to the present time
 */
function defaultRangeEnd() {
  return new Date(new Date().setUTCHours(0, 0, 0, 0));
}

exports.handler = async (event, context) => {
  // TODO Move outside handler if we end up using this a lot
  const param = await ssm
    .getParameter({
      Name: '/prx/stag/dovetail-metrics-export/BQ_CREDENTIALS',
    })
    .promise();
  const gcpConfig = JSON.parse(param.Parameter.Value);

  const bigQueryClient = new BigQuery({
    projectId: gcpConfig.project_id,
    credentials: gcpConfig,
  });

  if (
    event?.Range?.[0] &&
    !/\d{4}-\d{2}-\d{2}T00:00:00Z/.test(event.Range[0])
  ) {
    // bad explicit range start
    return;
  }

  if (
    event?.Range?.[1] &&
    !/\d{4}-\d{2}-\d{2}T00:00:00Z/.test(event.Range[1])
  ) {
    // bad explicit range end
    return;
  }

  if (event?.Range?.length === 1) {
    // need both ends of the range if any are included
    return;
  }

  if (!event?.PodcastIDs?.length > 1) {
    // bad shows input
    return;
  }

  if (!event?.Jobs || !Array.isArray(event?.Jobs)) {
    event.Jobs = [
      'Downloads',
      'Impressions',
      'PodcastMetadata',
      'EpisodeMetadata',
      'GeoMetadata',
    ];
  }

  const inclusiveRangeStart = event?.Range?.[0]
    ? new Date(Date.parse(event.Range[0]))
    : defaultRangeStart();
  const exclusiveRangeEnd = event?.Range?.[1]
    ? new Date(Date.parse(event.Range[1]))
    : defaultRangeEnd();

  const podcastIds = event.PodcastIDs;

  // A prefix defined on the input, which should include a trailing slash if
  // it should be separated from the automatic part of the full prefix
  const inputPrefix = event.ObjectPrefix || '';

  // This object prefix is used for all files created by all exports, like:
  // prefix/some_file_name.zip
  const objectPrefix = [
    inputPrefix,
    // inputPrefix can include a trailing slash if it needs to, don't add one
    `${inclusiveRangeStart.toISOString()}-${exclusiveRangeEnd.toISOString()}`,
    '/',
    +new Date(), // Make it easier to disambiguate multiple similar jobs
    '/',
    context.awsRequestId, // Provides a safe level of uniqueness
    '/', // Should always end in a slash
  ].join('');

  // TODO Check to make sure the data we want to export seems complete
  const doExport = true;

  // TODO Support selective export in the event data
  if (doExport) {
    if (event?.Jobs?.includes('Downloads')) {
      await ExportDownloads(
        bigQueryClient,
        podcastIds,
        inclusiveRangeStart,
        exclusiveRangeEnd,
        objectPrefix,
      );
    }

    if (event?.Jobs?.includes('Impressions')) {
      await ExportImpressions(
        bigQueryClient,
        podcastIds,
        inclusiveRangeStart,
        exclusiveRangeEnd,
        objectPrefix,
      );
    }

    if (event?.Jobs?.includes('PodcastMetadata')) {
      await ExportPodcastMetadata(bigQueryClient, podcastIds, objectPrefix);
    }

    if (event?.Jobs?.includes('EpisodeMetadata')) {
      await ExportEpisodeMetadata(bigQueryClient, podcastIds, objectPrefix);
    }

    if (event?.Jobs?.includes('GeoMetadata')) {
      await ExportGeoMetadata(bigQueryClient, objectPrefix);
    }
  }
};