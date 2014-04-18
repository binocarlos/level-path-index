var level    = require('level-test')()
var sublevel = require('level-sublevel')
var through = require('through')
var pull = require('pull-stream')

var tape     = require('tape')
var pathindexer   = require('../')

var db = sublevel(level('level-path-index--multiplefieldsearch', {encoding: 'json'}))

var treeindex = pathindexer(db, '_treeindex', function(key, obj, emit){
  
  (obj.colors || []).forEach(function(color){
    emit(key, 'color', color)
  })

  emit(key, 'name', obj.name)

})

tape('init', function (t) {

  treeindex.batch([{
    type:'put',
    key:'/home/rodney/catpictures/goofycat.jpg',
    value:{
      name:'goofy 1',
      colors:['red', 'blue'],
      description:'this cat crazy ass stoopid',
      otherstuff:'...'
     }
  }, {
    type:'put',
    key:'/home/rodney/shoppinglist/catfood.txt',
    value:{
      name:'cat yum yums',
      colors:['red', 'yellow'],
      description:'wot I needs to feeds the feline overlord',
      otherstuff:'...'
    }
  }], function(err, batch) {

    console.dir(batch.map(function(b){
      return b.key
    }));

    t.equal(batch.length, 18)

    t.equal(batch[0].key, '/home/rodney/catpictures/goofycat.jpg')
    t.equal(batch[2].key, 'ÿ_treeindexÿcv~color~red~/home/rodney/catpictures/~_cv~goofycat.jpg')
    t.equal(batch[5].key, 'ÿ_treeindexÿdt~/home/rodney/catpictures/goofycat.jpg/')
    
    console.log(batch.length);

    t.end();

  })


})



tape('match a search with multiple values for the same field', function (t) {

  pull(
    treeindex.descendentPullStream('/home', {
      color:['red', 'blue'],
      name:'goofy 1'
    }),
    pull.collect(function(err, docs){
      if(err) throw err

      t.equal(docs.length, 1);
      t.equal(docs[0].key, '/home/rodney/catpictures/goofycat.jpg')

      t.end()
      
    })
  )
})

