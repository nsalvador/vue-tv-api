const express = require('express');

const cors = require('cors');

require('./db/mongoose');

const showRouter = require('./routes/show');

const userRouter = require('./routes/user');

const app = express();

app.use(express.json());

app.use(cors());

app.use(showRouter);

app.use(userRouter);

module.exports = app;
