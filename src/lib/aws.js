const AWS = require('aws-sdk');

class AWSAsync {
	constructor() {
		this.config();
		this.aws = new AWS.S3();
	}
	config() {
		AWS.config.update({
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			region: 'us-east-2'
		});
	}
	listObjects(params) {
		return new Promise((resolve, reject) => {
			this.aws.listObjects(params, (error, data) => {
				if (error) return reject(error);
				resolve(data);
			});
		});
	}
	deleteObjects(params) {
		return new Promise((resolve, reject) => {
			this.aws.deleteObjects(params, (error, data) => {
				if (error) return reject(error);
				resolve(data);
			});
		});
	}
	upload(object) {
		return new Promise((resolve, reject) => {
			this.aws.upload(object, (error, data) => {
				if (error) return reject(error);
				resolve(data);
			});
		});
	}
}

module.exports = new AWSAsync();
