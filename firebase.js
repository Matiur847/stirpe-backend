const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const credentials = require('./key.json')

initializeApp({
    credential: cert(credentials)
})

const db = getFirestore();

module.exports = { db }