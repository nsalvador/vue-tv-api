const mongoose = require('mongoose');

const showSchema = new mongoose.Schema(
	{
		_id: String,
		seriesName: String,
		posterKey: String,
		posterUrl: String,
		status: String,
		overview: String,
		airsDayOfWeek: String,
		airedSeasons: Array,
		airedEpisodes: String,
		seriesEpisodes: Array,
		viewed: {
			type: Boolean,
			default: false
		},
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'User'
		},
		poster: {
			type: Buffer
		}
	},
	{
		timestamps: true
	}
);

const Show = mongoose.model('Show', showSchema);

module.exports = Show;
