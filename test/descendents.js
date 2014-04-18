var level    = require('level-test')()
var sublevel = require('level-sublevel')
var through = require('through')

var tape     = require('tape')
var pathindexer   = require('../')

var db = sublevel(level('level-path-index--simple', {encoding: 'json'}))

var tree = pathindexer(db, 'index', function(key, obj, emit){
  emit(key, 'size', obj.size)

  var arr = obj.foo.tags || [];

  arr.forEach(function(t){
    emit(key, 'tag', t);
  })

  // test the symlinks!
  emit('/city/' + obj.name, 'size', obj.size)
})

tape('init', function (t) {
  tree.batch([
    {key: '/uk/south/west/bristol', value: {name:'Bristol', size: 'medium', foo: {tags: ['apple', 'pear']}}, type: 'put'},
    {key: '/uk/south/east/london', value: {name:'London', size: 'large', foo: {tags: ['orange', 'pear']}}, type: 'put'},
    {key: '/uk/north/east/newcastle', value: {name:'Newcastle', size: 'medium', foo: {tags: ['pineapple', 'pear']}}, type: 'put'},
    {key: '/uk/north/west/liverpool', value: {name:'Liverpool', size: 'medium', foo: {tags: ['peach', 'apple']}}, type: 'put'}
  ], function (err, batch) {
    if(err) throw err

    t.equal(batch.length, 44)

    t.equal(batch[0].key, '/uk/south/west/bristol')
    t.equal(batch[10].key, 'ÿindexÿcv~size~medium~/city~_cv~/uk/south/west/bristol')
    t.equal(batch[11].key, '/uk/south/east/london')


    console.log(batch.length);

    t.end()
  })
})


tape('descendents with no query', function (t) {
  t.end()

  var arr = [];

  tree
    .descendentStream('/uk/north')
    .pipe(through(function(descendent){
      console.log('-------------------------------------------');
      console.dir(descendent);
    }))

})