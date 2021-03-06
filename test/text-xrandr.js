const test = require('tape')
const xrandr = require('../xrandr')
const from = require('from2-string')

test('parses xrandr output correctly', t=>{
  const xrandrCalls = [];

  function x(content, opts, cb) {
    xrandr([], Object.assign({
      xrandrPath: 'myXrandr',
      spawn: (command, args) => {
        if (command === 'myXrandr') {
          xrandrCalls.push(args)
        }
        t.equal(command, 'myXrandr', 'Should use specified command')
        return {
          stdout: from(content)
        };
      }
    }, opts), cb)
  }

  t.test('bogus xrandr output', t=> {
    x(`bla
bla
bla
` , {}, (err, screens) => {
      t.error(err)
      t.end()
    })
  })

  t.test('valid xrandr output', t=>{
    x(`
name3 connected 333x444+555+666
name1 connected 1x1+0+0
name2 connected primary 2x2+1+1
name4 connected 444444x555555-66-77
`   , {}, (err, screens) => {
      t.notOk(err)
      t.deepEqual(screens, [
        { name: 'name1',
          xres: 1, 
          yres: 1, 
          left: 0, 
          top: 0 },
        { name: 'name2',
          xres: 2,
          yres: 2,
          left: 1,
          top: 1 },
        { name: 'name3',
          xres: 333,
          yres: 444,
          left: 555,
          top: 666 },
        { name: 'name4',
          xres: 444444,
          yres: 555555,
          left: -66,
          top: -77 }
      ]);
      t.end()
    })
  })
})
