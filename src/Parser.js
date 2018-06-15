let Routine = require('./Routine'),
	OpCodes = require('./OpCodes'),
	Ref = require('./Ref'),
	Address = require('./Address'),
	Warning = require('./Warning');

// To parse for a specific routine chain
class Parser {
	constructor( disassembly, addr ){
		this.disassembly = disassembly;
		
		// Pull some data from the disassembly
		this.ROM = disassembly.ROM;

		this.ROMRefs = disassembly.ROMRefs;
		this.RAMRefs = disassembly.RAMRefs;
		
		this.ParsedRoutines = disassembly.ParsedRoutines;
		this.RoutinesToParse = disassembly.RoutinesToParse;
		
		// Initialize routine specific data
		this.InternalRefs = new Ref.Map();
		
		// Map containing every reference location for each internal ref
		this.InternalReferenceLocations = new Map();
		
		// Initialize the parser data
		this.index = addr;
		
		// If in bank 0, then set to the input home bank
		this.bank = Math.floor( addr / 0x4000 ) || disassembly.homeRefBank;
		this.bank_start = this.bank * 0x4000;
		
		// Flag to indicate that this routine falls into a new main routine
		this.doForkExternal = false;
		
		// Create the head Routine node
		this.Head = this.Routine = new Routine( this, addr );
		
		// Begin parsing
		this.parse();
		
		// Extract the data
		this.finalize();

		// If this is a Main Fork, then create a new parser
		if( this.doForkExternal ){
			new Parser( this.disassembly, this.index );
		}
	}
	
	parse(){
		let opCode;
		do {
			opCode = this.ROM[this.index];
		} while( this.handleNextOpCode( opCode ) && this.handleNextIndex( opCode ) );
	}
	
	// Get the Internal Reference Location set for the given address or create one if it doesnt exist
	getInternalReferenceLocations( addr ){
		if( this.InternalReferenceLocations.has(addr) ){
			return this.InternalReferenceLocations.get(addr);
		}
		else{
			let set = new Set();
			this.InternalReferenceLocations.set(addr, set);
			return set;
		}
	}
	
	// To read the given amount of bytes as a number
	readNumber( size ){
		let num = 0;
		
		switch( size ){
			case 2:
				num += this.ROM[this.index+2] * 0x100;
			case 1:
				num += this.ROM[this.index+1];
		}
		
		return num;
	}
	
	// To get the name (if it exists) or bank string for the given address
	getDesc( addr ){
		return this.ROMRefs.IndexToName.has( addr ) ?
				this.ROMRefs.IndexToName.get( addr )[0] :
				Address.toBankString( addr, 'rom' );
	}
	
	// To see if a known address falls within the middle of the next opcode
	hasIntermediateRef( size ){
		while(size){
			let addr = this.index + size;
			if( this.ROMRefs.has( addr ) ){
				let type = this.ROMRefs.get(addr);
				
				// If the addr is already known to be faulty, then do nothing
				if( Ref.isFaulty(type) ){
					continue;
				}
				// If the addr is MAYBE, upgrade it to a Faulty Maybe and continue
				else if( type === Ref.MAYBE ){
					this.ROMRefs.setFaulty( addr, type );
					continue;
				}
				
				// Otherwise, stop parsing
				let thisName = this.getDesc( this.Head.addr ),
					otherName = this.getDesc( addr );
						
				Warning('Unable to finish parsing ' + thisName + ' because known address ' + otherName + ' intersects an opcode');
				
				return true;
			}
			size--;
		}
		return false;
	}
	
	handleNextOpCode( opCode ){
		let data = OpCodes[ opCode ];
	
		// Exit if the end of the rom is reached
		if( this.index + data.size >= this.ROM.length ){
			Warning('End of ROM reached while parsing ' + this.getDesc(this.Head.addr) );
			return false;
		}
		
		// Exit if this falls into another bank
		if( this.index % 0x4000  + data.size > 0x4000 ){
			Warning('End of bank reached while parsing ' + this.getDesc(this.Head.addr) );
			return false;
		}
	
		// Exit if another reference refers to the middle of this op-code
		if( this.hasIntermediateRef( data.size ) ){
			return false;
		}
		
		// Pass the argument into the OpCode handler
		let value = this.readNumber( data.size ),
			result = data.handler( value, this.bank_start, this.index );
			
		// Store the result
		this.Routine.addOutput( result, this.index );
		
		// If the result has data:
		if( result instanceof Object ){
			if( result.addr.type === 'ram' ){
				this.handleRAMReference( result.addr.addr, result.type );
			}
			else{
				this.handleROMReference( result.addr.addr, result.type );
			}
		}
		
		// Increase the index
		this.index += data.size + 1;
		
		return true;
	}
	
	trySplitExternal( addr, type ){
		return this.disassembly.trySplitExternal(addr, type, this.index);
	}
	
	handleRAMReference( addr, type ){
		this.RAMRefs.set( addr, type );
	}
	
	handleROMReference( addr, type ){
		// Add the source index to the IntenalReferenceLocations map
		this.getInternalReferenceLocations( addr ).add( this.index );
		
		// Already referenced externally, make sure its at least the given type
		if( this.ROMRefs.has(addr) ){
			if( this.ROMRefs.get(addr) === Ref.SUB ){
				this.disassembly.upgradeExternal(addr);
			}
			else {
				// Set the type (will upgrade if it is a lower type)
				this.ROMRefs.set( addr, type );
				
				// Add to routines to parse if it's referenced as an EXEC
				if( type === Ref.EXEC ){
					this.RoutinesToParse.add(addr);
				}
			}
			return;
		}
		// If already referenced internally, then update
		else if( this.InternalRefs.has(addr) ){
			this.InternalRefs.set(addr, type);
		}
		// If this lies within this current routine chain, then split
		else if( this.trySplitInternal( addr, type ) ){
			return;
		}
		// If this address lies within a previously parsed routine, then split that
		else if( this.trySplitExternal( addr, type ) ){
			return;
		}
		// Otherwise, add/upgrade the internal list
		else{
			this.InternalRefs.set( addr, type );
		}
	}
		
	// To try to Split a Node within this chain
	trySplitInternal( addr, type ){
		if( this.Head.addr < addr && this.index >= addr ){
			// Traverse the routine chain and split the appropriate node
			let node = this.Routine.split( addr, type, this.index );
			
			// If a node was successfully split:
			if( node ){
				// If the node is the tail node, then set it as the current Routine
				if( node.isTail() ){
					this.Routine = node;
				}
			}
			// If no node was found, then this points to an intra-opcode address, so store a faulty
			else{
				this.ROMRefs.setFaulty( addr, type );
			}
			
			return true;
		}
		return false;
	}
	
	handleNextIndex( opCode ){
		let external_ref = this.ROMRefs.get(this.index),
			internal_ref = this.InternalRefs.get(this.index);
		
		// If ret, jp, jr, jp [hl], then the routine is finished
		// Unless this index is an internal execution reference
		if( internal_ref !== Ref.EXEC && 
			(opCode === 0xC9 || opCode === 0xC3 || opCode === 0x18 || opCode === 0xE9) ){
			return false;
		}
		
		// Exit if the end of the rom is reached
		else if( this.index === this.ROM.length ){
			Warning('End of ROM reached while parsing ' + this.getDesc(this.Head.addr) );
			return false;
		}
		
		// Exit if this falls into another bank
		else if( this.index % 0x4000 === 0 ){
			Warning('End of bank reached while parsing ' + this.getDesc(this.Head.addr) );
			return false;
		}
		
		// If it was referenced internally by any means, then fork as a sub routine
		else if( internal_ref ){
			this.Routine = this.Routine.fork( this.index );
		}
		
		// If it was referenced externally by any means, then fork as a main routine
		else if( external_ref ){
			// Only fork if it has not already been parsed
			if( external_ref !== Ref.MAIN ){
				this.doForkExternal = true;
			}
			return false;
		}
		
		return true;
	}
	
	finalize(){
		this.Routine.close( this.index );
		
		for(let [addr, type] of this.InternalRefs){
			this.ROMRefs.set(addr, type)
		
			if( type === Ref.EXEC ){
				this.RoutinesToParse.add(addr);
			}
		}
		
		this.ParsedRoutines.add( this.Head );
		this.disassembly.ShimOnlyROMNames.delete( this.Head.addr );
	}
}

module.exports = Parser;