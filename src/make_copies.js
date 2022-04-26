const AWS = require('aws-sdk');

const sns = new AWS.SNS({ apiVersion: '2010-03-31' });

/**
 * Sends Copy tasks to Porter to copy an object from Google Cloud Storage to
 * Porter-supported destinations. The destination file name will be the same as
 * the full source object name (including all prefixes).
 * @param {object} event
 * @param {string} bucketName - The name of the bucket with the exported object
 * @param {string} objectName - The name of the exported object in Google Cloud Storage
 */
module.exports = async function main(
  event,
  credentials,
  bucketName,
  objectName,
) {
  if (event?.Copies?.length) {
    const projectId =
      credentials.project_id ||
      credentials.audience.match(/projects\/([0-9]+)\/locations/)[1];

    await sns
      .publish({
        Message: JSON.stringify({
          Job: {
            Id: `${bucketName}/${objectName}`,
            Source: {
              Mode: 'GCP/Storage',
              ProjectId: projectId,
              ClientConfiguration: credentials,
              BucketName: bucketName,
              ObjectName: objectName,
            },
            // Create a copy task for each copy on the input event
            Tasks: event.Copies.map((c) => {
              return {
                Type: 'Copy',
                Mode: c.Mode,
                BucketName: c.BucketName,
                ObjectKey: objectName,
              };
            }),
          },
        }),
        TopicArn: process.env.PORTER_SNS_TOPIC,
      })
      .promise();
  }
};
