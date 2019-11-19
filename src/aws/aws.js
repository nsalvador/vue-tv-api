const AWS = require('aws-sdk');

AWS.config.update({
	accessKeyId: process.env.ACCESS_KEY_ID,
	secretAccessKey: process.env.SECRET_ACCESS_KEY,
	region: 'us-east-2'
});

AWS.S3.prototype.listObjectsPromise = function(params) {
	return new Promise((resolve, reject) => {
		this.listObjects(params, (error, data) => {
			if (error) return reject(error);
			resolve(data);
		});
	});
};

AWS.S3.prototype.deleteObjectsPromise = function(params) {
	return new Promise((resolve, reject) => {
		this.deleteObjects(params, (error, data) => {
			if (error) return reject(error);
			resolve(data);
		});
	});
};

AWS.S3.prototype.uploadPromise = function(object) {
	return new Promise((resolve, reject) => {
		this.upload(object, (error, data) => {
			if (error) return reject(error);
			resolve(data);
		});
	});
};

module.exports = new AWS.S3();
