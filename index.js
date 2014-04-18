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

  var treeindex = updateindex(db, indexDb, function(key, value, emit, type){

    var seen = {};

    function addkey(arr){
      var key = arr.join('~')
      if(!seen[key]){
        seen[key] = arr
        emit(arr, true)
      }
      
    }

    mapper(key, value, function(path, field, fieldvalue){

      path = path || ''
      var parts = path.split(opts.splitter)

      var nodename = parts.pop()
      var parentpath = parts.join(opts.splitter)

      // descendent tree
      addkey(['dt', key])

      // child tree
      addkey(['ct', parentpath, '_ct', key])

      // descendent tree with values
      addkey(['dv', field, fieldvalue, key])

      // child tree with values
      addkey(['cv', field, fieldvalue, parentpath, '_cv', key])
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

    parts.push(path);

    if(mode=='c'){
      parts.push(tag)
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

  function search(mode, path, query){

    if(Object.keys(query || {}).length>0){

      // a stream of streams!
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

  // a pull stream that yields the ids of documents that match all terms in our query
  function idStream(mode, path, query){

    // the number of hits a document must get to match to whole query (path + multiple values)
    var queryCount = Object.keys(query || {}).length + 1

    return pull(

      // a pull stream that is a merge of the search streams
      search(mode, path, query),

      // map the document id from the index key
      pull.map(function(entry){
        return entry;
      }),

      // a document only matches if the id has hit all parts of the query
      uniquecombine(queryCount)
    )
  }

  treeindex.descendentStream = function descendentStream(path, query){
    var docpull = idStream('d', path, query);

    //.pipe(documentMapper())
    return toStream(null, docpull)
  }

  treeindex.childStream = function childStream(path, query, opts){
    return toStream(null, idStream('c', path, query).pipe(documentMapper()))
  }

  treeindex.descendentKeyStream = function descendentKeyStream(path, query){
    return toStream(null, idStream('d', path, query))
  }

  treeindex.childKeyStream = function childKeyStream(path, query){
    return toStream(null, idStream('c', path, query))
  }

  return treeindex

}

