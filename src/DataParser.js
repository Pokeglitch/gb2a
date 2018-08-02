let Data = require('./Data'),
	Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

class DataParser {
	constructor( disassembly, addr ){
		this.disassembly = disassembly;
		this.addr = addr;
		
		// Pull some data from the disassembly
		this.ROM = disassembly.ROM;
		
		// Initialize the parser data
		this.index = addr;
		this.doFork = false;
		
		this.Head = this.Data = new Data(this, addr);
		this.disassembly.ROMRefs.set(addr, Ref.DATA);
		
		// Begin parsing
		this.parse();
		
		this.finalize();
		
		if( this.doFork ){
			new DataParser( disassembly, this.index );
		}
	}
	
	parse(){
		do {
			let value = this.ROM[this.index++];
			this.Data.addContent( value );
		} while ( this.doContinue() )
	}
	
	/* Don't continue if:
		- the bank has ended
		- the address is a known address
	*/
	doContinue(){
		let ref = this.disassembly.ROMRefs.get(this.index);
		
		if( !(this.index % 0x4000) ){
			Warning(`End of bank reached while parsing table at ${ Address.toBankString(this.addr, 'rom') }`);
			return false;
		}
		
		// End if a known reference was reached
		if( ref ){
			// Fork if the reference is not from the SYM file or an input location
			if( !this.disassembly.ContentToParse.has(this.index) &&
				( ref === Ref.DATA || ref === Ref.MAYBE ) ){
				this.doFork = true;
			}
			return false;
		}
		
		return true;
	}
	
	finalize(){
		this.Data.close( this.index );
		this.Head.store();
	}
}

module.exports = DataParser;