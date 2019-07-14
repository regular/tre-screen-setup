const pull = require('pull-stream')
const collectMutations = require('collect-mutations')
const WatchMerged = require('tre-prototypes')
const MutantMap = require('mutant/map')
const MutantArray = require('mutant/array')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const h = require('mutant/html-element')
const debug = require('debug')('track-station')

module.exports = function TrackStation(ssb) {
  const feedId = Value()
  const watchMerged = WatchMerged(ssb)
  ssb.whoami((err, feed)=>{
    if (err) return console.error(err.message)
    debug('feedis is', feed.id)
    feedId.set(feed.id)
  })

  function trackRole() {
    debug('trackRoles')
    const msgs = MutantArray()
    const o = {sync: true, live: true}
    const drain = collectMutations(msgs, o)
    pull(
      ssb.revisions.messagesByType('role', o),
      pull.through( x =>{
        debug('through %O', x)
      }),
      drain
    )
    const current = computed([feedId, msgs], (id, msgs) => {
      // find messages about us
      const aboutUs = msgs.filter(kv => {
        return kv && kv.value.content.about == id
      })
      // sort by timestamp
      const sorted = aboutUs.sort((a,b) => b.value.timestamp - a.value.timestamp)
      const station = sorted[0] && sorted[0].value.content.station
      debug('current station', station)
      return sorted[0] || null
    })
    current.abort = drain.abort
    return current
  } 

  return function trackStation() {
    debug('trackStation')
    const roleKv = trackRole()
    const ret = computed(roleKv, kv => {
      const station = kv && kv.value.content.station
      if (!station) return null
      return watchMerged(station, {allowAllAuthors: true})
    })
    ret.abort = roleKv.abort
    return ret
  }
}

