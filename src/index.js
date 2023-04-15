const { BigQuery } = require("@google-cloud/bigquery");

const extraction = require("./extraction");

/**
 * @typedef {object} ExportConfig
 * @property {!BigQuery} bigQueryClient
 * @property {!Date} inclusiveRangeStart
 * @property {!Date} exclusiveRangeEnd
 * @property {!number[]} podcastIds
 * @property {!number[]} integrationIds
 * @property {!string[]} extractions
 * @property {!string} inputPrefix
 * @property {!string} requestId
 * @property {!Date} requestTime
 * @property {!object[]} [copies]
 * @property {!string} destinationFormat
 * @property {!string} compression
 */

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
  console.log(JSON.stringify({ Event: event }));

  const gcpConfig = JSON.parse(process.env.BIGQUERY_CLIENT_CONFIG);

  const bigQueryClient = new BigQuery({
    projectId:
      gcpConfig.project_id ||
      gcpConfig.audience.match(/projects\/([0-9]+)\/locations/)[1],
    credentials: gcpConfig,
  });

  if (event.Range?.[0] && !/\d{4}-\d{2}-\d{2}T00:00:00Z/.test(event.Range[0])) {
    // bad explicit range start
    return;
  }

  if (event.Range?.[1] && !/\d{4}-\d{2}-\d{2}T00:00:00Z/.test(event.Range[1])) {
    // bad explicit range end
    return;
  }

  if (event.Range?.length === 1) {
    // need both ends of the range if any are included
    return;
  }

  if (event.PodcastIDs && event.IntegrationsIDs) {
    // only allow one type of record IDs
    return;
  }

  if (event.PodcastIDs && !(event.PodcastIDs?.length >= 1)) {
    // bad podcast IDs input
    return;
  }

  if (event.IntegrationsIDs && !(event.IntegrationsIDs?.length >= 1)) {
    // bad integration IDs input
    return;
  }

  // Check destination format
  let destinationFormat = event.DestinationFormat;
  if (
    event.DestinationFormat &&
    !["NEWLINE_DELIMITED_JSON", "CSV"].includes(event.DestinationFormat)
  ) {
    // bad format
    return;
  } else if (!event.DestinationFormat) {
    // use default format
    destinationFormat = "NEWLINE_DELIMITED_JSON";
  }

  // Check compression type
  let compression = event.CompressionType;
  if (
    event.CompressionType &&
    !["NONE", "GZIP"].includes(event.CompressionType)
  ) {
    // bad compression type
    return;
  } else if (!event.DestinationFormat) {
    // use default compression
    compression = "GZIP";
  }

  // Include all extraction types by default
  const extractions =
    !event.Extractions || !Array.isArray(event.Extractions)
      ? extraction.types.filter((t) => !["boostr_impressions"].includes(t))
      : event.Extractions;

  const inclusiveRangeStart = event.Range?.[0]
    ? new Date(Date.parse(event.Range[0]))
    : defaultRangeStart();
  const exclusiveRangeEnd = event.Range?.[1]
    ? new Date(Date.parse(event.Range[1]))
    : defaultRangeEnd();

  console.log(
    JSON.stringify({
      Extractions: extractions,
      Range: [inclusiveRangeStart, exclusiveRangeEnd],
    })
  );

  // A prefix defined on the input, which should include a trailing slash if
  // it should be separated from the automatic part of the full prefix
  const inputPrefix = event.ObjectPrefix || "";

  /** @type {ExportConfig} */
  const config = {
    bigQueryClient: bigQueryClient,
    inclusiveRangeStart: inclusiveRangeStart,
    exclusiveRangeEnd: exclusiveRangeEnd,
    ...(event.PodcastIDs && { podcastIds: event.PodcastIDs }),
    ...(event.IntegrationsIDs && { integrationIds: event.IntegrationsIDs }),
    extractions: extractions,
    inputPrefix: inputPrefix,
    requestId: context.awsRequestId,
    requestTime: new Date(),
    copies: event.Copies,
    destinationFormat: destinationFormat,
    compression: compression,
  };

  // TODO Check to make sure the data we want to export seems complete
  const doExport = true;

  if (doExport) {
    await Promise.all(extraction.types.map((t) => extraction.run(t, config)));
  }
};
