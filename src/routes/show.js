/* eslint-disable no-async-promise-executor */
/* eslint-disable require-atomic-updates */
const express = require('express');

const path = require('path');

const router = new express.Router();

const Show = require('../models/show');

const auth = require('../middleware/auth');

const axios = require('axios');

const AWS = require('aws-sdk');

const sharp = require('sharp');

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

const s3 = new AWS.S3();

const headers = {};

const baseURL = 'https://api.thetvdb.com';

const apikey = process.env.API_KEY;

const login = () => {
	return new Promise(async (resolve, reject) => {
		try {
			let response = await axios({
				baseURL,
				url: '/login',
				method: 'post',
				data: { apikey }
			});
			headers['Authorization'] = `Bearer ${response.data.token}`;
			resolve();
		} catch (e) {
			reject(e);
		}
	});
};

let getPosterKey = id => {
	return new Promise(async (resolve, reject) => {
		try {
			let response = null,
				count = null,
				source = null,
				posterKey = '';
			await login();
			response = await axios({
				headers,
				baseURL,
				url: `/series/${id}/images`,
				method: 'get'
			});
			count = response.data.data.poster;
			if (count) {
				response = await axios({
					headers,
					baseURL,
					url: `/series/${id}/images/query`,
					method: 'get',
					params: {
						keyType: 'poster'
					}
				});
				source =
					response.data.data[Math.floor(Math.random() * count + 1) - 1]
						.fileName;
				posterKey = source !== '' ? source.split('/')[1] : '';
			}
			resolve(posterKey);
		} catch (e) {
			if (e.response.status === 404) {
				return resolve('');
			}
			reject(e);
		}
	});
};

const deleteObjects = () => {
	return new Promise(async (resolve, reject) => {
		try {
			const params = {
				Bucket: 'tv-calendar-assets'
			};
			const data = await s3.listObjectsPromise(params);
			const contents = data.Contents;
			if (contents.length !== 0) {
				const result = contents.map(item => {
					return {
						Key: item.Key
					};
				});
				params.Delete = {
					Objects: result
				};
				await s3.deleteObjectsPromise(params);
			}
			resolve();
		} catch (e) {
			reject(e);
		}
	});
};

const createPoster = posterKey => {
	return new Promise(async (resolve, reject) => {
		try {
			const baseURL = 'https://www.thetvdb.com';
			const response = await axios({
				baseURL,
				url: `/banners/posters/${posterKey}`,
				responseType: 'arraybuffer'
			});
			const data = await s3.uploadPromise({
				Bucket: 'tv-calendar-assets',
				Key: posterKey,
				ACL: 'public-read',
				ContentEncoding: 'base64',
				ContentType: 'image/jpeg',
				Body: Buffer.from(response.data)
			});
			resolve(data.Location);
		} catch (e) {
			reject(e);
		}
	});
};

// Create show
router.post('/shows', auth, async (req, res) => {
	const body = req.body;
	let show = {
		_id: body.id.toString(),
		seriesName: body.seriesName,
		posterKey: body.posterKey,
		posterUrl: body.posterLocation
	};
	let response = null,
		series = null,
		summary = null;
	try {
		await login();

		response = await axios({
			headers,
			baseURL,
			url: `/series/${show._id}`,
			method: 'get'
		});
		series = response.data.data;

		response = await axios({
			headers,
			baseURL,
			url: `/series/${show._id}/episodes/summary`,
			method: 'get'
		});
		summary = response.data.data;

		show.status = series.status;
		show.overview = series.overview;
		show.airsDayOfWeek = series.airsDayOfWeek;
		show.airedSeasons = summary.airedSeasons;
		show.airedEpisodes = summary.airedEpisodes;

		if (body.posterLocation !== '') {
			response = await axios({
				url: body.posterLocation,
				responseType: 'arraybuffer'
			});
			const buffer = await sharp(Buffer.from(response.data))
				.resize({
					// width: 250,
					// height: 160
				})
				.jpeg()
				.toBuffer();
			show.poster = buffer;
		}
		show = new Show({
			...show,
			owner: req.user._id
		});
		await show.save();
		res.status(201).send();
	} catch (e) {
		res.status(400).send(e);
	}
});

router.get('/shows/search', async (req, res) => {
	try {
		let response = null,
			series = null;
		const params = {
			name: req.body.show
		};
		await login();
		response = await axios({
			headers,
			baseURL,
			url: '/search/series',
			method: 'get',
			params
		});
		series = response.data.data;
		await deleteObjects();
		for (let item of series) {
			const posterKey = await getPosterKey(item.id.toString());
			if (posterKey !== '') {
				item.posterKey = posterKey;
				item.posterLocation = await createPoster(item.posterKey);
			} else {
				item.posterKey = '';
				item.posterLocation = '';
			}
		}
		res.send({
			count: series.length,
			series
		});
	} catch (e) {
		res.status(500).send(e);
	}
});

router.get('/shows', auth, async (req, res) => {
	const match = {};
	const sort = {};
	if (req.query.completed) {
		match.completed = req.query.completed === 'true';
	}
	if (req.query.sortBy) {
		const parts = req.query.sortBy.split(':');
		sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
	}
	try {
		await req.user
			.populate({
				path: 'shows',
				match,
				options: {
					limit: parseInt(req.query.limit),
					skip: parseInt(req.query.skip),
					sort
				}
			})
			.execPopulate();
		res.send(req.user.shows);
	} catch (e) {
		res.status(500).send(e);
	}
});

router.get('/shows/:id', auth, async (req, res) => {
	const _id = req.params.id;
	try {
		const show = await Show.findOne({
			_id,
			owner: req.user._id
		});
		if (!show) {
			return res.status(404).send();
		}
		await login();
		let response = await axios({
			headers,
			baseURL,
			url: `/series/${_id}/episodes`,
			method: 'get'
		});
		show.seriesEpisodes = response.data.data;
		res.send(show);
	} catch (e) {
		res.status(500).send(e);
	}
});

router.patch('/shows/:id', auth, async (req, res) => {
	const updates = Object.keys(req.body);
	try {
		const show = await Show.findOne({
			_id: req.params.id,
			owner: req.user._id
		});
		if (!show) {
			return res.status(404).send();
		}
		updates.forEach(update => (show[update] = req.body[update]));
		await show.save();
		res.send(show);
	} catch (e) {
		res.status(400).send(e);
	}
});

router.delete('/shows/:id', auth, async (req, res) => {
	try {
		const show = await Show.findOneAndDelete({
			_id: req.params.id,
			owner: req.user._id
		});
		if (!show) {
			return res.status(404).send();
		}
		res.send(show);
	} catch (e) {
		res.status(500).send(e);
	}
});

router.get('/shows/:id/poster', auth, async (req, res) => {
	try {
		const show = await Show.findById(req.params.id);
		if (!show || !show.poster) throw new Error();
		res.set('Content-Type', 'image/jpeg');
		res.send(show.poster);
	} catch (e) {
		res.status(404).send();
	}
});

module.exports = router;
