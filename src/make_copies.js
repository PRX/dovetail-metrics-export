const AWS = require('aws-sdk');

const sns = new AWS.SNS({ apiVersion: '2010-03-31' }); /**

*
 * @param {object} event
 * @param {string} bucketName - The name of the bucket with the exported object
 * @param {string} objectName - The name of the exported object in Google Cloud Storage
 */
module.exports = async function main(event, bucketName, objectName) {
  if (event?.copies?.length) {
    await sns
      .publish({
        Message: JSON.stringify({
          Job: {
            Id: 123213, // TODO
            Source: {
              Mode: 'GCP/Storage',
              BucketName: bucketName,
              ObjectName: objectName,
            },
          },
          // Create a copy task for each copy on the input event
          Tasks: copies.map((c) => {
            return {
              Type: 'Copy',
              Mode: c.Mode,
              BucketName: c.BucketName,
              ObjectKey: objectName,
            };
          }),
        }),
        TopicArn: process.env.PORTER_SNS_TOPIC,
      })
      .promise();
  }
};
