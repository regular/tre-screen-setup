#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const TrackStation = require('./track-station')
const watch = require('mutant/watch')
const argv = require('minimist')(process.argv.slice(2))

if (argv._.length<1) {
  console.error(`USAGE: track-station CONFIGFILE`)
  process.exit(1)
}

const config = JSON.parse(fs.readFileSync(argv._[0]))
const path = config.path || resolve(argv._[0], '../.tre')
if (!path) {
  console.error('config.path not set in', config.config)
  process.exit(1)
}

const keys = ssbKeys.loadSync(join(path, 'secret'))
if (!keys) {
  console.error('secret not found in', path)
  process.exit(1)
}

showScreens(config, keys)

function showScreens(conf, keys) {
  ssbClient(keys, Object.assign({},
    conf,
    {
      manifest: {
        whoami: 'async',
        revisions: {
          messagesByType: 'source',
          heads: 'source'
        }
      }
    }
  ), (err, ssb) => {
    if (err) {
      console.error(err.message)
      process.exit(1)
    }
    const trackStation = TrackStation(ssb)
    const station = trackStation()
    watch(station, kv => {
      if (!kv) {
        console.log('No station selected')
        return
      }
      const screens = kv.value.content.screens
      if (!screens) {
        console.log('No screens defined in station')
        return
      }
      console.log('\nNew Screen Setup:')
      screens.forEach( (s, i)=>{
        console.log(`- #${i}: ${s.width}x${s.height} rotate: ${s.rotate||'No'}`)
      })
    })
  })
}

