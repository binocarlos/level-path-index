var level    = require('level-test')()
var sublevel = require('level-sublevel')
var through = require('through')
var pull = require('pull-stream')

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
    {key: '/uk/south/east/london', value: {name:'London', size: 'large', foo: {tags: ['orange', 'peach']}}, type: 'put'},
    {key: '/uk/north/east/newcastle', value: {name:'Newcastle', size: 'medium', foo: {tags: ['pineapple', 'pear']}}, type: 'put'},
    {key: '/uk/north/west/liverpool', value: {name:'Liverpool', size: 'small', foo: {tags: ['pear', 'apple']}}, type: 'put'}
  ], function (err, batch) {
    if(err) throw err

    t.equal(batch.length, 44)

    t.equal(batch[0].key, '/uk/south/west/bristol')
    t.equal(batch[10].key, 'ÿindexÿcv~size~medium~/city~_cv~/uk/south/west/bristol')
    t.equal(batch[11].key, '/uk/south/east/london')


    console.log(batch.length);

/*
    console.dir(batch.map(function(b){
      return b.key
    }));
*/

    t.end()
  })
})


tape('descendent pull stream with no query', function (t) {


  var arr = [];

  pull(
    tree.descendentPullStream('/uk/north'),
    pull.collect(function(err, docs){
      if(err) throw err
      t.equal(docs.length, 2);
      t.equal(docs[0].value.name, 'Newcastle')
      t.equal(docs[0].key, '/uk/north/east/newcastle')
      t.equal(docs[1].value.name, 'Liverpool')
      t.equal(docs[1].key, '/uk/north/west/liverpool')

      t.end()
      
    })
  )
})


tape('descendent normal stream with no query', function (t) {

  var docs = [];

  tree.descendentStream('/uk').pipe(through(function(doc){
    docs.push(doc)
  }, function(err){
    if(err) throw err
    t.equal(docs.length, 4);

    t.equal(docs[0].value.name, 'Newcastle')
    t.equal(docs[0].key, '/uk/north/east/newcastle')
    t.equal(docs[1].value.name, 'Liverpool')
    t.equal(docs[1].key, '/uk/north/west/liverpool')
    t.equal(docs[2].value.name, 'London')
    t.equal(docs[2].key, '/uk/south/east/london')
    t.equal(docs[3].value.name, 'Bristol')
    t.equal(docs[3].key, '/uk/south/west/bristol')
    t.end()
    
  }))

})


tape('descendent with single query', function (t) {


  var arr = [];

  pull(
    tree.descendentPullStream('/uk/south', {
      tag:'pear'
    }),
    pull.collect(function(err, docs){

      if(err) throw err
      t.equal(docs.length, 1);
      t.equal(docs[0].value.name, 'Bristol')
      t.equal(docs[0].key, '/uk/south/west/bristol')

      t.end()

    })
  )
})

tape('descendent with multiple query', function (t) {

  pull(
    tree.descendentPullStream('/uk', {
      tag:'pear',
      size:'medium'
    }),
    pull.collect(function(err, docs){
      if(err) throw err
      t.equal(docs.length, 2)
      t.equal(docs[0].value.name, 'Newcastle')
      t.equal(docs[0].key, '/uk/north/east/newcastle')
      t.equal(docs[1].value.name, 'Bristol')
      t.equal(docs[1].key, '/uk/south/west/bristol')

      t.end()

    })
  )
})

tape('descendent id normal stream', function (t) {
  var arr = [];
  tree.descendentKeyStream('/').pipe(through(function(k){
    arr.push(k);
  }, function(err){
    if(err) throw err
    t.equal(arr.length, 4);
    t.equal(arr[0], '/uk/north/east/newcastle')
    t.equal(arr[1], '/uk/north/west/liverpool')
    t.equal(arr[2], '/uk/south/east/london')
    t.equal(arr[3], '/uk/south/west/bristol')
    t.end()
  }))
})


tape('descendent id pull stream', function (t) {

  pull(
    tree.descendentKeyPullStream('/', {
      size:'medium'
    }),
    pull.collect(function(err, docs){
      if(err) throw err
      t.equal(docs.length, 2);
      t.equal(docs[0], '/uk/north/east/newcastle')
      t.equal(docs[1], '/uk/south/west/bristol')
      t.end()
    })
  )

})