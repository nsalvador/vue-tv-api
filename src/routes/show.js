const express = require('express');
const router = new express.Router();
const axios = require('axios');
const sharp = require('sharp');
const Show = require('../models/show');
const auth = require('../middleware/auth');
const s3 = require('../aws');
const TVDB = require('../tvdb');

// Create show
router.post('/shows', auth, async (req, res) => {
	const body = req.body;
	let show = {
		_id: body.id.toString(),
		seriesName: body.seriesName,
		posterUrl: body.posterUrl
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

		if (show.posterUrl !== '') {
			response = await axios({
				url: show.posterUrl,
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

// const deletePosters = async () => {
// 	const params = {
// 		Bucket: 'tv-calendar-assets'
// 	};
// 	const data = await s3.listObjects(params);
// 	const contents = data.Contents;
// 	if (contents.length !== 0) {
// 		const result = contents.map(item => ({
// 			Key: item.Key
// 		}));
// 		params.Delete = {
// 			Objects: result
// 		};
// 		await s3.deleteObjects(params);
// 	}
// };

// const getPosters = async series => {
// 	for (let item of series) {
// 		const image = item.image;
// 		if (image && image.includes('posters')) {
// 			const Key = image.split('/')[3];
// 			if (!Key.includes('.jpg')) {
// 				continue;
// 			}
// 			const Body = await TVDB.banner(Key);
// 			const response = await s3.upload({
// 				Bucket: 'tv-calendar-assets',
// 				Key,
// 				ACL: 'public-read',
// 				ContentEncoding: 'base64',
// 				ContentType: 'image/jpeg',
// 				Body
// 			});
// 			item.posterUrl = response.Location;
// 		} else {
// 			continue;
// 		}
// 	}
// };

router.post('/shows/search', async (req, res) => {
	try {
		await TVDB.login();
		const series = await TVDB.search(req.body.show);
		res.send(series);
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
