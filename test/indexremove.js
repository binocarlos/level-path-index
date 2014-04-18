var level    = require('level-test')()
var sublevel = require('level-sublevel')
var through = require('through')
var pull = require('pull-stream')

var tape     = require('tape')
var pathindexer   = require('../')

var db = sublevel(level('level-path-index--indexremove', {encoding: 'json'}))

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
    {key: '/uk/south/west/gloucester', value: {name:'Gloucester', size: 'medium', foo: {tags: ['pineapple', 'pear']}}, type: 'put'}
  ], function (err, batch) {
    if(err) throw err

    console.dir(batch.map(function(b){
      return b.key
    }));

    console.log(batch.length);
    
    t.end()
  
  })
})


tape('not match the removed things', function (t) {

  var arr = [];

  pull(
    tree.descendentPullStream('/uk/south', {
      tag:'orange'
    }),
    pull.collect(function(err, docs){
      if(err) throw err

      t.equal(docs.length, 1)
      t.equal(docs[0].key, '/uk/south/west/bath')

      tree.batch([
        {key:'/uk/south/west/bath', type:'del'}
      ], function(err, batch){

        pull(
          tree.descendentPullStream('/uk/south', {
            tag:'orange'
          }),
          pull.collect(function(err, docs){
            if(err) throw err

            t.equal(docs.length, 0)
            t.end()
          })
        )
      })

    })
  )
  
})