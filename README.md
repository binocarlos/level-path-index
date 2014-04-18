level-path-index
================

![Build status](https://api.travis-ci.org/binocarlos/level-path-index.png)

index properties of items that live in a tree of materialized paths

## installation

```
$ npm install level-path-index
```

## what it does

Indexes key=value properties of an object against a materialised path so you can ask things like:

 * match all items that match 'color=red' and are descendents of /home/rodney
 * match all items that are direct children of /home/rodney

## example

```js
var level = require('level');
var sub = require('level-sublevel');
var pathindex = require('level-path-index');

var db = sub(level(__dirname + '/pathdb', {
	 valueEncoding: 'json'
}))

var treedb = db.sublevel('folders')

var treeindex = pathindex(treedb, '_treeindex', function(key, value, emit){

	// emit the 'path', 'field' and 'value'
	emit(key, 'name', obj.name)

	// index multiple values for one field
	(obj.colors || []).forEach(function(color){
		emit(key, 'color', color)
	})

	// you can make funky symlinks by emitting a different path
	emit('/my/symlink', 'color', 'purple')
})
```

Then stick some data in your leveldb:

```js
treeindex.batch([{
	type:'put',
	key:'/home/rodney/catpictures/goofycat.jpg'
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
}], function(err) {

	// data and indexes are inserted!

})
```

Now we can search for things that match color=red and live somewhere under '/home/rodney':

```js
var through = require('through');

treeindex.descendents('/home/rodney/', {
	color:'red'
}).pipe(through(function(doc){
	console.dir(doc);
}))

/*
{
	name:'goofy 1',
	colors:['red', 'blue'],
	...
}
{
	name:'cat yum yums',
	colors:['red', 'yellow'],
	...
}

*/
```

Be sure to add the trailing '/' otherwise '/home/rodney2' would match.

You can also find direct children of an entry and use multiple clauses to your query:

```js
treeindex.children('/home/rodney/catpictures/', {
	color:'red',
	name:'goofy 1'
}).pipe(through(function(doc){
	console.dir(doc);
}))

/*
{
	name:'goofy 1',
	colors:['red', 'blue'],
	...
}
*/
```

## api

### pathindex(db, mapper(key, value, emit))

Return an indexer that uses the mapper function to emit indexed values for each put.

emit is a function with a (path, field, value) signature and be called multiple times.

```js
var index = pathindex(mydb, function(key, value, emit){
	emit(value.path, 'type', value.type)
	emit(value.path, 'capital', value.capital)
})

mydb.save(12, {
	path:'uk.south.west.bristol',
	type:'city',
	capital:'n'
}, function(){
	mydb.put(13, {
		path:'uk.south.east.london',
		type:'city',
		capital:'y'
	})
})
```

### index.save(key, values, callback)

Insert a value for a key and create the indexes based on your mapper function.

### index.batch(arr, callback)

Insert an array of documents - this must be a list of leveldb batch commands e.g.:

```js
[{
	type:'put',
	key:'/thing/to/put',
	value:{a:10}
},{
	type:'del',
	key:'/thing/to/remove'
}]
```

### index.descendentStream(path, searchTerms)

Return a read stream for entries that live at or below the given path:

```js
index.descendentStream('uk.south').pipe(through(function(val){
	console.dir(val.path);
}))

// uk.southwest.bristol
// uk.southeast.london
```

The descendent read stream can match field values using the searchTerms object:

```js
index.descendentStream('uk.south', {
	type:'city',
	capital:'y'
}).pipe(through(function(val){
	console.dir(val.path);
}))

// uk.southeast.london
```

### index.childStream(path, searchTerms)

This is the same as descendent stream but for entries directly below the given path:

```js
index.childStream('uk.south.west').pipe(through(function(val){
	console.dir(val.path);
}))

// uk.south.west.bristol
```

### index.descendentKeyStream(path, searchTerms)

This is the same as descendent stream but will return only the keys of the matched items

```js
index.descendentKeyStream('uk.south.west').pipe(through(function(val){
	console.dir(val);
}))

// uk.south.west.bristol

```

### index.childKeyStream(path, searchTerms)

This is the same as child stream but will return only the keys of the matched items

```js
index.childKeyStream('uk.south.west').pipe(through(function(val){
	console.dir(val);
}))

// uk.south.west.bristol

```

## license

MIT
