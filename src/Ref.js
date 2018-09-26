let OrderedList = require('./OrderedList'),
	types = [ 'NONE', 'MAYBE', 'DATA', 'EXEC', 'SUB', 'MAIN' ];

//TODO - Give this it's own iterator
class RefMap {
	constructor(){
		this.data = new Map();
		this.NameToIndex = new Map();
		this.IndexToName = new Map();
		this.OrderedNames = new OrderedList( x => x.addr );
		this.doTrack = false;
		this.trackedAddresses = new Set();
	}
	// To find the address before the given address 
	findPrev(addr){
		let prev = null;
		
		// Iterate through until the given address is found or passed
		for(let data of this.OrderedNames){
			if( data.addr >= addr ){
				break;
			}
			prev = data;
		}		
		
		return prev;
	}
	// To link the name to index and vice versa
	// A single address can have multiple names, so store as a list
	link( name, index ){
		if( this.IndexToName.has(index) ){
			let list = this.IndexToName.get(index);
			if( list.length === 0 ){
				// If this is the first name being added, then add it to the OrderedNames list
				this.OrderedNames.add({ addr : index, name });
			}
			if( list.indexOf(name) === -1 ){
				list.push(name);
			}
		}
		else{
			this.IndexToName.set( index, [name] );
			this.OrderedNames.add({ addr : index, name });
		}
		this.NameToIndex.set(name, index);
	}
	getLink( index ){
		if( this.IndexToName.has(index) ){
			return this.IndexToName.get(index);
		}
		else{
			let list = [];
			this.IndexToName.set(index, list);
			return list;
		}
	}
	beginTracking(){
		this.doTrack = true;
	}
	isNew( addr ){
		return this.trackedAddresses.has(addr);
	}
	// Set the type as Faulty (can never be downgraded to a non-faulty
	setFaulty( addr, type ){
		this.set( addr, type + types.length );
	}
	// Set the type, which can only be upgraded, not downgraded
	set( addr, type ){
		let prev_type = this.get(addr),
			new_type = Math.max( prev_type, type );
		
		// If tracking, and this data has not already been added, then track
		if( this.doTrack && !this.data.has(addr) ){
			this.trackedAddresses.add(addr);
		}
		
		return this.data.set( addr, new_type );
	}
	has( addr ){
		return this.data.has(addr);
	}
	get( addr ){
		return this.data.get(addr) || 0;
	}
	[Symbol.iterator](){
		return this.data[Symbol.iterator]();
	}
}

// Assign the types as attributes
types.forEach( (x,i) => {
	exports[x] = i
	exports['FAULTY_' + x] = i + types.length;
});

// Test whether the given type is faulty
exports.isFaulty = function( type ){
	return type >= types.length;
}

exports.Map = RefMap;