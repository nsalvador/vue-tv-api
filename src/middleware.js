const cors = require('cors');

const express = require('express');

module.exports = [
	cors(),
	express.json(),
	require('./router/show'),
	require('./router/user'),
];
