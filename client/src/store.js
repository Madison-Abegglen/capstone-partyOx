import Vue from 'vue'
import Vuex from 'vuex'
import Axios from 'axios'
import router from './router'

import io from 'socket.io-client'
let socket

Vue.use(Vuex)

let auth = Axios.create({
  baseURL: "//localhost:3000/auth/",
  timeout: 3000,
  withCredentials: true
})

let api = Axios.create({
  baseURL: "//localhost:3000/api/",
  timeout: 3000,
  withCredentials: true
})

export default new Vuex.Store({
  // IDAHO
  state: {
    snackbar: {
      open: false,
      text: ''
    },
    currentRoom: {},
    parties: [],
    ox: {},
    reroute: undefined,
    loading: false,
    activeParty: {}
  },

  // IF YOURE READY COME AND GET IT
  getters: {
    loggedIn: state => !!state.ox.email
  },

  // SCIENCE EXPERIMENTS HERE
  mutations: {
    setSnackbar(state, snack) {
      state.snackbar = snack
    },
    setRoom(state, room) {
      state.currentRoom = room
    },
    setMembers(state, member) {
      state.members.push(member)
    },
    setOx(state, ox) {
      state.ox = ox
    },
    setParties(state, parties) {
      state.parties = parties
    },
    setLoading(state, loading) {
      state.loading = loading
    },
    setActiveParty(state, party) {
      state.activeParty = party
    }
  },

  // TAKE ACTION NOW
  actions: {

    // SNACK BAR STUFF (YUM)
    closeSnackbar({ commit }) {
      commit('setSnackbar', { text: '', open: false })
    },
    async newSnackbar({ commit, dispatch }, data) {
      await dispatch('closeSnackbar')
      if (data instanceof Error) {
        if (data.response && data.response.data && data.response.data.error) {
          data = data.response.data.error
        } else {
          data = data.message
        }
      }
      commit('setSnackbar', { open: true, text: data })
    },

    // AUTHORIZATION FOUND BELOW
    login({ commit, dispatch, state }, creds) {
      commit('setLoading', true)
      auth.post('login', creds)
        .then(res => {
          commit('setOx', res.data)
          dispatch('initSocket')

          router.push(state.reroute || { name: 'ox-home' })
          state.reroute = undefined
          commit('setLoading', false)
        })
        .catch(error => {
          dispatch('newSnackbar', error)
          commit('setLoading', false)
        })
    },
    logout({ commit, dispatch }) {
      auth.delete('logout')
        .then(() => {
          commit('setOx', {})
          router.push({ name: 'login' }) // go to login page
        })
        .catch(error => dispatch('newSnackbar', error))
    },
    signup({ commit, dispatch, state }, creds) {
      auth.post('register', creds)
        .then(res => {
          commit('setOx', res.data)

          router.push(state.reroute || { name: 'ox-home' })
          state.reroute = undefined
        })
        .catch(error => dispatch('newSnackbar', error))
    },
    authenticate({ commit, dispatch, state }) {
      auth.get('authenticate')
        .then(res => {
          commit('setOx', res.data)

          router.push(state.reroute || { name: 'ox-home' })
          state.reroute = undefined
          dispatch('initSocket')
        })
        .catch(() => { }) // swallows your errors
    },

    // IN CASE YOU HATE OUR APP
    deleteAccount({ commit, dispatch }) {
      api.delete('users/')
        .then(() => {
          commit('setOx', {})
          router.push({ name: 'login' })
        })
        .catch(error => dispatch('newSnackbar', error))
    },

    // SOCKS???
    initSocket({ commit, dispatch, state, getters }) {
      if (!getters.loggedIn) {
        return;
      }
      socket = io('//localhost:3000')

      socket.on('connected', () => {
        // console.log('connected to socket')
        socket.emit('setUser', state.ox)
        // console.log('sent ox to socket')
      })

      socket.on('parties', parties => {
        commit('setParties', parties)
        // console.log('got parties from socket')
      })

      socket.on('party', party => {
        commit('setParties', [...state.parties, party])
        commit('setActiveParty', party)
        router.push({ name: 'party-code' })
        // console.log('got new party from socket')
      })

      socket.on('errorOccurred', error => {
        dispatch('newSnackbar', error)
        // console.log('[SOCKET ERROR]', error)
      })
    },

    newParty(context, partyData) {
      // console.log(partyData)
      let memberLimit = parseInt(partyData.limit)
      if (!memberLimit) {
        memberLimit = Number.MAX_SAFE_INTEGER
      }

      socket.emit('newParty', {
        name: partyData.name,
        memberLimit
      })
    }
  }
})
