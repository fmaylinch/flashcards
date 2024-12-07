const { AWS_KEY_ID, AWS_SECRET } = process.env;
const AWS = require("aws-sdk");

AWS.config.update({
    region: "ru-central1",
    apiVersion: "2006-03-01",
    endpoint: "storage.yandexcloud.net",
    credentials: { accessKeyId: AWS_KEY_ID, secretAccessKey: AWS_SECRET }
});
s3 = new AWS.S3();

module.exports = {
    s3,
    bucketName: "fmaylinch-flashcards"
};
