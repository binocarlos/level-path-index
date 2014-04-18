var pull  = require('pull-stream')
var cat   = require('pull-cat')
var uniquecombine = require('pull-unique-combine')
var pl    = require('pull-level')
var utils = require('./utils')

module.exports = function(db, indexDb, opts){
  
  var splitterEndReplace = new RegExp(opts.splitter + '$')

  var api = {
  	searchSource:searchSource,
  	idThrough:idThrough,
  	documentThrough:documentThrough
  }

  function singleSearch(mode, path, query){

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

    var explained = utils.explain(query)

    if(explained.length>0){

      // a concat stream of pull streams thanks to dominic tarr the stream-master!
      return cat(explained.map(function(param){
        return singleSearch(mode, path, {
          field:param.field,
          value:param.value
        })
      }))

    }
    else{

      return singleSearch(mode, path);

    }
  }

  function idThrough(query){

    var explained = utils.explain(query)

    // the number of hits a document must get to match to whole query (path + multiple values)
    var queryCount = explained.length//Object.keys(query || {}).length

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

  return api
}