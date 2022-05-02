const AWS = require('aws-sdk');

const sns = new AWS.SNS({ apiVersion: '2010-03-31' });

/** @typedef {import('./index').ExportConfig} ExportConfig */

/**
 * Sends Copy tasks to Porter to copy an object from Google Cloud Storage to
 * Porter-supported destinations.
 * @param {string} extractionType
 * @param {ExportConfig} config
 * @param {string} sourceBucketName - The name of the bucket with the exported object
 * @param {string} sourceObjectName - The name of the exported object in Google Cloud Storage
 */
module.exports = async function main(
  extractionType,
  config,
  sourceBucketName,
  sourceObjectName,
) {
  if (config.copies?.length) {
    const credentials = config.bigQueryClient.authClient.jsonContent;

    const projectId =
      credentials.project_id ||
      credentials.audience.match(/projects\/([0-9]+)\/locations/)[1];

    const job = {
      Job: {
        Id: `${sourceBucketName}/${sourceObjectName}`,
        Source: {
          Mode: 'GCP/Storage',
          ProjectId: projectId,
          ClientConfiguration: credentials,
          BucketName: sourceBucketName,
          ObjectName: sourceObjectName,
        },
        // Create a copy task for each copy definition on the input event
        Tasks: config.copies.map((c) => {
          // By default, the object key in the destination will exactly match
          // the object name of the source file in GCS
          let destinationKey = sourceObjectName;

          // If the copy included a custom format
          if (c.DestinationFormat) {
            destinationKey = c.DestinationFormat
              // Replace each format directive
              .replace(
                /%RANGE_START_ISO/g,
                config.inclusiveRangeStart.toISOString(),
              )
              .replace(
                /%RANGE_END_ISO/g,
                config.exclusiveRangeEnd.toISOString(),
              )
              .replace(/%TYPE/g, extractionType)
              .replace(/%REQUEST_ID/g, config.requestId)
              .replace(/%REQUEST_TIME/g, +config.requestTime);
          }

          if (c.mode === 'AWS/S3') {
            console.log(
              JSON.stringify({
                Copy: {
                  Source: `gs://${sourceBucketName}/${sourceObjectName}`,
                  Destination: `s3://${c.BucketName}/${destinationKey}`,
                },
              }),
            );

            return {
              Type: 'Copy',
              Mode: c.Mode,
              BucketName: c.BucketName,
              ObjectKey: destinationKey,
            };
          } else {
            // TODO Add more destination modes
          }
        }),
      },
    };

    console.log(JSON.stringify({ PorterJob: job }));

    await sns
      .publish({
        Message: JSON.stringify(job),
        TopicArn: process.env.PORTER_SNS_TOPIC,
      })
      .promise();
  }
};
