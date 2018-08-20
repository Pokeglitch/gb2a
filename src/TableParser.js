let Table = require('./Table'),
	Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

class TableParser {
	constructor( disassembly, addr ){
		this.disassembly = disassembly;
		this.addr = addr;
		
		// Pull some data from the disassembly
		this.ROM = disassembly.ROM;
		
		// Initialize the parser data
		this.index = addr;
		
		// If in bank 0, then set to the input home bank
		this.bank = Math.floor( addr / 0x4000 ) || disassembly.homeRefBank;
		this.bank_start = this.bank * 0x4000;
		
		this.doFork = false;
		
		this.Head = this.Table = new Table(this, addr);
		this.disassembly.ROMRefs.set(addr, Ref.DATA);
		
		// Begin parsing
		this.parse();
		
		this.finalize();
		
		if( this.doFork ){
			new TableParser( disassembly, this.index );
		}
	}
	
	parse(){
		do {
			this.parsePointer();
		} while ( this.doContinue() )
	}
	
	parsePointer(){
		let addr = this.ROM[this.index++];
		addr += 0x100 * this.ROM[this.index++];
		
		if( addr >= 0x4000 ){
			addr = this.bank_start + addr - 0x4000;
		}
		
		this.Table.addContent(addr);
		this.disassembly.ROMRefs.set( addr, Ref.EXEC );
		this.disassembly.RoutinesToParse.add(addr);
		this.disassembly.ContentToParse.add(addr);
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
		this.Table.close( this.index );
		this.Head.store();
	}
}

module.exports = TableParser;