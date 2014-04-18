var pull  = require('pull-stream')
var updateindex = require('level-index-update')
var toStream = require('pull-stream-to-stream')
var utils = require('./utils')

var Api = require('./api')

module.exports = PathIndex;

function PathIndex(db, indexDb, opts) {

  if(arguments.length<=2){
    opts = indexDb
    indexDb = null
  }

  if(typeof(opts)==='function'){
    opts = {
      mapper:opts
    }
  }

  if(!opts){
    opts = {}
  }

  var mapper = opts.mapper;

  if(!mapper)
    throw new Error('mapper function must be provided');

  if(!opts.splitter)
    opts.splitter = '/'
    
  if(!indexDb)
    indexDb = 'pathindex' //default to name of this module.

  if('string' === typeof indexDb)
    indexDb = db.sublevel(indexDb)

  var treeindex = updateindex(db, indexDb, function(key, value, emit, type){

    mapper(key, value, function(path, field, fieldvalue){

      path = path || ''
      var parts = path.split(opts.splitter)

      var nodename = parts.pop()
      var parentpath = parts.join(opts.splitter)

      // descendent tree
      emit(['dt', key + opts.splitter], true)

      // child tree
      emit(['ct', parentpath + opts.splitter, '_ct', nodename], true)

      // descendent tree with values
      emit(['dv', field, fieldvalue, key + opts.splitter], true)

      // child tree with values
      emit(['cv', field, fieldvalue, parentpath + opts.splitter, '_cv', nodename], true)
    })
  })

  treeindex.manifest = {
    methods: {
      save: { type: 'async' },
      batch: { type: 'async' },
      descendentStream: { type: 'readable' },
      childStream: { type: 'readable' },
      descendentKeyStream: { type: 'readable' },
      childKeyStream: { type: 'readable' }
    }
  }

  var api = Api(db, indexDb, opts)


  treeindex.descendentPullStream = function descendentStream(path, query){
    var source = api.searchSource('d', path, query)
    var through = api.documentThrough(query)

    return pull(source, through)
  }

  treeindex.descendentKeyPullStream = function descendentKeyStream(path, query){
    var source = api.searchSource('d', path, query)
    var through = api.idThrough(query)

    return pull(source, through)
  }

  treeindex.childPullStream = function childStream(path, query, opts){
    var source = api.searchSource('c', path, query)
    var through = api.documentThrough(query)

    return pull(source, through)
  }

  treeindex.childKeyPullStream = function childKeyStream(path, query){
    var source = api.searchSource('c', path, query)
    var through = api.idThrough(query)

    return pull(source, through)
  }

  treeindex.descendentStream = function descendentStream(path, query){
    return toStream(null, treeindex.descendentPullStream(path, query))
  }

  treeindex.descendentKeyStream = function descendentKeyStream(path, query){
    return toStream(null, treeindex.descendentKeyPullStream(path, query))
  }

  treeindex.childStream = function childStream(path, query){
    return toStream(null, treeindex.childPullStream(path, query))
  }

  treeindex.childKeyStream = function childKeyStream(path, query){
    return toStream(null, treeindex.childKeyPullStream(path, query))
  }

  return treeindex

}

