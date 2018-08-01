let Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

class Routine {
	constructor( parser, addr, prev = null, next = null ){
		
		this.parser = parser;
		this.addr = addr;
		this.prev = prev;
		this.next = next;
		
		// Get the set containing the locations of each time this node was referenced
		this.internal_ref_locs = parser.getInternalReferenceLocations(addr);
				
		// Initialize some data
		this.outputs = [];
		this.indices = [];
		
		if( prev ){		
			prev.next = this;
			parser.InternalRefs.set( addr, Ref.SUB );		
		}
		else{	
			parser.ROMRefs.set( addr, Ref.MAIN );	
			parser.InternalRefs.set( addr, Ref.MAIN );
		}
		
		if( next ){
			next.prev = this;
		}
		
	}
	
	isHead(){
		return !this.prev;
	}
	
	isTail(){
		return !this.next;
	}
	
	getHead(){
		return this.isHead() ? this : this.prev.getHead();
	}
	
	getTail(){
		return this.isTail() ? this : this.next.getTail();
	}
	
	addOutput( fn, index ){
		this.outputs.push( fn );
		this.indices.push( index );
	}
	
	// To upgrade this node
	upgrade(){	
	
		// Store the old prev
		let oldPrev = this.prev;
		
		// Disconnect from previous
		this.prev.next = null;
		this.prev = null;
	
		// Add it to the ParsedRoutines
		this.parser.ParsedRoutines.add( this );
		this.parser.disassembly.ShimOnlyROMNames.delete( this.getHead().addr );
		
		// Set the new type
		this.parser.ROMRefs.set( this.addr, Ref.MAIN );
		
		// See if any previous child nodes need to be updated (except the head)
		if( oldPrev && !oldPrev.isHead() ){
			oldPrev.checkUpgradeBackwards( this.addr );
		}
		
		// See if any subsequent child nodes need to be updated
		if( !this.isTail() ){
			this.next.checkUpgradeForwards( this.addr );
		}
		
	}
	
	// To see if this needs to be upgraded
	checkUpgradeForwards( new_start_addr ){
	
		for(let addr of this.internal_ref_locs){
			// If the reference location is earlier than the new routine start address, then upgrade this node
			if( addr < new_start_addr ){
				return this.upgrade();
			}
		}
		
		// See if any subsequent child nodes need to be updated
		if( !this.isTail() ){
			return this.next.checkUpgradeForwards( new_start_addr );
		}
	}
	
	// To see if this needs to be upgraded
	checkUpgradeBackwards( new_end_addr ){
	
		for(let addr of this.internal_ref_locs){
			// If the reference location is earlier than the new routine start address, then upgrade this node
			if( addr >= new_end_addr ){
				return this.upgrade();
			}
		}
		
		// See if any previous child nodes need to be updated (except the head)
		if( !this.isHead() && !this.prev.isHead() ){
			this.prev.checkUpgradeBackwards( new_end_addr );
		}
	}
	
	// To split this routine
	split( addr, type, index ){
		// If the addr lies within this block, then split
		// Since it starts from the tail of the chain, no need to test '>'
		if( this.addr < addr ){
			let i = this.indices.indexOf( addr );
			
			// If the addr is not within the list of indices, then it lies within an OpCode
			if( i < 0 ){
				// Display a warning if the type isn't a MAYBE (if it's MAYBE, this could just be a coincidence)
				if( type !== Ref.MAYBE ){	
					if( index === null ){
						let name = this.parser.getDesc( addr );
							
						Warning('Input address ' + name + ' points to the middle of an opcode' )
					}
					else{
						Warning('Reference to ' + Address.toHexString( addr, 'rom' ) + ' at ' + Address.toBankString(index, 'rom') + ' points to the middle of an opcode' )
					}
				}
				return null;
			}
			// Otherwise, Split
			else{
				let node = new Routine( this.parser, addr, this, this.next );
				
				// Transfer some data from this node
				node.outputs = this.outputs.splice(i);
				node.indices = this.indices.splice(i);
				node.after_addr = this.after_addr;
				
				// Update the after address for this node
				this.close( addr );
				
				return node;
			}
		}
		else{
			// This is only called when the addr is known to lie within this routine
			// So no need to verify that this.prev exists
			return this.prev.split( addr, type, index );
		}
	}
	
	fork( addr ){
		this.close( addr );
		return new Routine( this.parser, addr, this );
	}
	
	close( addr ){
		this.after_addr = addr;
	}
	
	compile( dis, asm ){
		if( this.isHead() ){
			// If it's the head, write all labels
			let labels = dis.getName( this.addr, 'rom', true );
			
			labels.forEach( (x,i) => {
				let label = x + ':';
				if( i === 0 ){
					label += ' ; ' + Address.toBankString( this.addr, 'rom' );
				}
				asm.write( label + '\n' );
			})
		}
		else{
			let label = dis.getName( this.addr, 'rom' );
			asm.write( label + '\n' );
		}
		
		this.outputs.forEach( data => {
			if( typeof data === 'string' ){
				asm.write( '\t' + data + '\n' ) 
			}
			else{
				let { addr, type } = data.addr;
				asm.write( '\t' + data.str.replace('_', dis.getName(addr, type)) + '\n' ) 
			}
		})
		
		if( this.next ){
			this.next.compile( dis, asm );
		}
	}
}

module.exports = Routine;