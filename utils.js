var utils = module.exports = {
	isPrimitive:function isPrimitive(arg) {
    var type = typeof arg;
    return arg == null || (type != "object" && type != "function");
  },
  // break a query down into an array of instructions
  // this is so we can have multiple values per field in the query
  // and so we know the count for the unique combine filter
  explain:function explain(query){

    var fields = [];

    Object.keys(query || {}).forEach(function(key){
      var val = query[key]
      if(val){
        if(!utils.isPrimitive(val)){
          val.forEach(function(p){
            fields.push({
              field:key,
              value:p
            })
          })
        }
        else{
          fields.push({
            field:key,
            value:val
          })
        } 
      }
    })

    return fields;
  }
}