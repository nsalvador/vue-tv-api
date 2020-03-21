const redis = require('redis');

class AsyncRedis {
	constructor() {
		this.client = redis.createClient(6379);
	}
	get(key) {
		return new Promise((resolve, reject) => {
			this.client.get(key, (error, data) => {
				if (error) return reject(error);
				resolve(data);
			});
		});
	}
	set(key, value) {
		return new Promise(resolve => {
			this.client.set(key, value);
			resolve();
		});
	}
}

module.exports = new AsyncRedis();
