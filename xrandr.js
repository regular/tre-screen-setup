const {spawn} = require('child_process')
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')
const split = require('pull-split')

module.exports = function xrandr(args, opts, cb) {
  opts = Object.assign({
    sortFunc: (a, b)=> a.name === b.name ? 0 : (a.name > b.name ? 1 : -1),
    xrandrPath: '/usr/bin/xrandr',
    spawn: spawn,   // used by tests
  }, opts || {})

  const xrandr = opts.spawn(opts.xrandrPath, args)
  if (!xrandr) return cb(new Error('Unable to spawn xrandr'))
  pull(
    toPull(xrandr.stdout),
    pull.map( x=> x.toString() ),
    split(),
    pull.map( l => l.match(/^(.*)\sconnected(?:\sprimary){0,1}\s(\d+)x(\d+)([\+\-]\d+)([\+\-]\d+)/) ),
    pull.filter(),
    pull.map( ([_,name,xres,yres,left,top]) => {
      return {
        name: name.trim(),
        xres: Number(xres),
        yres: Number(yres),
        left: Number(left),
        top: Number(top)
      }
    }),
    pull.collect((err, results) => {
      if (err) return cb(err)
      results.sort(opts.sortFunc)
      cb(null, results)
    })
  )
}
