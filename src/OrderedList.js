// List of node sorted by addr property
class OrderedList{
	constructor(){
		this.next = null;
		this.size = 0;
	}
	
	// To see if this list has a node as the provided addr
	has( addr ){
		let node = this;
		
		while( node = node.next ){
			// Since it's ordered, stop when the node addr is later than the addr
			if( addr < node.data.addr ){
				break;
			}
			
			if( node.data.addr === addr ){
				console.log(addr)
				return node.data;
			}
		}
		
		return null;
	}
	
	// To see if this list and it scontents contain the provided addr
	contains( addr ){
		let node = this;
		
		while( node = node.next ){
			
			// Since it's ordered, stop when the node addr is later than the addr
			if( addr < node.data.addr ){
				break;
			}
			
			if( addr >= node.data.addr && addr < node.data.getNextAddr() ){
				return node.data;
			}
		}
		
		return null;
	}
	
	add( data ){
		let node = this.size ?
			this.next.insert( data ) : 
			new Node( data, null, null );
			
		// If it's the first node, then update
		if( !node.prev ){
			this.next = node;
		}
		// If it's the last node, then update
		if( !node.next ){
			this.prev = node;
		}
		
		this.size++;
	}
	
	[Symbol.iterator](){
		let node = this;
		
		return {
			next(){
				node = node.next;
				
				return node ?
					{ value : node.data, done : false } :
					{ done : true }
			}
		}
	}
}

class Node {
	constructor( data, prev, next ){
		this.data = data;
		this.prev = prev;
		this.next = next;
	}
	insert( data ){
		// If the new addr is earlier than this address, then insert before
		if( data.addr < this.data.addr ){
			return this.insertBefore( data );
		}
		// If there is a subsequent node, test that one
		else if( this.next ){
			return this.next.insert( data );
		}
		else{
			return this.insertAfter( data );
		}
	}
	insertAfter( data ){
		let node = new Node( data, this, this.next );
		if( this.next ){
			this.next.prev = node;
		}
		this.next = node;
		return node;
	}
	insertBefore( data ){
		let node = new Node( data, this.prev, this );
		if( this.prev ){
			this.prev.next = node;
		}
		this.prev = node;
		return node;
	}
}

module.exports = OrderedList;