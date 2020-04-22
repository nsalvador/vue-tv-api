const axios = require('axios');
const sharp = require('sharp');

axios.defaults.baseURL = 'https://api.thetvdb.com';

class TVDB {
	async login() {
		const response = await axios({
			url: '/login',
			method: 'post',
			data: {
				apikey: process.env.TVDB_API_KEY,
				userkey: process.env.TVDB_USER_KEY,
				username: process.env.TVDB_USER_NAME
			}
		});
		axios.defaults.headers.common[
			'Authorization'
		] = `Bearer ${response.data.token}`;
	}

	async search(name) {
		const response = await axios({
			url: '/search/series',
			method: 'get',
			params: { name }
		});
		return response.data.data;
	}

	async series(id) {
		const response = await axios({
			url: `/series/${id}`,
			method: 'get'
		});
		return response.data.data;
	}

	async summary(id) {
		const response = await axios({
			url: `/series/${id}/episodes/summary`,
			method: 'get'
		});
		return response.data.data;
	}

	async banner(key) {
		const response = await axios({
			url: `https://www.thetvdb.com/banners/posters/${key}`,
			responseType: 'arraybuffer'
		});
		const buffer = await sharp(Buffer.from(response.data))
			.resize({ width: 680, height: 1000 })
			.jpeg()
			.toBuffer();
		return buffer;
	}
}

module.exports = new TVDB();
