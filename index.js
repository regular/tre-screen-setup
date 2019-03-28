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

const onScreenConfigChanged = debounce(function(stage, screens, input) {
  const done = multicb({pluck:1, spread: true})
  const inputRotation = input && input.rotate || 'normal'
  rotateInput(inputRotation, done())
  xrandr([], {}, done())

  const DEFAULT = {
    rotate: 'normal',
    ox: 0,
    oy :0
  }

  done((err, inputCmds, outputs) => {
    const output_cmds = outputs.map( (o, i)=>{
      const s = Object.assign({}, DEFAULT, screens[i] || {})
      let c = ''
      c += `--output ${o.name}`
      c += ` --mode ${s.width || o.xres}x${s.height || o.yres}`
      c += ` --rotate ${s.rotate}`
      c += ` --pos ${s.ox || o.left}x${s.oy || o.top}`
      if (s.rate) c += ` --rate ${s.rate}`
      if (s.reflect) c += ` --reflect ${s.reflect}`
      if (s.brightness) c += ` --brightness ${s.brightness}`
      if (s.gammaRGB && s.gammaRGB.length == 3) {
        c+=' --gamma ' + s.gammaRGB.map(x => Number(x) || 1).join(':')
      } 
      return c
    })
    const stage_cmds = []
    if (stage.width && stage.height) {
      stage_cmds.push(`--fb ${stage.width}x${stage.height}`)
    }
    const cmds = stage_cmds.concat(output_cmds)
    console.log(`${inputCmds}\nxrandr ${cmds.join(' ')}`)
    
    // move mouse out of sight
    console.log(`xdotool mousemove ${stage.width || 1920} ${stage.height || 1080}`)
    
    if (restart) console.log(restart)
  })
}, 1000)

if (argv._.length<1) {
  console.error(`USAGE: tre-screen-setup --restart RESTARTCOMMAND SSBCONFIGFILE`)
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
        onScreenConfigChanged({}, [], {})
        return
      }
      const stage = kv.value.content.stage
      const screens = kv.value.content.screens
      const input = kv.value.content.input
      onScreenConfigChanged(stage || {}, screens || [], input || {})
    })
  })
}

