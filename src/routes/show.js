const express = require('express');

const router = new express.Router();

const axios = require('axios');

const sharp = require('sharp');

const Show = require('../models/show');

const auth = require('../middleware/auth');

const s3 = require('../aws/aws');

const data = {
	apikey: process.env.TVDB_API_KEY,
	userkey: process.env.TVDB_USER_KEY,
	username: process.env.TVDB_USER_NAME
};

const headers = {};

const baseURL = 'https://api.thetvdb.com';

const login = async () => {
	try {
		let response = await axios({
			baseURL,
			url: '/login',
			method: 'post',
			data
		});
		headers['Authorization'] = `Bearer ${response.data.token}`;
		return Promise.resolve();
	} catch (e) {
		return Promise.reject(e);
	}
};

const deleteObjects = async () => {
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
		return Promise.resolve();
	} catch (e) {
		return Promise.reject(e);
	}
};

const getAndUploadPosterObjects = async series => {
	try {
		for (let item of series) {
			if (item.image) {
				if (item.image.includes('posters')) {
					let posterKey = item.image.split('/')[3];
					if (!posterKey.includes('.jpg')) {
						continue;
					}
					let response = await axios({
						url: `https://www.thetvdb.com/banners/posters/${posterKey}`,
						responseType: 'arraybuffer'
					});
					const Body = await sharp(Buffer.from(response.data))
						.resize({
							width: 680,
							height: 1000
						})
						.jpeg()
						.toBuffer();
					response = await s3.uploadPromise({
						Bucket: 'tv-calendar-assets',
						Key: posterKey,
						ACL: 'public-read',
						ContentEncoding: 'base64',
						ContentType: 'image/jpeg',
						Body
					});
					item.posterUrl = response.Location;
				}
			} else {
				continue;
			}
		}
		return Promise.resolve();
	} catch (e) {
		return Promise.reject(e);
	}
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
					width: 680,
					height: 1000
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

router.post('/shows/search', async (req, res) => {
	try {
		const PAGE_SIZE = 12;
		const page =
			!req.query.page || req.query.page === '1'
				? 0
				: parseInt(req.query.page) - 1;
		const name = req.body.show;
		const params = { name };
		await login();
		let response = await axios({
			headers,
			baseURL,
			url: '/search/series',
			method: 'get',
			params
		});
		let series = response.data.data;
		const results = series.length;
		series = series.splice(page * PAGE_SIZE, PAGE_SIZE);

		if (process.env.NODE_ENV === 'production') {
			await deleteObjects();
			await getAndUploadPosterObjects(series);
		}
		res.send({
			name,
			results,
			page: page == 0 ? 1 : page + 1,
			pages:
				Math.floor(results / PAGE_SIZE) + (results % PAGE_SIZE !== 0 ? 1 : 0),
			series
		});
	} catch (e) {
		res.status(404).send(e);
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
