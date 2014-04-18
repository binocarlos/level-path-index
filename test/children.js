var level    = require('level-test')()
var sublevel = require('level-sublevel')
var through = require('through')
var pull = require('pull-stream')

var tape     = require('tape')
var pathindexer   = require('../')

var db = sublevel(level('level-path-index--children', {encoding: 'json'}))

var tree = pathindexer(db, 'index', function(key, obj, emit){
  emit(key, 'size', obj.size)

  var arr = obj.foo.tags || [];

  arr.forEach(function(t){
    emit(key, 'tag', t);
  })
})

tape('init', function (t) {
  tree.batch([
    {key: '/uk/south/west/bristol', value: {name:'Bristol', size: 'medium', foo: {tags: ['apple', 'pear']}}, type: 'put'},
    {key: '/uk/south/west/bath', value: {name:'Bath', size: 'small', foo: {tags: ['orange', 'peach']}}, type: 'put'},
    {key: '/uk/south/west/gloucester', value: {name:'Gloucester', size: 'medium', foo: {tags: ['pineapple', 'pear']}}, type: 'put'},
    {key: '/uk/south/west/bristol/subfolder', value: {name:'Sub Folder', size: 'tiny', foo: {tags: ['pear', 'apple']}}, type: 'put'},
    {key: '/uk/south/west', value: {name:'Actual Folder', size: 'tiny', foo: {tags: ['pear', 'apple']}}, type: 'put'},
    {key: '/uk/south/west/bath/subfolder2', value: {name:'Sub Folder2', size: 'tiny', foo: {tags: ['pear', 'apple']}}, type: 'put'}
  ], function (err, batch) {
    if(err) throw err


    console.dir(batch.map(function(b){
      return b.key
    }));

    t.equal(batch.length, 54)

    t.equal(batch[0].key, '/uk/south/west/bristol')
    t.equal(batch[4].key, 'ÿindexÿcv~tag~apple~/uk/south/west/~_cv~bristol')
    t.equal(batch[25].key, 'ÿindexÿdv~tag~pear~/uk/south/west/gloucester/')
    t.equal(batch[44].key, 'ÿindexÿcv~tag~apple~/uk/south/~_cv~west')
    
    console.log(batch.length);


    t.end()
  })
})


tape('child pull stream with no query', function (t) {


  var arr = [];

  pull(
    tree.childPullStream('/uk/south/west'),
    pull.collect(function(err, docs){
      if(err) throw err

      t.equal(docs.length, 3);
      t.equal(docs[0].value.name, 'Bath')
      t.equal(docs[0].key, '/uk/south/west/bath')
      t.equal(docs[1].value.name, 'Bristol')
      t.equal(docs[1].key, '/uk/south/west/bristol')
      t.equal(docs[2].value.name, 'Gloucester')
      t.equal(docs[2].key, '/uk/south/west/gloucester')

      t.end()
      
    })
  )
})

tape('child normal stream with no query', function (t) {

  var docs = [];

  tree.childStream('/uk/south/west').pipe(through(function(doc){
    docs.push(doc)
  }, function(err){
    if(err) throw err

     
      t.equal(docs.length, 3);
      t.equal(docs[0].value.name, 'Bath')
      t.equal(docs[0].key, '/uk/south/west/bath')
      t.equal(docs[1].value.name, 'Bristol')
      t.equal(docs[1].key, '/uk/south/west/bristol')
      t.equal(docs[2].value.name, 'Gloucester')
      t.equal(docs[2].key, '/uk/south/west/gloucester')

    t.end()
    
  }))

})



tape('child with single query', function (t) {


  var arr = [];

  pull(
    tree.childPullStream('/uk/south/west', {
      tag:'pear'
    }),
    pull.collect(function(err, docs){

      if(err) throw err

      t.equal(docs.length, 2);
      t.equal(docs[0].value.name, 'Bristol')
      t.equal(docs[0].key, '/uk/south/west/bristol')
      t.equal(docs[1].value.name, 'Gloucester')
      t.equal(docs[1].key, '/uk/south/west/gloucester')

      t.end()

    })
  )
})



tape('child with multiple query', function (t) {

  pull(
    tree.childPullStream('/uk/south/west', {
      tag:'pear',
      size:'medium'
    }),
    pull.collect(function(err, docs){
      if(err) throw err
  
      t.equal(docs.length, 2);
      t.equal(docs[0].value.name, 'Bristol')
      t.equal(docs[0].key, '/uk/south/west/bristol')
      t.equal(docs[1].value.name, 'Gloucester')
      t.equal(docs[1].key, '/uk/south/west/gloucester')
      t.end()

    })
  )
})

tape('child id normal stream', function (t) {
  var arr = [];
  tree.childKeyStream('/uk/south/west').pipe(through(function(k){
    arr.push(k);
  }, function(err){
    if(err) throw err

    t.equal(arr.length, 3);
    t.equal(arr[0], '/uk/south/west/bath')
    t.equal(arr[1], '/uk/south/west/bristol')
    t.equal(arr[2], '/uk/south/west/gloucester')
    t.end()
  }))
})

tape('child id pull stream', function (t) {

  pull(
    tree.childKeyPullStream('/uk/south/west', {
      size:'medium'
    }),
    pull.collect(function(err, docs){
      if(err) throw err


      t.equal(docs.length, 2);
      t.equal(docs[0], '/uk/south/west/bristol')
      t.equal(docs[1], '/uk/south/west/gloucester')
      t.end()
    })
  )

})