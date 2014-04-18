level-path-index
================

![Build status](https://api.travis-ci.org/binocarlos/level-path-index.png)

index properties of items that live in a tree of materialized paths - using [levelup](https://github.com/rvagg/node-levelup)

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

	// index multiple values for one field
	(obj.colors || []).forEach(function(color){

		// emit the 'path', 'field' and 'value'
		emit(key, 'color', color)
	})

	emit(key, 'name', obj.name)
})
```

Then stick some data in your leveldb:

```js
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
}], function(err) {

	// data and indexes are inserted!

})
```

Now we can search for things that match color=red and live somewhere under '/home/rodney':

```js
var through = require('through');

treeindex.descendentStream('/home/rodney', {
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

You can also find direct children of an entry and use multiple clauses to your query:

```js
treeindex.childStream('/home/rodney/catpictures', {
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

## index structure

In a single query step - there are 3 parts in the combined index:

 * fieldname
 * value
 * tree location

Assuming this question:

```
find all descendents of '/a' where the color is red
```

Then we have:

 1. fieldname (color)
 2. value (red)
 3. tree location (/a/b/c)

If we create the index in this strict order then the key would become:

```
color~red~/a/b/c
```

### descendent query

The first part of the query is ok - color=red - this would mean leveldb range like this:

```js
{
	start:'dv~color~red~',
	end:'dv~color~red~\xff'
}
```

Because we are doing a (d)escendent query with some (v)alues - the key is prepended with 'dv'

Now to include the path - we are looking below '/a' - we add the splitter '/' on the end and the level range becomes:

```
{
	start:'dv~color~red~/a/',
	end:'dv~color~red~/a/\xff'
}
```

This would match our item - which is living 2 layers below (in '/a/b/c')

### child query

Children is slightly different - to make child request fast an extra index is created.

This avoids loading all descendents of a top level node when all you want are its children.

The child index works by seperating the parent path from the node path.

For our example (color~red~/a/b/c) the following index would also be created:

```
cv~color~red~/a/b/~_~c
```

The child value indexes are prepended with 'cv'.

The split between the parent and child path means we can ask for children of '/a/b' and only the direct children are loaded.

```
{
	start:'cv~color~red~/a/b/~_~',
	end:'cv~color~red~/a/b/~_~\xff'
}
```

This would match '/a/b/c' (cv~color~red~/a/b/~_~c) as a direct child

### Empty queries

You can also load descendents and children with a blank query - a seperate index for empty queries is used - the key for our example is simply:

```
/a/b/c
```

So if we just wanted descendents of '/a/b' we can use this range:

```js
{
	start:'dt~/a/b/',
	end:'dt~/a/b/\xff'
}
```

The empty query indexes (t)ree for descendents are prepended with 'dt' and for children 'ct'

## api

### pathindex(db, [indexdb], mapper(key, value, emit))

Pass the document database, optionally the name/sublevel for the indexes and a mapper function that will index each document as it is updated

the mapper is run with the key and value of the update and an emit function.

emit is a function with a (path, field, value) signature and be called multiple times to add an index to the document.

```js
var tree = pathindex(mydb, function(key, value, emit){
	emit(value.path, 'type', value.type)
	emit(value.path, 'capital', value.capital)
})

```

### index.save(key, value, callback)

Insert a value for a key and create the indexes based on your mapper function.

```js
tree.save('/uk/south/west/bristol, {
	name:'Bristol',
	type:'city',
	size:'medium'
}, function(err){
	
})
```

### index.batch(arr, callback)

Insert an array of documents - this must be a list of leveldb batch commands e.g.:

```js
tree.batch([
  {key: '/uk/south/west/bristol', value: {name:'Bristol', size: 'medium'}}, type: 'put'},
  {key: '/uk/south/east/london', value: {name:'London', size: 'large'}}, type: 'put'},
  {key: '/uk/north/east/newcastle', value: {name:'Newcastle', size: 'medium'}}, type: 'put'},
  {key: '/uk/north/west/liverpool', value: {name:'Liverpool', size: 'medium'}}, type: 'put'}
], function (err, batch) {

})
```

### index.descendentStream(path, searchTerms)

Return a read stream for entries that live at or below the given path:

```js
tree.descendentStream('/uk/north', {
	size:'medium'
}).pipe(through(function(doc){
	console.dir(doc.key);
}))

// /uk/north/east/newcastle
// /uk/north/west/liverpool
```

You can use multiple search terms and the values can be lists which all must match:

```js
tree.descendentStream('/uk', {
	size:'medium',
	tags:['red','yellow']
}).pipe(through(function(){
	
}))
```

### index.childStream(path, searchTerms)

This is the same as descendent stream but for entries directly below the given path:

```js
tree.childStream('/uk/south/west').pipe(through(function(val){
	console.dir(val.path);
}))

// /uk/south/west/bristol
```

### index.descendentKeyStream(path, searchTerms)

This is the same as descendent stream but will return only the keys of the matched items

```js
tree.descendentKeyStream('/uk/south').pipe(through(function(val){
	console.dir(val);
}))

// /uk/south/west/bristol
// /uk/south/east/london
```

### index.childKeyStream(path, searchTerms)

This is the same as child stream but will return only the keys of the matched items

```js
tree.childKeyStream('/uk/south/west').pipe(through(function(val){
	console.dir(val);
}))

// /uk/south/west/bristol
```

## pull streams

Each of the 4 read stream methods also come with [pull-stream](https://github.com/dominictarr/pull-stream) equivalents

### index.descendentPullStream(path, searchTerms)

### index.descendentKeyPullStream(path, searchTerms)

### index.childPullStream(path, searchTerms)

### index.childKeyPullStream(path, searchTerms)

## license

MIT
