const express = require('express');

const middleware = require('./middleware');

require('./db/mongoose');

const app = express();

app.use(middleware);

module.exports = app;
