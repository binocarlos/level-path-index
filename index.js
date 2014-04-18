var pull  = require('pull-stream')
var pl    = require('pull-level')
var cat   = require('pull-cat');
var toStream = require('pull-stream-to-stream')
var updateindex = require('level-index-update')
var uniquecombine = require('pull-unique-combine')

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

  var splitterEndReplace = new RegExp(opts.splitter + '$')

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

  function singlesearch(mode, path, query){

    var tag = query ? mode + 'v' : mode + 't'
    var parts = [tag]

    if(query){
      parts.push(query.field)
      parts.push(query.value)
    }

    path = path.replace(splitterEndReplace, '')
    path += opts.splitter
    parts.push(path)

    if(mode=='c'){
      parts.push('_' + tag)
    }

    var base = parts.join('~')

    return pl.read(indexDb, {
      start:base,
      end:base + '\xff',
      keys:true,
      values:false,
      keyEncoding:'utf8'
    })
  }

  function searchSource(mode, path, query){

    if(Object.keys(query || {}).length>0){

      // a concat stream of pull streams thanks to dominic tarr the stream-master!
      return cat(Object.keys(query).map(function(field){
        return singlesearch(mode, path, {
          field:field,
          value:query[field]
        })
      }))

    }
    else{

      return singlesearch(mode, path);

    }
  }

  function idThrough(query){
    // the number of hits a document must get to match to whole query (path + multiple values)
    var queryCount = Object.keys(query || {}).length

    // map the document id from the index key
    return pull.map(function(entry){

      if(entry.charAt(0)=='d'){
        return entry.split('~').pop().replace(splitterEndReplace, '')
      }
      else{
        var parts = entry.split('~')
        var nodename = parts.pop()
        parts.pop()
        var foldername = parts.pop()
        return foldername + nodename
      }
      
      
    }).pipe(

      // a document only matches if the id has hit all parts of the query
      uniquecombine(queryCount)
    )
  }

  function documentThrough(query){
    return idThrough(query)
      .pipe(pull.asyncMap(function(key, cb){

        db.get(key, function(err, doc){
          if(err)
            return cb(err)

          cb(null, {
            key:key,
            value:doc
          })
        })
        
      }))
  }

  treeindex.descendentPullStream = function descendentStream(path, query){
    var source = searchSource('d', path, query)
    var through = documentThrough(query)

    return pull(source, through)
  }

  treeindex.descendentKeyPullStream = function descendentKeyStream(path, query){
    var source = searchSource('d', path, query)
    var through = idThrough(query)

    return pull(source, through)
  }

  treeindex.childPullStream = function childStream(path, query, opts){
    var source = searchSource('c', path, query)
    var through = documentThrough(query)

    return pull(source, through)
  }

  treeindex.childKeyPullStream = function childKeyStream(path, query){
    var source = searchSource('c', path, query)
    var through = idThrough(query)

    return pull(source, through)
  }

  treeindex.descendentStream = function descendentStream(path, query){
    return toStream(null, this.descendentPullStream(path, query))
  }

  treeindex.descendentKeyStream = function descendentKeyStream(path, query){
    return toStream(null, this.descendentKeyPullStream(path, query))
  }

  treeindex.childStream = function childStream(path, query){
    return toStream(null, this.childPullStream(path, query))
  }

  treeindex.childKeyStream = function childKeyStream(path, query){
    return toStream(null, this.childKeyPullStream(path, query))
  }

  return treeindex

}

