const express = require('express')
const server = express()

const cors = require('cors')
const whitelist = ['http://localhost:8080', 'http://192.168.0.34:8080']
const corsOptions = {
  origin: function (origin, callback) {
    const originIsWhitelisted = whitelist.indexOf(origin) !== -1
    callback(null, originIsWhitelisted)
  },
  credentials: true
}
server.use(cors(corsOptions))

const bp = require('body-parser')
server.use(bp.json())
server.use(bp.urlencoded({ extended: true }))

// This is the AUTH GATE
const auth = require('./auth/routes')
server.use('/', auth.session)
server.use('/', auth.router)

server.use((req, res, next) => {
  if (!req.session.uid) {
    return res.status(401).send({ error: 'Please login to continue' })
  }
  next()
})

require('./db/db-config')


const routes = {
  users: require('./routes/user'),
  parties: require('./routes/party'),
  members: require('./routes/member')
}

server.use('/api/users/', routes.users)
// server.use('/api/parties/', routes.parties)
// server.use('/api/members/', routes.members)

// create server for socket and connect socket to it
const app = require('http').createServer(server)
const io = require('socket.io')(app, {
  origins: '*:*'
})

// socket stuff
const Parties = require('./models/party')
const Members = require('./models/member')


io.on('connection', socket => {
  // new connection to client

  let user = undefined

  const errorHandler = error => {
    if (error.name === 'ValidationError') {
      error = 'Invalid input'
    }
    socket.emit('errorOccurred', error)
  }

  // notify client of successful connection
  socket.emit('connected', {
    socket: socket.id,
    message: 'Succesfully connected'
  })

  socket.on('setUser', userData => {
    // update user obj
    user = userData;

    // send back list of parties for user
    Parties.find({ userId: user._id })
      .then(parties => {
        Promise.all(parties.map(party =>
          Members.find({ partyId: party._id })
            .then(members => {
              party._doc.members = members
            })
            .catch(errorHandler)
        ))
          .then(() => socket.emit('parties', parties))
      })
      .catch(errorHandler)

    // try {
    //   const parties = await Parties.find({ userId: user._id })
    //   for (party in parties) {
    //     party.members = await Members.find({ partyId: party._id })
    //   }
    // } catch(error) {
    //   errorHandler(error)
    // }
  })

  socket.on('newParty', party => {
    // must be logged in
    if (!user) {
      return socket.emit('errorOccurred', 'You must be logged in to create a party')
    }

    // has to be a number of at least 1
    if (typeof party.memberLimit !== 'number' || party.memberLimit < 1) {
      return socket.emit('errorOccurred', 'Party Limit must be at least 1')
    }

    const partyObj = {
      name: party.name,
      memberLimit: party.memberLimit,
      userId: user._id
    }

    // create party on model
    Parties.create(partyObj)
      .then(party => socket.emit('party', { ...party._doc, members: [] }))
      .catch(errorHandler)
  })

  socket.on('deleteParty', partyId => {
    Parties.findByIdAndRemove(partyId)
      .then(() => socket.emit('partyDeleted', partyId))
      .catch(errorHandler)
  })

  socket.on('joinParty', ({ name, partyCode }) => {
    // Join the party
    Parties.findOne({ code: partyCode })
      .then(party => {
        Members.create({ name, partyId: party._id })
          .then(member => {
            socket.emit('partyJo]ined', member)
          })
          .catch(errorHandler)
        })
      .catch(errorHandler)
  })

  socket.on('getParty', partyCode => {
    Parties.findOne({ code: partyCode })
      .then(party => {
        // console.log(party)
        if (!party) {
          return errorHandler('Invalid party code')
        }
        socket.emit('partyGot', party)
      })
      .catch(errorHandler)
  })
})

server.use('/api/*', (error, req, res) => res.status(400).send(error))
server.use('*', (req, res) => res.status(404).send('<h1>404 NO PAGE HERE</h1>'))

const port = 3000
app.listen(port, () => console.log(`Sockets & Server started on port: ${port}`))
// server.listen(port, () => console.log(`Server started on port: ${port}`))