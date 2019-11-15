const express = require('express')

require('./db/mongoose')

const showRouter = require('./routes/show')

const userRouter = require('./routes/user')

const app = express()

app.use(express.json())

app.use(showRouter)

app.use(userRouter)

module.exports = app   