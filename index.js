#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const TrackStation = require('./track-station')
const watch = require('mutant/watch')
const xrandr = require('./xrandr')
const debounce = require('debounce')
const debug = require('debug')('tre-screen-setup')
const rotateInput = require('rotate-pointer-devices')
const multicb = require('multicb')
const argv = require('minimist')(process.argv.slice(2))

const {restart} = argv

const onScreenConfigChanged = debounce(function(screens, input) {
  const done = multicb({pluck:1, spread: true})
  const inputRotation = input && input.rotate || 'normal'
  rotateInput(inputRotation, done())
  xrandr([], {}, done())

  done((err, inputCmds, outputs) => {
    const cmds = outputs.map( (o, i)=>{
      s = screens[i] || {rotation: 'normal'}
      return `--output ${o.name} --size ${s.width || o.xres}x${s.height || o.yres} --rotate ${s.rotate||'normal'}`
    })
    console.log(`${inputCmds}\nxrandr ${cmds.join(' ')}`)
    if (restart) console.log(restart)
  })
}, 1000)

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
        debug('No station selected')
        onScreenConfigChanged([], {})
        return
      }
      const screens = kv.value.content.screens
      const input = kv.value.content.input
      onScreenConfigChanged(screens || [], input || {})
    })
  })
}

